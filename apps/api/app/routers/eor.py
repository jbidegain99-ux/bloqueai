"""EOR (Employer of Record) endpoints for El Salvador."""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
import structlog

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.eor import (
    AFPProvider,
    BankAccountType,
    EOREmployee,
    EOREmployeeStatus,
    EORContractType,
    EORPaymentFrequency,
    EORPayrollRun,
    EORPayrollRunStatus,
    EORPayrollItem,
    EORVacationRequest,
    VacationRequestStatus,
)
from app.schemas.eor import (
    EOREmployeeCreate,
    EOREmployeeUpdate,
    EOREmployeeResponse,
    EOREmployeeDetailResponse,
    TerminationRequest,
    TerminationResponse,
    PayrollRunCreate,
    PayrollRunSummary,
    PayrollRunDetailResponse,
    PayrollItemResponse,
    PayrollSimulationRequest,
    PayrollSimulationResponse,
    VacationRequestCreate,
    VacationRequestResponse,
    PayslipSummary,
    CalculatorResponse,
)
from app.services.payroll_sv import PayrollCalculatorSV
from app.services.contract_generator import ContractGenerator
from app.utils.deps import get_current_user, require_employer

logger = structlog.get_logger()

router = APIRouter(prefix="/eor", tags=["EOR"])

calc = PayrollCalculatorSV()
contract_gen = ContractGenerator()


# ── Helpers ───────────────────────────────────────────────────

def _require_eor_access(user: User) -> None:
    """Verify user has EOR access (employer, recruiter, or admin)."""
    if user.role not in (UserRole.EMPLOYER, UserRole.RECRUITER, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permisos insuficientes para acceder al módulo EOR",
        )


def _employee_to_response(emp: EOREmployee) -> dict:
    """Convert EOREmployee ORM to response dict."""
    return {
        "id": emp.id,
        "client_company_id": emp.client_company_id,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "email": emp.email,
        "phone": emp.phone,
        "dui": emp.dui,
        "nit": emp.nit,
        "birth_date": emp.birth_date,
        "address": emp.address,
        "isss_number": emp.isss_number,
        "afp_provider": emp.afp_provider.value if emp.afp_provider else None,
        "afp_number": emp.afp_number,
        "bank_name": emp.bank_name,
        "bank_account_number": emp.bank_account_number,
        "bank_account_type": emp.bank_account_type.value if emp.bank_account_type else None,
        "position": emp.position,
        "department": emp.department,
        "base_salary": emp.base_salary,
        "payment_frequency": emp.payment_frequency.value if emp.payment_frequency else "MONTHLY",
        "start_date": emp.start_date,
        "end_date": emp.end_date,
        "contract_type": emp.contract_type.value if emp.contract_type else "INDEFINIDO",
        "contract_end_date": emp.contract_end_date,
        "status": emp.status.value if emp.status else "ONBOARDING",
        "created_at": emp.created_at,
        "updated_at": emp.updated_at,
    }


# ══════════════════════════════════════════════════════════════
# EMPLOYEES
# ══════════════════════════════════════════════════════════════


@router.post("/employees", response_model=EOREmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    data: EOREmployeeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Create a new EOR employee."""
    _require_eor_access(current_user)

    # Auto-inject client_company_id from the authenticated user if not provided
    company_id = data.client_company_id or current_user.company_id
    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo determinar la empresa. Proporcione client_company_id.",
        )

    # Convert string values to enum instances for SQLAlchemy
    afp = AFPProvider(data.afp_provider) if data.afp_provider else None
    bank_type = BankAccountType(data.bank_account_type) if data.bank_account_type else None
    pay_freq = EORPaymentFrequency(data.payment_frequency)
    contract = EORContractType(data.contract_type)

    employee = EOREmployee(
        id=uuid4(),
        client_company_id=company_id,
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        phone=data.phone,
        dui=data.dui,
        nit=data.nit,
        birth_date=data.birth_date,
        address=data.address,
        isss_number=data.isss_number,
        afp_provider=afp,
        afp_number=data.afp_number,
        bank_name=data.bank_name,
        bank_account_number=data.bank_account_number,
        bank_account_type=bank_type,
        position=data.position,
        department=data.department,
        base_salary=data.base_salary,
        payment_frequency=pay_freq,
        start_date=data.start_date,
        end_date=data.end_date,
        contract_type=contract,
        contract_end_date=data.contract_end_date,
        status=EOREmployeeStatus.ONBOARDING,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    try:
        db.add(employee)
        db.commit()
        db.refresh(employee)
    except Exception as e:
        db.rollback()
        logger.error("eor_employee_create_failed", error=str(e), email=data.email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear empleado: {str(e)}",
        )

    logger.info("eor_employee_created", employee_id=str(employee.id), email=employee.email)
    return _employee_to_response(employee)


@router.get("/employees", response_model=List[EOREmployeeResponse])
async def list_employees(
    status_filter: Optional[str] = Query(None, alias="status"),
    client_company_id: Optional[UUID] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list:
    """List EOR employees."""
    _require_eor_access(current_user)

    query = db.query(EOREmployee)

    # Filter by client company if employer
    if current_user.role == UserRole.EMPLOYER and current_user.company_id:
        query = query.filter(EOREmployee.client_company_id == current_user.company_id)
    elif client_company_id:
        query = query.filter(EOREmployee.client_company_id == client_company_id)

    if status_filter:
        try:
            s = EOREmployeeStatus(status_filter)
            query = query.filter(EOREmployee.status == s)
        except ValueError:
            logger.debug("invalid_filter_param", param="status", value=status_filter)

    if search:
        like = f"%{search}%"
        query = query.filter(
            (EOREmployee.first_name.ilike(like))
            | (EOREmployee.last_name.ilike(like))
            | (EOREmployee.email.ilike(like))
        )

    employees = query.order_by(EOREmployee.created_at.desc()).all()
    return [_employee_to_response(e) for e in employees]


@router.get("/employees/{employee_id}", response_model=EOREmployeeDetailResponse)
async def get_employee(
    employee_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get employee detail with cost breakdown."""
    _require_eor_access(current_user)

    employee = db.query(EOREmployee).filter(EOREmployee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    resp = _employee_to_response(employee)

    # Add monthly cost breakdown
    result = calc.calcular_planilla(Decimal(str(employee.base_salary)))
    resp["monthly_cost"] = {
        "gross_salary": float(result.gross_salary),
        "total_deductions": float(result.total_deductions),
        "net_salary": float(result.net_salary),
        "employer_contributions": float(result.isss_employer + result.afp_employer),
        "fee_talentos": float(result.fee_talentos),
        "grand_total": float(result.grand_total),
    }

    # Vacation days
    approved_days = (
        db.query(EORVacationRequest)
        .filter(
            EORVacationRequest.employee_id == employee_id,
            EORVacationRequest.status == VacationRequestStatus.APPROVED,
        )
        .all()
    )
    used = sum(v.days_requested for v in approved_days)
    resp["vacation_days_available"] = 15 - used
    resp["vacation_days_used"] = used

    return resp


@router.put("/employees/{employee_id}", response_model=EOREmployeeResponse)
async def update_employee(
    employee_id: UUID,
    data: EOREmployeeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Update employee data."""
    _require_eor_access(current_user)

    employee = db.query(EOREmployee).filter(EOREmployee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    # Convert string enum fields to proper enum instances
    enum_converters = {
        "afp_provider": lambda v: AFPProvider(v) if v else None,
        "bank_account_type": lambda v: BankAccountType(v) if v else None,
        "payment_frequency": lambda v: EORPaymentFrequency(v),
        "contract_type": lambda v: EORContractType(v),
        "status": lambda v: EOREmployeeStatus(v),
    }

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in enum_converters and value is not None:
            value = enum_converters[field](value)
        setattr(employee, field, value)

    employee.updated_at = datetime.utcnow()
    try:
        db.commit()
        db.refresh(employee)
    except Exception as e:
        db.rollback()
        logger.error("eor_employee_update_failed", error=str(e), employee_id=str(employee_id))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar empleado: {str(e)}",
        )

    logger.info("eor_employee_updated", employee_id=str(employee_id))
    return _employee_to_response(employee)


@router.post("/employees/{employee_id}/terminate", response_model=TerminationResponse)
async def terminate_employee(
    employee_id: UUID,
    data: TerminationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Terminate employment — calculates severance if applicable."""
    _require_eor_access(current_user)

    employee = db.query(EOREmployee).filter(EOREmployee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    salary = Decimal(str(employee.base_salary))

    # Calculate severance
    indemnization = Decimal("0")
    if not data.with_cause:
        indemnization = calc.calcular_indemnizacion(
            salary, employee.start_date, data.termination_date
        )

    aguinaldo = calc.calcular_aguinaldo(
        salary, employee.start_date, data.termination_date
    )
    vacaciones = calc.calcular_vacaciones(salary)
    total = indemnization + aguinaldo + vacaciones

    # Update employee status
    employee.status = EOREmployeeStatus.TERMINATED
    employee.end_date = data.termination_date
    employee.updated_at = datetime.utcnow()
    db.commit()

    logger.info("eor_employee_terminated", employee_id=str(employee_id), total_liquidacion=float(total))

    return {
        "employee_id": employee.id,
        "termination_date": data.termination_date,
        "indemnization": indemnization if not data.with_cause else None,
        "aguinaldo_proporcional": aguinaldo,
        "vacaciones_pendientes": vacaciones,
        "total_liquidacion": total,
        "message": "Liquidación calculada exitosamente",
    }


# ══════════════════════════════════════════════════════════════
# PAYROLL
# ══════════════════════════════════════════════════════════════


@router.post("/payroll/simulate", response_model=PayrollSimulationResponse)
async def simulate_payroll(
    data: PayrollSimulationRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Simulate payroll without saving."""
    _require_eor_access(current_user)

    result = calc.calcular_planilla(
        data.salario_base,
        horas_extra=data.horas_extra,
        bonificaciones=data.bonificaciones,
        otras_deducciones=data.otras_deducciones,
    )

    return {
        "base_salary": result.base_salary,
        "overtime": result.overtime,
        "bonuses": result.bonuses,
        "gross_salary": result.gross_salary,
        "isss_employee": result.isss_employee,
        "afp_employee": result.afp_employee,
        "isr": result.isr,
        "other_deductions": result.other_deductions,
        "total_deductions": result.total_deductions,
        "net_salary": result.net_salary,
        "isss_employer": result.isss_employer,
        "afp_employer": result.afp_employer,
        "total_employer_cost": result.total_employer_cost,
        "fee_talentos": result.fee_talentos,
        "grand_total": result.grand_total,
    }


@router.post("/payroll/runs", response_model=PayrollRunSummary, status_code=status.HTTP_201_CREATED)
async def create_payroll_run(
    data: PayrollRunCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Create a payroll run — calculates for all active employees."""
    _require_eor_access(current_user)

    # Get active employees
    query = db.query(EOREmployee).filter(
        EOREmployee.client_company_id == data.client_company_id,
        EOREmployee.status == EOREmployeeStatus.ACTIVE,
    )
    if data.employee_ids:
        query = query.filter(EOREmployee.id.in_(data.employee_ids))

    employees = query.all()
    if not employees:
        raise HTTPException(status_code=400, detail="No hay empleados activos para procesar")

    # Create run
    run = EORPayrollRun(
        id=uuid4(),
        client_company_id=data.client_company_id,
        period_start=data.period_start,
        period_end=data.period_end,
        payment_date=data.payment_date,
        status=EORPayrollRunStatus.DRAFT,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(run)
    db.flush()

    # Calculate for each employee
    total_gross = Decimal("0")
    total_deductions = Decimal("0")
    total_net = Decimal("0")
    total_contributions = Decimal("0")
    total_fees = Decimal("0")
    grand = Decimal("0")

    for emp in employees:
        result = calc.calcular_planilla(Decimal(str(emp.base_salary)))

        item = EORPayrollItem(
            id=uuid4(),
            payroll_run_id=run.id,
            employee_id=emp.id,
            base_salary=result.base_salary,
            overtime_hours=Decimal("0"),
            overtime_amount=result.overtime,
            bonuses=result.bonuses,
            gross_salary=result.gross_salary,
            isss_employee=result.isss_employee,
            afp_employee=result.afp_employee,
            isr=result.isr,
            other_deductions=result.other_deductions,
            total_deductions=result.total_deductions,
            net_salary=result.net_salary,
            isss_employer=result.isss_employer,
            afp_employer=result.afp_employer,
            fee_talentos=result.fee_talentos,
            total_employer_cost=result.total_employer_cost,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(item)

        total_gross += result.gross_salary
        total_deductions += result.total_deductions
        total_net += result.net_salary
        total_contributions += result.isss_employer + result.afp_employer
        total_fees += result.fee_talentos
        grand += result.grand_total

    # Update run totals
    run.total_employees = len(employees)
    run.total_gross = total_gross
    run.total_deductions = total_deductions
    run.total_net = total_net
    run.total_employer_contributions = total_contributions
    run.total_fees = total_fees
    run.grand_total = grand

    db.commit()
    db.refresh(run)

    logger.info("eor_payroll_run_created", run_id=str(run.id), employees=len(employees))

    return {
        "id": run.id,
        "client_company_id": run.client_company_id,
        "period_start": run.period_start,
        "period_end": run.period_end,
        "payment_date": run.payment_date,
        "status": run.status.value,
        "total_employees": run.total_employees,
        "total_gross": run.total_gross,
        "total_deductions": run.total_deductions,
        "total_net": run.total_net,
        "total_employer_contributions": run.total_employer_contributions,
        "total_fees": run.total_fees,
        "grand_total": run.grand_total,
        "created_at": run.created_at,
    }


@router.get("/payroll/runs", response_model=List[PayrollRunSummary])
async def list_payroll_runs(
    status_filter: Optional[str] = Query(None, alias="status"),
    client_company_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list:
    """List payroll runs."""
    _require_eor_access(current_user)

    query = db.query(EORPayrollRun)

    if current_user.role == UserRole.EMPLOYER and current_user.company_id:
        query = query.filter(EORPayrollRun.client_company_id == current_user.company_id)
    elif client_company_id:
        query = query.filter(EORPayrollRun.client_company_id == client_company_id)

    if status_filter:
        try:
            s = EORPayrollRunStatus(status_filter)
            query = query.filter(EORPayrollRun.status == s)
        except ValueError:
            logger.debug("invalid_filter_param", param="status", value=status_filter)

    runs = query.order_by(EORPayrollRun.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "client_company_id": r.client_company_id,
            "period_start": r.period_start,
            "period_end": r.period_end,
            "payment_date": r.payment_date,
            "status": r.status.value,
            "total_employees": r.total_employees,
            "total_gross": r.total_gross,
            "total_deductions": r.total_deductions,
            "total_net": r.total_net,
            "total_employer_contributions": r.total_employer_contributions,
            "total_fees": r.total_fees,
            "grand_total": r.grand_total,
            "created_at": r.created_at,
        }
        for r in runs
    ]


@router.get("/payroll/runs/{run_id}", response_model=PayrollRunDetailResponse)
async def get_payroll_run(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get payroll run detail with all items."""
    _require_eor_access(current_user)

    run = db.query(EORPayrollRun).filter(EORPayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Corrida de nómina no encontrada")

    items = db.query(EORPayrollItem).filter(EORPayrollItem.payroll_run_id == run_id).all()
    item_responses = []
    for item in items:
        emp = db.query(EOREmployee).filter(EOREmployee.id == item.employee_id).first()
        item_responses.append({
            "id": item.id,
            "employee_id": item.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else None,
            "base_salary": item.base_salary,
            "overtime_amount": item.overtime_amount,
            "bonuses": item.bonuses,
            "gross_salary": item.gross_salary,
            "isss_employee": item.isss_employee,
            "afp_employee": item.afp_employee,
            "isr": item.isr,
            "other_deductions": item.other_deductions,
            "total_deductions": item.total_deductions,
            "net_salary": item.net_salary,
            "isss_employer": item.isss_employer,
            "afp_employer": item.afp_employer,
            "fee_talentos": item.fee_talentos,
            "total_employer_cost": item.total_employer_cost,
        })

    return {
        "id": run.id,
        "client_company_id": run.client_company_id,
        "period_start": run.period_start,
        "period_end": run.period_end,
        "payment_date": run.payment_date,
        "status": run.status.value,
        "total_employees": run.total_employees,
        "total_gross": run.total_gross,
        "total_deductions": run.total_deductions,
        "total_net": run.total_net,
        "total_employer_contributions": run.total_employer_contributions,
        "total_fees": run.total_fees,
        "grand_total": run.grand_total,
        "created_at": run.created_at,
        "approved_at": run.approved_at,
        "paid_at": run.paid_at,
        "items": item_responses,
    }


@router.post("/payroll/runs/{run_id}/approve")
async def approve_payroll_run(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Approve payroll run."""
    _require_eor_access(current_user)

    run = db.query(EORPayrollRun).filter(EORPayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Corrida no encontrada")

    if run.status not in (EORPayrollRunStatus.DRAFT, EORPayrollRunStatus.PENDING_APPROVAL):
        raise HTTPException(status_code=400, detail="La corrida no puede ser aprobada en su estado actual")

    run.status = EORPayrollRunStatus.APPROVED
    run.approved_at = datetime.utcnow()
    run.approved_by = current_user.id
    run.updated_at = datetime.utcnow()
    db.commit()

    logger.info("eor_payroll_run_approved", run_id=str(run_id))
    return {"success": True, "message": "Nómina aprobada exitosamente"}


@router.post("/payroll/runs/{run_id}/mark-paid")
async def mark_payroll_paid(
    run_id: UUID,
    payment_date: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Mark payroll as paid."""
    _require_eor_access(current_user)

    run = db.query(EORPayrollRun).filter(EORPayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Corrida no encontrada")

    if run.status != EORPayrollRunStatus.APPROVED:
        raise HTTPException(status_code=400, detail="La corrida debe estar aprobada para marcarla como pagada")

    run.status = EORPayrollRunStatus.PAID
    run.paid_at = datetime.utcnow()
    run.payment_date = payment_date
    run.updated_at = datetime.utcnow()
    db.commit()

    logger.info("eor_payroll_run_paid", run_id=str(run_id))
    return {"success": True, "message": "Nómina marcada como pagada"}


# ══════════════════════════════════════════════════════════════
# DOCUMENTS
# ══════════════════════════════════════════════════════════════


@router.get("/employees/{employee_id}/contract")
async def generate_contract(
    employee_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Generate employment contract PDF."""
    _require_eor_access(current_user)

    employee = db.query(EOREmployee).filter(EOREmployee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    emp_dict = {
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "dui": employee.dui or "________-_",
        "nit": employee.nit or "____-______-___-_",
        "address": employee.address or "San Salvador",
    }

    salary = Decimal(str(employee.base_salary))
    contract_type = employee.contract_type.value if employee.contract_type else "INDEFINIDO"

    if contract_type == "PLAZO_FIJO" and employee.contract_end_date:
        text = contract_gen.generate_fixed_term_contract(
            emp_dict, employee.position or "Colaborador", salary,
            employee.start_date, employee.contract_end_date,
        )
    else:
        text = contract_gen.generate_indefinite_contract(
            emp_dict, employee.position or "Colaborador", salary, employee.start_date,
        )

    pdf_bytes = contract_gen.generate_pdf(text)
    filename = f"contrato_{employee.first_name}_{employee.last_name}.pdf".replace(" ", "_")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/employees/{employee_id}/payslips", response_model=List[PayslipSummary])
async def list_payslips(
    employee_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list:
    """List payslips for an employee."""
    _require_eor_access(current_user)

    items = (
        db.query(EORPayrollItem)
        .filter(EORPayrollItem.employee_id == employee_id)
        .all()
    )

    result = []
    for item in items:
        run = db.query(EORPayrollRun).filter(EORPayrollRun.id == item.payroll_run_id).first()
        if run:
            result.append({
                "item_id": item.id,
                "period_start": run.period_start,
                "period_end": run.period_end,
                "gross_salary": item.gross_salary,
                "total_deductions": item.total_deductions,
                "net_salary": item.net_salary,
                "payment_date": run.payment_date,
                "status": run.status.value,
            })

    return result


@router.get("/payroll/items/{item_id}/payslip")
async def download_payslip(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Download payslip PDF for a payroll item."""
    _require_eor_access(current_user)

    item = db.query(EORPayrollItem).filter(EORPayrollItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Recibo no encontrado")

    employee = db.query(EOREmployee).filter(EOREmployee.id == item.employee_id).first()
    run = db.query(EORPayrollRun).filter(EORPayrollRun.id == item.payroll_run_id).first()

    name = f"{employee.first_name} {employee.last_name}" if employee else "Empleado"
    period = f"{run.period_start} - {run.period_end}" if run else "Periodo"

    payslip_text = f"""
RECIBO DE NOMINA

Empresa: {contract_gen.EMPLOYER_NAME}
Empleado: {name}
Periodo: {period}
Puesto: {employee.position or 'N/A'}

INGRESOS
  Salario base:        ${item.base_salary:,.2f}
  Horas extra:         ${item.overtime_amount:,.2f}
  Bonificaciones:      ${item.bonuses:,.2f}
  SALARIO BRUTO:       ${item.gross_salary:,.2f}

DEDUCCIONES
  ISSS (3%):           ${item.isss_employee:,.2f}
  AFP (7.25%):         ${item.afp_employee:,.2f}
  ISR:                 ${item.isr:,.2f}
  Otras:               ${item.other_deductions:,.2f}
  TOTAL DEDUCCIONES:   ${item.total_deductions:,.2f}

SALARIO NETO:          ${item.net_salary:,.2f}

Aportes patronales:
  ISSS (7.5%):         ${item.isss_employer:,.2f}
  AFP (7.75%):         ${item.afp_employer:,.2f}
"""

    pdf_bytes = contract_gen.generate_pdf(payslip_text)
    filename = f"recibo_{name.replace(' ', '_')}_{period.replace(' ', '')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ══════════════════════════════════════════════════════════════
# VACATIONS
# ══════════════════════════════════════════════════════════════


@router.post("/vacation-requests", response_model=VacationRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_vacation_request(
    data: VacationRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Create a vacation request."""
    employee = db.query(EOREmployee).filter(EOREmployee.id == data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    request = EORVacationRequest(
        id=uuid4(),
        employee_id=data.employee_id,
        start_date=data.start_date,
        end_date=data.end_date,
        days_requested=data.days_requested,
        reason=data.reason,
        status=VacationRequestStatus.PENDING,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(request)
    db.commit()
    db.refresh(request)

    return {
        "id": request.id,
        "employee_id": request.employee_id,
        "employee_name": f"{employee.first_name} {employee.last_name}",
        "start_date": request.start_date,
        "end_date": request.end_date,
        "days_requested": request.days_requested,
        "reason": request.reason,
        "status": request.status.value,
        "created_at": request.created_at,
    }


@router.get("/vacation-requests", response_model=List[VacationRequestResponse])
async def list_vacation_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    employee_id: Optional[UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list:
    """List vacation requests."""
    _require_eor_access(current_user)

    query = db.query(EORVacationRequest)
    if employee_id:
        query = query.filter(EORVacationRequest.employee_id == employee_id)

    if status_filter:
        try:
            s = VacationRequestStatus(status_filter)
            query = query.filter(EORVacationRequest.status == s)
        except ValueError:
            logger.debug("invalid_filter_param", param="status", value=status_filter)

    requests = query.order_by(EORVacationRequest.created_at.desc()).all()
    result = []
    for r in requests:
        emp = db.query(EOREmployee).filter(EOREmployee.id == r.employee_id).first()
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name}" if emp else None,
            "start_date": r.start_date,
            "end_date": r.end_date,
            "days_requested": r.days_requested,
            "reason": r.reason,
            "status": r.status.value,
            "reviewed_by": r.reviewed_by,
            "reviewed_at": r.reviewed_at,
            "review_notes": r.review_notes,
            "created_at": r.created_at,
        })
    return result


@router.post("/vacation-requests/{request_id}/approve")
async def approve_vacation(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Approve a vacation request."""
    _require_eor_access(current_user)

    vr = db.query(EORVacationRequest).filter(EORVacationRequest.id == request_id).first()
    if not vr:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    vr.status = VacationRequestStatus.APPROVED
    vr.reviewed_by = current_user.id
    vr.reviewed_at = datetime.utcnow()
    vr.updated_at = datetime.utcnow()
    db.commit()

    return {"success": True, "message": "Vacaciones aprobadas"}


@router.post("/vacation-requests/{request_id}/reject")
async def reject_vacation(
    request_id: UUID,
    reason: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Reject a vacation request."""
    _require_eor_access(current_user)

    vr = db.query(EORVacationRequest).filter(EORVacationRequest.id == request_id).first()
    if not vr:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada")

    vr.status = VacationRequestStatus.REJECTED
    vr.reviewed_by = current_user.id
    vr.reviewed_at = datetime.utcnow()
    vr.review_notes = reason
    vr.updated_at = datetime.utcnow()
    db.commit()

    return {"success": True, "message": "Vacaciones rechazadas"}


# ══════════════════════════════════════════════════════════════
# PUBLIC CALCULATOR
# ══════════════════════════════════════════════════════════════


@router.get("/calculator", response_model=CalculatorResponse)
async def public_calculator(
    salary: float = Query(..., gt=0),
    salary_type: str = Query("gross"),
    country: str = Query("sv"),
) -> dict:
    """Public EOR cost calculator — no authentication required."""
    if country != "sv":
        raise HTTPException(status_code=400, detail="Solo disponible para El Salvador (sv)")

    if salary_type == "net":
        result = calc.calcular_costo_total_empleador(Decimal(str(salary)))
        return {
            "salary_type": "net",
            "salario_bruto": result["salario_bruto_necesario"],
            "isss_empleado": result["isss_empleado"],
            "afp_empleado": result["afp_empleado"],
            "isr": result["isr"],
            "total_deducciones": result["total_deducciones"],
            "salario_neto": result["salario_neto_real"],
            "isss_patronal": result["isss_patronal"],
            "afp_patronal": result["afp_patronal"],
            "subtotal_empleador": result["costo_empleador"],
            "fee_talentos": result["fee_talentos"],
            "costo_total_mensual": result["costo_total_mensual"],
        }
    else:
        r = calc.calcular_planilla(Decimal(str(salary)))
        return {
            "salary_type": "gross",
            "salario_bruto": r.gross_salary,
            "isss_empleado": r.isss_employee,
            "afp_empleado": r.afp_employee,
            "isr": r.isr,
            "total_deducciones": r.total_deductions,
            "salario_neto": r.net_salary,
            "isss_patronal": r.isss_employer,
            "afp_patronal": r.afp_employer,
            "subtotal_empleador": r.total_employer_cost,
            "fee_talentos": r.fee_talentos,
            "costo_total_mensual": r.grand_total,
        }
