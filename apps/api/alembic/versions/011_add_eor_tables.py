"""Add EOR (Employer of Record) tables for El Salvador module.

Tables: eor_employees, eor_payroll_runs, eor_payroll_items, eor_vacation_requests

Revision ID: 011
Revises: 010
Create Date: 2026-02-21
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Create enums ──────────────────────────────────────

    eor_employee_status = postgresql.ENUM(
        "ONBOARDING", "ACTIVE", "ON_LEAVE", "OFFBOARDING", "TERMINATED",
        name="eor_employee_status",
        create_type=False,
    )
    eor_employee_status.create(op.get_bind(), checkfirst=True)

    eor_contract_type = postgresql.ENUM(
        "INDEFINIDO", "PLAZO_FIJO",
        name="eor_contract_type",
        create_type=False,
    )
    eor_contract_type.create(op.get_bind(), checkfirst=True)

    eor_payment_frequency = postgresql.ENUM(
        "MONTHLY", "BIWEEKLY",
        name="eor_payment_frequency",
        create_type=False,
    )
    eor_payment_frequency.create(op.get_bind(), checkfirst=True)

    afp_provider = postgresql.ENUM(
        "CRECER", "CONFIA",
        name="afp_provider",
        create_type=False,
    )
    afp_provider.create(op.get_bind(), checkfirst=True)

    bank_account_type = postgresql.ENUM(
        "AHORRO", "CORRIENTE",
        name="bank_account_type",
        create_type=False,
    )
    bank_account_type.create(op.get_bind(), checkfirst=True)

    eor_payroll_run_status = postgresql.ENUM(
        "DRAFT", "PENDING_APPROVAL", "APPROVED", "PROCESSING", "PAID", "CANCELLED",
        name="eor_payroll_run_status",
        create_type=False,
    )
    eor_payroll_run_status.create(op.get_bind(), checkfirst=True)

    eor_vacation_request_status = postgresql.ENUM(
        "PENDING", "APPROVED", "REJECTED", "CANCELLED",
        name="eor_vacation_request_status",
        create_type=False,
    )
    eor_vacation_request_status.create(op.get_bind(), checkfirst=True)

    # ── eor_employees ─────────────────────────────────────

    op.create_table(
        "eor_employees",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("client_company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("dui", sa.String(10), nullable=True),
        sa.Column("nit", sa.String(17), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("isss_number", sa.String(20), nullable=True),
        sa.Column("afp_provider", postgresql.ENUM("CRECER", "CONFIA", name="afp_provider", create_type=False), nullable=True),
        sa.Column("afp_number", sa.String(20), nullable=True),
        sa.Column("bank_name", sa.String(100), nullable=True),
        sa.Column("bank_account_number", sa.String(30), nullable=True),
        sa.Column("bank_account_type", postgresql.ENUM("AHORRO", "CORRIENTE", name="bank_account_type", create_type=False), nullable=True),
        sa.Column("position", sa.String(200), nullable=True),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("base_salary", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_frequency", postgresql.ENUM("MONTHLY", "BIWEEKLY", name="eor_payment_frequency", create_type=False), nullable=False, server_default="MONTHLY"),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("contract_type", postgresql.ENUM("INDEFINIDO", "PLAZO_FIJO", name="eor_contract_type", create_type=False), nullable=False, server_default="INDEFINIDO"),
        sa.Column("contract_end_date", sa.Date(), nullable=True),
        sa.Column("status", postgresql.ENUM("ONBOARDING", "ACTIVE", "ON_LEAVE", "OFFBOARDING", "TERMINATED", name="eor_employee_status", create_type=False), nullable=False, server_default="ONBOARDING"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["client_company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
    )
    op.create_index("ix_eor_employees_client_company_id", "eor_employees", ["client_company_id"])
    op.create_index("ix_eor_employees_status", "eor_employees", ["status"])

    # ── eor_payroll_runs ──────────────────────────────────

    op.create_table(
        "eor_payroll_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("client_company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=True),
        sa.Column("status", postgresql.ENUM("DRAFT", "PENDING_APPROVAL", "APPROVED", "PROCESSING", "PAID", "CANCELLED", name="eor_payroll_run_status", create_type=False), nullable=False, server_default="DRAFT"),
        sa.Column("total_employees", sa.Integer(), server_default="0"),
        sa.Column("total_gross", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total_deductions", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total_net", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total_employer_contributions", sa.Numeric(12, 2), server_default="0"),
        sa.Column("total_fees", sa.Numeric(12, 2), server_default="0"),
        sa.Column("grand_total", sa.Numeric(12, 2), server_default="0"),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["client_company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"]),
    )
    op.create_index("ix_eor_payroll_runs_client_company_id", "eor_payroll_runs", ["client_company_id"])
    op.create_index("ix_eor_payroll_runs_status", "eor_payroll_runs", ["status"])

    # ── eor_payroll_items ─────────────────────────────────

    op.create_table(
        "eor_payroll_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("payroll_run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("base_salary", sa.Numeric(10, 2), nullable=False),
        sa.Column("overtime_hours", sa.Numeric(5, 2), server_default="0"),
        sa.Column("overtime_amount", sa.Numeric(10, 2), server_default="0"),
        sa.Column("bonuses", sa.Numeric(10, 2), server_default="0"),
        sa.Column("gross_salary", sa.Numeric(10, 2), nullable=False),
        sa.Column("isss_employee", sa.Numeric(10, 2), nullable=False),
        sa.Column("afp_employee", sa.Numeric(10, 2), nullable=False),
        sa.Column("isr", sa.Numeric(10, 2), nullable=False),
        sa.Column("other_deductions", sa.Numeric(10, 2), server_default="0"),
        sa.Column("total_deductions", sa.Numeric(10, 2), nullable=False),
        sa.Column("net_salary", sa.Numeric(10, 2), nullable=False),
        sa.Column("isss_employer", sa.Numeric(10, 2), nullable=False),
        sa.Column("afp_employer", sa.Numeric(10, 2), nullable=False),
        sa.Column("fee_talentos", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_employer_cost", sa.Numeric(10, 2), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["payroll_run_id"], ["eor_payroll_runs.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["eor_employees.id"]),
    )
    op.create_index("ix_eor_payroll_items_payroll_run_id", "eor_payroll_items", ["payroll_run_id"])
    op.create_index("ix_eor_payroll_items_employee_id", "eor_payroll_items", ["employee_id"])

    # ── eor_vacation_requests ─────────────────────────────

    op.create_table(
        "eor_vacation_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("days_requested", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", postgresql.ENUM("PENDING", "APPROVED", "REJECTED", "CANCELLED", name="eor_vacation_request_status", create_type=False), nullable=False, server_default="PENDING"),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("review_notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["employee_id"], ["eor_employees.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
    )
    op.create_index("ix_eor_vacation_requests_employee_id", "eor_vacation_requests", ["employee_id"])


def downgrade() -> None:
    op.drop_table("eor_vacation_requests")
    op.drop_table("eor_payroll_items")
    op.drop_table("eor_payroll_runs")
    op.drop_table("eor_employees")

    # Drop enums
    for name in [
        "eor_vacation_request_status",
        "eor_payroll_run_status",
        "bank_account_type",
        "afp_provider",
        "eor_payment_frequency",
        "eor_contract_type",
        "eor_employee_status",
    ]:
        sa.Enum(name=name).drop(op.get_bind(), checkfirst=True)
