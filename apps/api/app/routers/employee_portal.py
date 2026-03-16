"""Employee portal endpoints - self-service access to payroll data and AI assistant."""

from datetime import date, datetime, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import extract
import structlog

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.company import Company
from app.models.payroll import (
    Employee,
    Contract,
    PayrollRun,
    PayrollLine,
    Payslip,
    PayrollDeductionBreakdown,
    PayrollProvision,
    PayrollRunStatus,
)
from app.utils.deps import get_current_user

logger = structlog.get_logger()

router = APIRouter(
    prefix="/employee",
    tags=["Employee Portal"],
)


# ============ Schemas ============


class EmployeePayslipSummary(PydanticBaseModel):
    id: str
    month: int
    year: int
    gross_salary: float
    total_deductions: float
    net_salary: float
    payment_date: str


class EmployeeYtdSummary(PydanticBaseModel):
    total_gross: float
    total_deductions: float
    total_net: float
    total_isss: float
    total_afp: float
    total_isr: float


class DashboardResponse(PydanticBaseModel):
    employee_name: str
    position: str
    department: str
    last_payslip: Optional[EmployeePayslipSummary] = None
    ytd_summary: EmployeeYtdSummary
    pending_documents: int = 0


class EmployeePayslipListItem(PydanticBaseModel):
    id: str
    month: int
    year: int
    gross_salary: float
    total_deductions: float
    net_salary: float
    payment_date: str
    status: str


class DeductionLine(PydanticBaseModel):
    concept: str
    employee_amount: float
    employer_amount: float = 0.0


class EarningLine(PydanticBaseModel):
    concept: str
    amount: float


class PayslipDetailResponse(PydanticBaseModel):
    id: str
    month: int
    year: int
    employee_name: str
    employee_id_number: str
    position: str
    department: str
    payment_date: str
    base_salary: float
    earnings: list[EarningLine]
    gross_salary: float
    deductions: list[DeductionLine]
    total_deductions: float
    net_salary: float
    employer_contributions: list[DeductionLine]
    total_employer_contributions: float
    company_name: str
    company_nit: str


class DeductionBreakdownItem(PydanticBaseModel):
    concept: str
    rate: float
    employee_amount: float
    employer_amount: float
    cap: Optional[float] = None


class BenefitItem(PydanticBaseModel):
    name: str
    description: str
    value: Optional[str] = None


class YtdAccumulated(PydanticBaseModel):
    total_gross: float
    total_deductions: float
    total_net: float
    months_paid: int


class SalaryBreakdownResponse(PydanticBaseModel):
    base_salary: float
    currency: str = "USD"
    payment_frequency: str = "Mensual"
    deductions: list[DeductionBreakdownItem]
    total_employee_deductions: float
    total_employer_contributions: float
    net_salary: float
    benefits: list[BenefitItem]
    ytd: YtdAccumulated


class EmergencyContact(PydanticBaseModel):
    name: str
    relationship: str
    phone: str


class EmployeeProfileResponse(PydanticBaseModel):
    id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    date_of_birth: Optional[str] = None
    national_id: Optional[str] = None
    national_id_type: Optional[str] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    position: str
    department: str
    hire_date: str
    contract_type: str
    work_schedule: Optional[str] = None
    manager_name: Optional[str] = None
    employee_code: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_masked: Optional[str] = None
    bank_account_type: Optional[str] = None
    emergency_contact: Optional[EmergencyContact] = None
    status: str


class DocumentItem(PydanticBaseModel):
    id: str
    name: str
    description: str
    type: str
    available: bool
    generated_at: Optional[str] = None


class GeneratedDocumentResponse(PydanticBaseModel):
    html: str


class ChatMessage(PydanticBaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(PydanticBaseModel):
    message: str
    history: list[ChatMessage] = []


class ChatResponse(PydanticBaseModel):
    reply: str
    suggested_questions: list[str] = []


# ============ Helpers ============


def _get_employee_or_404(db: Session, user: User) -> Employee:
    """Look up the Employee record linked to the current user."""
    employee = db.query(Employee).filter(Employee.user_id == user.id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró perfil de empleado vinculado a este usuario",
        )
    return employee


def _get_active_contract(db: Session, employee_id: UUID) -> Optional[Contract]:
    """Get the active contract for an employee."""
    return (
        db.query(Contract)
        .filter(Contract.employee_id == employee_id, Contract.is_active.is_(True))
        .first()
    )


def _calculate_isss_employee(monthly_salary: float) -> float:
    """ISSS employee contribution: 3% capped at $30 (salary cap $1,000)."""
    applicable = min(monthly_salary, 1000.0)
    return min(round(applicable * 0.03, 2), 30.0)


def _calculate_isss_employer(monthly_salary: float) -> float:
    """ISSS employer contribution: 7.5% capped at $75 (salary cap $1,000)."""
    applicable = min(monthly_salary, 1000.0)
    return min(round(applicable * 0.075, 2), 75.0)


def _calculate_afp_employee(monthly_salary: float) -> float:
    """AFP employee contribution: 7.25% of salary."""
    return round(monthly_salary * 0.0725, 2)


def _calculate_afp_employer(monthly_salary: float) -> float:
    """AFP employer contribution: 8.75% of salary."""
    return round(monthly_salary * 0.0875, 2)


def _calculate_isr_monthly(monthly_salary: float, isss: float, afp: float) -> float:
    """ISR (income tax) based on El Salvador progressive table.

    Applied to taxable income = salary - ISSS - AFP.
    """
    taxable = monthly_salary - isss - afp
    if taxable <= 472.00:
        isr = 0.0
    elif taxable <= 895.24:
        isr = (taxable - 472.00) * 0.10
    elif taxable <= 2038.10:
        isr = 42.32 + (taxable - 895.24) * 0.20
    else:
        isr = 271.89 + (taxable - 2038.10) * 0.30
    return round(max(isr, 0.0), 2)


def _salary_breakdown(monthly_salary: float) -> dict[str, float]:
    """Full salary breakdown using El Salvador rates."""
    isss_emp = _calculate_isss_employee(monthly_salary)
    afp_emp = _calculate_afp_employee(monthly_salary)
    isr = _calculate_isr_monthly(monthly_salary, isss_emp, afp_emp)
    total_deductions = round(isss_emp + afp_emp + isr, 2)
    net = round(monthly_salary - total_deductions, 2)

    isss_patron = _calculate_isss_employer(monthly_salary)
    afp_patron = _calculate_afp_employer(monthly_salary)

    return {
        "base_salary": monthly_salary,
        "isss_employee": isss_emp,
        "afp_employee": afp_emp,
        "isr_monthly": isr,
        "total_deductions": total_deductions,
        "net_salary": net,
        "isss_employer": isss_patron,
        "afp_employer": afp_patron,
    }


def _get_ytd_data(db: Session, employee_id: UUID) -> dict[str, float]:
    """Get YTD payroll data for an employee."""
    current_year = date.today().year
    ytd_lines = (
        db.query(PayrollLine)
        .join(PayrollRun, PayrollLine.payroll_run_id == PayrollRun.id)
        .filter(
            PayrollLine.employee_id == employee_id,
            PayrollRun.status == PayrollRunStatus.PAID,
            extract("year", PayrollRun.period_start) == current_year,
        )
        .all()
    )

    ytd_gross = 0.0
    ytd_deductions = 0.0
    ytd_net = 0.0
    ytd_isss = 0.0
    ytd_afp = 0.0
    ytd_isr = 0.0

    for line in ytd_lines:
        ytd_gross += line.gross_pay or 0.0
        ytd_deductions += line.total_deductions or 0.0
        ytd_net += line.net_pay or 0.0
        # Parse deductions_detail for breakdown
        if line.deductions_detail and isinstance(line.deductions_detail, list):
            for d in line.deductions_detail:
                dtype = (d.get("type") or d.get("deduction_type") or "").upper()
                amount = float(d.get("amount", 0))
                if "ISSS" in dtype:
                    ytd_isss += amount
                elif "AFP" in dtype:
                    ytd_afp += amount
                elif "ISR" in dtype or "TAX" in dtype or "INCOME" in dtype:
                    ytd_isr += amount

    return {
        "total_gross": round(ytd_gross, 2),
        "total_deductions": round(ytd_deductions, 2),
        "total_net": round(ytd_net, 2),
        "total_isss": round(ytd_isss, 2),
        "total_afp": round(ytd_afp, 2),
        "total_isr": round(ytd_isr, 2),
        "months_paid": len(ytd_lines),
    }


# ============ Endpoints ============


@router.get("/profile")
async def get_employee_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EmployeeProfileResponse:
    """Return the authenticated employee's own profile."""
    employee = _get_employee_or_404(db, current_user)
    contract = _get_active_contract(db, employee.id)

    # Mask bank account
    bank_masked: Optional[str] = None
    if employee.bank_account_number:
        acct = employee.bank_account_number
        bank_masked = f"****{acct[-4:]}" if len(acct) >= 4 else "****"

    contract_type = "N/A"
    pay_freq = "Mensual"
    if contract:
        contract_type = contract.contract_type.value if contract.contract_type else "N/A"
        if contract.pay_frequency:
            freq_map = {"MONTHLY": "Mensual", "BIWEEKLY": "Quincenal", "WEEKLY": "Semanal"}
            pay_freq = freq_map.get(contract.pay_frequency.value, contract.pay_frequency.value)

    logger.info("employee_profile_accessed", employee_id=str(employee.id))

    return EmployeeProfileResponse(
        id=str(employee.id),
        full_name=employee.full_name,
        email=employee.email or "",
        phone=employee.phone,
        address=None,
        city=None,
        country="El Salvador",
        date_of_birth=None,
        national_id=employee.document_id,
        national_id_type=employee.document_type.value if employee.document_type else None,
        gender=None,
        marital_status=None,
        position=employee.position or "N/A",
        department=employee.department or "N/A",
        hire_date=employee.hire_date.isoformat() if employee.hire_date else "N/A",
        contract_type=contract_type,
        work_schedule=pay_freq,
        manager_name=None,
        employee_code=employee.employee_code,
        bank_name=None,
        bank_account_masked=bank_masked,
        bank_account_type=None,
        emergency_contact=None,
        status=employee.status.value if employee.status else "ACTIVE",
    )


@router.get("/dashboard")
async def get_employee_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardResponse:
    """Return dashboard data: last payslip, YTD summary, next payroll date."""
    employee = _get_employee_or_404(db, current_user)

    # Last payslip (from most recent PAID payroll run)
    last_line = (
        db.query(PayrollLine)
        .join(PayrollRun, PayrollLine.payroll_run_id == PayrollRun.id)
        .filter(
            PayrollLine.employee_id == employee.id,
            PayrollRun.status == PayrollRunStatus.PAID,
        )
        .order_by(PayrollRun.period_end.desc())
        .first()
    )

    last_payslip: Optional[EmployeePayslipSummary] = None
    if last_line:
        run = last_line.payroll_run
        payslip = db.query(Payslip).filter(Payslip.payroll_line_id == last_line.id).first()
        payslip_id = str(payslip.id) if payslip else str(last_line.id)
        last_payslip = EmployeePayslipSummary(
            id=payslip_id,
            month=run.period_end.month,
            year=run.period_end.year,
            gross_salary=last_line.gross_pay or 0.0,
            total_deductions=last_line.total_deductions or 0.0,
            net_salary=last_line.net_pay or 0.0,
            payment_date=run.period_end.isoformat(),
        )

    # YTD summary
    ytd_data = _get_ytd_data(db, employee.id)

    logger.info("employee_dashboard_accessed", employee_id=str(employee.id))

    return DashboardResponse(
        employee_name=employee.full_name,
        position=employee.position or "N/A",
        department=employee.department or "N/A",
        last_payslip=last_payslip,
        ytd_summary=EmployeeYtdSummary(
            total_gross=ytd_data["total_gross"],
            total_deductions=ytd_data["total_deductions"],
            total_net=ytd_data["total_net"],
            total_isss=ytd_data["total_isss"],
            total_afp=ytd_data["total_afp"],
            total_isr=ytd_data["total_isr"],
        ),
        pending_documents=0,
    )


@router.get("/payslips")
async def list_employee_payslips(
    year: Optional[int] = Query(None, description="Filtrar por año"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[EmployeePayslipListItem]:
    """Return list of employee payslips, optionally filtered by year."""
    employee = _get_employee_or_404(db, current_user)

    query = (
        db.query(PayrollLine)
        .join(PayrollRun, PayrollLine.payroll_run_id == PayrollRun.id)
        .filter(
            PayrollLine.employee_id == employee.id,
            PayrollRun.status == PayrollRunStatus.PAID,
        )
    )

    if year:
        query = query.filter(extract("year", PayrollRun.period_start) == year)

    lines = query.order_by(PayrollRun.period_end.desc()).all()

    results: list[EmployeePayslipListItem] = []
    for line in lines:
        run = line.payroll_run
        payslip = db.query(Payslip).filter(Payslip.payroll_line_id == line.id).first()
        payslip_id = str(payslip.id) if payslip else str(line.id)
        results.append(
            EmployeePayslipListItem(
                id=payslip_id,
                month=run.period_end.month,
                year=run.period_end.year,
                gross_salary=line.gross_pay or 0.0,
                total_deductions=line.total_deductions or 0.0,
                net_salary=line.net_pay or 0.0,
                payment_date=run.period_end.isoformat(),
                status=run.status.value,
            )
        )

    logger.info("employee_payslips_listed", employee_id=str(employee.id), count=len(results))
    return results


@router.get("/payslips/{payslip_id}")
async def get_payslip_detail(
    payslip_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayslipDetailResponse:
    """Return detailed payslip with full deduction breakdown."""
    employee = _get_employee_or_404(db, current_user)

    # Try to find by Payslip ID first, then by PayrollLine ID
    payslip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if payslip:
        line = db.query(PayrollLine).filter(PayrollLine.id == payslip.payroll_line_id).first()
    else:
        line = db.query(PayrollLine).filter(PayrollLine.id == payslip_id).first()
        if line:
            payslip = db.query(Payslip).filter(Payslip.payroll_line_id == line.id).first()

    if not line:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Boleta de pago no encontrada",
        )

    # Security: ensure payslip belongs to the requesting employee
    if line.employee_id != employee.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para ver esta boleta de pago",
        )

    run = line.payroll_run

    # Get company info
    company = db.query(Company).filter(Company.id == employee.client_id).first()
    company_name = company.name if company else "Empresa"
    company_nit = "N/A"

    # Build deductions from deductions_detail or calculate from salary
    deductions: list[DeductionLine] = []
    employer_contribs: list[DeductionLine] = []
    salary = line.base_salary or 0.0

    if line.deductions_detail and isinstance(line.deductions_detail, list):
        for d in line.deductions_detail:
            concept = d.get("description") or d.get("type") or "Deducción"
            amount = float(d.get("amount", 0))
            deductions.append(DeductionLine(concept=concept, employee_amount=amount))
    else:
        # Calculate from salary
        bd = _salary_breakdown(salary)
        deductions = [
            DeductionLine(concept="ISSS (3%)", employee_amount=bd["isss_employee"]),
            DeductionLine(concept="AFP (7.25%)", employee_amount=bd["afp_employee"]),
            DeductionLine(concept="ISR", employee_amount=bd["isr_monthly"]),
        ]
        employer_contribs = [
            DeductionLine(concept="ISSS Patronal (7.5%)", employee_amount=0, employer_amount=bd["isss_employer"]),
            DeductionLine(concept="AFP Patronal (8.75%)", employee_amount=0, employer_amount=bd["afp_employer"]),
        ]

    if not employer_contribs:
        bd = _salary_breakdown(salary)
        employer_contribs = [
            DeductionLine(concept="ISSS Patronal (7.5%)", employee_amount=0, employer_amount=bd["isss_employer"]),
            DeductionLine(concept="AFP Patronal (8.75%)", employee_amount=0, employer_amount=bd["afp_employer"]),
        ]

    total_employer = sum(c.employer_amount for c in employer_contribs)

    logger.info("employee_payslip_detail_accessed", employee_id=str(employee.id), payslip_id=str(payslip_id))

    return PayslipDetailResponse(
        id=str(payslip.id) if payslip else str(line.id),
        month=run.period_end.month,
        year=run.period_end.year,
        employee_name=employee.full_name,
        employee_id_number=employee.document_id or "N/A",
        position=employee.position or "N/A",
        department=employee.department or "N/A",
        payment_date=run.period_end.isoformat(),
        base_salary=salary,
        earnings=[],
        gross_salary=line.gross_pay or 0.0,
        deductions=deductions,
        total_deductions=line.total_deductions or 0.0,
        net_salary=line.net_pay or 0.0,
        employer_contributions=employer_contribs,
        total_employer_contributions=round(total_employer, 2),
        company_name=company_name,
        company_nit=company_nit,
    )


@router.get("/salary/breakdown")
async def get_salary_breakdown(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SalaryBreakdownResponse:
    """Return current salary with monthly deduction estimates (El Salvador rates)."""
    employee = _get_employee_or_404(db, current_user)

    # Use contract salary first, fallback to employee salary
    contract = _get_active_contract(db, employee.id)
    monthly_salary: float
    currency = "USD"
    pay_freq = "Mensual"

    if contract and contract.base_salary:
        monthly_salary = float(contract.base_salary)
        currency = contract.currency or "USD"
        if contract.pay_frequency:
            freq_map = {"MONTHLY": "Mensual", "BIWEEKLY": "Quincenal", "WEEKLY": "Semanal"}
            pay_freq = freq_map.get(contract.pay_frequency.value, "Mensual")
    elif employee.salary is not None:
        monthly_salary = float(employee.salary)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontró información de salario",
        )

    bd = _salary_breakdown(monthly_salary)

    # Build deduction items with rates
    deductions_list = [
        DeductionBreakdownItem(
            concept="ISSS",
            rate=3.0,
            employee_amount=bd["isss_employee"],
            employer_amount=bd["isss_employer"],
            cap=30.0,
        ),
        DeductionBreakdownItem(
            concept="AFP",
            rate=7.25,
            employee_amount=bd["afp_employee"],
            employer_amount=bd["afp_employer"],
            cap=None,
        ),
        DeductionBreakdownItem(
            concept="ISR",
            rate=0.0,  # Progressive, no single rate
            employee_amount=bd["isr_monthly"],
            employer_amount=0.0,
            cap=None,
        ),
    ]

    total_employer = round(bd["isss_employer"] + bd["afp_employer"], 2)

    # Benefits from contract
    benefits_list: list[BenefitItem] = []
    if contract and contract.benefits:
        for key, val in contract.benefits.items():
            benefits_list.append(BenefitItem(
                name=key,
                description=str(val) if isinstance(val, str) else key,
                value=str(val) if not isinstance(val, bool) else ("Incluido" if val else None),
            ))

    # YTD data
    ytd_data = _get_ytd_data(db, employee.id)

    logger.info("employee_salary_breakdown_accessed", employee_id=str(employee.id))

    return SalaryBreakdownResponse(
        base_salary=monthly_salary,
        currency=currency,
        payment_frequency=pay_freq,
        deductions=deductions_list,
        total_employee_deductions=bd["total_deductions"],
        total_employer_contributions=total_employer,
        net_salary=bd["net_salary"],
        benefits=benefits_list,
        ytd=YtdAccumulated(
            total_gross=ytd_data["total_gross"],
            total_deductions=ytd_data["total_deductions"],
            total_net=ytd_data["total_net"],
            months_paid=ytd_data["months_paid"],
        ),
    )


@router.get("/documents")
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentItem]:
    """Return list of available documents for the employee."""
    _get_employee_or_404(db, current_user)

    return [
        DocumentItem(
            id="proof-of-income",
            name="Constancia de Ingresos",
            description="Documento que certifica su salario actual y antigüedad laboral",
            type="proof_of_income",
            available=True,
            generated_at=None,
        ),
        DocumentItem(
            id="employment-letter",
            name="Carta Laboral",
            description="Certificado de empleo con detalle de cargo y antigüedad",
            type="employment_letter",
            available=True,
            generated_at=None,
        ),
        DocumentItem(
            id="payslips",
            name="Colillas de Pago",
            description="Acceda a todas sus colillas de pago desde la sección de colillas",
            type="payslips",
            available=True,
            generated_at=None,
        ),
    ]


@router.post("/documents/proof-of-income")
async def generate_proof_of_income(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GeneratedDocumentResponse:
    """Generate a proof of income HTML document for the employee."""
    employee = _get_employee_or_404(db, current_user)
    contract = _get_active_contract(db, employee.id)

    monthly_salary: float
    currency = employee.salary_currency or "USD"
    if contract and contract.base_salary:
        monthly_salary = float(contract.base_salary)
        currency = contract.currency or currency
    elif employee.salary is not None:
        monthly_salary = float(employee.salary)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontró información de salario para generar constancia",
        )

    today = date.today()
    hire_date_str = employee.hire_date.strftime("%d/%m/%Y") if employee.hire_date else "N/A"

    # Get company info
    company = db.query(Company).filter(Company.id == employee.client_id).first()
    company_name = company.name if company else "Empresa"

    html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Constancia de Ingresos</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; color: #333; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .header h1 {{ font-size: 18px; margin-bottom: 5px; color: #1a2332; }}
        .header h2 {{ font-size: 14px; color: #666; font-weight: normal; }}
        .content {{ line-height: 1.8; font-size: 14px; }}
        .signature {{ margin-top: 60px; text-align: center; }}
        .signature-line {{ border-top: 1px solid #333; width: 250px; margin: 0 auto; padding-top: 5px; }}
        .footer {{ margin-top: 40px; font-size: 11px; color: #666; text-align: center; }}
    </style>
</head>
<body>
    <div class="header">
        <h2>{company_name}</h2>
        <h1>CONSTANCIA DE INGRESOS</h1>
        <p style="font-size: 12px; color: #666;">Fecha de emisión: {today.strftime("%d/%m/%Y")}</p>
    </div>
    <div class="content">
        <p>Por medio de la presente se hace constar que:</p>
        <p><strong>{employee.full_name}</strong>, con documento de identidad
        <strong>{employee.document_type.value if employee.document_type else "N/A"}: {employee.document_id or "N/A"}</strong>,
        labora en nuestra empresa desde el <strong>{hire_date_str}</strong>,
        desempeñando el cargo de <strong>{employee.position or "N/A"}</strong>
        en el departamento de <strong>{employee.department or "N/A"}</strong>.</p>
        <p>Su salario mensual actual es de <strong>{currency} {monthly_salary:,.2f}</strong>.</p>
        <p>Se extiende la presente constancia a solicitud del interesado para los fines que estime conveniente.</p>
    </div>
    <div class="signature">
        <div class="signature-line">
            <p>Firma y Sello</p>
            <p>Recursos Humanos</p>
        </div>
    </div>
    <div class="footer">
        <p>Documento generado electrónicamente por TalenOS - {today.strftime("%d/%m/%Y %H:%M")}</p>
    </div>
</body>
</html>"""

    logger.info("proof_of_income_generated", employee_id=str(employee.id))
    return GeneratedDocumentResponse(html=html)


@router.post("/documents/generate/{doc_type}")
async def generate_document(
    doc_type: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GeneratedDocumentResponse:
    """Generate a document by type (employment_letter, etc.)."""
    employee = _get_employee_or_404(db, current_user)
    company = db.query(Company).filter(Company.id == employee.client_id).first()
    company_name = company.name if company else "Empresa"

    today = date.today()
    hire_date_str = employee.hire_date.strftime("%d/%m/%Y") if employee.hire_date else "N/A"

    if doc_type == "employment_letter":
        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Carta Laboral</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; color: #333; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .header h1 {{ font-size: 18px; margin-bottom: 5px; color: #1a2332; }}
        .content {{ line-height: 1.8; font-size: 14px; }}
        .signature {{ margin-top: 60px; text-align: center; }}
        .signature-line {{ border-top: 1px solid #333; width: 250px; margin: 0 auto; padding-top: 5px; }}
        .footer {{ margin-top: 40px; font-size: 11px; color: #666; text-align: center; }}
    </style>
</head>
<body>
    <div class="header">
        <h2>{company_name}</h2>
        <h1>CARTA LABORAL</h1>
        <p style="font-size: 12px; color: #666;">Fecha: {today.strftime("%d/%m/%Y")}</p>
    </div>
    <div class="content">
        <p>A quien corresponda:</p>
        <p>Por medio de la presente certificamos que <strong>{employee.full_name}</strong>,
        con documento de identidad <strong>{employee.document_type.value if employee.document_type else "N/A"}: {employee.document_id or "N/A"}</strong>,
        labora en <strong>{company_name}</strong> desde el <strong>{hire_date_str}</strong>.</p>
        <p>Actualmente desempeña el cargo de <strong>{employee.position or "N/A"}</strong>
        en el departamento de <strong>{employee.department or "N/A"}</strong>.</p>
        <p>Se extiende la presente a solicitud del interesado para los fines que estime conveniente.</p>
    </div>
    <div class="signature">
        <div class="signature-line">
            <p>Firma y Sello</p>
            <p>Recursos Humanos</p>
        </div>
    </div>
    <div class="footer">
        <p>Documento generado electrónicamente por TalenOS - {today.strftime("%d/%m/%Y %H:%M")}</p>
    </div>
</body>
</html>"""
        logger.info("employment_letter_generated", employee_id=str(employee.id))
        return GeneratedDocumentResponse(html=html)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Tipo de documento no soportado: {doc_type}",
    )


@router.post("/assistant/chat")
async def chat_with_assistant(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """Chat with Valentina, the AI payroll assistant (powered by Claude)."""
    employee = _get_employee_or_404(db, current_user)

    # Gather salary context for the assistant
    monthly_salary: Optional[float] = None
    contract = _get_active_contract(db, employee.id)
    if contract and contract.base_salary:
        monthly_salary = float(contract.base_salary)
    elif employee.salary is not None:
        monthly_salary = float(employee.salary)

    salary_context = ""
    if monthly_salary is not None:
        breakdown = _salary_breakdown(monthly_salary)
        salary_context = (
            f"\nDatos salariales del empleado:\n"
            f"- Salario base mensual: ${monthly_salary:,.2f}\n"
            f"- ISSS empleado: ${breakdown['isss_employee']:,.2f}\n"
            f"- AFP empleado: ${breakdown['afp_employee']:,.2f}\n"
            f"- ISR mensual: ${breakdown['isr_monthly']:,.2f}\n"
            f"- Total deducciones: ${breakdown['total_deductions']:,.2f}\n"
            f"- Salario neto: ${breakdown['net_salary']:,.2f}\n"
        )

    system_prompt = (
        "Eres Valentina, asistente virtual de nómina de TalenOS. "
        "Eres experta en legislación laboral de El Salvador y cálculos de nómina.\n\n"
        "Tu personalidad:\n"
        "- Amable y cercana, como una compañera de trabajo que sabe de nómina\n"
        "- Usas español salvadoreño natural (no traducción)\n"
        "- Explicas con ejemplos concretos y números reales\n"
        "- Ofreces próximos pasos al final de cada respuesta\n\n"
        "Conocimientos:\n"
        "- ISSS: 3% empleado (tope $30/mes, salario tope $1,000), 7.5% patronal (tope $75)\n"
        "- AFP: 7.25% empleado, 8.75% patronal\n"
        "- ISR: Tabla progresiva ($0-$472 exento, $472-$895 al 10%, $895-$2,038 al 20%, +$2,038 al 30%)\n"
        "- Aguinaldo: 1/12 del salario anual, pagadero del 1-20 de diciembre\n"
        "- Vacaciones: 15 días después de 1 año, remuneradas al 130%\n"
        "- Indemnización: 1 mes de salario por año trabajado (máx. 4 salarios)\n\n"
        "Reglas:\n"
        "- Responde SIEMPRE en español\n"
        "- Sé concisa pero completa (máximo 3-4 párrafos)\n"
        "- Si preguntan por aumento de salario o decisiones de la empresa → recomienda contactar a RRHH\n"
        "- Si preguntan por consejos financieros personales → recomienda un asesor\n"
        "- Si preguntan por datos de otros empleados → explica que es información privada\n"
        "- Si no estás segura, indícalo y sugiere contactar a RRHH\n\n"
        f"Empleado: {employee.full_name}\n"
        f"Cargo: {employee.position or 'N/A'}\n"
        f"Departamento: {employee.department or 'N/A'}\n"
        f"{salary_context}"
    )

    # Build message history for the API
    messages: list[dict[str, str]] = []
    for msg in request.history:
        if msg.role in ("user", "assistant"):
            messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.message})

    # Try to call Claude via Anthropic SDK
    try:
        import anthropic

        if not settings.llm_api_key:
            raise ValueError("API key not configured")

        client = anthropic.Anthropic(api_key=settings.llm_api_key)

        completion = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            temperature=0.7,
            system=system_prompt,
            messages=messages,
        )

        assistant_response = completion.content[0].text

        suggestions = [
            "¿Cómo se calcula mi ISSS?",
            "¿Cuánto pago de AFP?",
            "Explícame mi boleta de pago",
        ]

        logger.info("assistant_chat_success", employee_id=str(employee.id))

        return ChatResponse(reply=assistant_response, suggested_questions=suggestions)

    except (ImportError, ValueError, Exception) as exc:
        logger.warning(
            "assistant_chat_fallback",
            employee_id=str(employee.id),
            reason=str(exc),
        )

        # Mock response when Anthropic is unavailable
        first_name = employee.full_name.split()[0] if employee.full_name else "amigo"
        mock_response = (
            f"¡Hola {first_name}! Soy Valentina, tu asistente de nómina. "
            "En este momento el servicio de asistencia inteligente no está disponible. "
            "Por favor intenta más tarde o contacta a Recursos Humanos para consultas urgentes."
        )

        if monthly_salary is not None:
            bd = _salary_breakdown(monthly_salary)
            mock_response = (
                f"¡Hola {first_name}! Soy Valentina, tu asistente de nómina. "
                f"Tu salario base es ${monthly_salary:,.2f}. "
                f"Después de deducciones (ISSS ${bd['isss_employee']:,.2f}, "
                f"AFP ${bd['afp_employee']:,.2f}, ISR ${bd['isr_monthly']:,.2f}), "
                f"tu salario neto es ${bd['net_salary']:,.2f}. "
                "¿En qué más te puedo ayudar?"
            )

        return ChatResponse(
            reply=mock_response,
            suggested_questions=[
                "¿Cómo se calcula el ISSS?",
                "¿Cuándo pagan el aguinaldo?",
                "¿Cuántos días de vacaciones me corresponden?",
            ],
        )
