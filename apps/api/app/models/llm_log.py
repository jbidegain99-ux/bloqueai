"""LLM/OpenAI usage logging model."""

from sqlalchemy import Column, String, Text, Integer, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class LLMLog(BaseModel):
    """Log of LLM/OpenAI API calls for tracking and debugging."""

    __tablename__ = "llm_logs"

    # Context
    session_id = Column(
        UUID(as_uuid=True),
        ForeignKey("interview_sessions.id"),
        nullable=True,
        index=True,
    )
    job_id = Column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id"),
        nullable=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )

    # Request details
    endpoint = Column(String(100), nullable=False)  # e.g., "chat/completions"
    model = Column(String(100), nullable=False)  # e.g., "gpt-4o-mini"
    operation = Column(String(100), nullable=True)  # e.g., "interview_question", "report_generation"

    # Performance metrics
    latency_ms = Column(Integer, nullable=True)
    tokens_in = Column(Integer, nullable=True)  # Estimated input tokens
    tokens_out = Column(Integer, nullable=True)  # Estimated output tokens
    total_tokens = Column(Integer, nullable=True)

    # Status
    status = Column(String(50), nullable=False, default="success")  # success, error, timeout
    error_message = Column(Text, nullable=True)

    # Debug info (hashes, not full content to protect PII)
    prompt_hash = Column(String(64), nullable=True)  # SHA256 hash of prompt
    response_hash = Column(String(64), nullable=True)  # SHA256 hash of response

    # Metadata for debugging
    metadata_ = Column("metadata", JSONB, default=dict)

    def __repr__(self) -> str:
        return f"<LLMLog {self.id} ({self.operation} - {self.status})>"
