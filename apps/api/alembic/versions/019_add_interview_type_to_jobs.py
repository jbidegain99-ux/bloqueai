"""Add interview_type column to jobs table.

Revision ID: 019
Revises: 018
Create Date: 2026-02-24
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column(
            "interview_type",
            sa.String(10),
            nullable=False,
            server_default="chat",
        ),
    )


def downgrade() -> None:
    op.drop_column("jobs", "interview_type")
