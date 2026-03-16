"""Add payroll tables: employees, contracts, attendance, runs, lines, payslips, deductions, tax configs.

Revision ID: 009
Revises: 008
Create Date: 2026-02-17
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # === Create enums ===
    pay_frequency_enum = postgresql.ENUM(
        'WEEKLY', 'BIWEEKLY', 'MONTHLY',
        name='pay_frequency',
        create_type=False,
    )
    pay_frequency_enum.create(op.get_bind(), checkfirst=True)

    contract_type_enum = postgresql.ENUM(
        'FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE',
        name='contract_type',
        create_type=False,
    )
    contract_type_enum.create(op.get_bind(), checkfirst=True)

    attendance_type_enum = postgresql.ENUM(
        'REGULAR', 'OVERTIME', 'ABSENCE', 'VACATION', 'SICK_LEAVE',
        name='attendance_type',
        create_type=False,
    )
    attendance_type_enum.create(op.get_bind(), checkfirst=True)

    payroll_run_status_enum = postgresql.ENUM(
        'DRAFT', 'VALIDATED', 'CALCULATED', 'APPROVED', 'PAID', 'CANCELLED',
        name='payroll_run_status',
        create_type=False,
    )
    payroll_run_status_enum.create(op.get_bind(), checkfirst=True)

    deduction_calc_type_enum = postgresql.ENUM(
        'PERCENTAGE', 'FIXED',
        name='deduction_calc_type',
        create_type=False,
    )
    deduction_calc_type_enum.create(op.get_bind(), checkfirst=True)

    # === payroll_employees ===
    op.create_table(
        'payroll_employees',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('employee_code', sa.String(50), nullable=True),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('position', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('hire_date', sa.Date(), nullable=True),
        sa.Column('termination_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['client_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )
    op.create_index('ix_payroll_employees_client_id', 'payroll_employees', ['client_id'])

    # === payroll_contracts ===
    op.create_table(
        'payroll_contracts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('contract_type', postgresql.ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', name='contract_type', create_type=False), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('base_salary', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(10), nullable=False, server_default='USD'),
        sa.Column('pay_frequency', postgresql.ENUM('WEEKLY', 'BIWEEKLY', 'MONTHLY', name='pay_frequency', create_type=False), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['employee_id'], ['payroll_employees.id']),
        sa.ForeignKeyConstraint(['client_id'], ['companies.id']),
    )
    op.create_index('ix_payroll_contracts_employee_id', 'payroll_contracts', ['employee_id'])
    op.create_index('ix_payroll_contracts_client_id', 'payroll_contracts', ['client_id'])

    # === payroll_attendance ===
    op.create_table(
        'payroll_attendance',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('hours', sa.Float(), nullable=False),
        sa.Column('attendance_type', postgresql.ENUM('REGULAR', 'OVERTIME', 'ABSENCE', 'VACATION', 'SICK_LEAVE', name='attendance_type', create_type=False), nullable=False, server_default='REGULAR'),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['employee_id'], ['payroll_employees.id']),
        sa.ForeignKeyConstraint(['client_id'], ['companies.id']),
        sa.UniqueConstraint('employee_id', 'date', 'attendance_type', name='uq_attendance_employee_date_type'),
    )
    op.create_index('ix_payroll_attendance_employee_id', 'payroll_attendance', ['employee_id'])
    op.create_index('ix_payroll_attendance_client_id', 'payroll_attendance', ['client_id'])
    op.create_index('ix_payroll_attendance_date', 'payroll_attendance', ['date'])

    # === payroll_runs ===
    op.create_table(
        'payroll_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('pay_frequency', postgresql.ENUM('WEEKLY', 'BIWEEKLY', 'MONTHLY', name='pay_frequency', create_type=False), nullable=False),
        sa.Column('status', postgresql.ENUM('DRAFT', 'VALIDATED', 'CALCULATED', 'APPROVED', 'PAID', 'CANCELLED', name='payroll_run_status', create_type=False), nullable=False, server_default='DRAFT'),
        sa.Column('total_gross', sa.Float(), nullable=True, server_default='0'),
        sa.Column('total_deductions', sa.Float(), nullable=True, server_default='0'),
        sa.Column('total_net', sa.Float(), nullable=True, server_default='0'),
        sa.Column('employee_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('currency', sa.String(10), nullable=False, server_default='USD'),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['client_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id']),
    )
    op.create_index('ix_payroll_runs_client_id', 'payroll_runs', ['client_id'])
    op.create_index('ix_payroll_runs_status', 'payroll_runs', ['status'])

    # === payroll_lines ===
    op.create_table(
        'payroll_lines',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('payroll_run_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('base_salary', sa.Float(), nullable=False),
        sa.Column('days_worked', sa.Float(), nullable=True),
        sa.Column('hours_regular', sa.Float(), nullable=True, server_default='0'),
        sa.Column('hours_overtime', sa.Float(), nullable=True, server_default='0'),
        sa.Column('gross_pay', sa.Float(), nullable=False),
        sa.Column('total_deductions', sa.Float(), nullable=True, server_default='0'),
        sa.Column('net_pay', sa.Float(), nullable=False),
        sa.Column('deductions_detail', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['payroll_run_id'], ['payroll_runs.id']),
        sa.ForeignKeyConstraint(['employee_id'], ['payroll_employees.id']),
    )
    op.create_index('ix_payroll_lines_run_id', 'payroll_lines', ['payroll_run_id'])
    op.create_index('ix_payroll_lines_employee_id', 'payroll_lines', ['employee_id'])

    # === payroll_payslips ===
    op.create_table(
        'payroll_payslips',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('payroll_line_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('html_content', sa.Text(), nullable=True),
        sa.Column('generated_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['payroll_line_id'], ['payroll_lines.id']),
        sa.UniqueConstraint('payroll_line_id', name='uq_payslip_line'),
    )

    # === payroll_deduction_types ===
    op.create_table(
        'payroll_deduction_types',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('calc_type', postgresql.ENUM('PERCENTAGE', 'FIXED', name='deduction_calc_type', create_type=False), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_mandatory', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['client_id'], ['companies.id']),
    )
    op.create_index('ix_payroll_deduction_types_client_id', 'payroll_deduction_types', ['client_id'])

    # === payroll_tax_configs ===
    op.create_table(
        'payroll_tax_configs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('client_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('config_data', postgresql.JSONB(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['client_id'], ['companies.id']),
    )
    op.create_index('ix_payroll_tax_configs_client_id', 'payroll_tax_configs', ['client_id'])


def downgrade() -> None:
    op.drop_table('payroll_tax_configs')
    op.drop_table('payroll_deduction_types')
    op.drop_table('payroll_payslips')
    op.drop_table('payroll_lines')
    op.drop_table('payroll_runs')
    op.drop_table('payroll_attendance')
    op.drop_table('payroll_contracts')
    op.drop_table('payroll_employees')

    op.execute("DROP TYPE IF EXISTS deduction_calc_type")
    op.execute("DROP TYPE IF EXISTS payroll_run_status")
    op.execute("DROP TYPE IF EXISTS attendance_type")
    op.execute("DROP TYPE IF EXISTS contract_type")
    op.execute("DROP TYPE IF EXISTS pay_frequency")
