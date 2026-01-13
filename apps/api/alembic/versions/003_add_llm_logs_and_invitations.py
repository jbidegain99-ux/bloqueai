"""Add LLM logs and interview invitations tables.

Revision ID: 003
Revises: 002
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()


def index_exists(table_name: str, index_name: str) -> bool:
    """Check if an index exists on a table."""
    bind = op.get_bind()
    inspector = inspect(bind)
    try:
        indexes = inspector.get_indexes(table_name)
        return any(idx["name"] == index_name for idx in indexes)
    except Exception:
        return False


def upgrade() -> None:
    # LLM Logs table for tracking OpenAI usage
    if not table_exists("llm_logs"):
        op.create_table(
            "llm_logs",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("interview_sessions.id"), nullable=True),
            sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("endpoint", sa.String(100), nullable=False),
            sa.Column("model", sa.String(100), nullable=False),
            sa.Column("operation", sa.String(100), nullable=True),
            sa.Column("latency_ms", sa.Integer(), nullable=True),
            sa.Column("tokens_in", sa.Integer(), nullable=True),
            sa.Column("tokens_out", sa.Integer(), nullable=True),
            sa.Column("total_tokens", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(50), nullable=False, server_default="success"),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("prompt_hash", sa.String(64), nullable=True),
            sa.Column("response_hash", sa.String(64), nullable=True),
            sa.Column("metadata", postgresql.JSONB(), server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        )

    # Create index for session_id lookups
    if table_exists("llm_logs") and not index_exists("llm_logs", "ix_llm_logs_session_id"):
        op.create_index("ix_llm_logs_session_id", "llm_logs", ["session_id"])

    # Interview Invitations table
    if not table_exists("interview_invitations"):
        op.create_table(
            "interview_invitations",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("jobs.id"), nullable=False),
            sa.Column("candidate_email", sa.String(255), nullable=False),
            sa.Column("candidate_name", sa.String(255), nullable=True),
            sa.Column("token", sa.String(100), nullable=False, unique=True),
            sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("candidate_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("candidates.id"), nullable=True),
            sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("interview_sessions.id"), nullable=True),
            sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("metadata", postgresql.JSONB(), server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        )

    # Create index for token lookups
    if table_exists("interview_invitations") and not index_exists("interview_invitations", "ix_interview_invitations_token"):
        op.create_index("ix_interview_invitations_token", "interview_invitations", ["token"], unique=True)


def downgrade() -> None:
    op.drop_table("interview_invitations")
    op.drop_table("llm_logs")
