"""Payroll module models - Employee, Contract, Attendance, PayrollRun, PayrollLine, etc."""

from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Text, Date, DateTime, Integer, Float,
    ForeignKey, Enum, Boolean, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class PayFrequency(str, PyEnum):
    WEEKLY = "WEEKLY"
    BIWEEKLY = "BIWEEKLY"
    MONTHLY = "MONTHLY"


class ContractType(str, PyEnum):
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    CONTRACT = "CONTRACT"
    FREELANCE = "FREELANCE"


class AttendanceType(str, PyEnum):
    REGULAR = "REGULAR"
    OVERTIME = "OVERTIME"
    ABSENCE = "ABSENCE"
    VACATION = "VACATION"
    SICK_LEAVE = "SICK_LEAVE"


class PayrollRunStatus(str, PyEnum):
    DRAFT = "DRAFT"
    VALIDATED = "VALIDATED"
    CALCULATED = "CALCULATED"
    APPROVED = "APPROVED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class DeductionCalcType(str, PyEnum):
    PERCENTAGE = "PERCENTAGE"
    FIXED = "FIXED"


class Employee(BaseModel):
    """Payroll employee, optionally linked to a candidate/user."""

    __tablename__ = "payroll_employees"

    client_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    employee_code = Column(String(50), nullable=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    department = Column(String(100), nullable=True)
    position = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    hire_date = Column(Date, nullable=True)
    termination_date = Column(Date, nullable=True)

    # Relationships
    client = relationship("Company", foreign_keys=[client_id])
    contracts = relationship("Contract", back_populates="employee", lazy="dynamic")
    attendance_records = relationship("Attendance", back_populates="employee", lazy="dynamic")
    payroll_lines = relationship("PayrollLine", back_populates="employee", lazy="dynamic")


class Contract(BaseModel):
    """Employment contract with salary and payment terms."""

    __tablename__ = "payroll_contracts"

    employee_id = Column(UUID(as_uuid=True), ForeignKey("payroll_employees.id"), nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    contract_type = Column(Enum(ContractType, name="contract_type"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    base_salary = Column(Float, nullable=False)
    currency = Column(String(10), default="MXN", nullable=False)
    pay_frequency = Column(Enum(PayFrequency, name="pay_frequency"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    employee = relationship("Employee", back_populates="contracts")
    client = relationship("Company", foreign_keys=[client_id])


class Attendance(BaseModel):
    """Daily attendance record for an employee."""

    __tablename__ = "payroll_attendance"
    __table_args__ = (
        UniqueConstraint("employee_id", "date", "attendance_type", name="uq_attendance_employee_date_type"),
    )

    employee_id = Column(UUID(as_uuid=True), ForeignKey("payroll_employees.id"), nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    hours = Column(Float, nullable=False)
    attendance_type = Column(
        Enum(AttendanceType, name="attendance_type"),
        default=AttendanceType.REGULAR,
        nullable=False,
    )
    notes = Column(String(500), nullable=True)

    # Relationships
    employee = relationship("Employee", back_populates="attendance_records")


class PayrollRun(BaseModel):
    """A payroll run for a specific period and client."""

    __tablename__ = "payroll_runs"

    client_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    pay_frequency = Column(Enum(PayFrequency, name="pay_frequency"), nullable=False)
    status = Column(
        Enum(PayrollRunStatus, name="payroll_run_status"),
        default=PayrollRunStatus.DRAFT,
        nullable=False,
        index=True,
    )
    total_gross = Column(Float, default=0.0)
    total_deductions = Column(Float, default=0.0)
    total_net = Column(Float, default=0.0)
    employee_count = Column(Integer, default=0)
    currency = Column(String(10), default="MXN", nullable=False)
    approved_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    client = relationship("Company", foreign_keys=[client_id])
    lines = relationship("PayrollLine", back_populates="payroll_run", lazy="dynamic")
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class PayrollLine(BaseModel):
    """Individual payroll line for one employee in a run."""

    __tablename__ = "payroll_lines"

    payroll_run_id = Column(UUID(as_uuid=True), ForeignKey("payroll_runs.id"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("payroll_employees.id"), nullable=False, index=True)
    base_salary = Column(Float, nullable=False)
    days_worked = Column(Float, nullable=True)
    hours_regular = Column(Float, default=0.0)
    hours_overtime = Column(Float, default=0.0)
    gross_pay = Column(Float, nullable=False)
    total_deductions = Column(Float, default=0.0)
    net_pay = Column(Float, nullable=False)
    deductions_detail = Column(JSONB, default=list)

    # Relationships
    payroll_run = relationship("PayrollRun", back_populates="lines")
    employee = relationship("Employee", back_populates="payroll_lines")
    payslip = relationship("Payslip", back_populates="payroll_line", uselist=False)


class Payslip(BaseModel):
    """HTML payslip generated for a payroll line."""

    __tablename__ = "payroll_payslips"

    payroll_line_id = Column(UUID(as_uuid=True), ForeignKey("payroll_lines.id"), nullable=False, unique=True)
    html_content = Column(Text, nullable=True)
    generated_at = Column(DateTime, nullable=True)

    # Relationships
    payroll_line = relationship("PayrollLine", back_populates="payslip")


class DeductionType(BaseModel):
    """Configurable deduction type per client."""

    __tablename__ = "payroll_deduction_types"

    client_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    calc_type = Column(Enum(DeductionCalcType, name="deduction_calc_type"), nullable=False)
    value = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_mandatory = Column(Boolean, default=False, nullable=False)

    # Relationships
    client = relationship("Company", foreign_keys=[client_id])


class TaxConfig(BaseModel):
    """Placeholder for future tax rules per client."""

    __tablename__ = "payroll_tax_configs"

    client_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    config_data = Column(JSONB, default=dict)
    is_active = Column(Boolean, default=True, nullable=False)

    # Relationships
    client = relationship("Company", foreign_keys=[client_id])
