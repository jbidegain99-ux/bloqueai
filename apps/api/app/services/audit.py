"""Audit logging service."""

from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def create_audit_log(
    db: Session,
    user_id: Optional[UUID],
    entity_type: str,
    entity_id: UUID,
    action: str,
    description: Optional[str] = None,
    old_values: Optional[dict[str, Any]] = None,
    new_values: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditLog:
    """Create an audit log entry."""
    audit_log = AuditLog(
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        description=description,
        old_values=old_values or {},
        new_values=new_values or {},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    return audit_log


def log_rubric_change(
    db: Session,
    user_id: UUID,
    rubric_id: UUID,
    action: str,
    old_values: dict[str, Any],
    new_values: dict[str, Any],
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Log a rubric change."""
    return create_audit_log(
        db=db,
        user_id=user_id,
        entity_type="rubric",
        entity_id=rubric_id,
        action=action,
        description=f"Rubric {action}",
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
    )


def log_score_override(
    db: Session,
    user_id: UUID,
    report_id: UUID,
    original_score: float,
    new_score: float,
    reason: str,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Log a score override."""
    return create_audit_log(
        db=db,
        user_id=user_id,
        entity_type="candidate_report",
        entity_id=report_id,
        action="score_override",
        description=f"Score overridden from {original_score} to {new_score}",
        old_values={"score": original_score},
        new_values={"score": new_score, "reason": reason},
        ip_address=ip_address,
    )


def log_shortlist_action(
    db: Session,
    user_id: UUID,
    shortlist_item_id: UUID,
    action: str,
    details: dict[str, Any],
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Log a shortlist action."""
    return create_audit_log(
        db=db,
        user_id=user_id,
        entity_type="shortlist_item",
        entity_id=shortlist_item_id,
        action=action,
        description=f"Shortlist item {action}",
        new_values=details,
        ip_address=ip_address,
    )
