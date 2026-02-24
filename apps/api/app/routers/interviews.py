"""
API endpoints for video interviews (LiveKit + Pipecat).

Provides endpoints to create, join, start, and monitor
AI-powered video interviews for candidates.
"""

import json
import uuid
from datetime import datetime
from typing import List, Optional

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from uuid import UUID

from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.models.application import Application
from app.models.job import Job
from app.models.candidate import Candidate
from app.models.user import User, UserRole
from app.models.video_interview import VideoInterview, VideoInterviewStatus
from app.services.livekit_service import get_livekit_service
from app.services.interview_agent import InterviewAgent
from app.services.interview_analysis import get_analysis_service
from app.utils.deps import get_current_user

logger = structlog.get_logger()

router = APIRouter(prefix="/interviews", tags=["Video Interviews"])


# ============== Schemas ==============


class InterviewCreateRequest(BaseModel):
    """Request to create a new video interview."""

    application_id: UUID
    scheduled_at: Optional[datetime] = None


class InterviewCreateResponse(BaseModel):
    """Response after creating a video interview."""

    interview_id: UUID
    room_name: str
    candidate_token: str
    livekit_url: str
    status: str


class InterviewJoinResponse(BaseModel):
    """Response with token to join an interview room."""

    token: str
    livekit_url: str
    room_name: str


class InterviewStatusResponse(BaseModel):
    """Current status of a video interview."""

    interview_id: UUID
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    transcript_available: bool
    recording_available: bool


class CompetencyScore(BaseModel):
    """Score for a single competency."""

    score: int
    justification: str


class AnalysisScores(BaseModel):
    """Scores for all evaluated competencies."""

    communication: Optional[CompetencyScore] = None
    technical: Optional[CompetencyScore] = None
    problem_solving: Optional[CompetencyScore] = None
    cultural_fit: Optional[CompetencyScore] = None
    experience: Optional[CompetencyScore] = None


class Recommendation(BaseModel):
    """Hiring recommendation from AI analysis."""

    decision: str
    confidence: float
    rationale: str


class InterviewAnalysisResponse(BaseModel):
    """Response with full interview analysis."""

    interview_id: UUID
    overall_score: float
    scores: Optional[AnalysisScores] = None
    strengths: List[str]
    areas_for_improvement: List[str]
    red_flags: List[str]
    executive_summary: str
    recommendation: Optional[Recommendation] = None
    suggested_next_steps: List[str]
    analyzed_at: Optional[str] = None


# ============== Endpoints ==============


@router.post("", response_model=InterviewCreateResponse)
async def create_interview(
    request: InterviewCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewCreateResponse:
    """
    Create a new video interview for an application.
    Only employers/recruiters/admins can create interviews.
    """
    if current_user.role not in [UserRole.EMPLOYER, UserRole.RECRUITER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado para crear entrevistas")

    if not settings.livekit_configured:
        raise HTTPException(
            status_code=503,
            detail="Video interviews not configured. LiveKit credentials missing.",
        )

    # Get application with related data
    application = (
        db.query(Application)
        .options(
            joinedload(Application.candidate),
            joinedload(Application.job),
        )
        .filter(Application.id == request.application_id)
        .first()
    )

    if not application:
        raise HTTPException(status_code=404, detail="Aplicacion no encontrada")

    # Generate unique room name
    room_name = f"interview_{uuid.uuid4().hex[:12]}"

    # Create interview record
    interview = VideoInterview(
        application_id=application.id,
        room_name=room_name,
        status=VideoInterviewStatus.SCHEDULED.value,
        scheduled_at=request.scheduled_at or datetime.utcnow(),
        created_by=current_user.id,
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)

    # Generate LiveKit token for candidate
    livekit = get_livekit_service()

    candidate_name = "Candidato"
    if application.candidate and application.candidate.user:
        candidate_name = application.candidate.user.full_name or "Candidato"

    candidate_token = livekit.create_token(
        room_name=room_name,
        participant_identity=f"candidate_{application.candidate_id}",
        participant_name=candidate_name,
    )

    logger.info(
        "video_interview_created",
        interview_id=str(interview.id),
        room_name=room_name,
        application_id=str(application.id),
        created_by=str(current_user.id),
    )

    return InterviewCreateResponse(
        interview_id=interview.id,
        room_name=room_name,
        candidate_token=candidate_token,
        livekit_url=settings.livekit_url or "",
        status=VideoInterviewStatus.SCHEDULED.value,
    )


@router.post("/{interview_id}/join", response_model=InterviewJoinResponse)
async def join_interview(
    interview_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewJoinResponse:
    """
    Get a token to join an interview room.
    Candidates get participant role, employers get observer role.
    """
    interview = (
        db.query(VideoInterview)
        .options(joinedload(VideoInterview.application))
        .filter(VideoInterview.id == interview_id)
        .first()
    )

    if not interview:
        raise HTTPException(status_code=404, detail="Entrevista no encontrada")

    application = interview.application
    if not application:
        raise HTTPException(status_code=404, detail="Aplicacion asociada no encontrada")

    # Check user authorization
    is_candidate = current_user.id == getattr(
        getattr(application, "candidate", None), "user_id", None
    )
    is_employer = current_user.role in [
        UserRole.EMPLOYER,
        UserRole.RECRUITER,
        UserRole.ADMIN,
    ]

    if not (is_candidate or is_employer):
        raise HTTPException(status_code=403, detail="No autorizado para unirse a esta entrevista")

    livekit = get_livekit_service()

    if is_candidate:
        identity = f"candidate_{current_user.id}"
        name = current_user.full_name or "Candidato"
    else:
        identity = f"observer_{current_user.id}"
        name = f"{current_user.full_name} (Observador)"

    token = livekit.create_token(
        room_name=interview.room_name,
        participant_identity=identity,
        participant_name=name,
    )

    return InterviewJoinResponse(
        token=token,
        livekit_url=settings.livekit_url or "",
        room_name=interview.room_name,
    )


@router.post("/{interview_id}/start")
async def start_interview(
    interview_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Start the AI interviewer agent.
    Called when candidate is ready to begin the interview.
    """
    interview = (
        db.query(VideoInterview)
        .options(
            joinedload(VideoInterview.application).joinedload(Application.job),
            joinedload(VideoInterview.application).joinedload(Application.candidate),
        )
        .filter(VideoInterview.id == interview_id)
        .first()
    )

    if not interview:
        raise HTTPException(status_code=404, detail="Entrevista no encontrada")

    if interview.status not in [
        VideoInterviewStatus.SCHEDULED.value,
        VideoInterviewStatus.READY.value,
    ]:
        raise HTTPException(
            status_code=400,
            detail=f"La entrevista no puede iniciarse (estado: {interview.status})",
        )

    application = interview.application
    job = application.job
    candidate = application.candidate

    # Update status
    interview.status = VideoInterviewStatus.IN_PROGRESS.value
    interview.started_at = datetime.utcnow()
    db.commit()

    # Get candidate name from user relationship
    candidate_name = "Candidato"
    if candidate and candidate.user:
        candidate_name = candidate.user.full_name or "Candidato"

    # Get CV summary if available
    cv_summary = None
    if application.candidate_profile:
        cv_summary = str(application.candidate_profile.get("summary", ""))

    # Start AI agent in background
    agent = InterviewAgent(
        room_name=interview.room_name,
        job_title=job.title if job else "Puesto",
        job_description=job.description if job else "",
        candidate_name=candidate_name,
        candidate_cv_summary=cv_summary,
        num_questions=5,
    )

    background_tasks.add_task(
        _run_interview_agent, agent, interview.id
    )

    logger.info(
        "video_interview_started",
        interview_id=str(interview.id),
        room_name=interview.room_name,
    )

    return {"status": "started", "message": "El entrevistador IA se esta uniendo a la sala"}


async def _run_interview_agent(agent: InterviewAgent, interview_id: UUID) -> None:
    """Background task to run the interview agent."""
    db = SessionLocal()
    try:
        result = await agent.run()

        interview = db.query(VideoInterview).filter(VideoInterview.id == interview_id).first()
        if interview:
            interview.status = VideoInterviewStatus.COMPLETED.value
            interview.ended_at = datetime.utcnow()
            interview.transcript = result.get("transcript", [])
            db.commit()

        logger.info(
            "video_interview_agent_finished",
            interview_id=str(interview_id),
            status="completed",
        )
    except Exception as e:
        logger.error(
            "video_interview_agent_error",
            interview_id=str(interview_id),
            error=str(e),
        )
        interview = db.query(VideoInterview).filter(VideoInterview.id == interview_id).first()
        if interview:
            interview.status = VideoInterviewStatus.ERROR.value
            interview.error_message = str(e)[:500]
            db.commit()
    finally:
        db.close()


@router.get("/{interview_id}/status", response_model=InterviewStatusResponse)
async def get_interview_status(
    interview_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewStatusResponse:
    """Get current status of a video interview."""
    interview = db.query(VideoInterview).filter(VideoInterview.id == interview_id).first()

    if not interview:
        raise HTTPException(status_code=404, detail="Entrevista no encontrada")

    return InterviewStatusResponse(
        interview_id=interview.id,
        status=interview.status,
        started_at=interview.started_at,
        ended_at=interview.ended_at,
        transcript_available=interview.transcript is not None,
        recording_available=interview.recording_url is not None,
    )


@router.get("")
async def list_interviews(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """List video interviews. Employers see their created interviews, admins see all."""
    query = db.query(VideoInterview)

    if current_user.role not in [UserRole.ADMIN, UserRole.RECRUITER]:
        query = query.filter(VideoInterview.created_by == current_user.id)

    if status:
        query = query.filter(VideoInterview.status == status)

    query = query.order_by(VideoInterview.created_at.desc())
    interviews = query.limit(50).all()

    return {
        "items": [
            {
                "id": str(i.id),
                "room_name": i.room_name,
                "status": i.status,
                "application_id": str(i.application_id),
                "scheduled_at": i.scheduled_at.isoformat() if i.scheduled_at else None,
                "started_at": i.started_at.isoformat() if i.started_at else None,
                "ended_at": i.ended_at.isoformat() if i.ended_at else None,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in interviews
        ],
        "total": len(interviews),
    }


# ============== Analysis Endpoints ==============


def _build_analysis_response(interview: VideoInterview) -> InterviewAnalysisResponse:
    """Build analysis response from stored interview data."""
    recommendation = None
    if interview.ai_recommendation:
        try:
            rec_data = json.loads(interview.ai_recommendation)
            recommendation = Recommendation(**rec_data)
        except (json.JSONDecodeError, TypeError):
            pass

    scores = None
    if interview.ai_scores and isinstance(interview.ai_scores, dict):
        scores = AnalysisScores(**{
            k: CompetencyScore(**v)
            for k, v in interview.ai_scores.items()
            if isinstance(v, dict) and "score" in v
        })

    return InterviewAnalysisResponse(
        interview_id=interview.id,
        overall_score=interview.overall_score or 0.0,
        scores=scores,
        strengths=interview.strengths or [],
        areas_for_improvement=interview.areas_for_improvement or [],
        red_flags=interview.red_flags or [],
        executive_summary=interview.ai_summary or "",
        recommendation=recommendation,
        suggested_next_steps=interview.suggested_next_steps or [],
        analyzed_at=interview.updated_at.isoformat() if interview.updated_at else None,
    )


@router.post("/{interview_id}/analyze", response_model=InterviewAnalysisResponse)
async def analyze_interview(
    interview_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> InterviewAnalysisResponse:
    """
    Trigger AI analysis of a completed interview.
    Only employers/recruiters/admins can request analysis.
    """
    if current_user.role not in [UserRole.EMPLOYER, UserRole.RECRUITER, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="No autorizado para analizar entrevistas")

    interview = (
        db.query(VideoInterview)
        .options(
            joinedload(VideoInterview.application)
            .joinedload(Application.job)
            .joinedload(Job.company),
            joinedload(VideoInterview.application)
            .joinedload(Application.candidate)
            .joinedload(Candidate.user),
        )
        .filter(VideoInterview.id == interview_id)
        .first()
    )

    if not interview:
        raise HTTPException(status_code=404, detail="Entrevista no encontrada")

    if interview.status != VideoInterviewStatus.COMPLETED.value:
        raise HTTPException(
            status_code=400,
            detail="La entrevista debe estar completada antes del análisis",
        )

    if not interview.transcript:
        raise HTTPException(
            status_code=400,
            detail="No hay transcripción disponible para analizar",
        )

    # Return cached analysis if already done
    if interview.ai_scores and interview.ai_summary:
        return _build_analysis_response(interview)

    application = interview.application
    job = application.job
    candidate = application.candidate

    # Get candidate name
    candidate_name = "Candidato"
    if candidate and candidate.user:
        candidate_name = candidate.user.full_name or "Candidato"

    # Get job requirements from must_haves
    job_requirements: List[str] = []
    if job and job.must_haves:
        job_requirements = [str(r) for r in job.must_haves]

    # Get CV summary from candidate profile or ai_summary
    cv_summary = None
    if application.candidate_profile:
        cv_summary = str(application.candidate_profile)
    elif candidate and candidate.ai_summary:
        cv_summary = candidate.ai_summary

    # Perform analysis
    analysis_service = get_analysis_service()
    analysis = await analysis_service.analyze_interview(
        transcript=interview.transcript,
        job_title=job.title if job else "Puesto",
        job_description=job.description if job else "",
        job_requirements=job_requirements,
        candidate_name=candidate_name,
        candidate_cv_summary=cv_summary,
    )

    # Store results
    interview.ai_scores = analysis.get("scores", {})
    interview.ai_summary = analysis.get("executive_summary", "")
    interview.ai_recommendation = json.dumps(analysis.get("recommendation", {}))
    interview.overall_score = analysis.get("overall_score", 0)
    interview.strengths = analysis.get("strengths", [])
    interview.areas_for_improvement = analysis.get("areas_for_improvement", [])
    interview.red_flags = analysis.get("red_flags", [])
    interview.suggested_next_steps = analysis.get("suggested_next_steps", [])

    try:
        db.commit()
        db.refresh(interview)
    except Exception:
        db.rollback()
        raise

    logger.info(
        "interview_analyzed",
        interview_id=str(interview_id),
        overall_score=interview.overall_score,
    )

    return _build_analysis_response(interview)


@router.get("/{interview_id}/results")
async def get_interview_results(
    interview_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get full interview results including transcript and analysis.
    Employers see full analysis; candidates see limited feedback.
    """
    interview = (
        db.query(VideoInterview)
        .options(
            joinedload(VideoInterview.application)
            .joinedload(Application.job)
            .joinedload(Job.company),
            joinedload(VideoInterview.application)
            .joinedload(Application.candidate)
            .joinedload(Candidate.user),
        )
        .filter(VideoInterview.id == interview_id)
        .first()
    )

    if not interview:
        raise HTTPException(status_code=404, detail="Entrevista no encontrada")

    application = interview.application
    candidate = application.candidate

    # Verify access
    is_employer_role = current_user.role in [UserRole.EMPLOYER, UserRole.RECRUITER, UserRole.ADMIN]
    is_own_candidate = candidate and candidate.user_id == current_user.id

    if not (is_employer_role or is_own_candidate):
        raise HTTPException(status_code=403, detail="No autorizado para ver estos resultados")

    # Get candidate name
    candidate_name = "Candidato"
    if candidate and candidate.user:
        candidate_name = candidate.user.full_name or "Candidato"

    # Get company name
    company_name = "N/A"
    job = application.job
    if job and job.company:
        company_name = job.company.name or "N/A"

    # Build base result
    result: dict = {
        "interview_id": str(interview.id),
        "status": interview.status,
        "job_title": job.title if job else "N/A",
        "company_name": company_name,
        "candidate_name": candidate_name,
        "started_at": interview.started_at.isoformat() if interview.started_at else None,
        "ended_at": interview.ended_at.isoformat() if interview.ended_at else None,
        "duration_minutes": None,
    }

    # Calculate duration
    if interview.started_at and interview.ended_at:
        delta = interview.ended_at - interview.started_at
        result["duration_minutes"] = round(delta.total_seconds() / 60, 1)

    # Include transcript for both roles
    result["transcript"] = interview.transcript

    # Full analysis for employers
    if is_employer_role and interview.ai_scores:
        rec = None
        if interview.ai_recommendation:
            try:
                rec = json.loads(interview.ai_recommendation)
            except json.JSONDecodeError:
                pass

        result["analysis"] = {
            "overall_score": interview.overall_score,
            "scores": interview.ai_scores,
            "strengths": interview.strengths or [],
            "areas_for_improvement": interview.areas_for_improvement or [],
            "red_flags": interview.red_flags or [],
            "executive_summary": interview.ai_summary or "",
            "recommendation": rec,
            "suggested_next_steps": interview.suggested_next_steps or [],
        }

    # Limited feedback for candidates
    if is_own_candidate and interview.ai_scores:
        overall = interview.overall_score or 0
        if overall >= 7:
            impression = "positive"
        elif overall >= 5:
            impression = "neutral"
        else:
            impression = "needs_improvement"

        result["feedback"] = {
            "overall_impression": impression,
            "strengths_highlighted": (interview.strengths or [])[:2],
            "tip": (interview.areas_for_improvement or [None])[0],
        }

    return result
