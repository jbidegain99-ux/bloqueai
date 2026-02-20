"""CV Analysis Cache model for PostgreSQL-based caching."""

from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class CVAnalysisCache(BaseModel):
    """Cache for CV analysis results to avoid re-calling OpenAI."""

    __tablename__ = "cv_analysis_cache"

    # SHA-256 hash of (cv_text + job_id) — unique lookup key
    cache_key = Column(String(64), unique=True, nullable=False, index=True)

    # The cached analysis result (match_score, candidate_profile, etc.)
    result = Column(JSONB, nullable=False)

    # Optional: link to job for potential invalidation
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)

    # When this cache entry expires
    expires_at = Column(DateTime, nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<CVAnalysisCache {self.cache_key[:12]}... expires={self.expires_at}>"
