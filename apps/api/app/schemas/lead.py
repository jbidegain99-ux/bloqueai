"""Lead schemas for API."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LeadCreate(BaseModel):
    """Schema for creating a new lead."""

    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    company: Optional[str] = Field(None, max_length=255)
    country: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    roles_needed: Optional[str] = Field(None, max_length=1000)
    message: Optional[str] = Field(None, max_length=2000)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Juan Perez",
                "email": "juan@empresa.com",
                "company": "Empresa S.A.",
                "country": "Mexico",
                "roles_needed": "Desarrolladores Senior",
                "message": "Interesados en contratar 5 desarrolladores",
            }
        }


class LeadResponse(BaseModel):
    """Schema for lead response."""

    id: UUID
    name: str
    email: str
    company: Optional[str]
    country: Optional[str]
    roles_needed: Optional[str]
    message: Optional[str]
    contacted: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LeadCreateResponse(BaseModel):
    """Schema for lead creation response."""

    success: bool
    message: str
    lead_id: Optional[UUID] = None
