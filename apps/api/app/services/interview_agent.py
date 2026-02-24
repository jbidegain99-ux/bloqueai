"""
Pipecat-based AI Interview Agent.

Conducts live video interviews with candidates using voice:
1. Listens to candidate audio via Deepgram STT
2. Processes conversation with Claude (Anthropic LLM)
3. Responds with natural voice via ElevenLabs TTS
4. Communicates via LiveKit WebRTC transport
"""

import asyncio
import structlog
from typing import Optional, List, Dict

from app.core.config import settings

logger = structlog.get_logger()


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

        # Build pipeline: Audio In -> STT -> LLM -> TTS -> Audio Out
        pipeline = Pipeline(
            [
                transport.input(),  # Receive audio from candidate
                stt,  # Speech to text
                llm,  # Claude processes and responds
                tts,  # Text to speech
                transport.output(),  # Send audio back to candidate
            ]
        )

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
