"""Add video_interviews table for LiveKit video interviews.

Revision ID: 017
Revises: 016
Create Date: 2026-02-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers
revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "video_interviews",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "application_id",
            UUID(as_uuid=True),
            sa.ForeignKey("applications.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("room_name", sa.String(100), unique=True, nullable=False),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="SCHEDULED"
        ),
        sa.Column("scheduled_at", sa.DateTime(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("ended_at", sa.DateTime(), nullable=True),
        sa.Column("transcript", JSONB, nullable=True),
        sa.Column("recording_url", sa.String(500), nullable=True),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("ai_scores", JSONB, nullable=True),
        sa.Column("ai_recommendation", sa.Text(), nullable=True),
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # Index on status for filtered queries
    op.create_index(
        "ix_video_interviews_status", "video_interviews", ["status"]
    )


def downgrade() -> None:
    op.drop_index("ix_video_interviews_status")
    op.drop_table("video_interviews")
