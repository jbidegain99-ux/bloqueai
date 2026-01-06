"""Audit log model for tracking changes."""

from sqlalchemy import Column, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import BaseModel


class AuditLog(BaseModel):
    """Audit log for tracking important changes."""

    __tablename__ = "audit_logs"

    # Who performed the action
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,  # System actions may not have a user
    )

    # What was affected
    entity_type = Column(String(100), nullable=False)  # e.g., "rubric", "shortlist"
    entity_id = Column(UUID(as_uuid=True), nullable=False)

    # The action
    action = Column(String(50), nullable=False)  # e.g., "create", "update", "override"
    description = Column(Text, nullable=True)

    # Change details
    old_values = Column(JSONB, default=dict)
    new_values = Column(JSONB, default=dict)

    # Request context
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} on {self.entity_type} {self.entity_id}>"
