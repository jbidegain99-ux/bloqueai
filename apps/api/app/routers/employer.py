"""Employer endpoints."""

import csv
import io
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.job import Job, JobStatus
from app.models.shortlist import ShortlistItem, ShortlistStatus
from app.models.candidate import Candidate
from app.models.report import CandidateReport
from app.schemas.job import JobCreate, JobUpdate, JobResponse, JobListResponse
from app.schemas.shortlist import (
    ShortlistResponse,
    ShortlistItemResponse,
    GenerateShortlistRequest,
    ShortlistUpdateRequest,
    ShortlistCompareRequest,
    ShortlistCompareResponse,
)
from app.schemas.copilot import (
    CopilotDescriptionRequest,
    CopilotDescriptionResponse,
    CopilotRequirementsRequest,
    CopilotRequirementsResponse,
    CopilotQuestionsRequest,
    CopilotQuestionsResponse,
    CategoryFieldsResponse,
)
from app.schemas.candidate import CandidateForEmployer
from app.schemas.report import ReportForShortlist
from app.services.ranking import rank_candidates_for_job
from app.utils.deps import get_current_user, require_employer

router = APIRouter(prefix="/employer", tags=["Employer"])


def slugify(text: str) -> str:
    """Convert text to slug."""
    import re
    from uuid import uuid4

    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:80] + "-" + str(uuid4())[:8]


def get_job_or_404(db: Session, job_id: UUID, user: User) -> Job:
    """Get job or raise 404."""
    query = db.query(Job).filter(Job.id == job_id)

    # Filter by company for non-admins
    if user.role != UserRole.ADMIN and user.company_id:
        query = query.filter(Job.company_id == user.company_id)

    job = query.first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo no encontrado",
        )
    return job


@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    request: JobCreate,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> Job:
    """Create a new job posting."""
    if not current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tienes una empresa asociada",
        )

    job = Job(
        company_id=current_user.company_id,
        created_by_id=current_user.id,
        title=request.title,
        slug=slugify(request.title),
        description=request.description,
        department=request.department,
        seniority=request.seniority,
        salary_min=request.salary_min,
        salary_max=request.salary_max,
        salary_currency=request.salary_currency,
        modality=request.modality,
        location=request.location,
        country=request.country,
        timezone=request.timezone,
        must_haves=request.must_haves,
        nice_to_haves=request.nice_to_haves,
        responsibilities=request.responsibilities,
        benefits=request.benefits,
        custom_questions=request.custom_questions,
        rubric_id=request.rubric_id,
        status=JobStatus.DRAFT,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/jobs", response_model=JobListResponse)
async def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[JobStatus] = None,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> JobListResponse:
    """List all jobs for the employer."""
    query = db.query(Job)

    # Filter by company for non-admins
    if current_user.role != UserRole.ADMIN and current_user.company_id:
        query = query.filter(Job.company_id == current_user.company_id)

    if status_filter:
        query = query.filter(Job.status == status_filter)

    total = query.count()
    jobs = (
        query.order_by(Job.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Add counts
    for job in jobs:
        job.shortlist_count = (
            db.query(ShortlistItem).filter(ShortlistItem.job_id == job.id).count()
        )

    return JobListResponse(
        items=jobs,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> Job:
    """Get job details."""
    job = get_job_or_404(db, job_id, current_user)
    job.shortlist_count = (
        db.query(ShortlistItem).filter(ShortlistItem.job_id == job.id).count()
    )
    return job


@router.patch("/jobs/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: UUID,
    request: JobUpdate,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> Job:
    """Update a job posting."""
    job = get_job_or_404(db, job_id, current_user)

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)

    db.commit()
    db.refresh(job)
    return job


@router.post("/jobs/{job_id}/publish", response_model=JobResponse)
async def publish_job(
    job_id: UUID,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> Job:
    """Publish a job (make it active)."""
    job = get_job_or_404(db, job_id, current_user)
    job.status = JobStatus.ACTIVE
    db.commit()
    db.refresh(job)
    return job


@router.post("/jobs/{job_id}/shortlist/generate", response_model=ShortlistResponse)
async def generate_shortlist(
    job_id: UUID,
    request: GenerateShortlistRequest = None,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> ShortlistResponse:
    """Generate or regenerate candidate shortlist for a job."""
    job = get_job_or_404(db, job_id, current_user)

    if request is None:
        request = GenerateShortlistRequest()

    # Clear existing shortlist if not including reviewed
    if not request.include_reviewed:
        db.query(ShortlistItem).filter(
            ShortlistItem.job_id == job.id
        ).filter(
            ShortlistItem.status == ShortlistStatus.PENDING
        ).delete()
        db.flush()

    # Rank candidates
    ranked = rank_candidates_for_job(db, job, request.max_candidates)

    # Create shortlist items
    items = []
    for i, entry in enumerate(ranked, 1):
        candidate = entry["candidate"]
        report = entry["report"]

        # Build enhanced score breakdown with new fields
        score_breakdown = entry["score_breakdown"].copy()
        score_breakdown["final_score"] = entry.get("final_score", entry["total_score"] * 20)
        score_breakdown["cv_score"] = entry.get("cv_score", 0)
        score_breakdown["interview_score"] = entry.get("interview_score", 0)
        score_breakdown["top_competencies"] = entry.get("top_competencies", [])
        score_breakdown["flags_count"] = entry.get("flags_count", 0)
        score_breakdown["interview_status"] = entry.get("status", "PENDING")

        # Check if already in shortlist (reviewed)
        existing = (
            db.query(ShortlistItem)
            .filter(ShortlistItem.job_id == job.id)
            .filter(ShortlistItem.candidate_id == candidate.id)
            .first()
        )

        if existing:
            if request.include_reviewed:
                existing.rank = i
                existing.total_score = entry["total_score"]
                existing.score_breakdown = score_breakdown
                existing.top_reasons = entry["top_reasons"]
                existing.risks = entry["risks"]
                items.append(existing)
            continue

        item = ShortlistItem(
            job_id=job.id,
            candidate_id=candidate.id,
            report_id=report.id if report else None,
            rank=i,
            total_score=entry["total_score"],
            score_breakdown=score_breakdown,
            top_reasons=entry["top_reasons"],
            risks=entry["risks"],
            status=ShortlistStatus.PENDING,
        )
        db.add(item)
        items.append(item)

    db.commit()

    # Build response
    return ShortlistResponse(
        job_id=job.id,
        job_title=job.title,
        total_candidates=len(ranked),
        shortlist_count=len(items),
        items=[_build_shortlist_item_response(db, item) for item in items],
    )


@router.get("/jobs/{job_id}/shortlist", response_model=ShortlistResponse)
async def get_shortlist(
    job_id: UUID,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> ShortlistResponse:
    """Get shortlist for a job."""
    job = get_job_or_404(db, job_id, current_user)

    items = (
        db.query(ShortlistItem)
        .filter(ShortlistItem.job_id == job.id)
        .order_by(ShortlistItem.rank)
        .all()
    )

    return ShortlistResponse(
        job_id=job.id,
        job_title=job.title,
        total_candidates=len(items),
        shortlist_count=len(items),
        items=[_build_shortlist_item_response(db, item) for item in items],
    )


def _build_shortlist_item_response(db: Session, item: ShortlistItem) -> ShortlistItemResponse:
    """Build shortlist item response with candidate and report info."""
    from app.schemas.shortlist import CompetencyScore

    candidate = db.query(Candidate).filter(Candidate.id == item.candidate_id).first()
    report = None
    if item.report_id:
        report = db.query(CandidateReport).filter(CandidateReport.id == item.report_id).first()

    candidate_info = None
    if candidate:
        experience_years = len(candidate.experience) if candidate.experience else 0
        candidate_info = CandidateForEmployer(
            id=candidate.id,
            headline=candidate.headline,
            location=candidate.location,
            skills=candidate.skills or [],
            experience_years=experience_years,
            ai_summary=candidate.ai_summary,
            competency_scores=candidate.competency_scores or {},
        )

    report_info = None
    if report:
        report_info = ReportForShortlist(
            id=report.id,
            summary=report.summary,
            overall_score=report.overall_score,
            competency_scores=report.competency_scores or {},
            strengths=report.strengths or [],
            weaknesses=report.weaknesses or [],
            risks=report.risks or [],
        )

    # Extract new fields from score_breakdown
    score_breakdown = item.score_breakdown or {}
    final_score = score_breakdown.get("final_score", item.total_score * 20)
    cv_score = score_breakdown.get("cv_score", 0)
    interview_score = score_breakdown.get("interview_score", 0)
    flags_count = score_breakdown.get("flags_count", 0)
    interview_status = score_breakdown.get("interview_status", "PENDING")

    # Build top competencies
    top_competencies_raw = score_breakdown.get("top_competencies", [])
    top_competencies = [
        CompetencyScore(name=c.get("name", ""), score=c.get("score", 0))
        for c in top_competencies_raw if isinstance(c, dict)
    ]

    return ShortlistItemResponse(
        id=item.id,
        job_id=item.job_id,
        candidate_id=item.candidate_id,
        report_id=item.report_id,
        rank=item.rank,
        total_score=item.total_score,
        final_score=final_score,
        cv_score=cv_score,
        interview_score=interview_score,
        top_competencies=top_competencies,
        flags_count=flags_count,
        interview_status=interview_status,
        score_breakdown=score_breakdown,
        top_reasons=item.top_reasons or [],
        risks=item.risks or [],
        match_details=item.match_details or {},
        status=item.status,
        recruiter_notes=item.recruiter_notes,
        candidate=candidate_info,
        report=report_info,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/jobs/{job_id}/shortlist/export.csv")
async def export_shortlist_csv(
    job_id: UUID,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
):
    """Export shortlist as CSV."""
    job = get_job_or_404(db, job_id, current_user)

    items = (
        db.query(ShortlistItem)
        .filter(ShortlistItem.job_id == job.id)
        .order_by(ShortlistItem.rank)
        .all()
    )

    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Rank",
        "Final Score",
        "CV Score",
        "Interview Score",
        "Headline",
        "Location",
        "Skills",
        "Experience Years",
        "Top Competencies",
        "Strengths",
        "Risks",
        "Flags",
        "Interview Status",
        "Status",
    ])

    for item in items:
        candidate = db.query(Candidate).filter(Candidate.id == item.candidate_id).first()
        report = None
        if item.report_id:
            report = db.query(CandidateReport).filter(CandidateReport.id == item.report_id).first()

        # Extract new fields from score_breakdown
        score_breakdown = item.score_breakdown or {}
        final_score = score_breakdown.get("final_score", item.total_score * 20)
        cv_score = score_breakdown.get("cv_score", 0)
        interview_score = score_breakdown.get("interview_score", 0)
        flags_count = score_breakdown.get("flags_count", 0)
        interview_status = score_breakdown.get("interview_status", "PENDING")
        top_competencies = score_breakdown.get("top_competencies", [])

        # Format top competencies
        comp_str = "; ".join([
            f"{c.get('name', '')}: {c.get('score', 0):.1f}"
            for c in top_competencies[:3] if isinstance(c, dict)
        ])

        writer.writerow([
            item.rank,
            round(final_score, 1),
            round(cv_score, 1),
            round(interview_score, 1),
            candidate.headline if candidate else "",
            candidate.location if candidate else "",
            ", ".join(candidate.skills[:5]) if candidate and candidate.skills else "",
            len(candidate.experience) if candidate and candidate.experience else 0,
            comp_str,
            "; ".join(report.strengths[:3]) if report and report.strengths else "",
            "; ".join(item.risks[:2]) if item.risks else "",
            flags_count,
            interview_status,
            item.status.value,
        ])

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=shortlist_{job.slug}.csv"
        },
    )


@router.post("/jobs/{job_id}/shortlist/compare", response_model=ShortlistCompareResponse)
async def compare_candidates(
    job_id: UUID,
    request: ShortlistCompareRequest,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> ShortlistCompareResponse:
    """Compare multiple candidates side by side."""
    job = get_job_or_404(db, job_id, current_user)

    items = (
        db.query(ShortlistItem)
        .filter(ShortlistItem.job_id == job.id)
        .filter(ShortlistItem.candidate_id.in_(request.candidate_ids))
        .all()
    )

    if len(items) != len(request.candidate_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Algunos candidatos no están en el shortlist",
        )

    # Build comparison matrix
    comparison_matrix = {
        "competencies": {},
        "skills": {},
    }

    for item in items:
        candidate = db.query(Candidate).filter(Candidate.id == item.candidate_id).first()
        if candidate and candidate.competency_scores:
            for key, value in candidate.competency_scores.items():
                if key not in comparison_matrix["competencies"]:
                    comparison_matrix["competencies"][key] = {}
                score = value.get("score", 0) if isinstance(value, dict) else value
                comparison_matrix["competencies"][key][str(item.candidate_id)] = score

    return ShortlistCompareResponse(
        job_id=job.id,
        candidates=[_build_shortlist_item_response(db, item) for item in items],
        comparison_matrix=comparison_matrix,
    )


@router.patch("/jobs/{job_id}/shortlist/{item_id}", response_model=ShortlistItemResponse)
async def update_shortlist_item(
    job_id: UUID,
    item_id: UUID,
    request: ShortlistUpdateRequest,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> ShortlistItemResponse:
    """Update a shortlist item status or notes."""
    job = get_job_or_404(db, job_id, current_user)

    item = (
        db.query(ShortlistItem)
        .filter(ShortlistItem.id == item_id)
        .filter(ShortlistItem.job_id == job.id)
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item no encontrado en shortlist",
        )

    if request.status:
        item.status = request.status
    if request.recruiter_notes is not None:
        item.recruiter_notes = request.recruiter_notes

    db.commit()
    db.refresh(item)

    return _build_shortlist_item_response(db, item)


@router.get("/jobs/{job_id}/candidates/{candidate_id}")
async def get_candidate_detail(
    job_id: UUID,
    candidate_id: UUID,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> dict:
    """Get detailed candidate information for a specific job."""
    from sqlalchemy.orm import joinedload
    from app.models.interview import InterviewSession, InterviewMessage, InterviewStatus
    from app.models.report import CandidateReport, ReportStatus

    job = get_job_or_404(db, job_id, current_user)

    # Get candidate
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidato no encontrado",
        )

    # Get shortlist item for this job/candidate
    shortlist_item = (
        db.query(ShortlistItem)
        .filter(ShortlistItem.job_id == job.id)
        .filter(ShortlistItem.candidate_id == candidate.id)
        .first()
    )

    # Get interview session for this job (or general)
    interview = (
        db.query(InterviewSession)
        .options(joinedload(InterviewSession.messages))
        .filter(InterviewSession.candidate_id == candidate.id)
        .filter(
            (InterviewSession.job_id == job.id) |
            (InterviewSession.job_id.is_(None))
        )
        .order_by(InterviewSession.created_at.desc())
        .first()
    )

    # Get report
    report = None
    if interview:
        report = (
            db.query(CandidateReport)
            .filter(CandidateReport.session_id == interview.id)
            .filter(CandidateReport.status == ReportStatus.COMPLETED)
            .first()
        )

    # Build transcript
    transcript = []
    if interview and interview.messages:
        for msg in interview.messages:
            role = "assistant" if msg.role.value in ["AI", "SYSTEM"] else "user"
            transcript.append({
                "role": role,
                "content": msg.content,
                "timestamp": msg.created_at.isoformat() if msg.created_at else None,
            })

    # Get candidate's user info
    user_info = None
    if candidate.user:
        user_info = {
            "full_name": candidate.user.full_name,
            "email": candidate.user.email,
        }

    return {
        "job": {
            "id": str(job.id),
            "title": job.title,
        },
        "candidate": {
            "id": str(candidate.id),
            "headline": candidate.headline,
            "location": candidate.location,
            "skills": candidate.skills or [],
            "experience": candidate.experience or [],
            "education": candidate.education or [],
            "languages": candidate.languages or [],
            "summary": candidate.summary or candidate.ai_summary,
            "competency_scores": candidate.competency_scores or {},
            "user": user_info,
        },
        "shortlist": {
            "rank": shortlist_item.rank if shortlist_item else None,
            "total_score": shortlist_item.total_score if shortlist_item else None,
            "status": shortlist_item.status.value if shortlist_item else None,
            "top_reasons": shortlist_item.top_reasons if shortlist_item else [],
            "risks": shortlist_item.risks if shortlist_item else [],
            "recruiter_notes": shortlist_item.recruiter_notes if shortlist_item else None,
            "score_breakdown": shortlist_item.score_breakdown if shortlist_item else {},
        } if shortlist_item else None,
        "interview": {
            "id": str(interview.id),
            "status": interview.status.value,
            "started_at": interview.started_at,
            "completed_at": interview.completed_at,
            "duration_seconds": interview.duration_seconds,
            "total_messages": len(interview.messages) if interview.messages else 0,
        } if interview else None,
        "report": {
            "id": str(report.id),
            "summary": report.summary,
            "overall_score": report.overall_score,
            "confidence_score": report.confidence_score,
            "competency_scores": report.competency_scores or {},
            "strengths": report.strengths or [],
            "weaknesses": report.weaknesses or [],
            "risks": report.risks or [],
            "recommendations": report.recommendations or [],
            "flags": report.flags or [],
            "score_overridden": report.score_overridden or False,
            "original_score": report.original_score,
        } if report else None,
        "transcript": transcript,
    }


# ============ Interview Invitations ============


@router.post("/jobs/{job_id}/invitations", status_code=status.HTTP_201_CREATED)
async def create_invitation(
    job_id: UUID,
    email: str = Query(..., description="Email del candidato a invitar"),
    name: Optional[str] = Query(None, description="Nombre del candidato"),
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> dict:
    """Create an interview invitation for a candidate."""
    import secrets
    from datetime import datetime, timedelta
    from app.models.invitation import InterviewInvitation, InvitationStatus

    job = get_job_or_404(db, job_id, current_user)

    # Generate unique token
    token = secrets.token_urlsafe(32)

    # Set expiration (7 days)
    expires_at = datetime.utcnow() + timedelta(days=7)

    # Create invitation
    invitation = InterviewInvitation(
        job_id=job.id,
        candidate_email=email,
        candidate_name=name,
        token=token,
        status=InvitationStatus.PENDING,
        expires_at=expires_at,
        created_by_id=current_user.id,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    # Build invitation URL
    # Note: In production, this would be the actual frontend URL
    invite_url = f"/candidate/interview?token={token}&job_id={job.id}"

    return {
        "id": str(invitation.id),
        "job_id": str(job.id),
        "job_title": job.title,
        "email": email,
        "name": name,
        "token": token,
        "invite_url": invite_url,
        "expires_at": expires_at.isoformat(),
        "status": invitation.status.value,
    }


@router.get("/jobs/{job_id}/invitations")
async def list_invitations(
    job_id: UUID,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> list[dict]:
    """List all invitations for a job."""
    from app.models.invitation import InterviewInvitation

    job = get_job_or_404(db, job_id, current_user)

    invitations = (
        db.query(InterviewInvitation)
        .filter(InterviewInvitation.job_id == job.id)
        .order_by(InterviewInvitation.created_at.desc())
        .all()
    )

    return [
        {
            "id": str(inv.id),
            "email": inv.candidate_email,
            "name": inv.candidate_name,
            "status": inv.status.value,
            "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
            "used_at": inv.used_at.isoformat() if inv.used_at else None,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
        }
        for inv in invitations
    ]


# ============ Job Copilot AI ============


@router.post("/copilot/suggest-description", response_model=CopilotDescriptionResponse)
async def copilot_suggest_description(
    request: CopilotDescriptionRequest,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> CopilotDescriptionResponse:
    """Generate AI-powered job description suggestion."""
    from app.services.job_copilot import JobCopilotService

    copilot = JobCopilotService(db_session=db, user_id=current_user.id)

    # Get company context if available (use request value or fallback to user's company)
    company_context = request.company_context
    if not company_context and current_user.company:
        company_context = f"{current_user.company.name} - {current_user.company.industry or 'Empresa'}"

    result = await copilot.suggest_description(
        title=request.title,
        category=request.category,
        seniority=request.seniority,
        company_context=company_context,
        partial_description=request.partial_description,
    )

    return CopilotDescriptionResponse(**result)


@router.post("/copilot/suggest-requirements", response_model=CopilotRequirementsResponse)
async def copilot_suggest_requirements(
    request: CopilotRequirementsRequest,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> CopilotRequirementsResponse:
    """Generate AI-powered job requirements suggestion."""
    from app.services.job_copilot import JobCopilotService

    copilot = JobCopilotService(db_session=db, user_id=current_user.id)

    result = await copilot.suggest_requirements(
        title=request.title,
        category=request.category,
        seniority=request.seniority,
        description=request.description,
    )

    return CopilotRequirementsResponse(**result)


@router.post("/copilot/suggest-questions", response_model=CopilotQuestionsResponse)
async def copilot_suggest_questions(
    request: CopilotQuestionsRequest,
    current_user: User = Depends(require_employer),
    db: Session = Depends(get_db),
) -> CopilotQuestionsResponse:
    """Generate AI-powered interview questions suggestion."""
    from app.services.job_copilot import JobCopilotService

    copilot = JobCopilotService(db_session=db, user_id=current_user.id)

    result = await copilot.suggest_interview_questions(
        title=request.title,
        category=request.category,
        seniority=request.seniority,
        must_haves=request.must_haves,
        description=request.description,
    )

    return CopilotQuestionsResponse(**result)


@router.get("/copilot/category-fields/{category}", response_model=CategoryFieldsResponse)
async def get_category_fields(
    category: str,
    current_user: User = Depends(require_employer),
) -> CategoryFieldsResponse:
    """Get category-specific fields template for generic job form."""
    from app.services.job_copilot import get_category_fields as _get_fields

    fields = _get_fields(category)
    return CategoryFieldsResponse(
        category=category.upper(),
        fields=fields.get("fields", []),
    )
