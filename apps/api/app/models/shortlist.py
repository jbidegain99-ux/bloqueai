"""Shortlist model for job candidate rankings."""

from enum import Enum as PyEnum

from sqlalchemy import Column, Text, Enum, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ShortlistStatus(str, PyEnum):
    """Shortlist item status."""

    PENDING = "PENDING"
    REVIEWED = "REVIEWED"
    CONTACTED = "CONTACTED"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    REJECTED = "REJECTED"
    HIRED = "HIRED"


class ShortlistItem(BaseModel):
    """Shortlisted candidate for a job."""

    __tablename__ = "shortlist_items"

    job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id"),
        nullable=False,
    )
    candidate_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id"),
        nullable=False,
    )
    report_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidate_reports.id"),
        nullable=True,
    )

    # Ranking
    rank = Column(Integer, nullable=False)
    total_score = Column(Float, nullable=False)

    # Score breakdown
    score_breakdown = Column(JSONB, default=dict)
    # Example: {
    #   "must_have_match": 0.9,
    #   "nice_to_have_match": 0.7,
    #   "competency_weighted": 4.2,
    #   "experience_bonus": 0.3
    # }

    # Explainability
    top_reasons = Column(JSONB, default=list)  # Top 3 reasons for ranking
    risks = Column(JSONB, default=list)  # Potential risks/concerns
    match_details = Column(JSONB, default=dict)  # Detailed matching info

    # Status and notes
    status = Column(
        Enum(ShortlistStatus, name="shortlist_status"),
        default=ShortlistStatus.PENDING,
        nullable=False,
    )
    recruiter_notes = Column(Text, nullable=True)

    # Relationships
    job = relationship("Job", back_populates="shortlist_items")
    candidate = relationship("Candidate", back_populates="shortlist_items")
    report = relationship("CandidateReport")

    def __repr__(self) -> str:
        return f"<ShortlistItem job={self.job_id} rank={self.rank}>"
