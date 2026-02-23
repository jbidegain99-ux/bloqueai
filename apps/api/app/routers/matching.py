"""API endpoints for the candidate-job matching engine."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel as PydanticBase, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.match import CandidateJobMatch, MatchStatus
from app.models.user import User
from app.services.matching_service import matching_service, MatchFilters
from app.utils.deps import get_current_user, require_employer

router = APIRouter(prefix="/matching", tags=["matching"])


# ── Pydantic schemas ──────────────────────────────────────────────

class MatchResultSchema(PydanticBase):
    candidate_id: str
    job_id: str
    overall_score: float
    semantic_score: float
    skills_score: float
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class SaveMatchRequest(PydanticBase):
    candidate_id: str
    job_id: str
    overall_score: float
    semantic_score: float = 0.0
    skills_score: float = 0.0
    match_metadata: dict = Field(default_factory=dict)


class SaveMatchResponse(PydanticBase):
    id: str
    candidate_id: str
    job_id: str
    overall_score: float
    status: str
    created_at: str


class UpdateStatusRequest(PydanticBase):
    status: str
    recruiter_notes: Optional[str] = None


class SavedMatchSchema(PydanticBase):
    id: str
    candidate_id: str
    job_id: str
    overall_score: float
    semantic_score: float
    skills_score: float
    status: str
    match_metadata: Optional[dict] = None
    recruiter_notes: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: str


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/candidates-for-job/{job_id}", response_model=list[MatchResultSchema])
async def find_candidates_for_job(
    job_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    min_score: float = Query(0.0, ge=0, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employer),
):
    """Find best-matching candidates for a job posting."""
    filters = MatchFilters(min_score=min_score)
    try:
        results = await matching_service.find_candidates_for_job(
            db, job_id, limit=limit, filters=filters
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return [r.to_dict() for r in results]


@router.get("/jobs-for-candidate/{candidate_id}", response_model=list[MatchResultSchema])
async def find_jobs_for_candidate(
    candidate_id: UUID,
    limit: int = Query(20, ge=1, le=100),
    min_score: float = Query(0.0, ge=0, le=100),
    modality: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Find best-matching active jobs for a candidate."""
    filters = MatchFilters(min_score=min_score, modality=modality)
    try:
        results = await matching_service.find_jobs_for_candidate(
            db, candidate_id, limit=limit, filters=filters
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return [r.to_dict() for r in results]


@router.get("/score/{candidate_id}/{job_id}", response_model=MatchResultSchema)
async def calculate_match_score(
    candidate_id: UUID,
    job_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calculate the match score between a specific candidate and job."""
    try:
        result = await matching_service.calculate_match_score(db, candidate_id, job_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return result.to_dict()


@router.post("/save", response_model=SaveMatchResponse)
async def save_match(
    request: SaveMatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employer),
):
    """Save a match result to the database."""
    # Check for existing match
    existing = (
        db.query(CandidateJobMatch)
        .filter(
            CandidateJobMatch.candidate_id == request.candidate_id,
            CandidateJobMatch.job_id == request.job_id,
        )
        .first()
    )

    if existing:
        # Update scores
        existing.overall_score = request.overall_score
        existing.semantic_score = request.semantic_score
        existing.skills_score = request.skills_score
        existing.match_metadata = request.match_metadata
        db.commit()
        db.refresh(existing)
        return SaveMatchResponse(
            id=str(existing.id),
            candidate_id=str(existing.candidate_id),
            job_id=str(existing.job_id),
            overall_score=existing.overall_score,
            status=existing.status,
            created_at=str(existing.created_at),
        )

    match = CandidateJobMatch(
        candidate_id=request.candidate_id,
        job_id=request.job_id,
        overall_score=request.overall_score,
        semantic_score=request.semantic_score,
        skills_score=request.skills_score,
        match_metadata=request.match_metadata,
        status=MatchStatus.PENDING.value,
    )
    db.add(match)
    db.commit()
    db.refresh(match)

    return SaveMatchResponse(
        id=str(match.id),
        candidate_id=str(match.candidate_id),
        job_id=str(match.job_id),
        overall_score=match.overall_score,
        status=match.status,
        created_at=str(match.created_at),
    )


@router.patch("/status/{match_id}")
async def update_match_status(
    match_id: UUID,
    request: UpdateStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employer),
):
    """Update the status and/or notes of a saved match."""
    match = db.query(CandidateJobMatch).filter(CandidateJobMatch.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")

    # Validate status
    valid_statuses = {s.value for s in MatchStatus}
    if request.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}",
        )

    match.status = request.status
    if request.recruiter_notes is not None:
        match.recruiter_notes = request.recruiter_notes
    match.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(match)

    return {
        "id": str(match.id),
        "status": match.status,
        "recruiter_notes": match.recruiter_notes,
        "reviewed_at": str(match.reviewed_at),
    }


@router.get("/job/{job_id}/matches", response_model=list[SavedMatchSchema])
async def get_matches_for_job(
    job_id: UUID,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_employer),
):
    """Get all saved matches for a job, ordered by score."""
    query = (
        db.query(CandidateJobMatch)
        .filter(CandidateJobMatch.job_id == job_id)
    )

    if status:
        query = query.filter(CandidateJobMatch.status == status)

    matches = query.order_by(CandidateJobMatch.overall_score.desc()).all()

    return [
        SavedMatchSchema(
            id=str(m.id),
            candidate_id=str(m.candidate_id),
            job_id=str(m.job_id),
            overall_score=m.overall_score,
            semantic_score=m.semantic_score,
            skills_score=m.skills_score,
            status=m.status,
            match_metadata=m.match_metadata,
            recruiter_notes=m.recruiter_notes,
            reviewed_at=str(m.reviewed_at) if m.reviewed_at else None,
            created_at=str(m.created_at),
        )
        for m in matches
    ]


@router.get("/candidate/{candidate_id}/matches", response_model=list[SavedMatchSchema])
async def get_matches_for_candidate(
    candidate_id: UUID,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all saved matches for a candidate, ordered by score."""
    query = (
        db.query(CandidateJobMatch)
        .filter(CandidateJobMatch.candidate_id == candidate_id)
    )

    if status:
        query = query.filter(CandidateJobMatch.status == status)

    matches = query.order_by(CandidateJobMatch.overall_score.desc()).all()

    return [
        SavedMatchSchema(
            id=str(m.id),
            candidate_id=str(m.candidate_id),
            job_id=str(m.job_id),
            overall_score=m.overall_score,
            semantic_score=m.semantic_score,
            skills_score=m.skills_score,
            status=m.status,
            match_metadata=m.match_metadata,
            recruiter_notes=m.recruiter_notes,
            reviewed_at=str(m.reviewed_at) if m.reviewed_at else None,
            created_at=str(m.created_at),
        )
        for m in matches
    ]
