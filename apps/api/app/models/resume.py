"""Resume model for uploaded CVs."""

from enum import Enum as PyEnum

from sqlalchemy import Column, String, Text, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ResumeStatus(str, PyEnum):
    """Resume processing status."""

    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Resume(BaseModel):
    """Resume/CV upload model."""

    __tablename__ = "resumes"

    candidate_id = Column(
        UUID(as_uuid=True),
        ForeignKey("candidates.id"),
        nullable=False,
    )

    # File info
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)  # S3/MinIO path
    file_type = Column(String(50), nullable=False)  # pdf, docx
    file_size = Column(String(50), nullable=True)

    # Processing status
    status = Column(
        Enum(ResumeStatus, name="resume_status"),
        default=ResumeStatus.PENDING,
        nullable=False,
    )
    error_message = Column(Text, nullable=True)

    # Extracted content
    raw_text = Column(Text, nullable=True)
    parsed_data = Column(JSONB, default=dict)  # Structured extraction result

    # Relationships
    candidate = relationship("Candidate", back_populates="resumes")

    def __repr__(self) -> str:
        return f"<Resume {self.filename} ({self.status})>"
