"""Shortlist schemas."""

from typing import Any, Optional
from uuid import UUID

from pydantic import Field

from app.models.shortlist import ShortlistStatus
from app.schemas.base import IDSchema, BaseSchema, PaginatedResponse
from app.schemas.candidate import CandidateForEmployer
from app.schemas.report import ReportForShortlist


class CompetencyScore(BaseSchema):
    """Individual competency score."""
    name: str
    score: float


class ShortlistItemResponse(IDSchema):
    """Shortlist item response."""

    job_id: UUID
    candidate_id: UUID
    report_id: Optional[UUID] = None
    rank: int
    total_score: float
    # New explicit score fields
    final_score: float = 0.0  # Combined score (0-100 scale)
    cv_score: float = 0.0  # CV-based score (0-100 scale)
    interview_score: float = 0.0  # Interview-based score (0-100 scale)
    # Competencies and flags
    top_competencies: list[CompetencyScore] = []
    flags_count: int = 0
    interview_status: str = "PENDING"  # COMPLETED or PENDING
    # Existing fields
    score_breakdown: dict[str, Any] = {}
    top_reasons: list[str] = []
    risks: list[str] = []
    match_details: dict[str, Any] = {}
    status: ShortlistStatus
    recruiter_notes: Optional[str] = None
    candidate: Optional[CandidateForEmployer] = None
    report: Optional[ReportForShortlist] = None


class ShortlistResponse(BaseSchema):
    """Shortlist response for a job."""

    job_id: UUID
    job_title: str
    total_candidates: int
    shortlist_count: int
    items: list[ShortlistItemResponse] = []


class GenerateShortlistRequest(BaseSchema):
    """Request to generate/regenerate shortlist."""

    max_candidates: int = Field(10, ge=1, le=100)
    include_reviewed: bool = False


class ShortlistUpdateRequest(BaseSchema):
    """Request to update shortlist item."""

    status: Optional[ShortlistStatus] = None
    recruiter_notes: Optional[str] = Field(None, max_length=5000)


class ShortlistCompareRequest(BaseSchema):
    """Request to compare candidates."""

    candidate_ids: list[UUID] = Field(..., min_length=2, max_length=5)


class ShortlistCompareResponse(BaseSchema):
    """Response comparing multiple candidates."""

    job_id: UUID
    candidates: list[ShortlistItemResponse]
    comparison_matrix: dict[str, Any] = {}
