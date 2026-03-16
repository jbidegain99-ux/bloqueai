"""extend payroll models with LATAM-specific fields, deduction breakdowns, and provisions

Revision ID: 021
Revises: 020_enable_row_level_security
Create Date: 2026-03-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '021'
down_revision: Union[str, None] = '020'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create new enum types
    document_type_enum = postgresql.ENUM(
        'DUI', 'NIT', 'PASSPORT', 'CURP', 'CEDULA', 'OTHER',
        name='document_type', create_type=False,
    )
    document_type_enum.create(op.get_bind(), checkfirst=True)

    employment_type_enum = postgresql.ENUM(
        'FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE',
        name='employment_type', create_type=False,
    )
    employment_type_enum.create(op.get_bind(), checkfirst=True)

    employee_status_enum = postgresql.ENUM(
        'ACTIVE', 'ON_LEAVE', 'TERMINATED', 'SUSPENDED',
        name='employee_status', create_type=False,
    )
    employee_status_enum.create(op.get_bind(), checkfirst=True)

    payment_method_enum = postgresql.ENUM(
        'BANK_TRANSFER', 'CHECK', 'CASH',
        name='payment_method', create_type=False,
    )
    payment_method_enum.create(op.get_bind(), checkfirst=True)

    deduction_category_enum = postgresql.ENUM(
        'ISSS', 'AFP', 'INCOME_TAX', 'LOAN', 'OTHER',
        name='deduction_category', create_type=False,
    )
    deduction_category_enum.create(op.get_bind(), checkfirst=True)

    provision_type_enum = postgresql.ENUM(
        'AGUINALDO', 'VACACIONES', 'BONUS', 'INDEMNIZACION',
        name='provision_type', create_type=False,
    )
    provision_type_enum.create(op.get_bind(), checkfirst=True)

    # ── Extend payroll_employees ─────────────────────────────────
    op.add_column('payroll_employees', sa.Column('document_type', document_type_enum, nullable=True))
    op.add_column('payroll_employees', sa.Column('document_id', sa.String(length=50), nullable=True))
    op.add_column('payroll_employees', sa.Column('salary', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('payroll_employees', sa.Column('salary_currency', sa.String(length=10), server_default='USD', nullable=False))
    op.add_column('payroll_employees', sa.Column('employment_type', employment_type_enum, nullable=True))
    op.add_column('payroll_employees', sa.Column('status', employee_status_enum, server_default='ACTIVE', nullable=False))
    op.add_column('payroll_employees', sa.Column('bank_account_number', sa.String(length=50), nullable=True))
    op.create_index('ix_payroll_employees_status', 'payroll_employees', ['status'])

    # ── Extend payroll_contracts ─────────────────────────────────
    op.add_column('payroll_contracts', sa.Column('position_title', sa.String(length=255), nullable=True))
    op.add_column('payroll_contracts', sa.Column('benefits', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=True))
    op.add_column('payroll_contracts', sa.Column('document_url', sa.String(length=500), nullable=True))
    op.add_column('payroll_contracts', sa.Column('signed_by_employee_at', sa.DateTime(), nullable=True))

    # ── Extend payroll_runs ──────────────────────────────────────
    op.add_column('payroll_runs', sa.Column('payment_method', payment_method_enum, nullable=True))

    # ── Extend payroll_lines ─────────────────────────────────────
    op.add_column('payroll_lines', sa.Column('contract_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_payroll_lines_contract', 'payroll_lines', 'payroll_contracts', ['contract_id'], ['id'])
    op.create_index('ix_payroll_lines_contract_id', 'payroll_lines', ['contract_id'])

    # ── Extend payroll_payslips ──────────────────────────────────
    op.add_column('payroll_payslips', sa.Column('document_url', sa.String(length=500), nullable=True))

    # ── New table: payroll_deduction_breakdowns ───────────────────
    op.create_table('payroll_deduction_breakdowns',
        sa.Column('payroll_line_id', sa.UUID(), nullable=False),
        sa.Column('deduction_type', deduction_category_enum, nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['payroll_line_id'], ['payroll_lines.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_payroll_deduction_breakdowns_payroll_line_id', 'payroll_deduction_breakdowns', ['payroll_line_id'])

    # ── New table: payroll_provisions ─────────────────────────────
    op.create_table('payroll_provisions',
        sa.Column('payroll_line_id', sa.UUID(), nullable=False),
        sa.Column('provision_type', provision_type_enum, nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['payroll_line_id'], ['payroll_lines.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_payroll_provisions_payroll_line_id', 'payroll_provisions', ['payroll_line_id'])


def downgrade() -> None:
    # Drop new tables
    op.drop_table('payroll_provisions')
    op.drop_table('payroll_deduction_breakdowns')

    # Remove extended columns
    op.drop_column('payroll_payslips', 'document_url')
    op.drop_constraint('fk_payroll_lines_contract', 'payroll_lines', type_='foreignkey')
    op.drop_index('ix_payroll_lines_contract_id', table_name='payroll_lines')
    op.drop_column('payroll_lines', 'contract_id')
    op.drop_column('payroll_runs', 'payment_method')
    op.drop_column('payroll_contracts', 'signed_by_employee_at')
    op.drop_column('payroll_contracts', 'document_url')
    op.drop_column('payroll_contracts', 'benefits')
    op.drop_column('payroll_contracts', 'position_title')
    op.drop_index('ix_payroll_employees_status', table_name='payroll_employees')
    op.drop_column('payroll_employees', 'bank_account_number')
    op.drop_column('payroll_employees', 'status')
    op.drop_column('payroll_employees', 'employment_type')
    op.drop_column('payroll_employees', 'salary_currency')
    op.drop_column('payroll_employees', 'salary')
    op.drop_column('payroll_employees', 'document_id')
    op.drop_column('payroll_employees', 'document_type')

    # Drop enum types
    sa.Enum(name='provision_type').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='deduction_category').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='payment_method').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='employee_status').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='employment_type').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='document_type').drop(op.get_bind(), checkfirst=True)
