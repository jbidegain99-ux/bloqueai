"""Billing service for subscription and plan management."""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models.billing import (
    Plan, Subscription, Invoice, UsageRecord,
    PlanTier, SubscriptionStatus, InvoiceStatus,
)
from app.models.user import User

import structlog

logger = structlog.get_logger()


# ── Plan queries ─────────────────────────────────────────────────


def get_plans(db: Session, active_only: bool = True) -> list[Plan]:
    """Get all available plans."""
    query = db.query(Plan)
    if active_only:
        query = query.filter(Plan.is_active == True)
    return query.order_by(Plan.price_monthly.asc()).all()


def get_plan_by_id(db: Session, plan_id: UUID) -> Optional[Plan]:
    """Get a plan by ID."""
    return db.query(Plan).filter(Plan.id == plan_id).first()


def get_plan_by_tier(db: Session, tier: PlanTier) -> Optional[Plan]:
    """Get a plan by tier."""
    return db.query(Plan).filter(Plan.tier == tier).first()


# ── Subscription queries ─────────────────────────────────────────


def get_current_subscription(db: Session, company_id: UUID) -> Optional[Subscription]:
    """Get the active subscription for a company."""
    return (
        db.query(Subscription)
        .options(joinedload(Subscription.plan))
        .filter(
            Subscription.company_id == company_id,
            Subscription.status.in_([
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.TRIALING,
            ]),
        )
        .first()
    )


def create_subscription(
    db: Session,
    company_id: UUID,
    plan_id: UUID,
    is_annual: bool = False,
) -> Subscription:
    """Create a new subscription for a company."""
    # Check for existing active subscription
    existing = get_current_subscription(db, company_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La empresa ya tiene una suscripción activa. Use el endpoint de upgrade.",
        )

    plan = get_plan_by_id(db, plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan no encontrado",
        )

    now = datetime.utcnow()
    trial_days = 14 if plan.tier != PlanTier.FREE else 0

    subscription = Subscription(
        id=uuid4(),
        company_id=company_id,
        plan_id=plan_id,
        status=SubscriptionStatus.TRIALING if trial_days > 0 else SubscriptionStatus.ACTIVE,
        is_annual=is_annual,
        trial_ends_at=now + timedelta(days=trial_days) if trial_days > 0 else None,
        current_period_start=now,
        current_period_end=now + timedelta(days=365 if is_annual else 30),
        created_at=now,
        updated_at=now,
    )
    db.add(subscription)

    # Create initial invoice (skip for free plan)
    if plan.tier != PlanTier.FREE:
        amount = plan.price_annual if is_annual else plan.price_monthly
        invoice = Invoice(
            id=uuid4(),
            subscription_id=subscription.id,
            company_id=company_id,
            amount=amount,
            currency=plan.currency,
            status=InvoiceStatus.PENDING,
            period_start=subscription.current_period_start,
            period_end=subscription.current_period_end,
            description=f"Suscripción {plan.name} - {'Anual' if is_annual else 'Mensual'}",
            created_at=now,
            updated_at=now,
        )
        db.add(invoice)

    db.commit()
    db.refresh(subscription)

    logger.info(
        "subscription_created",
        company_id=str(company_id),
        plan=plan.tier.value,
        is_annual=is_annual,
    )

    return subscription


def upgrade_subscription(
    db: Session,
    company_id: UUID,
    new_plan_id: UUID,
    is_annual: bool = False,
) -> Subscription:
    """Upgrade or change a company's subscription plan."""
    subscription = get_current_subscription(db, company_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró una suscripción activa",
        )

    new_plan = get_plan_by_id(db, new_plan_id)
    if not new_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan no encontrado",
        )

    now = datetime.utcnow()
    old_plan_tier = subscription.plan.tier.value

    subscription.plan_id = new_plan_id
    subscription.is_annual = is_annual
    subscription.status = SubscriptionStatus.ACTIVE
    subscription.current_period_start = now
    subscription.current_period_end = now + timedelta(days=365 if is_annual else 30)
    subscription.updated_at = now

    # Create upgrade invoice
    if new_plan.tier != PlanTier.FREE:
        amount = new_plan.price_annual if is_annual else new_plan.price_monthly
        invoice = Invoice(
            id=uuid4(),
            subscription_id=subscription.id,
            company_id=company_id,
            amount=amount,
            currency=new_plan.currency,
            status=InvoiceStatus.PENDING,
            period_start=subscription.current_period_start,
            period_end=subscription.current_period_end,
            description=f"Upgrade a {new_plan.name} - {'Anual' if is_annual else 'Mensual'}",
            created_at=now,
            updated_at=now,
        )
        db.add(invoice)

    db.commit()
    db.refresh(subscription)

    logger.info(
        "subscription_upgraded",
        company_id=str(company_id),
        old_plan=old_plan_tier,
        new_plan=new_plan.tier.value,
    )

    return subscription


def cancel_subscription(
    db: Session,
    company_id: UUID,
    cancel_at_period_end: bool = True,
    reason: Optional[str] = None,
) -> Subscription:
    """Cancel a company's subscription."""
    subscription = get_current_subscription(db, company_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró una suscripción activa",
        )

    now = datetime.utcnow()

    if cancel_at_period_end:
        subscription.cancel_at_period_end = True
        subscription.canceled_at = now
    else:
        subscription.status = SubscriptionStatus.CANCELED
        subscription.canceled_at = now

    subscription.updated_at = now
    db.commit()
    db.refresh(subscription)

    logger.info(
        "subscription_canceled",
        company_id=str(company_id),
        at_period_end=cancel_at_period_end,
        reason=reason,
    )

    return subscription


# ── Feature & Limit Checks ──────────────────────────────────────


def check_feature_access(db: Session, company_id: UUID, feature: str) -> dict:
    """Check if a company has access to a specific feature."""
    subscription = get_current_subscription(db, company_id)

    # No subscription = free tier
    if not subscription:
        free_plan = get_plan_by_tier(db, PlanTier.FREE)
        if free_plan and feature in (free_plan.features or []):
            return {
                "feature": feature,
                "has_access": True,
                "plan_tier": PlanTier.FREE.value,
                "message": None,
            }
        return {
            "feature": feature,
            "has_access": False,
            "plan_tier": PlanTier.FREE.value,
            "message": "Actualice su plan para acceder a esta función",
        }

    plan = subscription.plan
    has_access = feature in (plan.features or [])

    return {
        "feature": feature,
        "has_access": has_access,
        "plan_tier": plan.tier.value,
        "message": None if has_access else "Su plan actual no incluye esta función",
    }


def check_limit(
    db: Session,
    company_id: UUID,
    limit_type: str,
    current_count: int,
) -> dict:
    """Check if a company is within its plan limits."""
    subscription = get_current_subscription(db, company_id)

    # No subscription = free tier limits
    if not subscription:
        free_plan = get_plan_by_tier(db, PlanTier.FREE)
        limits = free_plan.limits if free_plan else {}
    else:
        limits = subscription.plan.limits or {}

    max_allowed = limits.get(limit_type, 0)
    plan_tier = subscription.plan.tier.value if subscription else PlanTier.FREE.value

    # -1 means unlimited
    if max_allowed == -1:
        return {
            "limit_type": limit_type,
            "current_usage": current_count,
            "max_allowed": -1,
            "has_capacity": True,
            "plan_tier": plan_tier,
        }

    return {
        "limit_type": limit_type,
        "current_usage": current_count,
        "max_allowed": max_allowed,
        "has_capacity": current_count < max_allowed,
        "plan_tier": plan_tier,
    }


# ── Invoice queries ──────────────────────────────────────────────


def get_invoices(
    db: Session,
    company_id: UUID,
    limit: int = 20,
) -> list[Invoice]:
    """Get invoices for a company."""
    return (
        db.query(Invoice)
        .filter(Invoice.company_id == company_id)
        .order_by(Invoice.created_at.desc())
        .limit(limit)
        .all()
    )


def create_invoice(
    db: Session,
    subscription_id: UUID,
    company_id: UUID,
    amount: float,
    currency: str = "USD",
    description: Optional[str] = None,
) -> Invoice:
    """Create a new invoice."""
    now = datetime.utcnow()
    invoice = Invoice(
        id=uuid4(),
        subscription_id=subscription_id,
        company_id=company_id,
        amount=amount,
        currency=currency,
        status=InvoiceStatus.PENDING,
        description=description,
        created_at=now,
        updated_at=now,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice
