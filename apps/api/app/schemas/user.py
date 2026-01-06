"""User schemas."""

from typing import Optional
from uuid import UUID

from pydantic import EmailStr, Field

from app.models.user import UserRole
from app.schemas.base import IDSchema, BaseSchema


class UserResponse(IDSchema):
    """User response schema."""

    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    is_verified: bool
    company_id: Optional[UUID] = None


class UserUpdate(BaseSchema):
    """User update schema."""

    full_name: Optional[str] = Field(None, min_length=2, max_length=255)


class UserWithCompany(UserResponse):
    """User response with company details."""

    company_name: Optional[str] = None
