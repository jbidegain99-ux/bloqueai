"""Job model for job postings."""

from enum import Enum as PyEnum

from sqlalchemy import Column, DateTime, String, Text, Enum, Integer, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import deferred, relationship
from pgvector.sqlalchemy import Vector

from app.models.base import BaseModel


class JobStatus(str, PyEnum):
    """Job posting status."""

    DRAFT = "DRAFT"  # Initial state, not published
    PENDING = "PENDING"  # Awaiting approval before publishing
    ACTIVE = "ACTIVE"  # Live and accepting applications
    PAUSED = "PAUSED"  # Temporarily paused, not visible to candidates
    CLOSED = "CLOSED"  # No longer accepting applications, visible in reports
    INACTIVE = "INACTIVE"  # Archived, not visible but kept for records


class JobModality(str, PyEnum):
    """Job modality/work type."""

    REMOTE = "REMOTE"
    HYBRID = "HYBRID"
    ONSITE = "ONSITE"


class InterviewType(str, PyEnum):
    """Interview type for job postings."""

    CHAT = "chat"
    VIDEO = "video"


class JobCategory(str, PyEnum):
    """Job category/industry."""

    TECHNOLOGY = "TECHNOLOGY"
    ENGINEERING = "ENGINEERING"
    HEALTHCARE = "HEALTHCARE"
    LEGAL = "LEGAL"
    FINANCE = "FINANCE"
    MANUFACTURING = "MANUFACTURING"
    ADMINISTRATION = "ADMINISTRATION"
    SALES = "SALES"
    MARKETING = "MARKETING"
    HUMAN_RESOURCES = "HUMAN_RESOURCES"
    CUSTOMER_SERVICE = "CUSTOMER_SERVICE"
    LOGISTICS = "LOGISTICS"
    EDUCATION = "EDUCATION"
    RESEARCH = "RESEARCH"
    DENTAL = "DENTAL"
    CONSTRUCTION = "CONSTRUCTION"
    HOSPITALITY = "HOSPITALITY"
    RETAIL = "RETAIL"
    OTHER = "OTHER"


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
    category = Column(
        Enum(JobCategory, name="job_category"),
        default=JobCategory.OTHER,
        nullable=True,
        index=True,
    )

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
    interview_type = Column(String(10), default="chat", nullable=False)
    custom_questions = Column(JSONB, default=list)  # Custom interview questions

    # Category-specific fields (for generic job form)
    # Structure depends on category: healthcare (certifications, specialties),
    # finance (licenses, experience areas), legal (bar admissions, practice areas), etc.
    category_fields = Column(JSONB, default=dict)

    # Status
    status = Column(
        Enum(JobStatus, name="job_status"),
        default=JobStatus.DRAFT,
        nullable=False,
    )
    is_featured = Column(Boolean, default=False, nullable=False)

    # Match threshold for this job (NULL = use system default of 70)
    match_threshold = Column(Integer, nullable=True)

    # Display name for candidates (always shows this instead of real company name)
    display_company_name = Column(String(255), default="Bloque Internacional", nullable=True)

    # Embedding for AI matching (deferred to avoid loading large vectors on every query)
    job_embedding = deferred(Column(Vector(1536), nullable=True))
    embedding_updated_at = Column(DateTime, nullable=True)

    # Rubric association
    rubric_id = Column(UUID(as_uuid=True), ForeignKey("rubrics.id"), nullable=True)

    # Relationships
    company = relationship("Company", back_populates="jobs")
    created_by = relationship("User")
    rubric = relationship("Rubric", back_populates="jobs")
    interview_sessions = relationship("InterviewSession", back_populates="job")
    shortlist_items = relationship("ShortlistItem", back_populates="job")
    applications = relationship("Application", back_populates="job")

    def __repr__(self) -> str:
        return f"<Job {self.title} at {self.company_id}>"
