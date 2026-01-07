"""Lead model for contact form submissions."""

from sqlalchemy import Column, String, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import BaseModel


class Lead(BaseModel):
    """Lead from landing page contact form."""

    __tablename__ = "leads"

    # Contact info
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    company = Column(String(255), nullable=True)
    country = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)

    # Request details
    roles_needed = Column(Text, nullable=True)
    message = Column(Text, nullable=True)

    # Status
    contacted = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<Lead {self.email} - {self.company}>"
