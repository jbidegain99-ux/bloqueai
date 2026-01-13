"""Job Application model for tracking candidate applications."""

from enum import Enum
from sqlalchemy import Column, String, Integer, ForeignKey, Enum as SAEnum, Text, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ApplicationStatus(str, Enum):
    """Application status through the wizard flow."""
    CREATED = "CREATED"  # Application just created, no CV yet
    CV_UPLOADED = "CV_UPLOADED"  # CV uploaded, not analyzed yet
    ANALYZING = "ANALYZING"  # CV analysis in progress
    MATCH_PASSED = "MATCH_PASSED"  # Match score >= 70, can proceed to interview
    MATCH_BELOW_THRESHOLD = "MATCH_BELOW_THRESHOLD"  # Match score < 70, show recommendations
    INTERVIEW_STARTED = "INTERVIEW_STARTED"  # Interview in progress
    INTERVIEW_COMPLETED = "INTERVIEW_COMPLETED"  # Interview done, generating report
    COMPLETED = "COMPLETED"  # Full process completed
    WITHDRAWN = "WITHDRAWN"  # Candidate withdrew application
    REJECTED = "REJECTED"  # Rejected by employer


class Application(BaseModel):
    """
    Job Application model.

    Tracks a candidate's application to a specific job through the wizard flow:
    1. Created -> CV Uploaded -> Analyzing -> Match result
    2. If match >= 70: Interview -> Completed
    3. If match < 70: Show recommendations
    """
    __tablename__ = "applications"

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
        nullable=False,
        index=True
    )

    # Status tracking
    status = Column(
        SAEnum(ApplicationStatus),
        default=ApplicationStatus.CREATED,
        nullable=False,
        index=True
    )

    # CV/Resume info (stored after upload)
    resume_filename = Column(String(255), nullable=True)
    resume_file_type = Column(String(50), nullable=True)
    resume_file_size = Column(Integer, nullable=True)  # bytes
    resume_text = Column(Text, nullable=True)  # Extracted text from CV

    # CV Analysis results (from OpenAI)
    match_score = Column(Float, nullable=True)  # 0-100
    candidate_profile = Column(JSONB, nullable=True)  # { skills, roles, years, education }
    match_reasons = Column(JSONB, nullable=True)  # List of reasons for match
    match_gaps = Column(JSONB, nullable=True)  # List of gaps/missing skills
    recommended_job_ids = Column(JSONB, nullable=True)  # Top 3 recommended jobs if match < 70

    # Interview tracking
    interview_session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("interview_sessions.id"),
        nullable=True
    )

    # Notes
    candidate_notes = Column(Text, nullable=True)  # Notes from candidate
    recruiter_notes = Column(Text, nullable=True)  # Notes from recruiter

    # Relationships
    candidate = relationship("Candidate", back_populates="applications")
    job = relationship("Job", back_populates="applications")
    interview_session = relationship("InterviewSession", foreign_keys=[interview_session_id])

    def __repr__(self):
        return f"<Application {self.id} - {self.status}>"
