"""Interview schemas."""

from typing import Any, Optional
from uuid import UUID

from pydantic import Field

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


class InterviewSessionForReview(InterviewSessionResponse):
    """Interview session with full details for recruiter review."""

    masked_transcript: Optional[str] = None
    ai_analysis: dict[str, Any] = {}
    candidate_name: Optional[str] = None
    job_title: Optional[str] = None
