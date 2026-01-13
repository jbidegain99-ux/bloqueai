"""Interview invitation model."""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Enum, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class InvitationStatus(str, PyEnum):
    """Invitation status."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class InterviewInvitation(BaseModel):
    """Interview invitation for candidates."""

    __tablename__ = "interview_invitations"

    # Job reference
    job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id"),
        nullable=False,
    )

    # Candidate info
    candidate_email = Column(String(255), nullable=False)
    candidate_name = Column(String(255), nullable=True)

    # Token for invitation link
    token = Column(String(100), nullable=False, unique=True, index=True)

    # Status
    status = Column(
        Enum(InvitationStatus, name="invitation_status"),
        default=InvitationStatus.PENDING,
        nullable=False,
    )

    # Expiration
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)

    # Links after acceptance
    candidate_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id"),
        nullable=True,
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("interview_sessions.id"),
        nullable=True,
    )

    # Created by
    created_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )

    # Metadata
    metadata_ = Column("metadata", JSONB, default=dict)

    # Relationships
    job = relationship("Job")
    candidate = relationship("Candidate")
    session = relationship("InterviewSession")
    created_by = relationship("User")

    def __repr__(self) -> str:
        return f"<InterviewInvitation {self.id} ({self.candidate_email} - {self.status})>"
