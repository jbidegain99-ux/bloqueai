"""Pydantic schemas for EOR module."""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


# ── Employee ──────────────────────────────────────────────────


class EOREmployeeCreate(BaseSchema):
    client_company_id: UUID
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., max_length=255)
    phone: Optional[str] = None
    dui: Optional[str] = None
    nit: Optional[str] = None
    birth_date: Optional[date] = None
    address: Optional[str] = None

    isss_number: Optional[str] = None
    afp_provider: Optional[str] = None
    afp_number: Optional[str] = None

    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_type: Optional[str] = None

    position: Optional[str] = None
    department: Optional[str] = None
    base_salary: Decimal = Field(..., ge=0)
    payment_frequency: str = "MONTHLY"
    start_date: date
    end_date: Optional[date] = None
    contract_type: str = "INDEFINIDO"
    contract_end_date: Optional[date] = None


class EOREmployeeUpdate(BaseSchema):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    dui: Optional[str] = None
    nit: Optional[str] = None
    birth_date: Optional[date] = None
    address: Optional[str] = None

    isss_number: Optional[str] = None
    afp_provider: Optional[str] = None
    afp_number: Optional[str] = None

    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_type: Optional[str] = None

    position: Optional[str] = None
    department: Optional[str] = None
    base_salary: Optional[Decimal] = None
    payment_frequency: Optional[str] = None
    contract_type: Optional[str] = None
    contract_end_date: Optional[date] = None
    status: Optional[str] = None


class EOREmployeeResponse(BaseSchema):
    id: UUID
    client_company_id: UUID
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    dui: Optional[str] = None
    nit: Optional[str] = None
    birth_date: Optional[date] = None
    address: Optional[str] = None

    isss_number: Optional[str] = None
    afp_provider: Optional[str] = None
    afp_number: Optional[str] = None

    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_type: Optional[str] = None

    position: Optional[str] = None
    department: Optional[str] = None
    base_salary: Decimal
    payment_frequency: str
    start_date: date
    end_date: Optional[date] = None
    contract_type: str
    contract_end_date: Optional[date] = None

    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class EOREmployeeDetailResponse(EOREmployeeResponse):
    monthly_cost: Optional[dict] = None
    vacation_days_available: Optional[int] = None
    vacation_days_used: Optional[int] = None


# ── Termination ───────────────────────────────────────────────


class TerminationRequest(BaseSchema):
    termination_date: date
    reason: str
    with_cause: bool = False


class TerminationResponse(BaseSchema):
    employee_id: UUID
    termination_date: date
    indemnization: Optional[Decimal] = None
    aguinaldo_proporcional: Optional[Decimal] = None
    vacaciones_pendientes: Optional[Decimal] = None
    total_liquidacion: Decimal
    message: str


# ── Payroll Run ───────────────────────────────────────────────


class PayrollRunCreate(BaseSchema):
    client_company_id: UUID
    period_start: date
    period_end: date
    payment_date: Optional[date] = None
    employee_ids: Optional[List[UUID]] = None


class PayrollRunSummary(BaseSchema):
    id: UUID
    client_company_id: UUID
    period_start: date
    period_end: date
    payment_date: Optional[date] = None
    status: str
    total_employees: int
    total_gross: Decimal
    total_deductions: Decimal
    total_net: Decimal
    total_employer_contributions: Decimal
    total_fees: Decimal
    grand_total: Decimal
    created_at: Optional[datetime] = None


class PayrollItemResponse(BaseSchema):
    id: UUID
    employee_id: UUID
    employee_name: Optional[str] = None
    base_salary: Decimal
    overtime_amount: Decimal
    bonuses: Decimal
    gross_salary: Decimal
    isss_employee: Decimal
    afp_employee: Decimal
    isr: Decimal
    other_deductions: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    isss_employer: Decimal
    afp_employer: Decimal
    fee_talentos: Decimal
    total_employer_cost: Decimal


class PayrollRunDetailResponse(PayrollRunSummary):
    items: List[PayrollItemResponse] = []
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None


# ── Payroll Simulation ────────────────────────────────────────


class PayrollSimulationRequest(BaseSchema):
    salario_base: Decimal
    horas_extra: Decimal = Decimal("0")
    bonificaciones: Decimal = Decimal("0")
    otras_deducciones: Decimal = Decimal("0")


class PayrollSimulationResponse(BaseSchema):
    base_salary: Decimal
    overtime: Decimal
    bonuses: Decimal
    gross_salary: Decimal
    isss_employee: Decimal
    afp_employee: Decimal
    isr: Decimal
    other_deductions: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    isss_employer: Decimal
    afp_employer: Decimal
    total_employer_cost: Decimal
    fee_talentos: Decimal
    grand_total: Decimal


# ── Vacation ──────────────────────────────────────────────────


class VacationRequestCreate(BaseSchema):
    employee_id: UUID
    start_date: date
    end_date: date
    days_requested: int = Field(..., ge=1)
    reason: Optional[str] = None


class VacationRequestResponse(BaseSchema):
    id: UUID
    employee_id: UUID
    employee_name: Optional[str] = None
    start_date: date
    end_date: date
    days_requested: int
    reason: Optional[str] = None
    status: str
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    created_at: Optional[datetime] = None


# ── Payslip ───────────────────────────────────────────────────


class PayslipSummary(BaseSchema):
    item_id: UUID
    period_start: date
    period_end: date
    gross_salary: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    payment_date: Optional[date] = None
    status: str


# ── Public Calculator ─────────────────────────────────────────


class CalculatorResponse(BaseSchema):
    salary_type: str
    salario_bruto: Decimal
    isss_empleado: Decimal
    afp_empleado: Decimal
    isr: Decimal
    total_deducciones: Decimal
    salario_neto: Decimal
    isss_patronal: Decimal
    afp_patronal: Decimal
    subtotal_empleador: Decimal
    fee_talentos: Decimal
    costo_total_mensual: Decimal
