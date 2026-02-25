"""
Pipecat-based AI Interview Agent.

Conducts live video interviews with candidates using voice:
1. Listens to candidate audio via Deepgram STT
2. Processes conversation with Claude (Anthropic LLM)
3. Responds with natural voice via ElevenLabs TTS
4. Communicates via LiveKit WebRTC transport
"""

import asyncio
import time
import structlog
from typing import Optional, List, Dict

from app.core.config import settings

logger = structlog.get_logger()

# --- Fix: Increase BOT_VAD_STOP_SECS from 0.35s to 2.0s ---
# Pipecat's default (0.35s) is too aggressive for streaming TTS.
# If the TTS WebSocket takes >350ms between audio chunks (common with
# ElevenLabs, especially on Free tier), the transport declares the bot
# "stopped speaking" and discards the remaining audio buffer.
# 2.0s gives the TTS enough headroom for network jitter and TTFB latency.
try:
    from pipecat.transports import base_output as _pipecat_base_output
    _ORIGINAL_VAD_STOP = _pipecat_base_output.BOT_VAD_STOP_SECS
    _pipecat_base_output.BOT_VAD_STOP_SECS = 2.0
    logger.info(
        "pipecat_vad_patched",
        original=_ORIGINAL_VAD_STOP,
        new=_pipecat_base_output.BOT_VAD_STOP_SECS,
    )
except (ImportError, AttributeError):
    pass


class AudioDiagnosticProcessor:
    """
    Diagnostic frame processor inserted between TTS and Transport output.
    Logs every audio frame to help debug audio cutoff issues.

    Enable with AUDIO_DIAG=1 environment variable.
    """

    _enabled: bool = False
    _frame_count: int = 0
    _total_audio_bytes: int = 0
    _first_frame_time: float = 0.0
    _last_frame_time: float = 0.0
    _gap_warnings: int = 0

    @classmethod
    def create(cls) -> Optional["_AudioDiagFrameProcessor"]:
        """Create the processor if diagnostics are enabled."""
        import os
        if not os.environ.get("AUDIO_DIAG"):
            return None
        try:
            from pipecat.processors.frame_processor import FrameProcessor
            from pipecat.frames.frames import (
                Frame,
                TTSAudioRawFrame,
                TTSStartedFrame,
                TTSStoppedFrame,
                BotStartedSpeakingFrame,
                BotStoppedSpeakingFrame,
            )
            from pipecat.processors.frame_processor import FrameDirection
        except ImportError:
            return None

        diag = cls

        class _AudioDiagFrameProcessor(FrameProcessor):
            def __init__(self) -> None:
                super().__init__(name="AudioDiagnostic")

            async def process_frame(
                self, frame: Frame, direction: FrameDirection
            ) -> None:
                await super().process_frame(frame, direction)
                now = time.time()

                if isinstance(frame, TTSStartedFrame):
                    diag._frame_count = 0
                    diag._total_audio_bytes = 0
                    diag._first_frame_time = now
                    diag._last_frame_time = now
                    diag._gap_warnings = 0
                    logger.info("diag_tts_started")

                elif isinstance(frame, TTSAudioRawFrame):
                    gap = now - diag._last_frame_time
                    diag._frame_count += 1
                    diag._total_audio_bytes += len(frame.audio)
                    duration_ms = (
                        len(frame.audio)
                        / (frame.sample_rate * 2)  # 16-bit = 2 bytes/sample
                        * 1000
                    )

                    if gap > 0.3:
                        diag._gap_warnings += 1
                        logger.warning(
                            "diag_audio_gap",
                            gap_ms=round(gap * 1000, 1),
                            frame_num=diag._frame_count,
                        )

                    if diag._frame_count <= 5 or diag._frame_count % 50 == 0:
                        logger.info(
                            "diag_tts_audio_frame",
                            frame_num=diag._frame_count,
                            audio_bytes=len(frame.audio),
                            duration_ms=round(duration_ms, 1),
                            sample_rate=frame.sample_rate,
                            gap_ms=round(gap * 1000, 1),
                        )
                    diag._last_frame_time = now

                elif isinstance(frame, TTSStoppedFrame):
                    elapsed = now - diag._first_frame_time
                    total_audio_secs = (
                        diag._total_audio_bytes / 48000  # 24kHz * 2 bytes
                    )
                    logger.info(
                        "diag_tts_stopped",
                        total_frames=diag._frame_count,
                        total_audio_bytes=diag._total_audio_bytes,
                        total_audio_secs=round(total_audio_secs, 2),
                        elapsed_secs=round(elapsed, 2),
                        gap_warnings=diag._gap_warnings,
                    )

                elif isinstance(frame, BotStartedSpeakingFrame):
                    logger.info("diag_bot_started_speaking", time=now)

                elif isinstance(frame, BotStoppedSpeakingFrame):
                    logger.info("diag_bot_stopped_speaking", time=now)

                await self.push_frame(frame, direction)

        return _AudioDiagFrameProcessor()


class InterviewAgent:
    """
    AI-powered interview agent that conducts live video interviews.

    Uses Pipecat pipeline:
    Audio In -> Deepgram STT -> Claude LLM -> ElevenLabs TTS -> Audio Out
    """

    def __init__(
        self,
        room_name: str,
        job_title: str,
        job_description: str,
        candidate_name: str,
        candidate_cv_summary: Optional[str] = None,
        num_questions: int = 5,
    ) -> None:
        self.room_name = room_name
        self.job_title = job_title
        self.job_description = job_description
        self.candidate_name = candidate_name
        self.candidate_cv_summary = candidate_cv_summary
        self.num_questions = num_questions

        # Interview state
        self.questions_asked = 0
        self.conversation_history: List[Dict[str, str]] = []
        self.transcript: List[Dict[str, str]] = []

    def _build_system_prompt(self) -> str:
        """Build the system prompt for the AI interviewer."""
        cv_context = ""
        if self.candidate_cv_summary:
            cv_context = f"""
## Candidate Background (from CV)
{self.candidate_cv_summary}

Use this information to ask relevant follow-up questions about their experience.
"""

        return f"""You are an AI interviewer conducting a video interview for TalentOS.

## Your Role
- Professional, friendly, and encouraging interviewer
- Ask {self.num_questions} questions total, one at a time
- Listen carefully and ask relevant follow-ups
- Keep responses concise (2-3 sentences max for speaking)

## Interview Details
- Position: {self.job_title}
- Job Description: {self.job_description}
{cv_context}

## Interview Structure
1. Greeting and introduction (brief, warm)
2. Technical/role-specific questions
3. Behavioral questions (STAR format)
4. Questions about their experience
5. Closing (thank them, explain next steps)

## Guidelines
- Speak naturally as if having a conversation
- If the candidate gives a short answer, probe deeper
- Be encouraging: "That's interesting", "Great example"
- Don't repeat what the candidate said back to them
- Keep track of questions asked and smoothly transition
- Speak in Spanish (the platform is for LATAM)

## Current State
Questions asked so far: {self.questions_asked}/{self.num_questions}

When you've asked all questions, thank the candidate and end the interview naturally.
"""

    async def run(self) -> Dict[str, object]:
        """
        Start the interview agent pipeline.

        Imports pipecat modules lazily to avoid import errors
        when pipecat is not installed (graceful degradation).

        Returns:
            Dict with transcript, questions_asked, and status
        """
        try:
            from pipecat.frames.frames import LLMMessagesFrame
            from pipecat.pipeline.pipeline import Pipeline
            from pipecat.pipeline.task import PipelineTask
            from pipecat.services.deepgram import DeepgramSTTService
            from pipecat.services.elevenlabs import ElevenLabsTTSService
            from pipecat.services.anthropic import AnthropicLLMService
            from pipecat.transports.services.livekit import LiveKitTransport
        except ImportError as e:
            logger.error(
                "pipecat_import_error",
                error=str(e),
                message="Pipecat packages not installed. Install with: "
                "pip install pipecat-ai[livekit,deepgram,anthropic,elevenlabs]",
            )
            raise RuntimeError(f"Pipecat not installed: {e}") from e

        # Initialize transport
        transport = LiveKitTransport(
            url=settings.livekit_url or "",
            api_key=settings.livekit_api_key or "",
            api_secret=settings.livekit_api_secret or "",
            room_name=self.room_name,
            participant_identity="ai-interviewer",
            participant_name="AI Interviewer",
        )

        # Initialize STT (Speech-to-Text)
        stt = DeepgramSTTService(
            api_key=settings.deepgram_api_key or "",
            language="es",  # Spanish for LATAM
        )

        # Initialize LLM
        llm = AnthropicLLMService(
            api_key=settings.llm_api_key or "",
            model="claude-sonnet-4-20250514",
        )

        # Initialize TTS (Text-to-Speech)
        tts = ElevenLabsTTSService(
            api_key=settings.elevenlabs_api_key or "",
            voice_id=settings.elevenlabs_voice_id,
        )

        # Build pipeline: Audio In -> STT -> LLM -> TTS -> [Diagnostic] -> Audio Out
        pipeline_processors = [
            transport.input(),  # Receive audio from candidate
            stt,  # Speech to text
            llm,  # Claude processes and responds
            tts,  # Text to speech
        ]

        diag_processor = AudioDiagnosticProcessor.create()
        if diag_processor:
            pipeline_processors.append(diag_processor)
            logger.info("audio_diagnostic_enabled")

        pipeline_processors.append(transport.output())  # Send audio back

        pipeline = Pipeline(pipeline_processors)

        # Set initial context with greeting
        messages = [
            {"role": "system", "content": self._build_system_prompt()},
            {
                "role": "assistant",
                "content": (
                    f"Hola {self.candidate_name}! Soy tu entrevistador "
                    f"virtual de TalentOS. Gracias por tomarte el tiempo "
                    f"para esta entrevista para el puesto de {self.job_title}. "
                    f"Estas listo para comenzar?"
                ),
            },
        ]

        task = PipelineTask(pipeline)

        # Start with greeting
        await task.queue_frame(LLMMessagesFrame(messages))

        logger.info(
            "interview_agent_started",
            room=self.room_name,
            job_title=self.job_title,
            candidate=self.candidate_name,
        )

        # Run until interview complete
        await task.run()

        logger.info(
            "interview_agent_completed",
            room=self.room_name,
            questions_asked=self.questions_asked,
        )

        return {
            "transcript": self.transcript,
            "questions_asked": self.questions_asked,
            "status": "completed",
        }
