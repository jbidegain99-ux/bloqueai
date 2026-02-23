"""Add pgvector extension

Revision ID: 013_pgvector
Revises: dee25af735a4
Create Date: 2026-02-23
"""

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "013_pgvector"
down_revision: str = "dee25af735a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS vector")
