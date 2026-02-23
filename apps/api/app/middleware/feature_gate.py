"""Feature gating decorators for plan-based access control."""

from functools import wraps
from typing import Callable

from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.utils.deps import get_current_user
from app.services import billing_service


def require_feature(feature: str):
    """Dependency that checks if the user's company has access to a feature.

    Usage:
        @router.get("/some-endpoint")
        async def endpoint(
            _gate: None = Depends(require_feature("ai_matching")),
            current_user: User = Depends(get_current_user),
        ):
            ...
    """

    async def _check(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> None:
        if not current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuario no pertenece a una empresa",
            )

        result = billing_service.check_feature_access(db, current_user.company_id, feature)
        if not result["has_access"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Su plan no incluye la función '{feature}'. Actualice su plan para continuar.",
            )

    return _check


def require_limit(limit_type: str, count_getter: Callable[..., int]):
    """Dependency that checks if the user's company is within a plan limit.

    The count_getter is a callable that receives (db, company_id) and returns the current count.

    Usage:
        def get_job_count(db: Session, company_id) -> int:
            return db.query(Job).filter(Job.company_id == company_id).count()

        @router.post("/jobs")
        async def create_job(
            _gate: None = Depends(require_limit("jobs", get_job_count)),
            current_user: User = Depends(get_current_user),
        ):
            ...
    """

    async def _check(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> None:
        if not current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuario no pertenece a una empresa",
            )

        current_count = count_getter(db, current_user.company_id)
        result = billing_service.check_limit(db, current_user.company_id, limit_type, current_count)

        if not result["has_capacity"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Ha alcanzado el límite de {result['max_allowed']} para '{limit_type}' "
                    f"en su plan {result['plan_tier']}. Actualice su plan para continuar."
                ),
            )

    return _check
