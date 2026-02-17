"""Pydantic schemas for Payroll module."""

from datetime import date, datetime
from typing import Optional, List
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


# === Employees ===

class EmployeeCreate(BaseSchema):
    client_id: UUID
    full_name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = None
    phone: Optional[str] = None
    employee_code: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    hire_date: Optional[date] = None
    candidate_id: Optional[UUID] = None
    user_id: Optional[UUID] = None


class EmployeeUpdate(BaseSchema):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    employee_code: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    is_active: Optional[bool] = None
    hire_date: Optional[date] = None
    termination_date: Optional[date] = None


class EmployeeResponse(BaseSchema):
    id: UUID
    client_id: UUID
    client_name: Optional[str] = None
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    employee_code: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    is_active: bool
    hire_date: Optional[date] = None
    termination_date: Optional[date] = None
    active_contract: Optional[dict] = None
    created_at: Optional[datetime] = None


# === Contracts ===

class ContractCreate(BaseSchema):
    employee_id: UUID
    client_id: UUID
    contract_type: str
    start_date: date
    base_salary: float = Field(..., gt=0)
    currency: str = "USD"
    pay_frequency: str
    end_date: Optional[date] = None
    notes: Optional[str] = None


class ContractUpdate(BaseSchema):
    contract_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    base_salary: Optional[float] = None
    currency: Optional[str] = None
    pay_frequency: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


# === Attendance ===

class AttendanceCreate(BaseSchema):
    employee_id: UUID
    client_id: UUID
    date: date
    hours: float = Field(..., gt=0)
    attendance_type: str = "REGULAR"
    notes: Optional[str] = None


class AttendanceCsvRow(BaseSchema):
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    date: str
    hours: float
    attendance_type: str = "REGULAR"
    notes: Optional[str] = None
    is_duplicate: bool = False
    employee_id: Optional[UUID] = None


class AttendanceCsvPreview(BaseSchema):
    rows: List[AttendanceCsvRow]
    total_rows: int
    valid_rows: int
    duplicate_rows: int
    unmapped_rows: int


# === Payroll Runs ===

class PayrollRunCreate(BaseSchema):
    client_id: UUID
    period_start: date
    period_end: date
    pay_frequency: str
    notes: Optional[str] = None


class PayrollRunResponse(BaseSchema):
    id: UUID
    client_id: UUID
    client_name: Optional[str] = None
    period_start: date
    period_end: date
    pay_frequency: str
    status: str
    total_gross: float
    total_deductions: float
    total_net: float
    employee_count: int
    currency: str
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class PayrollLineResponse(BaseSchema):
    id: UUID
    employee_id: UUID
    employee_name: str
    employee_code: Optional[str] = None
    department: Optional[str] = None
    base_salary: float
    days_worked: Optional[float] = None
    hours_regular: float
    hours_overtime: float
    gross_pay: float
    total_deductions: float
    net_pay: float
    deductions_detail: Optional[List[dict]] = None


# === Deduction Types ===

class DeductionTypeCreate(BaseSchema):
    client_id: UUID
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    calc_type: str
    value: float = Field(..., gt=0)
    is_mandatory: bool = False


class DeductionTypeResponse(BaseSchema):
    id: UUID
    client_id: UUID
    name: str
    description: Optional[str] = None
    calc_type: str
    value: float
    is_active: bool
    is_mandatory: bool
    created_at: Optional[datetime] = None


# === Reports ===

class PayrollSummaryReport(BaseSchema):
    client_name: Optional[str] = None
    period: Optional[str] = None
    total_employees: int = 0
    total_gross: float = 0.0
    total_deductions: float = 0.0
    total_net: float = 0.0
    runs_count: int = 0
    currency: str = "USD"


class PayrollDetailLine(BaseSchema):
    employee_name: str
    employee_code: Optional[str] = None
    department: Optional[str] = None
    base_salary: float
    gross_pay: float
    total_deductions: float
    net_pay: float
