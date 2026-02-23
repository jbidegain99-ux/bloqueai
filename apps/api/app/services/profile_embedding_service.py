"""Service for generating and updating embeddings for candidate profiles and jobs."""

from datetime import datetime
from typing import Optional

import structlog
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.job import Job
from app.services.embedding_service import embedding_service

logger = structlog.get_logger()


class ProfileEmbeddingService:
    """Generates and updates embeddings for candidate profiles and job postings."""

    def _build_candidate_text(self, candidate: Candidate) -> str:
        """Build representative text from a candidate profile for embedding.

        Combines: headline, summary, skills, experience, education, AI summary.
        """
        parts: list[str] = []

        if candidate.headline:
            parts.append(f"Title: {candidate.headline}")

        if candidate.summary:
            parts.append(f"Summary: {candidate.summary}")

        if candidate.skills:
            skills = candidate.skills
            if isinstance(skills, list):
                skills_text = ", ".join(str(s) for s in skills)
            else:
                skills_text = str(skills)
            parts.append(f"Skills: {skills_text}")

        if candidate.experience:
            exp_texts: list[str] = []
            exps = candidate.experience if isinstance(candidate.experience, list) else []
            for exp in exps:
                if isinstance(exp, dict):
                    exp_text = f"{exp.get('title', '')} at {exp.get('company', '')}"
                    if exp.get("description"):
                        exp_text += f": {exp['description']}"
                    exp_texts.append(exp_text)
            if exp_texts:
                parts.append(f"Experience: {'; '.join(exp_texts)}")

        if candidate.education:
            edu_texts: list[str] = []
            edus = candidate.education if isinstance(candidate.education, list) else []
            for edu in edus:
                if isinstance(edu, dict):
                    edu_text = (
                        f"{edu.get('degree', '')} in {edu.get('field', '')} "
                        f"from {edu.get('institution', '')}"
                    )
                    edu_texts.append(edu_text)
            if edu_texts:
                parts.append(f"Education: {'; '.join(edu_texts)}")

        if candidate.ai_summary:
            parts.append(f"AI Summary: {candidate.ai_summary}")

        return "\n\n".join(parts)

    def _build_job_text(self, job: Job) -> str:
        """Build representative text from a job posting for embedding.

        Combines: title, description, must_haves, nice_to_haves,
        responsibilities, location, modality.
        """
        parts: list[str] = []

        if job.title:
            parts.append(f"Position: {job.title}")

        if job.description:
            parts.append(f"Description: {job.description}")

        if job.must_haves:
            items = job.must_haves
            if isinstance(items, list):
                text = ", ".join(str(i) for i in items)
            else:
                text = str(items)
            parts.append(f"Requirements: {text}")

        if job.nice_to_haves:
            items = job.nice_to_haves
            if isinstance(items, list):
                text = ", ".join(str(i) for i in items)
            else:
                text = str(items)
            parts.append(f"Nice to have: {text}")

        if job.responsibilities:
            items = job.responsibilities
            if isinstance(items, list):
                text = ", ".join(str(i) for i in items)
            else:
                text = str(items)
            parts.append(f"Responsibilities: {text}")

        if job.location:
            parts.append(f"Location: {job.location}")

        if job.modality:
            modality_val = job.modality.value if hasattr(job.modality, "value") else str(job.modality)
            parts.append(f"Work Type: {modality_val}")

        if job.category:
            category_val = job.category.value if hasattr(job.category, "value") else str(job.category)
            parts.append(f"Category: {category_val}")

        if job.seniority:
            seniority_val = job.seniority.value if hasattr(job.seniority, "value") else str(job.seniority)
            parts.append(f"Seniority: {seniority_val}")

        return "\n\n".join(parts)

    async def generate_candidate_embedding(
        self,
        db: Session,
        candidate_id: str,
        force: bool = False,
    ) -> Optional[Candidate]:
        """Generate or update embedding for a candidate.

        Args:
            db: Database session.
            candidate_id: UUID of the candidate.
            force: If True, regenerate even if embedding exists.

        Returns:
            Updated Candidate or None if not found.
        """
        candidate = db.query(Candidate).filter(
            Candidate.id == candidate_id
        ).first()

        if not candidate:
            logger.warning("candidate_not_found", candidate_id=candidate_id)
            return None

        if candidate.profile_embedding is not None and not force:
            logger.info("candidate_embedding_exists", candidate_id=candidate_id)
            return candidate

        text = self._build_candidate_text(candidate)

        if not text.strip():
            logger.warning("candidate_no_text", candidate_id=candidate_id)
            return candidate

        result = await embedding_service.generate_embedding(text)

        candidate.profile_embedding = result.embedding
        candidate.embedding_updated_at = datetime.utcnow()

        db.commit()
        db.refresh(candidate)

        logger.info("candidate_embedding_generated", candidate_id=candidate_id)
        return candidate

    async def generate_job_embedding(
        self,
        db: Session,
        job_id: str,
        force: bool = False,
    ) -> Optional[Job]:
        """Generate or update embedding for a job posting.

        Args:
            db: Database session.
            job_id: UUID of the job.
            force: If True, regenerate even if embedding exists.

        Returns:
            Updated Job or None if not found.
        """
        job = db.query(Job).filter(Job.id == job_id).first()

        if not job:
            logger.warning("job_not_found", job_id=job_id)
            return None

        if job.job_embedding is not None and not force:
            logger.info("job_embedding_exists", job_id=job_id)
            return job

        text = self._build_job_text(job)

        if not text.strip():
            logger.warning("job_no_text", job_id=job_id)
            return job

        result = await embedding_service.generate_embedding(text)

        job.job_embedding = result.embedding
        job.embedding_updated_at = datetime.utcnow()

        db.commit()
        db.refresh(job)

        logger.info("job_embedding_generated", job_id=job_id)
        return job

    async def bulk_generate_candidate_embeddings(
        self,
        db: Session,
        limit: int = 100,
        force: bool = False,
    ) -> int:
        """Generate embeddings for candidates that don't have one.

        Useful for initial migration or backfill.
        """
        query = db.query(Candidate)

        if not force:
            query = query.filter(Candidate.profile_embedding.is_(None))

        candidates = query.limit(limit).all()

        count = 0
        for candidate in candidates:
            try:
                await self.generate_candidate_embedding(
                    db, str(candidate.id), force=True
                )
                count += 1
            except Exception as e:
                logger.error(
                    "candidate_embedding_failed",
                    candidate_id=str(candidate.id),
                    error=str(e),
                )

        logger.info("bulk_candidate_embeddings_done", count=count)
        return count

    async def bulk_generate_job_embeddings(
        self,
        db: Session,
        limit: int = 100,
        force: bool = False,
    ) -> int:
        """Generate embeddings for jobs that don't have one."""
        query = db.query(Job)

        if not force:
            query = query.filter(Job.job_embedding.is_(None))

        jobs = query.limit(limit).all()

        count = 0
        for job in jobs:
            try:
                await self.generate_job_embedding(db, str(job.id), force=True)
                count += 1
            except Exception as e:
                logger.error(
                    "job_embedding_failed",
                    job_id=str(job.id),
                    error=str(e),
                )

        logger.info("bulk_job_embeddings_done", count=count)
        return count


# Singleton instance
profile_embedding_service = ProfileEmbeddingService()
