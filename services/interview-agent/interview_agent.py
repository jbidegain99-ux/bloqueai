"""
Pipecat-based AI Interview Agent.

Conducts live video interviews with candidates using voice:
1. Listens to candidate audio via Deepgram STT
2. Processes conversation with OpenAI LLM
3. Responds with natural voice via ElevenLabs TTS
4. Communicates via LiveKit WebRTC transport
"""

import asyncio
import time
import traceback
from datetime import datetime, timezone
import structlog
from typing import Optional, List, Dict

from config import settings

logger = structlog.get_logger()

# Verify pipecat is importable at module load time
try:
    import pipecat  # noqa: F401
    logger.info("pipecat_available", version=getattr(pipecat, "__version__", "unknown"))
except ImportError as e:
    logger.error("pipecat_not_installed", error=str(e))

# --- Monkey-patch BOT_VAD_STOP_SECS para dar más tiempo al TTS ---
# Pipecat's default (0.35s) kills audio if ElevenLabs takes >350ms between chunks.
try:
    import pipecat.transports.base_output as _base_output
    _original_vad_stop = getattr(_base_output, "BOT_VAD_STOP_SECS", 0.35)
    _base_output.BOT_VAD_STOP_SECS = 2.0
    logger.info("pipecat_vad_patched", original=_original_vad_stop, new=2.0)
except (ImportError, AttributeError):
    pass

# --- Monkey-patch AUDIO_CONTEXT_TIMEOUT from 3s to 10s ---
# ElevenLabs Free tier TTFB can exceed 3s. The hardcoded 3s timeout in
# _handle_audio_context() abandons the context before audio arrives.
# We patch the method to use a longer timeout.
try:
    import pipecat.services.tts_service as _tts_svc
    _orig_handle = _tts_svc.AudioContextTTSService._handle_audio_context

    async def _patched_handle_audio_context(self, context_id):
        """Patched version with 10s timeout instead of 3s."""
        import asyncio as _asyncio
        AUDIO_CONTEXT_TIMEOUT = 10.0
        queue = self._contexts[context_id]
        running = True
        while running:
            try:
                frame = await _asyncio.wait_for(queue.get(), timeout=AUDIO_CONTEXT_TIMEOUT)
                if frame is _tts_svc.AudioContextTTSService._CONTEXT_KEEPALIVE:
                    continue
                if frame:
                    await self.push_frame(frame)
                running = frame is not None
            except _asyncio.TimeoutError:
                break

    _tts_svc.AudioContextTTSService._handle_audio_context = _patched_handle_audio_context
    logger.info("pipecat_audio_context_timeout_patched", new_timeout=10.0)
except (ImportError, AttributeError) as e:
    logger.warning("pipecat_audio_context_patch_failed", error=str(e))

# --- Note: _receive_messages monkey-patch REMOVED ---
# The previous patch replaced ElevenLabs' _receive_messages to add error logging,
# but it likely broke the audio flow (no elevenlabs_audio_chunk logs appeared,
# suggesting the patched method was crashing silently). The timeout patches above
# are sufficient. ElevenLabs errors will surface through Pipecat's own logging.


def _create_audio_diagnostic_processor() -> Optional[object]:
    """Create a FrameProcessor that logs every frame between TTS and Output.

    Returns None if pipecat isn't available.
    """
    try:
        from pipecat.processors.frame_processor import FrameProcessor, FrameDirection
        from pipecat.frames.frames import (
            Frame,
            TTSAudioRawFrame,
            TTSStartedFrame,
            TTSStoppedFrame,
            OutputAudioRawFrame,
            BotStartedSpeakingFrame,
            BotStoppedSpeakingFrame,
            InterruptionFrame,
            TTSSpeakFrame,
        )
    except ImportError:
        return None

    class AudioDiagnosticProcessor(FrameProcessor):
        def __init__(self) -> None:
            super().__init__(name="AudioDiag")
            self._frame_count = 0
            self._audio_bytes = 0
            self._first_time = 0.0
            self._last_time = 0.0

        async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
            await super().process_frame(frame, direction)
            now = time.time()

            if isinstance(frame, TTSSpeakFrame):
                logger.info("diag_tts_speak_frame", text=getattr(frame, "text", "")[:80])

            elif isinstance(frame, TTSStartedFrame):
                self._frame_count = 0
                self._audio_bytes = 0
                self._first_time = now
                self._last_time = now
                logger.info("diag_tts_started")

            elif isinstance(frame, TTSAudioRawFrame):
                gap = now - self._last_time if self._last_time else 0
                self._frame_count += 1
                self._audio_bytes += len(frame.audio)
                audio_duration_ms = len(frame.audio) / (frame.sample_rate * 2) * 1000

                if self._frame_count <= 3 or self._frame_count % 25 == 0 or gap > 0.3:
                    logger.info(
                        "diag_tts_audio",
                        n=self._frame_count,
                        bytes=len(frame.audio),
                        dur_ms=round(audio_duration_ms, 1),
                        sr=frame.sample_rate,
                        gap_ms=round(gap * 1000, 1),
                        total_bytes=self._audio_bytes,
                    )
                self._last_time = now

            elif isinstance(frame, TTSStoppedFrame):
                elapsed = now - self._first_time if self._first_time else 0
                logger.info(
                    "diag_tts_stopped",
                    total_frames=self._frame_count,
                    total_bytes=self._audio_bytes,
                    audio_secs=round(self._audio_bytes / 48000, 2),
                    elapsed_secs=round(elapsed, 2),
                )

            elif isinstance(frame, BotStartedSpeakingFrame):
                logger.info("diag_bot_started_speaking")

            elif isinstance(frame, BotStoppedSpeakingFrame):
                logger.info("diag_bot_stopped_speaking")

            elif isinstance(frame, InterruptionFrame):
                logger.warning("diag_interruption_frame")

            await self.push_frame(frame, direction)

    return AudioDiagnosticProcessor()


def _create_transcript_tracker(agent: "InterviewAgent") -> Optional[object]:
    """Create a FrameProcessor that logs user transcriptions and LLM responses.

    Returns None if pipecat isn't available.
    """
    try:
        from pipecat.processors.frame_processor import FrameProcessor, FrameDirection
        from pipecat.frames.frames import (
            Frame,
            TranscriptionFrame,
            TextFrame,
        )
    except ImportError:
        return None

    class TranscriptTracker(FrameProcessor):
        """Tracks conversation transcript and question count."""

        def __init__(self, interview_agent: "InterviewAgent") -> None:
            super().__init__(name="TranscriptTracker")
            self._agent = interview_agent

        async def process_frame(self, frame: Frame, direction: FrameDirection) -> None:
            await super().process_frame(frame, direction)

            if isinstance(frame, TranscriptionFrame):
                text = frame.text.strip()
                if text:
                    self._agent.transcript.append({
                        "role": "user",
                        "content": text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    logger.info(
                        "transcript_user",
                        text=text[:120],
                        total_entries=len(self._agent.transcript),
                    )

            elif isinstance(frame, TextFrame):
                text = frame.text.strip()
                if text:
                    self._agent.transcript.append({
                        "role": "assistant",
                        "content": text,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
                    # Count questions by looking for "?" in assistant responses
                    if "?" in text:
                        self._agent.questions_asked += 1
                        logger.info(
                            "transcript_assistant_question",
                            text=text[:120],
                            questions_asked=self._agent.questions_asked,
                            total_questions=self._agent.num_questions,
                        )

            await self.push_frame(frame, direction)

    return TranscriptTracker(agent)


class InterviewAgent:
    """
    AI-powered interview agent that conducts live video interviews.

    Uses Pipecat pipeline:
    Audio In -> Deepgram STT -> LLM Context -> OpenAI LLM -> ElevenLabs TTS -> Audio Out
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

        return f"""Eres Valentina, una entrevistadora virtual de TalentOS.
Estás conduciendo una entrevista en vivo por video.

## Tu Rol
- Entrevistadora profesional, amigable y motivadora
- Haz {self.num_questions} preguntas en total, una a la vez
- Escucha atentamente y haz seguimientos relevantes
- Responde de forma concisa (2-3 oraciones máximo por turno)

## Detalles del Puesto
- Posición: {self.job_title}
- Descripción: {self.job_description}
{cv_context}

## Estructura de la Entrevista
1. El saludo inicial ya fue dado. Empieza directamente con preguntas.
2. Preguntas técnicas/específicas del rol
3. Preguntas conductuales (formato STAR)
4. Preguntas sobre su experiencia
5. Cierre (agradece y explica próximos pasos)

## Reglas Importantes
- SIEMPRE habla en español
- Habla naturalmente como en una conversación real
- Si el candidato da una respuesta corta, profundiza
- Sé motivador: "Interesante", "Buen ejemplo", "Me gusta esa experiencia"
- NO repitas lo que el candidato dijo
- Cada respuesta tuya DEBE terminar con una pregunta para mantener la conversación
- Si el candidato no responde o parece confundido, reformula la pregunta de forma más simple
- Si no escuchas bien, di "Disculpa, no te escuché bien. ¿Podrías repetirlo?"

## Estado Actual
Preguntas hechas: {self.questions_asked}/{self.num_questions}

Cuando hayas hecho todas las preguntas, agradece al candidato y despídete naturalmente.
"""

    async def run(self) -> Dict[str, object]:
        """
        Start the interview agent pipeline.

        Returns:
            Dict with transcript, questions_asked, and status
        """
        logger.info(
            "agent_run_starting",
            room=self.room_name,
            candidate=self.candidate_name,
            job_title=self.job_title,
        )

        # --- Import pipecat modules ---
        try:
            logger.info("agent_importing_pipecat")
            from pipecat.audio.vad.silero import SileroVADAnalyzer
            from pipecat.frames.frames import TTSSpeakFrame
            from pipecat.pipeline.pipeline import Pipeline
            from pipecat.pipeline.runner import PipelineRunner
            from pipecat.pipeline.task import PipelineParams, PipelineTask
            from pipecat.processors.aggregators.llm_context import LLMContext
            from pipecat.processors.aggregators.llm_response_universal import (
                LLMContextAggregatorPair,
                LLMUserAggregatorParams,
            )
            from pipecat.services.deepgram.stt import DeepgramSTTService
            from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
            from pipecat.transcriptions.language import Language
            from pipecat.services.openai.llm import OpenAILLMService
            from pipecat.transports.livekit.transport import LiveKitParams, LiveKitTransport
            from livekit import api as livekit_api
            logger.info("agent_pipecat_imported_ok")
        except ImportError as e:
            tb = traceback.format_exc()
            logger.error(
                "pipecat_import_error",
                error=str(e),
                traceback=tb,
            )
            raise RuntimeError(f"Pipecat not installed: {e}") from e

        # --- Generate LiveKit token for the agent ---
        logger.info(
            "agent_generating_livekit_token",
            room=self.room_name,
            livekit_url=settings.livekit_url,
            has_api_key=bool(settings.livekit_api_key),
            has_api_secret=bool(settings.livekit_api_secret),
        )

        try:
            token = (
                livekit_api.AccessToken(
                    settings.livekit_api_key,
                    settings.livekit_api_secret,
                )
                .with_identity("ai-interviewer")
                .with_name("AI Interviewer")
                .with_grants(
                    livekit_api.VideoGrants(room_join=True, room=self.room_name)
                )
                .to_jwt()
            )
            logger.info("agent_livekit_token_generated")
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(
                "agent_livekit_token_error",
                error=str(e),
                error_type=type(e).__name__,
                traceback=tb,
            )
            raise

        # --- Initialize LiveKit transport ---
        try:
            transport = LiveKitTransport(
                url=settings.livekit_url,
                token=token,
                room_name=self.room_name,
                params=LiveKitParams(
                    audio_in_enabled=True,
                    audio_out_enabled=True,
                ),
            )
            logger.info("agent_livekit_transport_created")
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(
                "agent_livekit_transport_error",
                error=str(e),
                error_type=type(e).__name__,
                traceback=tb,
            )
            raise

        # --- Initialize services ---
        logger.info("agent_initializing_services")

        try:
            stt = DeepgramSTTService(
                api_key=settings.deepgram_api_key,
                language="es",  # Spanish for LATAM
            )
            logger.info("agent_deepgram_ok", has_key=bool(settings.deepgram_api_key))

            llm = OpenAILLMService(
                api_key=settings.llm_api_key,
                model="gpt-4o-mini",
            )
            logger.info("agent_openai_ok", has_key=bool(settings.llm_api_key))

            tts = ElevenLabsTTSService(
                model="eleven_multilingual_v2",
                api_key=settings.elevenlabs_api_key,
                voice_id=settings.elevenlabs_voice_id,
                # ElevenLabs Free tier TTFB can be 3-10s. Default timeout (2s)
                # fires TTSStoppedFrame before audio arrives, killing playback.
                stop_frame_timeout_s=15.0,
                params=ElevenLabsTTSService.InputParams(
                    language=Language.ES,
                ),
            )
            logger.info(
                "agent_elevenlabs_ok",
                has_key=bool(settings.elevenlabs_api_key),
                voice_id=settings.elevenlabs_voice_id,
                model=getattr(tts, "model_name", getattr(tts, "_model", "eleven_multilingual_v2")),
            )
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(
                "agent_service_init_error",
                error=str(e),
                error_type=type(e).__name__,
                traceback=tb,
            )
            raise

        # --- Build LLM context with system prompt ---
        messages = [
            {"role": "system", "content": self._build_system_prompt()},
        ]
        context = LLMContext(messages)

        # Context aggregators: wire STT text into LLM context, capture LLM output
        context_aggregator = LLMContextAggregatorPair(
            context,
            user_params=LLMUserAggregatorParams(
                vad_analyzer=SileroVADAnalyzer(),
            ),
        )

        # --- Build pipeline ---
        # Order: input → STT → transcript_tracker → user_aggregator → LLM → TTS → [diag] → output → assistant_aggregator
        logger.info("agent_building_pipeline")

        diag = _create_audio_diagnostic_processor()
        if diag:
            logger.info("agent_audio_diag_enabled")

        tracker = _create_transcript_tracker(self)
        if tracker:
            logger.info("agent_transcript_tracker_enabled")

        try:
            processors = [
                transport.input(),
                stt,
            ]
            if tracker:
                processors.append(tracker)
            processors.extend([
                context_aggregator.user(),
                llm,
                tts,
            ])
            if diag:
                processors.append(diag)
            processors.append(transport.output())
            processors.append(context_aggregator.assistant())

            pipeline = Pipeline(processors)
            logger.info("agent_pipeline_built", processor_count=len(processors))
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(
                "agent_pipeline_build_error",
                error=str(e),
                error_type=type(e).__name__,
                traceback=tb,
            )
            raise

        task = PipelineTask(
            pipeline,
            params=PipelineParams(allow_interruptions=True),
        )

        # --- Greeting + first question: speak when first participant joins ---
        greeting = (
            f"¡Hola {self.candidate_name}! Soy Valentina, tu entrevistadora virtual de TalentOS. "
            f"Gracias por tomarte el tiempo para esta entrevista para el puesto de {self.job_title}. "
            f"Voy a hacerte algunas preguntas para conocerte mejor. "
            f"Para comenzar, cuéntame un poco sobre ti y tu experiencia profesional."
        )

        @transport.event_handler("on_connected")
        async def on_connected(transport_obj):
            logger.info(
                "agent_transport_connected",
                room=self.room_name,
                message="Audio track published to LiveKit",
            )

        @transport.event_handler("on_disconnected")
        async def on_disconnected(transport_obj):
            logger.info(
                "agent_transport_disconnected",
                room=self.room_name,
            )

        @transport.event_handler("on_participant_connected")
        async def on_participant_connected(transport_obj, participant_id):
            logger.info(
                "agent_participant_connected",
                participant_id=participant_id,
                room=self.room_name,
            )

        @transport.event_handler("on_audio_track_subscribed")
        async def on_audio_track_subscribed(transport_obj, participant_id):
            logger.info(
                "agent_audio_track_subscribed",
                participant_id=participant_id,
                room=self.room_name,
                message="Now receiving audio from participant",
            )

        @transport.event_handler("on_first_participant_joined")
        async def on_first_participant_joined(transport_obj, participant_id):
            logger.info(
                "agent_first_participant_joined",
                participant_id=participant_id,
                room=self.room_name,
            )
            await task.queue_frame(TTSSpeakFrame(greeting))

        logger.info(
            "agent_pipeline_running",
            room=self.room_name,
            job_title=self.job_title,
            candidate=self.candidate_name,
        )

        # --- Run via PipelineRunner (handles event loop params) ---
        runner = PipelineRunner()
        logger.info("agent_runner_starting", room=self.room_name)
        try:
            await runner.run(task)
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(
                "agent_pipeline_run_error",
                room=self.room_name,
                error=str(e),
                error_type=type(e).__name__,
                traceback=tb,
            )
            raise

        logger.info(
            "agent_pipeline_finished",
            room=self.room_name,
            questions_asked=self.questions_asked,
        )

        return {
            "transcript": self.transcript,
            "questions_asked": self.questions_asked,
            "status": "completed",
        }
