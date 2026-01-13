"""API routers for TalentOS."""

from app.routers.auth import router as auth_router
from app.routers.candidate import router as candidate_router
from app.routers.employer import router as employer_router
from app.routers.admin import router as admin_router
from app.routers.health import router as health_router
from app.routers.public import router as public_router
from app.routers.applications import router as applications_router

__all__ = [
    "auth_router",
    "candidate_router",
    "employer_router",
    "admin_router",
    "health_router",
    "public_router",
    "applications_router",
]
