"""
Pipecat-based AI Interview Agent.

Conducts live video interviews with candidates using voice:
1. Listens to candidate audio via Deepgram STT
2. Processes conversation with Claude (Anthropic LLM)
3. Responds with natural voice via ElevenLabs TTS
4. Communicates via LiveKit WebRTC transport
"""

import asyncio
import traceback
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
            from pipecat.frames.frames import LLMMessagesFrame
            from pipecat.pipeline.pipeline import Pipeline
            from pipecat.pipeline.task import PipelineTask
            from pipecat.services.deepgram import DeepgramSTTService
            from pipecat.services.elevenlabs import ElevenLabsTTSService
            from pipecat.services.anthropic import AnthropicLLMService
            from pipecat.transports.services.livekit import LiveKitTransport
            logger.info("agent_pipecat_imported_ok")
        except ImportError as e:
            tb = traceback.format_exc()
            logger.error(
                "pipecat_import_error",
                error=str(e),
                traceback=tb,
            )
            raise RuntimeError(f"Pipecat not installed: {e}") from e

        # --- Initialize LiveKit transport ---
        logger.info(
            "agent_connecting_livekit",
            room=self.room_name,
            livekit_url=settings.livekit_url,
            has_api_key=bool(settings.livekit_api_key),
            has_api_secret=bool(settings.livekit_api_secret),
        )

        try:
            transport = LiveKitTransport(
                url=settings.livekit_url,
                api_key=settings.livekit_api_key,
                api_secret=settings.livekit_api_secret,
                room_name=self.room_name,
                participant_identity="ai-interviewer",
                participant_name="AI Interviewer",
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

            llm = AnthropicLLMService(
                api_key=settings.llm_api_key,
                model="claude-sonnet-4-20250514",
            )
            logger.info("agent_anthropic_ok", has_key=bool(settings.llm_api_key))

            tts = ElevenLabsTTSService(
                api_key=settings.elevenlabs_api_key,
                voice_id=settings.elevenlabs_voice_id,
            )
            logger.info("agent_elevenlabs_ok", has_key=bool(settings.elevenlabs_api_key))
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(
                "agent_service_init_error",
                error=str(e),
                error_type=type(e).__name__,
                traceback=tb,
            )
            raise

        # --- Build pipeline ---
        logger.info("agent_building_pipeline")

        try:
            pipeline = Pipeline(
                [
                    transport.input(),
                    stt,
                    llm,
                    tts,
                    transport.output(),
                ]
            )
            logger.info("agent_pipeline_built")
        except Exception as e:
            tb = traceback.format_exc()
            logger.error(
                "agent_pipeline_build_error",
                error=str(e),
                error_type=type(e).__name__,
                traceback=tb,
            )
            raise

        # --- Set initial context ---
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
            "agent_pipeline_running",
            room=self.room_name,
            job_title=self.job_title,
            candidate=self.candidate_name,
        )

        # --- Run until interview complete ---
        try:
            await task.run()
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
