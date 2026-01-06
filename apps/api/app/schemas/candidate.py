"""Candidate schemas."""

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
