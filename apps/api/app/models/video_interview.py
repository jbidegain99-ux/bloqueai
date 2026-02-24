"""VideoInterview model for LiveKit-based video interviews."""

from enum import Enum as PyEnum

from sqlalchemy import Column, Float, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class VideoInterviewStatus(str, PyEnum):
    """Status of a video interview."""

    SCHEDULED = "SCHEDULED"
    READY = "READY"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    ERROR = "ERROR"


class VideoInterview(BaseModel):
    """
    Video interview model for LiveKit-powered interviews.

    Tracks video interview sessions including room info,
    timing, transcript, AI analysis, and recording metadata.
    """

    __tablename__ = "video_interviews"

    # Core relationship
    application_id = Column(
        UUID(as_uuid=True),
        ForeignKey("applications.id"),
        nullable=False,
        index=True,
    )

    # LiveKit room
    room_name = Column(String(100), unique=True, nullable=False)
    status = Column(
        String(20),
        default=VideoInterviewStatus.SCHEDULED.value,
        nullable=False,
        index=True,
    )

    # Timing
    scheduled_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)

    # Results
    transcript = Column(JSONB, nullable=True)  # [{speaker, text, timestamp}]
    recording_url = Column(String(500), nullable=True)

    # AI Analysis (populated after interview)
    ai_summary = Column(Text, nullable=True)
    ai_scores = Column(JSONB, nullable=True)  # {communication: {score, justification}, ...}
    ai_recommendation = Column(Text, nullable=True)  # JSON string of recommendation object
    overall_score = Column(Float, nullable=True)
    strengths = Column(JSONB, nullable=True)  # List of strings
    areas_for_improvement = Column(JSONB, nullable=True)  # List of strings
    red_flags = Column(JSONB, nullable=True)  # List of strings
    suggested_next_steps = Column(JSONB, nullable=True)  # List of strings

    # Metadata
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    error_message = Column(Text, nullable=True)

    # Relationships
    application = relationship("Application", backref="video_interviews")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<VideoInterview {self.room_name} ({self.status})>"
