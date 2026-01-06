"""Interview session and message models."""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Text, Enum, Integer, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class InterviewStatus(str, PyEnum):
    """Interview session status."""

    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    ABANDONED = "ABANDONED"


class MessageRole(str, PyEnum):
    """Message sender role."""

    SYSTEM = "SYSTEM"
    AI = "AI"
    CANDIDATE = "CANDIDATE"


class InterviewSession(BaseModel):
    """AI interview session model."""

    __tablename__ = "interview_sessions"

    candidate_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id"),
        nullable=False,
    )
    job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id"),
        nullable=True,  # Can be a general interview without specific job
    )

    # Session status
    status = Column(
        Enum(InterviewStatus, name="interview_status"),
        default=InterviewStatus.NOT_STARTED,
        nullable=False,
    )

    # Progress tracking
    current_question_index = Column(Integer, default=0, nullable=False)
    total_questions = Column(Integer, default=12, nullable=False)

    # Interview configuration
    interview_type = Column(String(50), default="general", nullable=False)
    language = Column(String(10), default="es", nullable=False)

    # Timing
    started_at = Column(String(50), nullable=True)
    completed_at = Column(String(50), nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    # AI analysis flags
    has_inconsistencies = Column(Boolean, default=False, nullable=False)
    confidence_score = Column(Integer, nullable=True)  # 0-100
    requires_review = Column(Boolean, default=False, nullable=False)

    # Raw transcript and analysis
    full_transcript = Column(Text, nullable=True)
    masked_transcript = Column(Text, nullable=True)  # PII masked version
    ai_analysis = Column(JSONB, default=dict)

    # Relationships
    candidate = relationship("Candidate", back_populates="interview_sessions")
    job = relationship("Job", back_populates="interview_sessions")
    messages = relationship(
        "InterviewMessage",
        back_populates="session",
        order_by="InterviewMessage.sequence",
    )
    reports = relationship("CandidateReport", back_populates="session")

    def __repr__(self) -> str:
        return f"<InterviewSession {self.id} ({self.status})>"


class InterviewMessage(BaseModel):
    """Individual message in interview session."""

    __tablename__ = "interview_messages"

    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("interview_sessions.id"),
        nullable=False,
    )

    # Message details
    role = Column(
        Enum(MessageRole, name="message_role"),
        nullable=False,
    )
    content = Column(Text, nullable=False)
    content_masked = Column(Text, nullable=True)  # PII masked version
    sequence = Column(Integer, nullable=False)

    # Metadata
    question_id = Column(String(100), nullable=True)  # Reference to question template
    metadata_ = Column("metadata", JSONB, default=dict)

    # Relationships
    session = relationship("InterviewSession", back_populates="messages")

    def __repr__(self) -> str:
        return f"<InterviewMessage {self.sequence} ({self.role})>"
