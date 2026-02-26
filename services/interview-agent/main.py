"""
Standalone Pipecat AI Interview Agent Service.

Receives HTTP triggers from the main API and runs long-lived
Pipecat interview pipelines. Reports results back via webhook.

Architecture note:
  Cloud Run only allocates CPU while an HTTP request is active.
  The /start endpoint intentionally blocks for the full duration of
  the interview (10-30 min) so the container keeps receiving CPU.
  The main API fires this request with a short read-timeout and
  treats a ReadTimeout as "agent launched successfully".
"""

import asyncio
import hmac
import traceback
from typing import Optional

import httpx
import structlog
from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel

from config import settings

logger = structlog.get_logger()

app = FastAPI(title="Interview Agent Service", version="1.0.0")


class StartRequest(BaseModel):
    """Payload to start an interview agent."""

    interview_id: str
    room_name: str
    job_title: str
    job_description: str
    candidate_name: str
    cv_summary: Optional[str] = None
    num_questions: int = 5


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/start")
async def start_agent(
    request: StartRequest,
    x_agent_secret: str = Header(...),
) -> dict:
    """
    Start an AI interview agent for a given room.

    This endpoint blocks for the full interview duration (10-30 min).
    Cloud Run keeps CPU allocated as long as the request is active.
    The calling API should use a short read-timeout (2-5s) and treat
    a ReadTimeout as success (agent is running).
    """
    if not hmac.compare_digest(x_agent_secret, settings.agent_webhook_secret):
        raise HTTPException(status_code=403, detail="Invalid agent secret")

    logger.info(
        "agent_start_received",
        interview_id=request.interview_id,
        room_name=request.room_name,
        livekit_url=settings.livekit_url[:30] if settings.livekit_url else "NOT SET",
    )

    # Run agent inline — keeps request active so Cloud Run allocates CPU
    result = await _run_agent(
        interview_id=request.interview_id,
        room_name=request.room_name,
        job_title=request.job_title,
        job_description=request.job_description,
        candidate_name=request.candidate_name,
        cv_summary=request.cv_summary,
        num_questions=request.num_questions,
    )

    return result


async def _run_agent(
    interview_id: str,
    room_name: str,
    job_title: str,
    job_description: str,
    candidate_name: str,
    cv_summary: Optional[str],
    num_questions: int,
) -> dict:
    """Run the Pipecat interview agent and POST results back to main API."""
    from interview_agent import InterviewAgent

    result: dict = {}
    try:
        logger.info(
            "agent_creating",
            interview_id=interview_id,
            room_name=room_name,
        )

        agent = InterviewAgent(
            room_name=room_name,
            job_title=job_title,
            job_description=job_description,
            candidate_name=candidate_name,
            candidate_cv_summary=cv_summary,
            num_questions=num_questions,
        )

        logger.info(
            "agent_running",
            interview_id=interview_id,
        )

        result = await agent.run()

        logger.info(
            "agent_completed",
            interview_id=interview_id,
            status=result.get("status"),
            questions_asked=result.get("questions_asked"),
        )
    except Exception as exc:
        tb = traceback.format_exc()
        logger.error(
            "agent_failed",
            interview_id=interview_id,
            error=str(exc),
            error_type=type(exc).__name__,
            traceback=tb,
        )
        result = {"status": "error", "error": str(exc)[:500]}

    await _callback(interview_id, result)
    return result


async def _callback(interview_id: str, result: dict) -> None:
    """POST agent result back to the main API with retries."""
    url = f"{settings.main_api_url}/interviews/{interview_id}/webhook"
    headers = {"X-Agent-Secret": settings.agent_webhook_secret}

    logger.info(
        "callback_sending",
        interview_id=interview_id,
        url=url,
        result_status=result.get("status"),
    )

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=result, headers=headers)
                resp.raise_for_status()
            logger.info(
                "callback_sent",
                interview_id=interview_id,
                status_code=resp.status_code,
            )
            return
        except Exception as exc:
            wait = 2 ** attempt
            logger.warning(
                "callback_retry",
                interview_id=interview_id,
                attempt=attempt + 1,
                error=str(exc),
                error_type=type(exc).__name__,
                wait_seconds=wait,
            )
            await asyncio.sleep(wait)

    logger.error("callback_failed_all_retries", interview_id=interview_id)
