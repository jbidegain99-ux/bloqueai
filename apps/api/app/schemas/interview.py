"""Interview schemas."""

from typing import Any, Optional
from uuid import UUID
from datetime import datetime

from pydantic import Field, computed_field

from app.models.interview import InterviewStatus, MessageRole
from app.schemas.base import IDSchema, BaseSchema


class InterviewStartRequest(BaseSchema):
    """Request to start an interview session."""

    job_id: Optional[UUID] = None
    language: str = Field("es", max_length=10)


class InterviewMessageRequest(BaseSchema):
    """Request to send a message in interview."""

    content: str = Field(..., min_length=1, max_length=10000)


class InterviewMessageResponse(BaseSchema):
    """Response for an interview message."""

    role: MessageRole
    content: str
    sequence: int
    question_id: Optional[str] = None


class InterviewSessionResponse(IDSchema):
    """Interview session response."""

    candidate_id: UUID
    job_id: Optional[UUID] = None
    status: InterviewStatus
    current_question_index: int
    total_questions: int
    interview_type: str
    language: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_seconds: Optional[int] = None
    has_inconsistencies: bool
    confidence_score: Optional[int] = None
    requires_review: bool
    messages: list[InterviewMessageResponse] = []


class InterviewCompleteResponse(BaseSchema):
    """Response after completing interview."""

    session_id: UUID
    status: InterviewStatus
    message: str
    report_status: str


# Nested schemas for admin review
class UserForReview(BaseSchema):
    """User info for admin review."""
    full_name: str
    email: str


class CandidateForReview(BaseSchema):
    """Candidate info for admin review."""
    id: UUID
    user: Optional[UserForReview] = None


class ReportForReview(BaseSchema):
    """Report info for admin review."""
    id: UUID
    overall_score: Optional[float] = None
    summary: Optional[str] = None
    confidence_score: Optional[int] = None
    score_overridden: bool = False
    original_score: Optional[float] = None
    competency_scores: dict[str, Any] = {}


class TranscriptMessage(BaseSchema):
    """Message in transcript for admin review."""
    role: str  # 'assistant' or 'user'
    content: str
    timestamp: Optional[str] = None


class InterviewSessionForReview(InterviewSessionResponse):
    """Interview session with full details for recruiter review."""

    masked_transcript: Optional[str] = None
    ai_analysis: dict[str, Any] = {}
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None

    # Nested objects for frontend
    candidate: Optional[CandidateForReview] = None
    report: Optional[ReportForReview] = None
    transcript: list[TranscriptMessage] = []
    total_messages: int = 0
    duration_minutes: Optional[int] = None
