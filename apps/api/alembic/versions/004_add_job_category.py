"""Add job category field.

Revision ID: 004
Revises: 003
Create Date: 2025-01-13

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the enum type
    job_category = sa.Enum(
        'TECHNOLOGY', 'ENGINEERING', 'HEALTHCARE', 'LEGAL', 'FINANCE',
        'MANUFACTURING', 'ADMINISTRATION', 'SALES', 'MARKETING',
        'HUMAN_RESOURCES', 'CUSTOMER_SERVICE', 'LOGISTICS', 'EDUCATION',
        'RESEARCH', 'DENTAL', 'CONSTRUCTION', 'HOSPITALITY', 'RETAIL', 'OTHER',
        name='job_category'
    )

    conn = op.get_bind()

    # Create enum type if it doesn't exist
    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_type WHERE typname = 'job_category'"
    ))
    if not result.fetchone():
        job_category.create(op.get_bind())

    # Check if column exists
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = 'jobs' AND column_name = 'category'"
    ))
    if not result.fetchone():
        # Add column without index=True to avoid duplicate index creation
        op.add_column(
            'jobs',
            sa.Column('category', job_category, nullable=True)
        )

    # Check if index exists before creating
    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname = 'ix_jobs_category'"
    ))
    if not result.fetchone():
        op.create_index('ix_jobs_category', 'jobs', ['category'])


def downgrade() -> None:
    op.drop_index('ix_jobs_category', table_name='jobs')
    op.drop_column('jobs', 'category')
    sa.Enum(name='job_category').drop(op.get_bind())
