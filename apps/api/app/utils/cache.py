"""PostgreSQL-based cache utilities for CV analysis."""

import hashlib
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
import structlog

from app.models.cache import CVAnalysisCache

logger = structlog.get_logger()


def generate_cache_key(cv_text: str, job_id: str) -> str:
    """Generate SHA-256 hash from CV text + job_id as cache key."""
    content = f"{cv_text}::{job_id}"
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def get_cached_analysis(db: Session, cache_key: str) -> Optional[dict]:
    """Look up a cached CV analysis result.

    Returns the cached result dict if found and not expired, None otherwise.
    Graceful degradation: returns None on any DB error.
    """
    try:
        entry = (
            db.query(CVAnalysisCache)
            .filter(
                CVAnalysisCache.cache_key == cache_key,
                CVAnalysisCache.expires_at > datetime.utcnow(),
            )
            .first()
        )
        if entry:
            logger.info("cv_analysis_cache_hit", cache_key=cache_key[:12])
            return entry.result
        logger.info("cv_analysis_cache_miss", cache_key=cache_key[:12])
        return None
    except Exception as e:
        logger.warning("cv_analysis_cache_read_error", error=str(e), cache_key=cache_key[:12])
        return None


def set_cached_analysis(
    db: Session,
    cache_key: str,
    result: dict,
    job_id: Optional[UUID] = None,
    ttl_hours: int = 24,
) -> None:
    """Store a CV analysis result in cache.

    Graceful degradation: silently fails on any DB error.
    """
    try:
        expires_at = datetime.utcnow() + timedelta(hours=ttl_hours)

        # Upsert: update if exists, insert if not
        existing = (
            db.query(CVAnalysisCache)
            .filter(CVAnalysisCache.cache_key == cache_key)
            .first()
        )
        if existing:
            existing.result = result
            existing.expires_at = expires_at
            existing.updated_at = datetime.utcnow()
        else:
            entry = CVAnalysisCache(
                id=uuid4(),
                cache_key=cache_key,
                result=result,
                job_id=job_id,
                expires_at=expires_at,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(entry)

        db.flush()
        logger.info("cv_analysis_cache_set", cache_key=cache_key[:12], ttl_hours=ttl_hours)
    except Exception as e:
        logger.warning("cv_analysis_cache_write_error", error=str(e), cache_key=cache_key[:12])
        try:
            db.rollback()
        except Exception:
            pass


def cleanup_expired_cache(db: Session) -> int:
    """Delete expired cache entries. Returns number of entries deleted."""
    try:
        count = (
            db.query(CVAnalysisCache)
            .filter(CVAnalysisCache.expires_at < datetime.utcnow())
            .delete()
        )
        db.commit()
        logger.info("cv_analysis_cache_cleanup", deleted=count)
        return count
    except Exception as e:
        logger.error("cv_analysis_cache_cleanup_error", error=str(e))
        db.rollback()
        return 0
