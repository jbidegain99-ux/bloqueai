"""Candidate report model with AI-generated analysis."""

from enum import Enum as PyEnum

from sqlalchemy import Column, Text, Enum, Integer, Float, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ReportStatus(str, PyEnum):
    """Report generation status."""

    PENDING = "PENDING"
    GENERATING = "GENERATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class CandidateReport(BaseModel):
    """AI-generated candidate report model."""

    __tablename__ = "candidate_reports"

    candidate_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id"),
        nullable=False,
    )
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("interview_sessions.id"),
        nullable=True,
    )
    job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id"),
        nullable=True,
    )

    # Status
    status = Column(
        Enum(ReportStatus, name="report_status"),
        default=ReportStatus.PENDING,
        nullable=False,
    )

    # Summary and scores
    summary = Column(Text, nullable=True)
    overall_score = Column(Float, nullable=True)  # 0-5 scale
    confidence_score = Column(Integer, nullable=True)  # 0-100 confidence

    # Detailed scores by competency
    competency_scores = Column(JSONB, default=dict)
    # Example: {
    #   "technical_skills": {"score": 4.2, "weight": 0.3, "notes": "..."},
    #   "communication": {"score": 3.8, "weight": 0.2, "notes": "..."},
    #   ...
    # }

    # Skills analysis
    skills_detected = Column(JSONB, default=list)
    skills_missing = Column(JSONB, default=list)
    skills_match_percentage = Column(Float, nullable=True)

    # Pros, cons, and recommendations
    strengths = Column(JSONB, default=list)  # List of strengths
    weaknesses = Column(JSONB, default=list)  # List of areas for improvement
    risks = Column(JSONB, default=list)  # List of potential risks
    recommendations = Column(JSONB, default=list)  # Recommended roles/actions

    # Flags and review status
    flags = Column(JSONB, default=list)  # List of flags/warnings
    requires_review = Column(Boolean, default=False, nullable=False)
    reviewed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    review_notes = Column(Text, nullable=True)

    # Score override
    score_overridden = Column(Boolean, default=False, nullable=False)
    original_score = Column(Float, nullable=True)
    override_reason = Column(Text, nullable=True)

    # Full AI output (raw JSON)
    raw_ai_output = Column(JSONB, default=dict)

    # Relationships
    candidate = relationship("Candidate", back_populates="reports")
    session = relationship("InterviewSession", back_populates="reports")
    reviewed_by = relationship("User")

    def __repr__(self) -> str:
        return f"<CandidateReport {self.candidate_id} score={self.overall_score}>"
