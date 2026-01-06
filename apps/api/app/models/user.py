"""User model for authentication and authorization."""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Boolean, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class UserRole(str, PyEnum):
    """User roles for RBAC."""

    CANDIDATE = "CANDIDATE"
    EMPLOYER = "EMPLOYER"
    RECRUITER = "RECRUITER"
    ADMIN = "ADMIN"


class User(BaseModel):
    """User model for authentication."""

    __tablename__ = "users"

    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(
        Enum(UserRole, name="user_role"),
        default=UserRole.CANDIDATE,
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    # Company association (for employers/recruiters)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True)

    # Relationships
    company = relationship("Company", back_populates="users")
    candidate = relationship("Candidate", back_populates="user", uselist=False)

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"
