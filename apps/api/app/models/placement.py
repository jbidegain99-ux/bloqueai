"""Placement and Assignment models for outsourcing/payroll management."""

from enum import Enum as PyEnum
from datetime import date

from sqlalchemy import Column, String, Text, Date, Integer, Float, ForeignKey, Enum, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class PlacementStatus(str, PyEnum):
    """Status of a placement."""
    PENDING = "PENDING"  # Placement offer pending acceptance
    ACTIVE = "ACTIVE"  # Currently placed
    ON_HOLD = "ON_HOLD"  # Temporarily on hold
    COMPLETED = "COMPLETED"  # Placement ended successfully
    TERMINATED = "TERMINATED"  # Placement terminated early
    CANCELLED = "CANCELLED"  # Placement cancelled before start


class PlacementType(str, PyEnum):
    """Type of placement."""
    DIRECT_HIRE = "DIRECT_HIRE"  # Hired directly by client
    CONTRACT = "CONTRACT"  # Fixed-term contract
    CONTRACT_TO_HIRE = "CONTRACT_TO_HIRE"  # Contract with hire option
    OUTSOURCING = "OUTSOURCING"  # Bloque payroll, works at client
    FREELANCE = "FREELANCE"  # Freelance/project-based


class Placement(BaseModel):
    """
    Placement model.

    Represents a candidate being placed at a client company.
    Can be direct hire, contract, or outsourcing arrangement.
    """
    __tablename__ = "placements"

    # Core relationships
    candidate_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id"),
        nullable=False,
        index=True
    )
    job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id"),
        nullable=True,
        index=True
    )
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("companies.id"),
        nullable=False,
        index=True
    )

    # Placement details
    placement_type = Column(
        Enum(PlacementType, name="placement_type"),
        default=PlacementType.DIRECT_HIRE,
        nullable=False
    )
    status = Column(
        Enum(PlacementStatus, name="placement_status"),
        default=PlacementStatus.PENDING,
        nullable=False,
        index=True
    )

    # Position info
    position_title = Column(String(255), nullable=False)
    department = Column(String(100), nullable=True)
    location = Column(String(255), nullable=True)

    # Timeline
    offer_date = Column(Date, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)  # For contracts, null for permanent

    # Compensation (can be hourly, monthly, or annual)
    salary_amount = Column(Float, nullable=True)
    salary_currency = Column(String(10), default="USD", nullable=True)
    salary_period = Column(String(20), default="monthly", nullable=True)  # hourly, monthly, annual

    # Fee info (for recruiter tracking)
    placement_fee = Column(Float, nullable=True)
    fee_percentage = Column(Float, nullable=True)
    fee_paid = Column(Boolean, default=False, nullable=False)

    # Notes and metadata
    notes = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, default=dict)

    # Relationships
    candidate = relationship("Candidate")
    job = relationship("Job")
    client = relationship("Company")
    assignments = relationship("Assignment", back_populates="placement")

    def __repr__(self) -> str:
        return f"<Placement {self.position_title} - {self.status}>"


class AssignmentStatus(str, PyEnum):
    """Status of an assignment."""
    PENDING = "PENDING"  # Assignment pending start
    ACTIVE = "ACTIVE"  # Currently on assignment
    ON_LEAVE = "ON_LEAVE"  # Temporary leave
    COMPLETED = "COMPLETED"  # Assignment completed
    TERMINATED = "TERMINATED"  # Assignment terminated early


class Assignment(BaseModel):
    """
    Assignment model for outsourcing/payroll.

    Represents a worker assigned to a client for payroll purposes.
    Used when Bloque manages payroll for workers at client sites.
    One placement can have multiple sequential assignments.
    """
    __tablename__ = "assignments"

    # Core relationships
    placement_id = Column(
        UUID(as_uuid=True),
        ForeignKey("placements.id"),
        nullable=False,
        index=True
    )
    candidate_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id"),
        nullable=False,
        index=True
    )
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("companies.id"),
        nullable=False,
        index=True
    )

    # Assignment details
    status = Column(
        Enum(AssignmentStatus, name="assignment_status"),
        default=AssignmentStatus.PENDING,
        nullable=False,
        index=True
    )

    # Timeline
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # Null for ongoing

    # Billing info
    bill_rate = Column(Float, nullable=True)  # Client billing rate
    pay_rate = Column(Float, nullable=True)  # Worker pay rate
    rate_currency = Column(String(10), default="USD", nullable=True)
    rate_period = Column(String(20), default="hourly", nullable=True)  # hourly, daily, monthly

    # Hours tracking (for payroll)
    expected_hours_week = Column(Integer, default=40, nullable=True)
    overtime_multiplier = Column(Float, default=1.5, nullable=True)

    # Project/cost center
    project_name = Column(String(255), nullable=True)
    cost_center = Column(String(100), nullable=True)
    purchase_order = Column(String(100), nullable=True)

    # Manager at client
    client_manager_name = Column(String(255), nullable=True)
    client_manager_email = Column(String(255), nullable=True)

    # Notes
    notes = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSONB, default=dict)

    # Relationships
    placement = relationship("Placement", back_populates="assignments")
    candidate = relationship("Candidate")
    client = relationship("Company")

    def __repr__(self) -> str:
        return f"<Assignment {self.placement_id} - {self.status}>"
