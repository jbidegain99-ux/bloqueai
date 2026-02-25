"""PostgreSQL-based cache utilities for CV analysis.

Graceful degradation: all operations silently return defaults when the
``cv_analysis_cache`` table does not exist in the database (e.g. production
at an older migration).  Importantly, failures never call ``db.rollback()``
on the caller's session — instead we use SAVEPOINTs so that only the cache
operation is rolled back while the surrounding transaction stays intact.
"""

import hashlib
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
import structlog

logger = structlog.get_logger()

# Module-level flag: set to False after the first failure so we stop
# hitting a table that doesn't exist for the rest of the process lifetime.
_cache_available: Optional[bool] = None


def _is_cache_available(db: Session) -> bool:
    """Check once whether the cv_analysis_cache table exists."""
    global _cache_available
    if _cache_available is not None:
        return _cache_available
    try:
        insp = inspect(db.bind)
        _cache_available = insp.has_table("cv_analysis_cache")
    except Exception:
        _cache_available = False
    if not _cache_available:
        logger.info("cv_analysis_cache_table_missing_skipping")
    return _cache_available


def generate_cache_key(cv_text: str, job_id: str) -> str:
    """Generate SHA-256 hash from CV text + job_id as cache key."""
    content = f"{cv_text}::{job_id}"
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def get_cached_analysis(db: Session, cache_key: str) -> Optional[dict]:
    """Look up a cached CV analysis result.

    Returns the cached result dict if found and not expired, None otherwise.
    Graceful degradation: returns None on any DB error.
    """
    if not _is_cache_available(db):
        return None
    try:
        from app.models.cache import CVAnalysisCache
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

    Uses a SAVEPOINT so that a failure here never rolls back the caller's
    transaction.
    """
    if not _is_cache_available(db):
        return
    try:
        from app.models.cache import CVAnalysisCache
        expires_at = datetime.utcnow() + timedelta(hours=ttl_hours)

        nested = db.begin_nested()  # SAVEPOINT
        try:
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
            nested.commit()
            logger.info("cv_analysis_cache_set", cache_key=cache_key[:12], ttl_hours=ttl_hours)
        except Exception:
            nested.rollback()
            raise
    except Exception as e:
        logger.warning("cv_analysis_cache_write_error", error=str(e), cache_key=cache_key[:12])


def cleanup_expired_cache(db: Session) -> int:
    """Delete expired cache entries. Returns number of entries deleted."""
    if not _is_cache_available(db):
        return 0
    try:
        from app.models.cache import CVAnalysisCache
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
