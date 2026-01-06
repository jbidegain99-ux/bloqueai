"""Resume schemas."""

from typing import Any, Optional
from uuid import UUID

from app.models.resume import ResumeStatus
from app.schemas.base import IDSchema


class ResumeUploadResponse(IDSchema):
    """Response after resume upload."""

    filename: str
    file_type: str
    status: ResumeStatus


class ResumeResponse(IDSchema):
    """Full resume response."""

    candidate_id: UUID
    filename: str
    file_type: str
    file_size: Optional[str] = None
    status: ResumeStatus
    error_message: Optional[str] = None
    parsed_data: dict[str, Any] = {}
