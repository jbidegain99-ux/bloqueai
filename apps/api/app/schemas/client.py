"""Client (Company with is_client=True) schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema, IDSchema


class ClientCreate(BaseModel):
    """Schema for creating a new client."""

    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    website: Optional[str] = Field(None, max_length=500)
    industry: Optional[str] = Field(None, max_length=100)
    size: Optional[str] = Field(None, max_length=50)
    logo_url: Optional[str] = Field(None, max_length=500)
    client_code: Optional[str] = Field(None, max_length=50)
    match_threshold: Optional[int] = Field(None, ge=0, le=100)


class ClientUpdate(BaseModel):
    """Schema for updating a client."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    website: Optional[str] = Field(None, max_length=500)
    industry: Optional[str] = Field(None, max_length=100)
    size: Optional[str] = Field(None, max_length=50)
    logo_url: Optional[str] = Field(None, max_length=500)
    client_code: Optional[str] = Field(None, max_length=50)
    match_threshold: Optional[int] = Field(None, ge=0, le=100)
    is_client: Optional[bool] = None
    is_active: Optional[bool] = None


class ClientResponse(BaseSchema):
    """Response schema for a client."""

    id: UUID
    name: str
    slug: str
    description: Optional[str]
    website: Optional[str]
    industry: Optional[str]
    size: Optional[str]
    logo_url: Optional[str]
    is_active: bool
    is_client: bool
    client_code: Optional[str]
    match_threshold: Optional[int]
    created_at: datetime
    updated_at: datetime
    job_count: Optional[int] = 0


class ClientListResponse(BaseSchema):
    """Response schema for listing clients."""

    items: list[ClientResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ClientJobResponse(BaseSchema):
    """Simplified job response for client job listings."""

    id: UUID
    title: str
    status: str
    category: Optional[str]
    seniority: str
    location: Optional[str]
    modality: str
    created_at: datetime


class ClientJobsListResponse(BaseSchema):
    """Response schema for listing jobs for a client."""

    items: list[ClientJobResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
