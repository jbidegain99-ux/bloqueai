"""Base schema with common configuration."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class BaseSchema(BaseModel):
    """Base schema with ORM mode enabled."""

    model_config = ConfigDict(from_attributes=True)


class TimestampSchema(BaseSchema):
    """Schema with timestamp fields."""

    created_at: datetime
    updated_at: datetime


class IDSchema(TimestampSchema):
    """Schema with ID and timestamps."""

    id: UUID


class PaginatedResponse(BaseSchema):
    """Base paginated response."""

    total: int
    page: int
    page_size: int
    total_pages: int


class MessageResponse(BaseSchema):
    """Simple message response."""

    message: str
    success: bool = True
