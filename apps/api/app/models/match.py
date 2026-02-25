"""CandidateJobMatch model for AI matching results."""

from enum import Enum as PyEnum

from sqlalchemy import Column, DateTime, Float, String, Text, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class MatchStatus(str, PyEnum):
    """Status of a candidate-job match."""

    PENDING = "pending"
    REVIEWED = "reviewed"
    SHORTLISTED = "shortlisted"
    REJECTED = "rejected"
    APPLIED = "applied"
    HIRED = "hired"


class CandidateJobMatch(BaseModel):
    """Stores AI-generated match scores between candidates and jobs."""

    __tablename__ = "candidate_job_matches"

    candidate_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id", ondelete="CASCADE"),
        nullable=False,
    )
    job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Scores (0-100 scale)
    overall_score = Column(Float, nullable=False, default=0.0)
    semantic_score = Column(Float, nullable=False, default=0.0)
    skills_score = Column(Float, nullable=False, default=0.0)

    # Status tracking
    status = Column(
        String(20),
        nullable=False,
        default=MatchStatus.PENDING.value,
    )

    # Additional match details
    match_metadata = Column(JSONB, default=dict)
    recruiter_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    # Relationships
    candidate = relationship("Candidate", backref="matches")
    job = relationship("Job", backref="matches")

    __table_args__ = (
        UniqueConstraint("candidate_id", "job_id", name="uq_candidate_job_match"),
        Index("ix_match_job_score", "job_id", "overall_score"),
        Index("ix_match_candidate_score", "candidate_id", "overall_score"),
    )

    def __repr__(self) -> str:
        return f"<CandidateJobMatch {self.candidate_id} -> {self.job_id} ({self.overall_score:.1f})>"
