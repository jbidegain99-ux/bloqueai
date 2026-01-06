"""Report schemas."""

from typing import Any, Optional
from uuid import UUID

from pydantic import Field

from app.models.report import ReportStatus
from app.schemas.base import IDSchema, BaseSchema


class CandidateReportResponse(IDSchema):
    """Candidate report response."""

    candidate_id: UUID
    session_id: Optional[UUID] = None
    job_id: Optional[UUID] = None
    status: ReportStatus
    summary: Optional[str] = None
    overall_score: Optional[float] = None
    confidence_score: Optional[int] = None
    competency_scores: dict[str, Any] = {}
    skills_detected: list[str] = []
    skills_missing: list[str] = []
    skills_match_percentage: Optional[float] = None
    strengths: list[str] = []
    weaknesses: list[str] = []
    risks: list[str] = []
    recommendations: list[str] = []
    flags: list[str] = []
    requires_review: bool
    score_overridden: bool
    original_score: Optional[float] = None
    override_reason: Optional[str] = None


class ReportOverrideRequest(BaseSchema):
    """Request to override a report score."""

    new_score: float = Field(..., ge=0, le=5)
    reason: str = Field(..., min_length=10, max_length=1000)


class ReportForShortlist(BaseSchema):
    """Report info for shortlist view."""

    id: UUID
    summary: Optional[str] = None
    overall_score: Optional[float] = None
    competency_scores: dict[str, Any] = {}
    strengths: list[str] = []
    weaknesses: list[str] = []
    risks: list[str] = []
