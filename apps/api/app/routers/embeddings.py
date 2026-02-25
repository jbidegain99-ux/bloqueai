"""API endpoints for embedding generation and management."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User
from app.services.profile_embedding_service import profile_embedding_service
from app.utils.deps import get_current_user, require_admin

router = APIRouter(prefix="/embeddings", tags=["embeddings"])


class BulkGenerateRequest(BaseModel):
    """Request body for bulk embedding generation."""

    entity_type: str  # "candidates" or "jobs"
    limit: int = 100
    force: bool = False


class BulkGenerateResponse(BaseModel):
    """Response for bulk embedding generation."""

    message: str
    count: int


@router.post("/generate/candidate/{candidate_id}")
async def generate_candidate_embedding(
    candidate_id: str,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate embedding for a specific candidate."""
    candidate = await profile_embedding_service.generate_candidate_embedding(
        db, candidate_id, force=force
    )

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    return {
        "message": "Embedding generated",
        "candidate_id": candidate_id,
        "has_embedding": candidate.profile_embedding is not None,
        "updated_at": str(candidate.embedding_updated_at) if candidate.embedding_updated_at else None,
    }


@router.post("/generate/job/{job_id}")
async def generate_job_embedding(
    job_id: str,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate embedding for a specific job posting."""
    job = await profile_embedding_service.generate_job_embedding(
        db, job_id, force=force
    )

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "message": "Embedding generated",
        "job_id": job_id,
        "has_embedding": job.job_embedding is not None,
        "updated_at": str(job.embedding_updated_at) if job.embedding_updated_at else None,
    }


@router.post("/generate/bulk", response_model=BulkGenerateResponse)
async def bulk_generate_embeddings(
    request: BulkGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Generate embeddings in bulk (admin only)."""
    if request.entity_type == "candidates":
        count = await profile_embedding_service.bulk_generate_candidate_embeddings(
            db, limit=request.limit, force=request.force
        )
    elif request.entity_type == "jobs":
        count = await profile_embedding_service.bulk_generate_job_embeddings(
            db, limit=request.limit, force=request.force
        )
    else:
        raise HTTPException(
            status_code=400,
            detail="entity_type must be 'candidates' or 'jobs'",
        )

    return BulkGenerateResponse(
        message=f"Generated embeddings for {count} {request.entity_type}",
        count=count,
    )


@router.get("/stats")
async def get_embedding_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get embedding statistics (admin only)."""
    total_candidates = db.query(Candidate).count()
    candidates_with_embedding = db.query(Candidate).filter(
        Candidate.profile_embedding.isnot(None)
    ).count()

    total_jobs = db.query(Job).count()
    jobs_with_embedding = db.query(Job).filter(
        Job.job_embedding.isnot(None)
    ).count()

    return {
        "candidates": {
            "total": total_candidates,
            "with_embedding": candidates_with_embedding,
            "percentage": (
                round(candidates_with_embedding / total_candidates * 100, 1)
                if total_candidates > 0
                else 0
            ),
        },
        "jobs": {
            "total": total_jobs,
            "with_embedding": jobs_with_embedding,
            "percentage": (
                round(jobs_with_embedding / total_jobs * 100, 1)
                if total_jobs > 0
                else 0
            ),
        },
    }
