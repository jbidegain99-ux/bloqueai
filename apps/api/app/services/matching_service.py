"""Matching engine: finds candidate-job matches using vector similarity + skills overlap."""

from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.job import Job, JobStatus
from app.models.user import User
from app.services.embedding_service import embedding_service
from app.services.profile_embedding_service import profile_embedding_service

logger = structlog.get_logger()

# Scoring weights
WEIGHT_SEMANTIC = 0.60
WEIGHT_SKILLS = 0.25
WEIGHT_OTHER = 0.15

# Minimum cosine similarity to consider a match
MIN_COSINE_SIMILARITY = 0.5


class MatchFilters:
    """Filters for matching queries."""

    def __init__(
        self,
        min_score: float = 0.0,
        modality: Optional[str] = None,
        location: Optional[str] = None,
    ) -> None:
        self.min_score = min_score
        self.modality = modality
        self.location = location


class MatchResult:
    """A single match result with scores and metadata."""

    def __init__(
        self,
        candidate_id: UUID,
        job_id: UUID,
        overall_score: float,
        semantic_score: float,
        skills_score: float,
        candidate_name: Optional[str] = None,
        job_title: Optional[str] = None,
        matched_skills: Optional[list[str]] = None,
        missing_skills: Optional[list[str]] = None,
        metadata: Optional[dict] = None,
    ) -> None:
        self.candidate_id = candidate_id
        self.job_id = job_id
        self.overall_score = overall_score
        self.semantic_score = semantic_score
        self.skills_score = skills_score
        self.candidate_name = candidate_name
        self.job_title = job_title
        self.matched_skills = matched_skills or []
        self.missing_skills = missing_skills or []
        self.metadata = metadata or {}

    def to_dict(self) -> dict:
        return {
            "candidate_id": str(self.candidate_id),
            "job_id": str(self.job_id),
            "overall_score": round(self.overall_score, 2),
            "semantic_score": round(self.semantic_score, 2),
            "skills_score": round(self.skills_score, 2),
            "candidate_name": self.candidate_name,
            "job_title": self.job_title,
            "matched_skills": self.matched_skills,
            "missing_skills": self.missing_skills,
            "metadata": self.metadata,
        }


class MatchingService:
    """Core matching engine using vector similarity and skills overlap."""

    async def find_candidates_for_job(
        self,
        db: Session,
        job_id: UUID,
        limit: int = 20,
        filters: Optional[MatchFilters] = None,
    ) -> list[MatchResult]:
        """Find best-matching candidates for a given job.

        Uses pgvector cosine distance for semantic similarity,
        then enriches with skills overlap scoring.
        """
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        # Auto-generate embedding if missing
        if job.job_embedding is None:
            job = await profile_embedding_service.generate_job_embedding(
                db, str(job_id), force=True
            )
            if not job or job.job_embedding is None:
                logger.warning("job_no_embedding", job_id=str(job_id))
                return []

        # Query candidates via pgvector cosine distance
        # cosine distance = 1 - cosine_similarity, so similarity = 1 - distance
        sql = text("""
            SELECT
                c.id AS candidate_id,
                u.full_name AS candidate_name,
                c.skills AS candidate_skills,
                1 - (c.profile_embedding <=> (
                    SELECT job_embedding FROM jobs WHERE id = :job_id
                )) AS cosine_sim
            FROM candidates c
            JOIN users u ON u.id = c.user_id
            WHERE c.profile_embedding IS NOT NULL
              AND 1 - (c.profile_embedding <=> (
                    SELECT job_embedding FROM jobs WHERE id = :job_id
              )) >= :min_sim
            ORDER BY cosine_sim DESC
            LIMIT :limit
        """)

        rows = db.execute(
            sql,
            {
                "job_id": str(job_id),
                "min_sim": MIN_COSINE_SIMILARITY,
                "limit": limit,
            },
        ).fetchall()

        required_skills = _normalize_skills_list(job.must_haves)
        min_score = filters.min_score if filters else 0.0

        results: list[MatchResult] = []
        for row in rows:
            semantic = row.cosine_sim * 100  # Scale to 0-100

            candidate_skills = _normalize_skills_list(row.candidate_skills)
            skills_result = _calculate_skills_score(candidate_skills, required_skills)

            overall = (
                WEIGHT_SEMANTIC * semantic
                + WEIGHT_SKILLS * skills_result["score"]
                + WEIGHT_OTHER * 50.0  # Neutral baseline for other factors
            )

            if overall < min_score:
                continue

            results.append(
                MatchResult(
                    candidate_id=row.candidate_id,
                    job_id=job_id,
                    overall_score=overall,
                    semantic_score=semantic,
                    skills_score=skills_result["score"],
                    candidate_name=row.candidate_name,
                    job_title=job.title,
                    matched_skills=skills_result["matched"],
                    missing_skills=skills_result["missing"],
                    metadata={
                        "weights": {
                            "semantic": WEIGHT_SEMANTIC,
                            "skills": WEIGHT_SKILLS,
                            "other": WEIGHT_OTHER,
                        },
                    },
                )
            )

        results.sort(key=lambda r: r.overall_score, reverse=True)
        return results

    async def find_jobs_for_candidate(
        self,
        db: Session,
        candidate_id: UUID,
        limit: int = 20,
        filters: Optional[MatchFilters] = None,
    ) -> list[MatchResult]:
        """Find best-matching active jobs for a given candidate."""
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        # Auto-generate embedding if missing
        if candidate.profile_embedding is None:
            candidate = await profile_embedding_service.generate_candidate_embedding(
                db, str(candidate_id), force=True
            )
            if not candidate or candidate.profile_embedding is None:
                logger.warning("candidate_no_embedding", candidate_id=str(candidate_id))
                return []

        # Build dynamic WHERE clauses
        extra_where = ""
        params: dict = {
            "candidate_id": str(candidate_id),
            "min_sim": MIN_COSINE_SIMILARITY,
            "active_status": JobStatus.ACTIVE.value,
            "limit": limit,
        }

        if filters and filters.modality:
            extra_where += " AND j.modality = :modality"
            params["modality"] = filters.modality

        sql = text(f"""
            SELECT
                j.id AS job_id,
                j.title AS job_title,
                j.must_haves AS required_skills,
                j.modality AS modality,
                j.salary_min,
                j.salary_max,
                1 - (j.job_embedding <=> (
                    SELECT profile_embedding FROM candidates WHERE id = :candidate_id
                )) AS cosine_sim
            FROM jobs j
            WHERE j.job_embedding IS NOT NULL
              AND j.status = :active_status
              AND 1 - (j.job_embedding <=> (
                    SELECT profile_embedding FROM candidates WHERE id = :candidate_id
              )) >= :min_sim
              {extra_where}
            ORDER BY cosine_sim DESC
            LIMIT :limit
        """)

        rows = db.execute(sql, params).fetchall()

        candidate_skills = _normalize_skills_list(candidate.skills)
        min_score = filters.min_score if filters else 0.0

        # Get candidate name via user relationship
        user = db.query(User).filter(User.id == candidate.user_id).first()
        candidate_name = user.full_name if user else None

        results: list[MatchResult] = []
        for row in rows:
            semantic = row.cosine_sim * 100

            required_skills = _normalize_skills_list(row.required_skills)
            skills_result = _calculate_skills_score(candidate_skills, required_skills)

            overall = (
                WEIGHT_SEMANTIC * semantic
                + WEIGHT_SKILLS * skills_result["score"]
                + WEIGHT_OTHER * 50.0
            )

            if overall < min_score:
                continue

            results.append(
                MatchResult(
                    candidate_id=candidate_id,
                    job_id=row.job_id,
                    overall_score=overall,
                    semantic_score=semantic,
                    skills_score=skills_result["score"],
                    candidate_name=candidate_name,
                    job_title=row.job_title,
                    matched_skills=skills_result["matched"],
                    missing_skills=skills_result["missing"],
                    metadata={
                        "modality": row.modality,
                        "salary_range": {
                            "min": row.salary_min,
                            "max": row.salary_max,
                        },
                    },
                )
            )

        results.sort(key=lambda r: r.overall_score, reverse=True)
        return results

    async def calculate_match_score(
        self,
        db: Session,
        candidate_id: UUID,
        job_id: UUID,
    ) -> MatchResult:
        """Calculate the match score between a specific candidate and job."""
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        # Auto-generate embeddings if missing
        if candidate.profile_embedding is None:
            candidate = await profile_embedding_service.generate_candidate_embedding(
                db, str(candidate_id), force=True
            )
        if job.job_embedding is None:
            job = await profile_embedding_service.generate_job_embedding(
                db, str(job_id), force=True
            )

        # Calculate semantic score
        if candidate.profile_embedding is not None and job.job_embedding is not None:
            cosine_sim = embedding_service.cosine_similarity(
                list(candidate.profile_embedding),
                list(job.job_embedding),
            )
            semantic = cosine_sim * 100
        else:
            semantic = 0.0

        # Calculate skills score
        candidate_skills = _normalize_skills_list(candidate.skills)
        required_skills = _normalize_skills_list(job.must_haves)
        skills_result = _calculate_skills_score(candidate_skills, required_skills)

        overall = (
            WEIGHT_SEMANTIC * semantic
            + WEIGHT_SKILLS * skills_result["score"]
            + WEIGHT_OTHER * 50.0
        )

        # Get candidate name
        user = db.query(User).filter(User.id == candidate.user_id).first()
        candidate_name = user.full_name if user else None

        return MatchResult(
            candidate_id=candidate_id,
            job_id=job_id,
            overall_score=overall,
            semantic_score=semantic,
            skills_score=skills_result["score"],
            candidate_name=candidate_name,
            job_title=job.title,
            matched_skills=skills_result["matched"],
            missing_skills=skills_result["missing"],
            metadata={
                "weights": {
                    "semantic": WEIGHT_SEMANTIC,
                    "skills": WEIGHT_SKILLS,
                    "other": WEIGHT_OTHER,
                },
            },
        )


def _normalize_skills_list(skills: object) -> list[str]:
    """Normalize a JSONB skills field to a list of lowercase strings."""
    if not skills:
        return []
    if isinstance(skills, list):
        return [str(s).strip().lower() for s in skills if s]
    return []


def _calculate_skills_score(
    candidate_skills: list[str],
    required_skills: list[str],
) -> dict:
    """Calculate skills overlap score.

    Returns dict with score (0-100), matched skills, and missing skills.
    """
    if not required_skills:
        return {"score": 50.0, "matched": [], "missing": []}

    candidate_set = set(candidate_skills)
    required_set_lower = {s.lower() for s in required_skills}

    matched = [s for s in required_skills if s.lower() in candidate_set]
    missing = [s for s in required_skills if s.lower() not in candidate_set]

    score = (len(matched) / len(required_set_lower)) * 100

    return {"score": score, "matched": matched, "missing": missing}


# Singleton instance
matching_service = MatchingService()
