"""Billing API endpoints for TalentOS."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.utils.deps import get_current_user
from app.schemas.billing import (
    PlanResponse,
    SubscriptionResponse,
    InvoiceResponse,
    UsageCheckResponse,
    LimitCheckResponse,
    CreateSubscriptionRequest,
    UpgradeRequest,
    CancelRequest,
)
from app.services import billing_service

router = APIRouter(prefix="/billing", tags=["billing"])


# ── Public endpoints ─────────────────────────────────────────────


@router.get("/plans", response_model=list[PlanResponse])
async def list_plans(db: Session = Depends(get_db)):
    """Get all available plans."""
    plans = billing_service.get_plans(db)
    return plans


# ── Authenticated endpoints ──────────────────────────────────────


@router.get("/subscription", response_model=Optional[SubscriptionResponse])
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current company subscription."""
    if not current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no pertenece a una empresa",
        )
    subscription = billing_service.get_current_subscription(db, current_user.company_id)
    return subscription


@router.post("/subscribe", response_model=SubscriptionResponse)
async def subscribe(
    request: CreateSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new subscription."""
    if not current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no pertenece a una empresa",
        )
    subscription = billing_service.create_subscription(
        db=db,
        company_id=current_user.company_id,
        plan_id=request.plan_id,
        is_annual=request.is_annual,
    )
    return subscription


@router.post("/upgrade", response_model=SubscriptionResponse)
async def upgrade(
    request: UpgradeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upgrade or change subscription plan."""
    if not current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no pertenece a una empresa",
        )
    subscription = billing_service.upgrade_subscription(
        db=db,
        company_id=current_user.company_id,
        new_plan_id=request.new_plan_id,
        is_annual=request.is_annual,
    )
    return subscription


@router.post("/cancel", response_model=SubscriptionResponse)
async def cancel(
    request: CancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel subscription."""
    if not current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no pertenece a una empresa",
        )
    subscription = billing_service.cancel_subscription(
        db=db,
        company_id=current_user.company_id,
        cancel_at_period_end=request.cancel_at_period_end,
        reason=request.reason,
    )
    return subscription


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(
    limit: int = Query(default=20, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get invoices for the current company."""
    if not current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no pertenece a una empresa",
        )
    invoices = billing_service.get_invoices(db, current_user.company_id, limit=limit)
    return invoices


@router.get("/check-feature", response_model=UsageCheckResponse)
async def check_feature(
    feature: str = Query(..., description="Feature key to check"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if the company has access to a specific feature."""
    if not current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no pertenece a una empresa",
        )
    result = billing_service.check_feature_access(db, current_user.company_id, feature)
    return result


@router.get("/check-limit", response_model=LimitCheckResponse)
async def check_limit(
    limit_type: str = Query(..., description="Limit type to check"),
    current_count: int = Query(..., description="Current usage count"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if the company is within plan limits."""
    if not current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no pertenece a una empresa",
        )
    result = billing_service.check_limit(db, current_user.company_id, limit_type, current_count)
    return result
