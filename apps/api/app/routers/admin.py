"""Admin and recruiter endpoints."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.rubric import Rubric, RubricCriteria
from app.models.candidate import Candidate
from app.models.job import Job, JobStatus
from app.models.interview import InterviewSession, InterviewStatus
from app.models.report import CandidateReport, ReportStatus
from app.models.shortlist import ShortlistItem, ShortlistStatus
from app.models.audit import AuditLog
from app.schemas.rubric import (
    RubricCreate,
    RubricUpdate,
    RubricResponse,
    RubricCriteriaResponse,
    RubricSimulationRequest,
    RubricSimulationResponse,
)
from app.schemas.report import CandidateReportResponse, ReportOverrideRequest
from app.schemas.interview import InterviewSessionForReview
from app.schemas.dashboard import DashboardKPIs
from app.services.ranking import rank_candidates_for_job
from app.services.audit import log_rubric_change, log_score_override
from app.utils.deps import get_current_user, require_recruiter, require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


# ============ Rubrics ============


@router.get("/rubrics", response_model=list[RubricResponse])
async def list_rubrics(
    include_inactive: bool = False,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> list[Rubric]:
    """List all rubrics."""
    query = db.query(Rubric)
    if not include_inactive:
        query = query.filter(Rubric.is_active == True)
    return query.order_by(Rubric.name).all()


@router.post("/rubrics", response_model=RubricResponse, status_code=status.HTTP_201_CREATED)
async def create_rubric(
    request: RubricCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Rubric:
    """Create a new rubric."""
    rubric = Rubric(
        name=request.name,
        description=request.description,
        min_score_threshold=request.min_score_threshold,
        max_candidates_shortlist=request.max_candidates_shortlist,
    )
    db.add(rubric)
    db.flush()

    # Add criteria
    for i, criteria_data in enumerate(request.criteria):
        criteria = RubricCriteria(
            rubric_id=rubric.id,
            name=criteria_data.name,
            key=criteria_data.key,
            description=criteria_data.description,
            weight=criteria_data.weight,
            order=i,
            min_score=criteria_data.min_score,
            max_score=criteria_data.max_score,
            scoring_guidelines=criteria_data.scoring_guidelines,
        )
        db.add(criteria)

    db.commit()
    db.refresh(rubric)

    # Log audit
    log_rubric_change(
        db=db,
        user_id=current_user.id,
        rubric_id=rubric.id,
        action="create",
        old_values={},
        new_values={"name": rubric.name, "criteria_count": len(request.criteria)},
    )

    return rubric


@router.get("/rubrics/{rubric_id}", response_model=RubricResponse)
async def get_rubric(
    rubric_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> Rubric:
    """Get rubric details."""
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rúbrica no encontrada",
        )
    return rubric


@router.patch("/rubrics/{rubric_id}", response_model=RubricResponse)
async def update_rubric(
    rubric_id: UUID,
    request: RubricUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Rubric:
    """Update a rubric (creates new version)."""
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rúbrica no encontrada",
        )

    old_values = {
        "name": rubric.name,
        "min_score_threshold": rubric.min_score_threshold,
        "max_candidates_shortlist": rubric.max_candidates_shortlist,
    }

    # Update basic fields
    if request.name is not None:
        rubric.name = request.name
    if request.description is not None:
        rubric.description = request.description
    if request.min_score_threshold is not None:
        rubric.min_score_threshold = request.min_score_threshold
    if request.max_candidates_shortlist is not None:
        rubric.max_candidates_shortlist = request.max_candidates_shortlist
    if request.is_active is not None:
        rubric.is_active = request.is_active

    # Update criteria if provided
    if request.criteria is not None:
        # Delete existing criteria
        db.query(RubricCriteria).filter(RubricCriteria.rubric_id == rubric.id).delete()

        # Add new criteria
        for i, criteria_data in enumerate(request.criteria):
            criteria = RubricCriteria(
                rubric_id=rubric.id,
                name=criteria_data.name,
                key=criteria_data.key,
                description=criteria_data.description,
                weight=criteria_data.weight,
                order=i,
                min_score=criteria_data.min_score,
                max_score=criteria_data.max_score,
                scoring_guidelines=criteria_data.scoring_guidelines,
            )
            db.add(criteria)

    rubric.version += 1
    db.commit()
    db.refresh(rubric)

    # Log audit
    new_values = {
        "name": rubric.name,
        "min_score_threshold": rubric.min_score_threshold,
        "max_candidates_shortlist": rubric.max_candidates_shortlist,
        "version": rubric.version,
    }
    log_rubric_change(
        db=db,
        user_id=current_user.id,
        rubric_id=rubric.id,
        action="update",
        old_values=old_values,
        new_values=new_values,
    )

    return rubric


@router.post("/rubrics/{rubric_id}/simulate", response_model=RubricSimulationResponse)
async def simulate_rubric(
    rubric_id: UUID,
    request: RubricSimulationRequest,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> RubricSimulationResponse:
    """Simulate rubric changes and see impact on rankings."""
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rúbrica no encontrada",
        )

    job = db.query(Job).filter(Job.id == request.job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo no encontrado",
        )

    # Get original ranking
    original_ranked = rank_candidates_for_job(db, job, 10)
    original_ranking = [
        {
            "candidate_id": str(r["candidate"].id),
            "rank": i + 1,
            "score": r["total_score"],
        }
        for i, r in enumerate(original_ranked)
    ]

    # Apply weight changes temporarily
    for criteria in rubric.criteria:
        if criteria.key in request.criteria_weights:
            criteria.weight = request.criteria_weights[criteria.key]

    # Get new ranking
    new_ranked = rank_candidates_for_job(db, job, 10)
    new_ranking = [
        {
            "candidate_id": str(r["candidate"].id),
            "rank": i + 1,
            "score": r["total_score"],
        }
        for i, r in enumerate(new_ranked)
    ]

    # Rollback weight changes
    db.rollback()

    # Calculate changes
    changes = []
    original_positions = {r["candidate_id"]: r["rank"] for r in original_ranking}
    for new in new_ranking:
        cid = new["candidate_id"]
        if cid in original_positions:
            old_rank = original_positions[cid]
            new_rank = new["rank"]
            if old_rank != new_rank:
                changes.append({
                    "candidate_id": cid,
                    "old_rank": old_rank,
                    "new_rank": new_rank,
                    "change": old_rank - new_rank,
                })

    return RubricSimulationResponse(
        original_ranking=original_ranking,
        new_ranking=new_ranking,
        changes=changes,
    )


# ============ Interview Review ============


@router.get("/interviews/flagged", response_model=list[InterviewSessionForReview])
async def get_flagged_interviews(
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> list[InterviewSession]:
    """Get interviews flagged for review."""
    return (
        db.query(InterviewSession)
        .filter(InterviewSession.requires_review == True)
        .filter(InterviewSession.status == InterviewStatus.COMPLETED)
        .order_by(InterviewSession.completed_at.desc())
        .limit(50)
        .all()
    )


@router.get("/interviews/{session_id}", response_model=InterviewSessionForReview)
async def get_interview_for_review(
    session_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> InterviewSession:
    """Get interview details for review."""
    session = db.query(InterviewSession).filter(InterviewSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión no encontrada",
        )
    return session


# ============ Score Override ============


@router.post("/reports/{report_id}/override", response_model=CandidateReportResponse)
async def override_report_score(
    report_id: UUID,
    request: ReportOverrideRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> CandidateReport:
    """Override a candidate report score."""
    report = db.query(CandidateReport).filter(CandidateReport.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reporte no encontrado",
        )

    original_score = report.overall_score

    report.original_score = original_score
    report.overall_score = request.new_score
    report.score_overridden = True
    report.override_reason = request.reason
    report.reviewed_by_id = current_user.id

    db.commit()
    db.refresh(report)

    # Log audit
    log_score_override(
        db=db,
        user_id=current_user.id,
        report_id=report.id,
        original_score=original_score or 0,
        new_score=request.new_score,
        reason=request.reason,
    )

    return report


# ============ Dashboard KPIs ============


@router.get("/dashboard/kpis", response_model=DashboardKPIs)
async def get_dashboard_kpis(
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> DashboardKPIs:
    """Get dashboard KPIs."""
    # Candidate metrics
    total_candidates = db.query(Candidate).count()
    candidates_with_interviews = (
        db.query(Candidate)
        .join(InterviewSession)
        .distinct()
        .count()
    )
    interviews_completed = (
        db.query(InterviewSession)
        .filter(InterviewSession.status == InterviewStatus.COMPLETED)
        .count()
    )
    interviews_in_progress = (
        db.query(InterviewSession)
        .filter(InterviewSession.status == InterviewStatus.IN_PROGRESS)
        .count()
    )

    # Job metrics
    active_jobs = db.query(Job).filter(Job.status == JobStatus.ACTIVE).count()

    # Shortlist metrics
    shortlists_generated = db.query(ShortlistItem.job_id).distinct().count()
    candidates_shortlisted = db.query(ShortlistItem).count()
    candidates_contacted = (
        db.query(ShortlistItem)
        .filter(ShortlistItem.status.in_([
            ShortlistStatus.CONTACTED,
            ShortlistStatus.INTERVIEW_SCHEDULED,
            ShortlistStatus.HIRED,
        ]))
        .count()
    )
    candidates_hired = (
        db.query(ShortlistItem)
        .filter(ShortlistItem.status == ShortlistStatus.HIRED)
        .count()
    )

    # Average scores
    avg_score_result = (
        db.query(func.avg(CandidateReport.overall_score))
        .filter(CandidateReport.status == ReportStatus.COMPLETED)
        .scalar()
    )
    avg_interview_score = float(avg_score_result) if avg_score_result else None

    # Flagged interviews
    flagged_interviews_count = (
        db.query(InterviewSession)
        .filter(InterviewSession.requires_review == True)
        .count()
    )

    # Score overrides
    score_overrides_count = (
        db.query(CandidateReport)
        .filter(CandidateReport.score_overridden == True)
        .count()
    )

    # Conversion rates
    interview_completion_rate = None
    if candidates_with_interviews > 0:
        interview_completion_rate = interviews_completed / candidates_with_interviews

    shortlist_to_contact_rate = None
    if candidates_shortlisted > 0:
        shortlist_to_contact_rate = candidates_contacted / candidates_shortlisted

    contact_to_hire_rate = None
    if candidates_contacted > 0:
        contact_to_hire_rate = candidates_hired / candidates_contacted

    return DashboardKPIs(
        total_candidates=total_candidates,
        candidates_with_interviews=candidates_with_interviews,
        interviews_completed=interviews_completed,
        interviews_in_progress=interviews_in_progress,
        active_jobs=active_jobs,
        total_applications=0,  # Would need applications table
        shortlists_generated=shortlists_generated,
        candidates_shortlisted=candidates_shortlisted,
        candidates_contacted=candidates_contacted,
        candidates_hired=candidates_hired,
        interview_completion_rate=interview_completion_rate,
        shortlist_to_contact_rate=shortlist_to_contact_rate,
        contact_to_hire_rate=contact_to_hire_rate,
        avg_interview_score=avg_interview_score,
        flagged_interviews_count=flagged_interviews_count,
        score_overrides_count=score_overrides_count,
    )


# ============ Audit Logs ============


@router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Get audit logs."""
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()

    return [
        {
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id),
            "action": log.action,
            "description": log.description,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]
