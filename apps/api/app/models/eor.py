"""EOR (Employer of Record) models for El Salvador."""

from datetime import datetime
from enum import Enum as PyEnum
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


# ── Enums ─────────────────────────────────────────────────────


class EOREmployeeStatus(str, PyEnum):
    ONBOARDING = "ONBOARDING"
    ACTIVE = "ACTIVE"
    ON_LEAVE = "ON_LEAVE"
    OFFBOARDING = "OFFBOARDING"
    TERMINATED = "TERMINATED"


class EORContractType(str, PyEnum):
    INDEFINIDO = "INDEFINIDO"
    PLAZO_FIJO = "PLAZO_FIJO"


class EORPaymentFrequency(str, PyEnum):
    MONTHLY = "MONTHLY"
    BIWEEKLY = "BIWEEKLY"


class AFPProvider(str, PyEnum):
    CRECER = "CRECER"
    CONFIA = "CONFIA"


class BankAccountType(str, PyEnum):
    AHORRO = "AHORRO"
    CORRIENTE = "CORRIENTE"


class EORPayrollRunStatus(str, PyEnum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    PROCESSING = "PROCESSING"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class VacationRequestStatus(str, PyEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


# ── Models ────────────────────────────────────────────────────


class EOREmployee(BaseModel):
    __tablename__ = "eor_employees"

    client_company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )

    # Datos personales
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    dui = Column(String(10), nullable=True)  # 00000000-0
    nit = Column(String(17), nullable=True)  # 0000-000000-000-0
    birth_date = Column(Date, nullable=True)
    address = Column(Text, nullable=True)

    # Seguro social
    isss_number = Column(String(20), nullable=True)
    afp_provider = Column(
        Enum(AFPProvider, name="afp_provider"), nullable=True
    )
    afp_number = Column(String(20), nullable=True)

    # Datos bancarios
    bank_name = Column(String(100), nullable=True)
    bank_account_number = Column(String(30), nullable=True)
    bank_account_type = Column(
        Enum(BankAccountType, name="bank_account_type"), nullable=True
    )

    # Datos laborales
    position = Column(String(200), nullable=True)
    department = Column(String(100), nullable=True)
    base_salary = Column(Numeric(10, 2), nullable=False)
    payment_frequency = Column(
        Enum(EORPaymentFrequency, name="eor_payment_frequency"),
        default=EORPaymentFrequency.MONTHLY,
        nullable=False,
    )
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    contract_type = Column(
        Enum(EORContractType, name="eor_contract_type"),
        default=EORContractType.INDEFINIDO,
        nullable=False,
    )
    contract_end_date = Column(Date, nullable=True)

    # Status
    status = Column(
        Enum(EOREmployeeStatus, name="eor_employee_status"),
        default=EOREmployeeStatus.ONBOARDING,
        nullable=False,
        index=True,
    )

    # Audit
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    client_company = relationship("Company", foreign_keys=[client_company_id])
    payroll_items = relationship("EORPayrollItem", back_populates="employee")
    vacation_requests = relationship("EORVacationRequest", back_populates="employee")


class EORPayrollRun(BaseModel):
    __tablename__ = "eor_payroll_runs"

    client_company_id = Column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True
    )

    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    payment_date = Column(Date, nullable=True)

    status = Column(
        Enum(EORPayrollRunStatus, name="eor_payroll_run_status"),
        default=EORPayrollRunStatus.DRAFT,
        nullable=False,
        index=True,
    )

    # Totales
    total_employees = Column(Integer, default=0)
    total_gross = Column(Numeric(12, 2), default=0)
    total_deductions = Column(Numeric(12, 2), default=0)
    total_net = Column(Numeric(12, 2), default=0)
    total_employer_contributions = Column(Numeric(12, 2), default=0)
    total_fees = Column(Numeric(12, 2), default=0)
    grand_total = Column(Numeric(12, 2), default=0)

    # Approval
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    paid_at = Column(DateTime, nullable=True)

    # Relationships
    items = relationship("EORPayrollItem", back_populates="payroll_run")
    client_company = relationship("Company", foreign_keys=[client_company_id])


class EORPayrollItem(BaseModel):
    __tablename__ = "eor_payroll_items"

    payroll_run_id = Column(
        UUID(as_uuid=True), ForeignKey("eor_payroll_runs.id"), nullable=False, index=True
    )
    employee_id = Column(
        UUID(as_uuid=True), ForeignKey("eor_employees.id"), nullable=False, index=True
    )

    # Ingresos
    base_salary = Column(Numeric(10, 2), nullable=False)
    overtime_hours = Column(Numeric(5, 2), default=0)
    overtime_amount = Column(Numeric(10, 2), default=0)
    bonuses = Column(Numeric(10, 2), default=0)
    gross_salary = Column(Numeric(10, 2), nullable=False)

    # Deducciones empleado
    isss_employee = Column(Numeric(10, 2), nullable=False)
    afp_employee = Column(Numeric(10, 2), nullable=False)
    isr = Column(Numeric(10, 2), nullable=False)
    other_deductions = Column(Numeric(10, 2), default=0)
    total_deductions = Column(Numeric(10, 2), nullable=False)

    # Neto
    net_salary = Column(Numeric(10, 2), nullable=False)

    # Aportes patronales
    isss_employer = Column(Numeric(10, 2), nullable=False)
    afp_employer = Column(Numeric(10, 2), nullable=False)

    # Fee y total
    fee_talentos = Column(Numeric(10, 2), nullable=False)
    total_employer_cost = Column(Numeric(10, 2), nullable=False)

    # Relationships
    payroll_run = relationship("EORPayrollRun", back_populates="items")
    employee = relationship("EOREmployee", back_populates="payroll_items")


class EORVacationRequest(BaseModel):
    __tablename__ = "eor_vacation_requests"

    employee_id = Column(
        UUID(as_uuid=True), ForeignKey("eor_employees.id"), nullable=False, index=True
    )

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days_requested = Column(Integer, nullable=False)
    reason = Column(Text, nullable=True)

    status = Column(
        Enum(VacationRequestStatus, name="eor_vacation_request_status"),
        default=VacationRequestStatus.PENDING,
        nullable=False,
    )

    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)

    # Relationships
    employee = relationship("EOREmployee", back_populates="vacation_requests")
