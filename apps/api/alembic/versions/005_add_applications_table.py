"""Add applications table for job application wizard flow.

Revision ID: 005
Revises: 004
Create Date: 2025-01-13

"""
from alembic import op
import sqlalchemy as sa

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

    # Check if table exists - use raw SQL to avoid SQLAlchemy's automatic enum type creation
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'applications'"
    ))
    if not result.fetchone():
        # Use completely raw SQL to create the table
        # This bypasses SQLAlchemy's automatic enum type creation behavior
        conn.execute(sa.text("""
            CREATE TABLE applications (
                id UUID PRIMARY KEY,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

                -- Core relationships
                candidate_id UUID NOT NULL REFERENCES candidates(id),
                job_id UUID NOT NULL REFERENCES jobs(id),

                -- Status
                status application_status NOT NULL DEFAULT 'CREATED',

                -- CV/Resume info
                resume_filename VARCHAR(255),
                resume_file_type VARCHAR(50),
                resume_file_size INTEGER,
                resume_text TEXT,

                -- CV Analysis results
                match_score FLOAT,
                candidate_profile JSONB,
                match_reasons JSONB,
                match_gaps JSONB,
                recommended_job_ids JSONB,

                -- Interview tracking
                interview_session_id UUID REFERENCES interview_sessions(id),

                -- Notes
                candidate_notes TEXT,
                recruiter_notes TEXT
            )
        """))

        # Create column indexes
        conn.execute(sa.text("CREATE INDEX ix_applications_candidate_id ON applications(candidate_id)"))
        conn.execute(sa.text("CREATE INDEX ix_applications_job_id ON applications(job_id)"))

    # Create additional indexes if they don't exist
    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname = 'ix_applications_status'"
    ))
    if not result.fetchone():
        conn.execute(sa.text("CREATE INDEX ix_applications_status ON applications(status)"))

    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname = 'ix_applications_candidate_job'"
    ))
    if not result.fetchone():
        conn.execute(sa.text("CREATE INDEX ix_applications_candidate_job ON applications(candidate_id, job_id)"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_applications_candidate_job"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_applications_status"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_applications_job_id"))
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_applications_candidate_id"))
    conn.execute(sa.text("DROP TABLE IF EXISTS applications"))
    conn.execute(sa.text("DROP TYPE IF EXISTS application_status"))
