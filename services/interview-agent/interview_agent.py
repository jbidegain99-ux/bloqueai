"""
Pipecat-based AI Interview Agent.

Conducts live video interviews with candidates using voice:
1. Listens to candidate audio via Deepgram STT
2. Processes conversation with OpenAI LLM
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
        # Order: input → STT → user_aggregator → LLM → TTS → output → assistant_aggregator
        logger.info("agent_building_pipeline")

        try:
            pipeline = Pipeline(
                [
                    transport.input(),
                    stt,
                    context_aggregator.user(),
                    llm,
                    tts,
                    transport.output(),
                    context_aggregator.assistant(),
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

        task = PipelineTask(
            pipeline,
            params=PipelineParams(allow_interruptions=True),
        )

        # --- Greeting: speak when first participant joins ---
        greeting = (
            f"Hola {self.candidate_name}! Soy tu entrevistador "
            f"virtual de TalentOS. Gracias por tomarte el tiempo "
            f"para esta entrevista para el puesto de {self.job_title}. "
            f"Estas listo para comenzar?"
        )

        @transport.event_handler("on_first_participant_joined")
        async def on_first_participant_joined(transport_obj, participant_id):
            logger.info(
                "agent_participant_joined",
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
