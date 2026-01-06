"""Candidate model with profile information."""

from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Candidate(BaseModel):
    """Candidate profile model."""

    __tablename__ = "candidates"

    # Link to user account
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )

    # Basic info (extracted from CV or manually entered)
    phone = Column(String(50), nullable=True)
    phone_masked = Column(String(50), nullable=True)
    location = Column(String(255), nullable=True)
    linkedin_url = Column(String(500), nullable=True)
    github_url = Column(String(500), nullable=True)
    portfolio_url = Column(String(500), nullable=True)

    # Parsed profile data
    headline = Column(String(500), nullable=True)
    summary = Column(Text, nullable=True)

    # Structured data stored as JSONB
    skills = Column(JSONB, default=list)  # List of skill strings
    experience = Column(JSONB, default=list)  # List of experience objects
    education = Column(JSONB, default=list)  # List of education objects
    languages = Column(JSONB, default=list)  # List of language objects
    certifications = Column(JSONB, default=list)  # List of certification objects

    # AI-generated profile data
    ai_summary = Column(Text, nullable=True)
    ai_skills = Column(JSONB, default=list)  # Skills with confidence scores
    competency_scores = Column(JSONB, default=dict)  # Scores by competency

    # Relationships
    user = relationship("User", back_populates="candidate")
    resumes = relationship("Resume", back_populates="candidate")
    interview_sessions = relationship("InterviewSession", back_populates="candidate")
    reports = relationship("CandidateReport", back_populates="candidate")
    shortlist_items = relationship("ShortlistItem", back_populates="candidate")

    def __repr__(self) -> str:
        return f"<Candidate {self.user_id}>"
