"""Billing and subscription schemas for TalentOS."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.base import BaseSchema


# ── Response Schemas ─────────────────────────────────────────────


class PlanResponse(BaseSchema):
    """Plan details response."""

    id: UUID
    name: str
    tier: str
    description: Optional[str] = None
    price_monthly: float
    price_annual: float
    currency: str
    is_active: bool
    limits: dict
    features: list
    created_at: datetime


class SubscriptionResponse(BaseSchema):
    """Subscription details response."""

    id: UUID
    company_id: UUID
    plan_id: UUID
    plan: PlanResponse
    status: str
    is_annual: bool
    trial_ends_at: Optional[datetime] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    canceled_at: Optional[datetime] = None
    cancel_at_period_end: bool
    created_at: datetime
    updated_at: datetime


class InvoiceResponse(BaseSchema):
    """Invoice details response."""

    id: UUID
    subscription_id: UUID
    company_id: UUID
    amount: float
    currency: str
    status: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    description: Optional[str] = None
    created_at: datetime


class UsageCheckResponse(BaseSchema):
    """Feature access check response."""

    feature: str
    has_access: bool
    plan_tier: str
    message: Optional[str] = None


class LimitCheckResponse(BaseSchema):
    """Limit check response."""

    limit_type: str
    current_usage: int
    max_allowed: int
    has_capacity: bool
    plan_tier: str


# ── Request Schemas ──────────────────────────────────────────────


class CreateSubscriptionRequest(BaseModel):
    """Create subscription request."""

    model_config = ConfigDict(from_attributes=True)

    plan_id: UUID
    is_annual: bool = False


class UpgradeRequest(BaseModel):
    """Upgrade/change plan request."""

    model_config = ConfigDict(from_attributes=True)

    new_plan_id: UUID
    is_annual: bool = False


class CancelRequest(BaseModel):
    """Cancel subscription request."""

    model_config = ConfigDict(from_attributes=True)

    cancel_at_period_end: bool = True
    reason: Optional[str] = None
