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
    conn = op.get_bind()

    # Helper: check if a column exists
    def _col_exists(table: str, column: str) -> bool:
        r = conn.execute(
            sa.text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        )
        return r.fetchone() is not None

    # Helper: get column data type
    def _col_type(table: str, column: str) -> str:
        r = conn.execute(
            sa.text(
                "SELECT data_type FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        )
        row = r.fetchone()
        return row[0] if row else ""

    # ── candidates ──
    if not _col_exists("candidates", "embedding_updated_at"):
        op.add_column(
            "candidates",
            sa.Column("embedding_updated_at", sa.DateTime(), nullable=True),
        )

    if _col_exists("candidates", "profile_embedding"):
        if _col_type("candidates", "profile_embedding") == "bytea":
            # Column exists as bytea (created by startup hook) — convert to vector
            op.execute("ALTER TABLE candidates DROP COLUMN profile_embedding")
            op.execute("ALTER TABLE candidates ADD COLUMN profile_embedding vector(1536)")
    else:
        op.execute("ALTER TABLE candidates ADD COLUMN profile_embedding vector(1536)")

    # ── jobs ──
    if not _col_exists("jobs", "embedding_updated_at"):
        op.add_column(
            "jobs",
            sa.Column("embedding_updated_at", sa.DateTime(), nullable=True),
        )

    if _col_exists("jobs", "job_embedding"):
        if _col_type("jobs", "job_embedding") == "bytea":
            # Column exists as bytea (created by startup hook) — convert to vector
            op.execute("ALTER TABLE jobs DROP COLUMN job_embedding")
            op.execute("ALTER TABLE jobs ADD COLUMN job_embedding vector(1536)")
    else:
        op.execute("ALTER TABLE jobs ADD COLUMN job_embedding vector(1536)")


def downgrade() -> None:
    op.drop_column("candidates", "profile_embedding")
    op.drop_column("candidates", "embedding_updated_at")
    op.drop_column("jobs", "job_embedding")
    op.drop_column("jobs", "embedding_updated_at")
