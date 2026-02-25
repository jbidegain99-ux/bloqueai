"""Billing and subscription models for TalentOS."""

from enum import Enum as PyEnum
from datetime import datetime

from sqlalchemy import Column, String, Boolean, Enum, ForeignKey, Integer, Float, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class PlanTier(str, PyEnum):
    """Plan tier levels."""
    FREE = "FREE"
    GROWTH = "GROWTH"
    PROFESSIONAL = "PROFESSIONAL"
    ENTERPRISE = "ENTERPRISE"


class SubscriptionStatus(str, PyEnum):
    """Subscription status."""
    ACTIVE = "ACTIVE"
    TRIALING = "TRIALING"
    PAST_DUE = "PAST_DUE"
    CANCELED = "CANCELED"
    EXPIRED = "EXPIRED"


class InvoiceStatus(str, PyEnum):
    """Invoice status."""
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class Plan(BaseModel):
    """Billing plan definition."""

    __tablename__ = "plans"

    name = Column(String(100), nullable=False)
    tier = Column(Enum(PlanTier, name="plan_tier"), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    price_monthly = Column(Float, nullable=False, default=0.0)
    price_annual = Column(Float, nullable=False, default=0.0)
    currency = Column(String(3), nullable=False, default="USD")
    is_active = Column(Boolean, default=True, nullable=False)

    # Limits (JSON for flexibility)
    limits = Column(JSONB, default=dict)
    # e.g. {"jobs": 3, "candidates": 50, "interviews_per_month": 10, "ai_reports": 5, "users": 2}

    # Features (list of feature keys enabled)
    features = Column(JSONB, default=list)
    # e.g. ["basic_ats", "ai_matching", "bulk_import", "api_access", "custom_branding"]

    # Relationships
    subscriptions = relationship("Subscription", back_populates="plan")

    def __repr__(self) -> str:
        return f"<Plan {self.name} ({self.tier.value})>"


class Subscription(BaseModel):
    """Company subscription to a plan."""

    __tablename__ = "subscriptions"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)
    status = Column(
        Enum(SubscriptionStatus, name="subscription_status"),
        nullable=False,
        default=SubscriptionStatus.TRIALING,
    )
    is_annual = Column(Boolean, default=False, nullable=False)

    # Trial
    trial_ends_at = Column(DateTime, nullable=True)

    # Billing period
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)

    # Payment gateway (for future integration)
    gateway_subscription_id = Column(String(255), nullable=True)
    gateway_customer_id = Column(String(255), nullable=True)

    # Cancellation
    canceled_at = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False, nullable=False)

    # Relationships
    company = relationship("Company", back_populates="subscription")
    plan = relationship("Plan", back_populates="subscriptions")
    invoices = relationship("Invoice", back_populates="subscription")

    def __repr__(self) -> str:
        return f"<Subscription company={self.company_id} plan={self.plan_id} status={self.status.value}>"


class Invoice(BaseModel):
    """Billing invoice."""

    __tablename__ = "invoices"

    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)

    amount = Column(Float, nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    status = Column(
        Enum(InvoiceStatus, name="invoice_status"),
        nullable=False,
        default=InvoiceStatus.DRAFT,
    )

    # Period
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)

    # Payment
    paid_at = Column(DateTime, nullable=True)
    gateway_invoice_id = Column(String(255), nullable=True)
    gateway_payment_id = Column(String(255), nullable=True)

    description = Column(Text, nullable=True)

    # Relationships
    subscription = relationship("Subscription", back_populates="invoices")

    def __repr__(self) -> str:
        return f"<Invoice {self.id} amount={self.amount} status={self.status.value}>"


class UsageRecord(BaseModel):
    """Track feature usage for limit enforcement."""

    __tablename__ = "usage_records"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    metric = Column(String(100), nullable=False)  # e.g. "jobs", "interviews", "ai_reports"
    count = Column(Integer, nullable=False, default=0)
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)

    def __repr__(self) -> str:
        return f"<UsageRecord company={self.company_id} metric={self.metric} count={self.count}>"
