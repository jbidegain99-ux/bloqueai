"""Add candidate_job_matches table

Revision ID: 016_matches
Revises: 015_vector_indexes
Create Date: 2026-02-23
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "016_matches"
down_revision: str = "015_vector_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Check if table already exists (may have been created by startup hook)
    table_exists = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'candidate_job_matches'"
        )
    ).fetchone() is not None

    if not table_exists:
        op.create_table(
            "candidate_job_matches",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "candidate_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("candidates.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "job_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("jobs.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("overall_score", sa.Float, nullable=False, server_default="0"),
            sa.Column("semantic_score", sa.Float, nullable=False, server_default="0"),
            sa.Column("skills_score", sa.Float, nullable=False, server_default="0"),
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
            sa.Column("match_metadata", postgresql.JSONB, server_default="{}"),
            sa.Column("recruiter_notes", sa.Text, nullable=True),
            sa.Column("reviewed_at", sa.DateTime, nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime,
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime,
                nullable=False,
                server_default=sa.func.now(),
            ),
        )

    # Add constraints/indexes if they don't exist
    def _constraint_exists(name: str) -> bool:
        return conn.execute(
            sa.text("SELECT 1 FROM pg_constraint WHERE conname = :n"),
            {"n": name},
        ).fetchone() is not None

    def _index_exists(name: str) -> bool:
        return conn.execute(
            sa.text("SELECT 1 FROM pg_indexes WHERE indexname = :n"),
            {"n": name},
        ).fetchone() is not None

    if not _constraint_exists("uq_candidate_job_match"):
        op.create_unique_constraint(
            "uq_candidate_job_match",
            "candidate_job_matches",
            ["candidate_id", "job_id"],
        )

    if not _index_exists("ix_match_job_score"):
        op.create_index(
            "ix_match_job_score",
            "candidate_job_matches",
            ["job_id", "overall_score"],
        )

    if not _index_exists("ix_match_candidate_score"):
        op.create_index(
            "ix_match_candidate_score",
            "candidate_job_matches",
            ["candidate_id", "overall_score"],
        )


def downgrade() -> None:
    op.drop_index("ix_match_candidate_score", table_name="candidate_job_matches")
    op.drop_index("ix_match_job_score", table_name="candidate_job_matches")
    op.drop_constraint("uq_candidate_job_match", "candidate_job_matches")
    op.drop_table("candidate_job_matches")
