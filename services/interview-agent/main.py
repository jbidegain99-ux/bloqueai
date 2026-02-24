"""
Standalone Pipecat AI Interview Agent Service.

Receives HTTP triggers from the main API and runs long-lived
Pipecat interview pipelines. Reports results back via webhook.
"""

import asyncio
from typing import Optional

import httpx
import structlog
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from config import settings
from interview_agent import InterviewAgent

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

    Validates the shared secret, launches the agent as a background
    asyncio task, and returns immediately.
    """
    if x_agent_secret != settings.agent_webhook_secret:
        raise HTTPException(status_code=403, detail="Invalid agent secret")

    asyncio.create_task(
        _run_agent(
            interview_id=request.interview_id,
            room_name=request.room_name,
            job_title=request.job_title,
            job_description=request.job_description,
            candidate_name=request.candidate_name,
            cv_summary=request.cv_summary,
            num_questions=request.num_questions,
        )
    )

    logger.info(
        "agent_task_created",
        interview_id=request.interview_id,
        room_name=request.room_name,
    )

    return {"status": "started", "interview_id": request.interview_id}


async def _run_agent(
    interview_id: str,
    room_name: str,
    job_title: str,
    job_description: str,
    candidate_name: str,
    cv_summary: Optional[str],
    num_questions: int,
) -> None:
    """Run the Pipecat interview agent and POST results back to main API."""
    result: dict = {}
    try:
        agent = InterviewAgent(
            room_name=room_name,
            job_title=job_title,
            job_description=job_description,
            candidate_name=candidate_name,
            candidate_cv_summary=cv_summary,
            num_questions=num_questions,
        )
        result = await agent.run()
        logger.info(
            "agent_completed",
            interview_id=interview_id,
            status=result.get("status"),
        )
    except Exception as exc:
        logger.error(
            "agent_failed",
            interview_id=interview_id,
            error=str(exc),
        )
        result = {"status": "error", "error": str(exc)[:500]}

    await _callback(interview_id, result)


async def _callback(interview_id: str, result: dict) -> None:
    """POST agent result back to the main API with retries."""
    url = f"{settings.main_api_url}/interviews/{interview_id}/webhook"
    headers = {"X-Agent-Secret": settings.agent_webhook_secret}

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
                wait_seconds=wait,
            )
            await asyncio.sleep(wait)

    logger.error("callback_failed", interview_id=interview_id)
