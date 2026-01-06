"""Company model for employer organizations."""

from sqlalchemy import Column, String, Text, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Company(BaseModel):
    """Company model for employers."""

    __tablename__ = "companies"

    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    website = Column(String(500), nullable=True)
    industry = Column(String(100), nullable=True)
    size = Column(String(50), nullable=True)  # e.g., "1-10", "11-50", "51-200"
    logo_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Additional company data
    metadata_ = Column("metadata", JSONB, default=dict)

    # Relationships
    users = relationship("User", back_populates="company")
    jobs = relationship("Job", back_populates="company")

    def __repr__(self) -> str:
        return f"<Company {self.name}>"
