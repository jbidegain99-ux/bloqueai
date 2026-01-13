"""Schemas for job applications."""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.application import ApplicationStatus


class ApplicationCreate(BaseModel):
    """Schema for creating a new application."""
    job_id: UUID


class ApplicationResponse(BaseModel):
    """Schema for application response."""
    id: UUID
    candidate_id: UUID
    job_id: UUID
    status: ApplicationStatus
    resume_filename: Optional[str] = None
    resume_file_type: Optional[str] = None
    resume_file_size: Optional[int] = None
    match_score: Optional[float] = None
    candidate_profile: Optional[dict] = None
    match_reasons: Optional[List[str]] = None
    match_gaps: Optional[List[str]] = None
    recommended_job_ids: Optional[List[dict]] = None
    interview_session_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApplicationWithJob(ApplicationResponse):
    """Application response with job details."""
    job: Optional[dict] = None


class ResumeUploadResponse(BaseModel):
    """Response after uploading a resume."""
    success: bool
    application_id: UUID
    filename: str
    file_type: str
    file_size: int
    status: ApplicationStatus


class CVAnalysisRequest(BaseModel):
    """Request to analyze CV."""
    pass  # No additional params needed, we use the uploaded CV


class CVAnalysisResponse(BaseModel):
    """Response from CV analysis."""
    success: bool
    application_id: UUID
    match_score: float
    status: ApplicationStatus
    candidate_profile: dict = Field(default_factory=dict)
    match_reasons: List[str] = Field(default_factory=list)
    match_gaps: List[str] = Field(default_factory=list)
    recommended_jobs: Optional[List[dict]] = None  # Only if match < 70


class RecommendedJob(BaseModel):
    """Recommended job for low-match candidates."""
    id: UUID
    title: str
    company_name: str
    match_score: float
    location: Optional[str] = None
    modality: Optional[str] = None
