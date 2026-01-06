"""Job model for job postings."""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Text, Enum, Integer, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class JobStatus(str, PyEnum):
    """Job posting status."""

    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CLOSED = "CLOSED"


class JobModality(str, PyEnum):
    """Job modality/work type."""

    REMOTE = "REMOTE"
    HYBRID = "HYBRID"
    ONSITE = "ONSITE"


class SeniorityLevel(str, PyEnum):
    """Seniority level for job."""

    INTERN = "INTERN"
    JUNIOR = "JUNIOR"
    MID = "MID"
    SENIOR = "SENIOR"
    LEAD = "LEAD"
    MANAGER = "MANAGER"
    DIRECTOR = "DIRECTOR"
    VP = "VP"
    C_LEVEL = "C_LEVEL"


class Job(BaseModel):
    """Job posting model."""

    __tablename__ = "jobs"

    company_id = Column(
        UUID(as_uuid=True),
        ForeignKey("companies.id"),
        nullable=False,
    )
    created_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    # Basic info
    title = Column(String(255), nullable=False)
    slug = Column(String(100), index=True, nullable=True)
    description = Column(Text, nullable=False)
    department = Column(String(100), nullable=True)

    # Seniority and compensation
    seniority = Column(
        Enum(SeniorityLevel, name="seniority_level"),
        default=SeniorityLevel.MID,
        nullable=False,
    )
    salary_min = Column(Integer, nullable=True)
    salary_max = Column(Integer, nullable=True)
    salary_currency = Column(String(10), default="USD", nullable=True)

    # Location and modality
    modality = Column(
        Enum(JobModality, name="job_modality"),
        default=JobModality.REMOTE,
        nullable=False,
    )
    location = Column(String(255), nullable=True)
    country = Column(String(100), nullable=True)
    timezone = Column(String(100), nullable=True)

    # Requirements
    must_haves = Column(JSONB, default=list)  # List of required skills/requirements
    nice_to_haves = Column(JSONB, default=list)  # List of preferred skills
    responsibilities = Column(JSONB, default=list)  # List of responsibilities
    benefits = Column(JSONB, default=list)  # List of benefits

    # Interview configuration
    custom_questions = Column(JSONB, default=list)  # Custom interview questions

    # Status
    status = Column(
        Enum(JobStatus, name="job_status"),
        default=JobStatus.DRAFT,
        nullable=False,
    )
    is_featured = Column(Boolean, default=False, nullable=False)

    # Rubric association
    rubric_id = Column(UUID(as_uuid=True), ForeignKey("rubrics.id"), nullable=True)

    # Relationships
    company = relationship("Company", back_populates="jobs")
    created_by = relationship("User")
    rubric = relationship("Rubric", back_populates="jobs")
    interview_sessions = relationship("InterviewSession", back_populates="job")
    shortlist_items = relationship("ShortlistItem", back_populates="job")

    def __repr__(self) -> str:
        return f"<Job {self.title} at {self.company_id}>"
