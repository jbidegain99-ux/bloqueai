"""Rate limiting utilities for OpenAI-powered endpoints.

Uses slowapi (already installed) with a custom key function that identifies
users by JWT user_id when authenticated, falling back to IP address.
"""

from fastapi import Request
from starlette.authentication import UnauthenticatedUser
import structlog

logger = structlog.get_logger()


def get_user_id_or_ip(request: Request) -> str:
    """Extract user identifier for rate limiting.

    Priority: JWT user_id from request state > client IP.
    This function is used as slowapi's key_func.
    """
    # Try to get user_id set by auth middleware or dependency
    user_id = getattr(request.state, "rate_limit_user_id", None)
    if user_id:
        return f"user:{user_id}"

    # Fallback to IP
    if request.client:
        return f"ip:{request.client.host}"

    return "ip:unknown"


# ── Rate limit strings (slowapi format) ──────────────────────────
# These are applied as decorators on individual endpoints

RATE_LIMIT_CV_ANALYSIS = "10/hour"
RATE_LIMIT_INTERVIEW = "20/hour"
RATE_LIMIT_COPILOT = "50/hour"
