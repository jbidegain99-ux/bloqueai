"""Add source column to resumes table.

Revision ID: 008
Revises: 007
Create Date: 2026-02-04

Changes:
- Add resume_source enum type
- Add source column to resumes table with default UPLOADED
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create resume_source enum type
    resume_source_enum = postgresql.ENUM(
        'UPLOADED', 'AI_BUILDER', 'MANUAL',
        name='resume_source',
        create_type=False
    )
    resume_source_enum.create(op.get_bind(), checkfirst=True)

    # Add source column to resumes table with default value
    op.add_column(
        'resumes',
        sa.Column(
            'source',
            postgresql.ENUM('UPLOADED', 'AI_BUILDER', 'MANUAL', name='resume_source', create_type=False),
            nullable=False,
            server_default='UPLOADED'
        )
    )


def downgrade() -> None:
    # Remove source column
    op.drop_column('resumes', 'source')

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS resume_source")
