"""Add applications table for job application wizard flow.

Revision ID: 005
Revises: 004
Create Date: 2025-01-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Create enum type if it doesn't exist (using raw SQL for idempotency)
    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_type WHERE typname = 'application_status'"
    ))
    if not result.fetchone():
        conn.execute(sa.text(
            "CREATE TYPE application_status AS ENUM "
            "('CREATED', 'CV_UPLOADED', 'ANALYZING', 'MATCH_PASSED', "
            "'MATCH_BELOW_THRESHOLD', 'INTERVIEW_STARTED', 'INTERVIEW_COMPLETED', "
            "'COMPLETED', 'WITHDRAWN', 'REJECTED')"
        ))

    # Create the enum type reference for table creation (create_type=False prevents auto-creation)
    application_status = sa.Enum(
        'CREATED', 'CV_UPLOADED', 'ANALYZING', 'MATCH_PASSED',
        'MATCH_BELOW_THRESHOLD', 'INTERVIEW_STARTED', 'INTERVIEW_COMPLETED',
        'COMPLETED', 'WITHDRAWN', 'REJECTED',
        name='application_status',
        create_type=False  # Important: Don't auto-create, we already handled it
    )

    # Check if table exists
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'applications'"
    ))
    if not result.fetchone():
        op.create_table(
            'applications',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),

            # Core relationships
            sa.Column('candidate_id', UUID(as_uuid=True), sa.ForeignKey('candidates.id'), nullable=False, index=True),
            sa.Column('job_id', UUID(as_uuid=True), sa.ForeignKey('jobs.id'), nullable=False, index=True),

            # Status
            sa.Column('status', application_status, nullable=False, server_default='CREATED'),

            # CV/Resume info
            sa.Column('resume_filename', sa.String(255), nullable=True),
            sa.Column('resume_file_type', sa.String(50), nullable=True),
            sa.Column('resume_file_size', sa.Integer(), nullable=True),
            sa.Column('resume_text', sa.Text(), nullable=True),

            # CV Analysis results
            sa.Column('match_score', sa.Float(), nullable=True),
            sa.Column('candidate_profile', JSONB(), nullable=True),
            sa.Column('match_reasons', JSONB(), nullable=True),
            sa.Column('match_gaps', JSONB(), nullable=True),
            sa.Column('recommended_job_ids', JSONB(), nullable=True),

            # Interview tracking
            sa.Column('interview_session_id', UUID(as_uuid=True), sa.ForeignKey('interview_sessions.id'), nullable=True),

            # Notes
            sa.Column('candidate_notes', sa.Text(), nullable=True),
            sa.Column('recruiter_notes', sa.Text(), nullable=True),
        )

    # Create indexes if they don't exist
    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname = 'ix_applications_status'"
    ))
    if not result.fetchone():
        op.create_index('ix_applications_status', 'applications', ['status'])

    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname = 'ix_applications_candidate_job'"
    ))
    if not result.fetchone():
        op.create_index('ix_applications_candidate_job', 'applications', ['candidate_id', 'job_id'])


def downgrade() -> None:
    op.drop_index('ix_applications_candidate_job', table_name='applications')
    op.drop_index('ix_applications_status', table_name='applications')
    op.drop_table('applications')
    sa.Enum(name='application_status').drop(op.get_bind())
