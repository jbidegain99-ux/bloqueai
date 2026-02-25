"""Add cv_analysis_cache table for PostgreSQL-based caching of OpenAI CV analysis results.

Revision ID: 010
Revises: 009
Create Date: 2026-02-20
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'cv_analysis_cache',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('cache_key', sa.String(64), unique=True, nullable=False),
        sa.Column('result', postgresql.JSONB(), nullable=False),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('jobs.id'), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('idx_cv_cache_key', 'cv_analysis_cache', ['cache_key'])
    op.create_index('idx_cv_cache_expires', 'cv_analysis_cache', ['expires_at'])


def downgrade() -> None:
    op.drop_index('idx_cv_cache_expires', table_name='cv_analysis_cache')
    op.drop_index('idx_cv_cache_key', table_name='cv_analysis_cache')
    op.drop_table('cv_analysis_cache')
