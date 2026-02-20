"""Health check endpoints."""

import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.core.config import settings
from app.schemas.base import BaseSchema

router = APIRouter(prefix="/health", tags=["Health"])


class ServiceStatus(BaseSchema):
    """Individual service health status."""

    status: str  # healthy, unhealthy, degraded
    latency_ms: Optional[float] = None
    message: Optional[str] = None


class HealthResponse(BaseSchema):
    """Full health check response."""

    status: str  # healthy, degraded, unhealthy
    timestamp: str
    version: str = "1.0.0"
    services: dict[str, ServiceStatus]


@router.get("", response_model=HealthResponse)
async def health_check(db: Session = Depends(get_db)) -> HealthResponse:
    """Check API health status with service-level details."""
    services: dict[str, ServiceStatus] = {}

    # ── Database check ────────────────────────────────────────
    try:
        start = time.monotonic()
        db.execute(text("SELECT 1"))
        latency = (time.monotonic() - start) * 1000
        services["database"] = ServiceStatus(
            status="healthy",
            latency_ms=round(latency, 2),
        )
    except Exception as e:
        services["database"] = ServiceStatus(
            status="unhealthy",
            message=str(e)[:100],
        )

    # ── OpenAI key check (no actual call) ─────────────────────
    if settings.llm_api_key and settings.llm_api_key.strip():
        services["openai"] = ServiceStatus(
            status="configured",
            message=f"model={settings.llm_model}",
        )
    else:
        services["openai"] = ServiceStatus(
            status="not_configured",
            message="LLM_API_KEY not set — AI features disabled",
        )

    # ── Storage check ─────────────────────────────────────────
    if settings.storage_enabled:
        services["storage"] = ServiceStatus(status="configured")
    else:
        services["storage"] = ServiceStatus(
            status="not_configured",
            message="MinIO/S3 not configured",
        )

    # ── Determine overall status ──────────────────────────────
    db_healthy = services["database"].status == "healthy"
    openai_ok = services["openai"].status == "configured"

    if db_healthy and openai_ok:
        overall = "healthy"
    elif db_healthy:
        overall = "degraded"
    else:
        overall = "unhealthy"

    return HealthResponse(
        status=overall,
        timestamp=datetime.utcnow().isoformat() + "Z",
        version="1.0.0",
        services=services,
    )


@router.get("/ready")
async def readiness_check() -> dict:
    """Kubernetes readiness probe."""
    return {"ready": True}


@router.get("/live")
async def liveness_check() -> dict:
    """Kubernetes liveness probe."""
    return {"alive": True}
