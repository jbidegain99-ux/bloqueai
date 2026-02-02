"""Candidate schemas."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.base import IDSchema, BaseSchema


class CandidateResponse(IDSchema):
    """Candidate basic response."""

    user_id: UUID
    phone_masked: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    headline: Optional[str] = None
    summary: Optional[str] = None
    skills: list[str] = []


class CandidateProfileResponse(CandidateResponse):
    """Full candidate profile response."""

    ai_summary: Optional[str] = None
    ai_skills: list[dict[str, Any]] = []
    experience: list[dict[str, Any]] = []
    education: list[dict[str, Any]] = []
    languages: list[dict[str, Any]] = []
    certifications: list[dict[str, Any]] = []
    competency_scores: dict[str, Any] = {}

    # Resume/CV info
    resume_updated_at: Optional[datetime] = None
    resume_source: Optional[str] = None  # UPLOADED, AI_BUILDER, MANUAL

    # Interview status
    has_completed_interview: bool = False


class CandidateUpdate(BaseSchema):
    """Candidate profile update."""

    phone: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=255)
    linkedin_url: Optional[str] = Field(None, max_length=500)
    github_url: Optional[str] = Field(None, max_length=500)
    portfolio_url: Optional[str] = Field(None, max_length=500)
    headline: Optional[str] = Field(None, max_length=500)
    summary: Optional[str] = None


class CandidateForEmployer(BaseSchema):
    """Candidate info visible to employers (PII masked)."""

    id: UUID
    headline: Optional[str] = None
    location: Optional[str] = None
    skills: list[str] = []
    experience_years: int = 0
    ai_summary: Optional[str] = None
    competency_scores: dict[str, Any] = {}


# CV Builder Schemas
class CVBuilderPersonalInfo(BaseSchema):
    """Personal information for CV builder."""

    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=255)
    headline: Optional[str] = Field(None, max_length=500)


class CVBuilderWorkEntry(BaseSchema):
    """Work history entry for CV builder."""

    company: str = Field(..., min_length=1, max_length=200)
    title: str = Field(..., min_length=1, max_length=200)
    start_date: str = Field(..., max_length=50)
    end_date: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=2000)
    achievements: list[str] = []


class CVBuilderEducationEntry(BaseSchema):
    """Education entry for CV builder."""

    institution: str = Field(..., min_length=1, max_length=200)
    degree: str = Field(..., min_length=1, max_length=200)
    field: Optional[str] = Field(None, max_length=200)
    year: Optional[str] = Field(None, max_length=20)


class CVBuilderSkills(BaseSchema):
    """Skills for CV builder."""

    technical: list[str] = []
    soft: list[str] = []


class CVBuilderLanguage(BaseSchema):
    """Language entry for CV builder."""

    language: str = Field(..., min_length=1, max_length=100)
    level: str = Field(..., max_length=50)  # Nativo, Avanzado, Intermedio, Basico


class CVBuilderRequest(BaseSchema):
    """CV Builder full request."""

    personal_info: CVBuilderPersonalInfo
    work_history: list[CVBuilderWorkEntry] = []
    education: list[CVBuilderEducationEntry] = []
    skills: CVBuilderSkills = Field(default_factory=CVBuilderSkills)
    languages: list[CVBuilderLanguage] = []


class CVBuilderResponse(BaseSchema):
    """CV Builder response."""

    success: bool = True
    message: str = "CV generado exitosamente"
    resume_id: UUID
    file_url: Optional[str] = None
    summary: str
    html_preview: str
