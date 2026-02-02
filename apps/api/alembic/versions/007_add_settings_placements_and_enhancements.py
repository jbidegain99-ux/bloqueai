"""Add system settings, placements, assignments, and model enhancements.

Revision ID: 007
Revises: 006
Create Date: 2026-02-02

Changes:
- Add system_settings table for global configuration
- Add placements table for candidate placements
- Add assignments table for outsourcing/payroll
- Add match_threshold to companies (client-level override)
- Add is_client and client_code to companies
- Add applied_threshold to applications (audit trail)
- Add category_fields to jobs (generic form support)
- Add PENDING and INACTIVE to job_status enum
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # === System Settings Table ===
    op.create_table(
        'system_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('key', sa.String(100), nullable=False),
        sa.Column('value', sa.String(500), nullable=True),
        sa.Column('value_int', sa.Integer(), nullable=True),
        sa.Column('value_bool', sa.Boolean(), nullable=True),
        sa.Column('value_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(100), nullable=False, server_default='general'),
        sa.Column('is_editable', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key')
    )
    op.create_index('ix_system_settings_key', 'system_settings', ['key'])

    # === Placements Table ===
    # Create placement_type enum
    placement_type_enum = postgresql.ENUM(
        'DIRECT_HIRE', 'CONTRACT', 'CONTRACT_TO_HIRE', 'OUTSOURCING', 'FREELANCE',
        name='placement_type',
        create_type=False
    )
    placement_type_enum.create(op.get_bind(), checkfirst=True)

    # Create placement_status enum
    placement_status_enum = postgresql.ENUM(
        'PENDING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'TERMINATED', 'CANCELLED',
        name='placement_status',
        create_type=False
    )
    placement_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'placements',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('placement_type', sa.Enum('DIRECT_HIRE', 'CONTRACT', 'CONTRACT_TO_HIRE', 'OUTSOURCING', 'FREELANCE', name='placement_type'), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'TERMINATED', 'CANCELLED', name='placement_status'), nullable=False),
        sa.Column('position_title', sa.String(255), nullable=False),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('location', sa.String(255), nullable=True),
        sa.Column('offer_date', sa.Date(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('salary_amount', sa.Float(), nullable=True),
        sa.Column('salary_currency', sa.String(10), nullable=True, server_default='USD'),
        sa.Column('salary_period', sa.String(20), nullable=True, server_default='monthly'),
        sa.Column('placement_fee', sa.Float(), nullable=True),
        sa.Column('fee_percentage', sa.Float(), nullable=True),
        sa.Column('fee_paid', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id']),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id']),
        sa.ForeignKeyConstraint(['client_id'], ['companies.id'])
    )
    op.create_index('ix_placements_candidate_id', 'placements', ['candidate_id'])
    op.create_index('ix_placements_client_id', 'placements', ['client_id'])
    op.create_index('ix_placements_status', 'placements', ['status'])

    # === Assignments Table ===
    # Create assignment_status enum
    assignment_status_enum = postgresql.ENUM(
        'PENDING', 'ACTIVE', 'ON_LEAVE', 'COMPLETED', 'TERMINATED',
        name='assignment_status',
        create_type=False
    )
    assignment_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'assignments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('placement_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'ACTIVE', 'ON_LEAVE', 'COMPLETED', 'TERMINATED', name='assignment_status'), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('bill_rate', sa.Float(), nullable=True),
        sa.Column('pay_rate', sa.Float(), nullable=True),
        sa.Column('rate_currency', sa.String(10), nullable=True, server_default='USD'),
        sa.Column('rate_period', sa.String(20), nullable=True, server_default='hourly'),
        sa.Column('expected_hours_week', sa.Integer(), nullable=True, server_default='40'),
        sa.Column('overtime_multiplier', sa.Float(), nullable=True, server_default='1.5'),
        sa.Column('project_name', sa.String(255), nullable=True),
        sa.Column('cost_center', sa.String(100), nullable=True),
        sa.Column('purchase_order', sa.String(100), nullable=True),
        sa.Column('client_manager_name', sa.String(255), nullable=True),
        sa.Column('client_manager_email', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['placement_id'], ['placements.id']),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id']),
        sa.ForeignKeyConstraint(['client_id'], ['companies.id'])
    )
    op.create_index('ix_assignments_placement_id', 'assignments', ['placement_id'])
    op.create_index('ix_assignments_candidate_id', 'assignments', ['candidate_id'])
    op.create_index('ix_assignments_client_id', 'assignments', ['client_id'])
    op.create_index('ix_assignments_status', 'assignments', ['status'])

    # === Company Enhancements (Client threshold + designation) ===
    op.add_column('companies', sa.Column('match_threshold', sa.Integer(), nullable=True))
    op.add_column('companies', sa.Column('is_client', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('companies', sa.Column('client_code', sa.String(50), nullable=True))
    op.create_unique_constraint('uq_companies_client_code', 'companies', ['client_code'])

    # === Application Enhancement (Applied threshold audit) ===
    op.add_column('applications', sa.Column('applied_threshold', sa.Integer(), nullable=True))

    # === Job Enhancements (Category fields + status enum) ===
    op.add_column('jobs', sa.Column('category_fields', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Add new values to job_status enum
    # Note: PostgreSQL requires special handling for adding values to existing enums
    op.execute("ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'PENDING'")
    op.execute("ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'INACTIVE'")

    # === Seed default system settings ===
    op.execute("""
        INSERT INTO system_settings (id, key, value_int, description, category, is_editable, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'default_match_threshold',
            70,
            'Default CV match threshold percentage for all jobs',
            'matching',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (key) DO NOTHING
    """)

    op.execute("""
        INSERT INTO system_settings (id, key, value_int, description, category, is_editable, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'max_interview_questions',
            12,
            'Maximum number of questions in an AI interview',
            'interview',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (key) DO NOTHING
    """)

    op.execute("""
        INSERT INTO system_settings (id, key, value_int, description, category, is_editable, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'cv_max_size_mb',
            10,
            'Maximum CV file size in megabytes',
            'upload',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (key) DO NOTHING
    """)


def downgrade() -> None:
    # Drop assignments table
    op.drop_index('ix_assignments_status', 'assignments')
    op.drop_index('ix_assignments_client_id', 'assignments')
    op.drop_index('ix_assignments_candidate_id', 'assignments')
    op.drop_index('ix_assignments_placement_id', 'assignments')
    op.drop_table('assignments')

    # Drop placements table
    op.drop_index('ix_placements_status', 'placements')
    op.drop_index('ix_placements_client_id', 'placements')
    op.drop_index('ix_placements_candidate_id', 'placements')
    op.drop_table('placements')

    # Drop system_settings table
    op.drop_index('ix_system_settings_key', 'system_settings')
    op.drop_table('system_settings')

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS assignment_status")
    op.execute("DROP TYPE IF EXISTS placement_status")
    op.execute("DROP TYPE IF EXISTS placement_type")

    # Remove company columns
    op.drop_constraint('uq_companies_client_code', 'companies', type_='unique')
    op.drop_column('companies', 'client_code')
    op.drop_column('companies', 'is_client')
    op.drop_column('companies', 'match_threshold')

    # Remove application column
    op.drop_column('applications', 'applied_threshold')

    # Remove job column
    op.drop_column('jobs', 'category_fields')

    # Note: Removing enum values requires recreating the enum type
    # which is complex and may cause data loss. In production,
    # consider leaving the values or using a more complex migration.
