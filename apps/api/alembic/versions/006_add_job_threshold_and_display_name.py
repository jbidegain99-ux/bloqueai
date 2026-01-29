"""Add match_threshold and display_company_name to jobs table.

Revision ID: 006
Revises: 005
Create Date: 2026-01-29

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Add match_threshold column if it doesn't exist
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'jobs' AND column_name = 'match_threshold'"
    ))
    if not result.fetchone():
        conn.execute(sa.text(
            "ALTER TABLE jobs ADD COLUMN match_threshold INTEGER"
        ))

    # Add display_company_name column if it doesn't exist
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'jobs' AND column_name = 'display_company_name'"
    ))
    if not result.fetchone():
        conn.execute(sa.text(
            "ALTER TABLE jobs ADD COLUMN display_company_name VARCHAR(255) DEFAULT 'Bloque Internacional'"
        ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE jobs DROP COLUMN IF EXISTS match_threshold"))
    conn.execute(sa.text("ALTER TABLE jobs DROP COLUMN IF EXISTS display_company_name"))
