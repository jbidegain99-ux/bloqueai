"""Job schemas."""

from typing import Any, Optional
from uuid import UUID

from pydantic import Field

from app.models.job import JobStatus, JobModality, SeniorityLevel
from app.schemas.base import IDSchema, BaseSchema, PaginatedResponse


class JobCreate(BaseSchema):
    """Job creation request."""

    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=50)
    department: Optional[str] = Field(None, max_length=100)
    seniority: SeniorityLevel = SeniorityLevel.MID
    salary_min: Optional[int] = Field(None, ge=0)
    salary_max: Optional[int] = Field(None, ge=0)
    salary_currency: str = Field("USD", max_length=10)
    modality: JobModality = JobModality.REMOTE
    location: Optional[str] = Field(None, max_length=255)
    country: Optional[str] = Field(None, max_length=100)
    timezone: Optional[str] = Field(None, max_length=100)
    must_haves: list[str] = []
    nice_to_haves: list[str] = []
    responsibilities: list[str] = []
    benefits: list[str] = []
    custom_questions: list[str] = []
    rubric_id: Optional[UUID] = None


class JobUpdate(BaseSchema):
    """Job update request."""

    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = Field(None, min_length=50)
    department: Optional[str] = Field(None, max_length=100)
    seniority: Optional[SeniorityLevel] = None
    salary_min: Optional[int] = Field(None, ge=0)
    salary_max: Optional[int] = Field(None, ge=0)
    salary_currency: Optional[str] = Field(None, max_length=10)
    modality: Optional[JobModality] = None
    location: Optional[str] = Field(None, max_length=255)
    country: Optional[str] = Field(None, max_length=100)
    timezone: Optional[str] = Field(None, max_length=100)
    must_haves: Optional[list[str]] = None
    nice_to_haves: Optional[list[str]] = None
    responsibilities: Optional[list[str]] = None
    benefits: Optional[list[str]] = None
    custom_questions: Optional[list[str]] = None
    status: Optional[JobStatus] = None
    rubric_id: Optional[UUID] = None


class JobResponse(IDSchema):
    """Job response schema."""

    company_id: UUID
    created_by_id: UUID
    title: str
    slug: Optional[str] = None
    description: str
    department: Optional[str] = None
    seniority: SeniorityLevel
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: Optional[str] = None
    modality: JobModality
    location: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    must_haves: list[str] = []
    nice_to_haves: list[str] = []
    responsibilities: list[str] = []
    benefits: list[str] = []
    custom_questions: list[str] = []
    status: JobStatus
    is_featured: bool
    rubric_id: Optional[UUID] = None
    company_name: Optional[str] = None
    candidate_count: int = 0
    shortlist_count: int = 0


class JobListResponse(PaginatedResponse):
    """Paginated job list response."""

    items: list[JobResponse]
