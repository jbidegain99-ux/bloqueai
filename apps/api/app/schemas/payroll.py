"""Pydantic schemas for Payroll module."""

import re
from datetime import date, datetime
from typing import Optional, List
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.base import BaseSchema


# === DUI Validation ===

DUI_PATTERN = re.compile(r"^\d{8}-\d$")


def validate_dui_format(value: str) -> str:
    """Validate El Salvador DUI format: 00000000-0 (8 digits, dash, 1 digit)."""
    if not DUI_PATTERN.match(value):
        raise ValueError(
            "Formato de DUI inválido. Esperado: 00000000-0 (8 dígitos, guión, 1 dígito)"
        )
    return value


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
    document_type: Optional[str] = None
    document_id: Optional[str] = None
    salary: Optional[float] = Field(None, ge=0)
    salary_currency: str = "USD"
    employment_type: Optional[str] = None
    bank_account_number: Optional[str] = None

    @field_validator("document_id")
    @classmethod
    def validate_document_id(cls, v: Optional[str], info) -> Optional[str]:
        if v is None:
            return v
        doc_type = info.data.get("document_type")
        if doc_type == "DUI":
            return validate_dui_format(v)
        return v


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
    document_type: Optional[str] = None
    document_id: Optional[str] = None
    salary: Optional[float] = Field(None, ge=0)
    salary_currency: Optional[str] = None
    employment_type: Optional[str] = None
    bank_account_number: Optional[str] = None

    @field_validator("document_id")
    @classmethod
    def validate_document_id(cls, v: Optional[str], info) -> Optional[str]:
        if v is None:
            return v
        doc_type = info.data.get("document_type")
        if doc_type == "DUI":
            return validate_dui_format(v)
        return v


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
    document_type: Optional[str] = None
    document_id: Optional[str] = None
    salary: Optional[float] = None
    salary_currency: Optional[str] = None
    employment_type: Optional[str] = None
    status: Optional[str] = None
    bank_account_number: Optional[str] = None
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
    position_title: Optional[str] = None
    benefits: Optional[dict] = None
    document_url: Optional[str] = None

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v: Optional[date], info) -> Optional[date]:
        if v is not None:
            start = info.data.get("start_date")
            if start and v <= start:
                raise ValueError("end_date debe ser posterior a start_date")
        return v


class ContractUpdate(BaseSchema):
    contract_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    base_salary: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    pay_frequency: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    position_title: Optional[str] = None
    benefits: Optional[dict] = None
    document_url: Optional[str] = None


class ContractResponse(BaseSchema):
    id: UUID
    employee_id: UUID
    employee_name: Optional[str] = None
    client_id: UUID
    contract_type: str
    position_title: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    base_salary: float
    currency: str
    pay_frequency: str
    is_active: bool
    notes: Optional[str] = None
    benefits: Optional[dict] = None
    document_url: Optional[str] = None
    signed_by_employee_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


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
