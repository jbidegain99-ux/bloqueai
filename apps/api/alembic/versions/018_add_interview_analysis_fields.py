"""Add analysis fields to video_interviews table.

Revision ID: 018
Revises: 017
Create Date: 2026-02-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers
revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("video_interviews", sa.Column("overall_score", sa.Float(), nullable=True))
    op.add_column("video_interviews", sa.Column("strengths", JSONB(), nullable=True))
    op.add_column("video_interviews", sa.Column("areas_for_improvement", JSONB(), nullable=True))
    op.add_column("video_interviews", sa.Column("red_flags", JSONB(), nullable=True))
    op.add_column("video_interviews", sa.Column("suggested_next_steps", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("video_interviews", "suggested_next_steps")
    op.drop_column("video_interviews", "red_flags")
    op.drop_column("video_interviews", "areas_for_improvement")
    op.drop_column("video_interviews", "strengths")
    op.drop_column("video_interviews", "overall_score")
