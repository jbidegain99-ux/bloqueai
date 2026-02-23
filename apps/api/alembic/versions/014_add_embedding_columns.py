"""Add embedding columns to candidates and jobs

Revision ID: 014_embeddings
Revises: 013_pgvector
Create Date: 2026-02-23
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "014_embeddings"
down_revision: str = "013_pgvector"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add embedding columns to candidates
    op.add_column(
        "candidates",
        sa.Column("embedding_updated_at", sa.DateTime(), nullable=True),
    )
    op.execute(
        "ALTER TABLE candidates ADD COLUMN profile_embedding vector(1536)"
    )

    # Add embedding columns to jobs
    op.add_column(
        "jobs",
        sa.Column("embedding_updated_at", sa.DateTime(), nullable=True),
    )
    op.execute(
        "ALTER TABLE jobs ADD COLUMN job_embedding vector(1536)"
    )


def downgrade() -> None:
    op.drop_column("candidates", "profile_embedding")
    op.drop_column("candidates", "embedding_updated_at")
    op.drop_column("jobs", "job_embedding")
    op.drop_column("jobs", "embedding_updated_at")
