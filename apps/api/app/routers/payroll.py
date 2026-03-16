"""Payroll module endpoints - employees, contracts, attendance, runs, deductions, reports."""

import io
import csv
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import structlog

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.company import Company
from app.models.payroll import (
    Employee, Contract, Attendance, PayrollRun, PayrollLine,
    Payslip, DeductionType, TaxConfig,
    PayFrequency, ContractType, AttendanceType, PayrollRunStatus, DeductionCalcType,
)
from app.models.payroll import (
    EmployeeStatus, DocumentType, EmploymentType,
    PayrollDeductionBreakdown, PayrollProvision,
    DeductionCategory, ProvisionType,
)
from app.schemas.payroll import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    ContractCreate, ContractUpdate, ContractResponse,
    AttendanceCreate, AttendanceCsvRow, AttendanceCsvPreview,
    PayrollRunCreate, PayrollRunResponse, PayrollLineResponse,
    DeductionTypeCreate, DeductionTypeResponse,
    PayrollSummaryReport, PayrollDetailLine,
)
from app.services.payroll_sv import PayrollCalculatorSV
from app.services.spu_generator import SPUGenerator
from app.services.compliance_service import validate_payroll_compliance
from app.services.payslip_generator import generate_payslip_html
from app.services.audit import create_audit_log
from app.utils.deps import get_current_user, require_recruiter

logger = structlog.get_logger()


def require_payroll_enabled():
    """Dependency that checks if payroll module is enabled."""
    if not settings.enable_payroll:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El modulo de nomina no esta habilitado",
        )


router = APIRouter(
    prefix="/payroll",
    tags=["Payroll"],
    dependencies=[Depends(require_payroll_enabled)],
)


# ============ Helpers ============


def _get_client_or_404(db: Session, client_id: UUID) -> Company:
    client = db.query(Company).filter(Company.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


def _employee_to_response(emp: Employee, db: Session) -> dict:
    """Convert Employee model to response dict with active contract."""
    active_contract = (
        db.query(Contract)
        .filter(Contract.employee_id == emp.id, Contract.is_active == True)
        .first()
    )
    client = db.query(Company).filter(Company.id == emp.client_id).first()
    return {
        "id": emp.id,
        "client_id": emp.client_id,
        "client_name": client.name if client else None,
        "full_name": emp.full_name,
        "email": emp.email,
        "phone": emp.phone,
        "employee_code": emp.employee_code,
        "department": emp.department,
        "position": emp.position,
        "is_active": emp.is_active,
        "hire_date": emp.hire_date,
        "termination_date": emp.termination_date,
        "document_type": emp.document_type.value if emp.document_type else None,
        "document_id": emp.document_id,
        "salary": float(emp.salary) if emp.salary is not None else None,
        "salary_currency": emp.salary_currency,
        "employment_type": emp.employment_type.value if emp.employment_type else None,
        "status": emp.status.value if emp.status else None,
        "bank_account_number": emp.bank_account_number,
        "active_contract": {
            "contract_type": active_contract.contract_type.value if active_contract else None,
            "base_salary": active_contract.base_salary if active_contract else None,
            "currency": active_contract.currency if active_contract else None,
            "pay_frequency": active_contract.pay_frequency.value if active_contract else None,
        } if active_contract else None,
        "created_at": emp.created_at,
    }


def _contract_to_response(c: Contract, db: Session) -> dict:
    """Convert Contract model to response dict."""
    emp = db.query(Employee).filter(Employee.id == c.employee_id).first()
    return {
        "id": c.id,
        "employee_id": c.employee_id,
        "employee_name": emp.full_name if emp else "N/A",
        "client_id": c.client_id,
        "contract_type": c.contract_type.value,
        "position_title": c.position_title,
        "start_date": c.start_date,
        "end_date": c.end_date,
        "base_salary": c.base_salary,
        "currency": c.currency,
        "pay_frequency": c.pay_frequency.value,
        "is_active": c.is_active,
        "notes": c.notes,
        "benefits": c.benefits,
        "document_url": c.document_url,
        "signed_by_employee_at": c.signed_by_employee_at,
        "created_at": c.created_at,
    }


# ============ Employees ============


@router.get("/employees", response_model=list[EmployeeResponse])
async def list_employees(
    client_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """List payroll employees with optional filters."""
    query = db.query(Employee)
    if client_id:
        query = query.filter(Employee.client_id == client_id)
    if is_active is not None:
        query = query.filter(Employee.is_active == is_active)
    if search:
        query = query.filter(Employee.full_name.ilike(f"%{search}%"))
    total = query.count()
    employees = query.order_by(Employee.full_name).offset(skip).limit(limit).all()
    return [_employee_to_response(e, db) for e in employees]


@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    data: EmployeeCreate,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Create a new payroll employee."""
    _get_client_or_404(db, data.client_id)

    # Validate DUI uniqueness per tenant
    if data.document_type == "DUI" and data.document_id:
        existing = db.query(Employee).filter(
            Employee.client_id == data.client_id,
            Employee.document_id == data.document_id,
            Employee.document_type == DocumentType.DUI,
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe un empleado con DUI {data.document_id} en este cliente",
            )

    emp = Employee(
        id=uuid4(),
        client_id=data.client_id,
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        employee_code=data.employee_code,
        department=data.department,
        position=data.position,
        hire_date=data.hire_date,
        candidate_id=data.candidate_id,
        user_id=data.user_id,
        document_type=DocumentType(data.document_type) if data.document_type else None,
        document_id=data.document_id,
        salary=data.salary,
        salary_currency=data.salary_currency,
        employment_type=EmploymentType(data.employment_type) if data.employment_type else None,
        bank_account_number=data.bank_account_number,
        status=EmployeeStatus.ACTIVE,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(emp)
    db.commit()
    db.refresh(emp)

    create_audit_log(
        db=db, user_id=current_user.id,
        entity_type="payroll_employee", entity_id=emp.id,
        action="create", description=f"Empleado creado: {emp.full_name}",
    )
    return _employee_to_response(emp, db)


@router.patch("/employees/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: UUID,
    data: EmployeeUpdate,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Update a payroll employee."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(emp, field, value)
    emp.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(emp)

    create_audit_log(
        db=db, user_id=current_user.id,
        entity_type="payroll_employee", entity_id=emp.id,
        action="update", description=f"Empleado actualizado: {emp.full_name}",
        new_values=update_data,
    )
    return _employee_to_response(emp, db)


@router.get("/employees/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Get a single employee by ID."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    return _employee_to_response(emp, db)


@router.post("/employees/{employee_id}/terminate", response_model=EmployeeResponse)
async def terminate_employee(
    employee_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Terminate an employee (soft delete)."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    if emp.status == EmployeeStatus.TERMINATED:
        raise HTTPException(status_code=400, detail="El empleado ya está terminado")

    emp.status = EmployeeStatus.TERMINATED
    emp.is_active = False
    emp.termination_date = datetime.utcnow().date()
    emp.updated_at = datetime.utcnow()

    # Deactivate all contracts
    db.query(Contract).filter(
        Contract.employee_id == employee_id,
        Contract.is_active == True,
    ).update({"is_active": False, "end_date": emp.termination_date, "updated_at": datetime.utcnow()})

    db.commit()
    db.refresh(emp)

    create_audit_log(
        db=db, user_id=current_user.id,
        entity_type="payroll_employee", entity_id=emp.id,
        action="terminate", description=f"Empleado terminado: {emp.full_name}",
    )
    return _employee_to_response(emp, db)


# ============ Contracts ============


@router.get("/contracts", response_model=list[ContractResponse])
async def list_contracts(
    client_id: Optional[UUID] = None,
    employee_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """List contracts with optional filters."""
    query = db.query(Contract)
    if client_id:
        query = query.filter(Contract.client_id == client_id)
    if employee_id:
        query = query.filter(Contract.employee_id == employee_id)
    if is_active is not None:
        query = query.filter(Contract.is_active == is_active)
    contracts = query.order_by(Contract.start_date.desc()).offset(skip).limit(limit).all()
    return [_contract_to_response(c, db) for c in contracts]


@router.get("/contracts/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Get a single contract by ID."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return _contract_to_response(contract, db)


@router.post("/contracts", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
async def create_contract(
    data: ContractCreate,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Create a new employment contract."""
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    _get_client_or_404(db, data.client_id)

    # Deactivate other active contracts for this employee
    db.query(Contract).filter(
        Contract.employee_id == data.employee_id,
        Contract.is_active == True,
    ).update({"is_active": False, "updated_at": datetime.utcnow()})

    contract = Contract(
        id=uuid4(),
        employee_id=data.employee_id,
        client_id=data.client_id,
        contract_type=data.contract_type,
        start_date=data.start_date,
        end_date=data.end_date,
        base_salary=data.base_salary,
        currency=data.currency,
        pay_frequency=data.pay_frequency,
        notes=data.notes,
        position_title=data.position_title,
        benefits=data.benefits or {},
        document_url=data.document_url,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)

    create_audit_log(
        db=db, user_id=current_user.id,
        entity_type="payroll_contract", entity_id=contract.id,
        action="create", description=f"Contrato creado para {emp.full_name}",
    )
    return _contract_to_response(contract, db)


@router.patch("/contracts/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: UUID,
    data: ContractUpdate,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Update a contract. Signed contracts cannot be modified."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    if contract.signed_by_employee_at is not None:
        raise HTTPException(
            status_code=400,
            detail="No se puede modificar un contrato firmado. Cree uno nuevo.",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contract, field, value)
    contract.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(contract)
    return _contract_to_response(contract, db)


@router.post("/contracts/{contract_id}/sign", response_model=ContractResponse)
async def sign_contract(
    contract_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Sign a contract (records timestamp)."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    if contract.signed_by_employee_at is not None:
        raise HTTPException(status_code=400, detail="El contrato ya fue firmado")

    contract.signed_by_employee_at = datetime.utcnow()
    contract.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(contract)

    emp = db.query(Employee).filter(Employee.id == contract.employee_id).first()
    create_audit_log(
        db=db, user_id=current_user.id,
        entity_type="payroll_contract", entity_id=contract.id,
        action="sign", description=f"Contrato firmado para {emp.full_name if emp else 'N/A'}",
    )
    return _contract_to_response(contract, db)


@router.post("/contracts/{contract_id}/terminate", response_model=ContractResponse)
async def terminate_contract(
    contract_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Terminate a contract (sets end_date and deactivates)."""
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    if not contract.is_active:
        raise HTTPException(status_code=400, detail="El contrato ya está inactivo")

    contract.is_active = False
    contract.end_date = datetime.utcnow().date()
    contract.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(contract)

    emp = db.query(Employee).filter(Employee.id == contract.employee_id).first()
    create_audit_log(
        db=db, user_id=current_user.id,
        entity_type="payroll_contract", entity_id=contract.id,
        action="terminate", description=f"Contrato terminado para {emp.full_name if emp else 'N/A'}",
    )
    return _contract_to_response(contract, db)


# ============ Attendance ============


@router.get("/attendance")
async def list_attendance(
    client_id: Optional[UUID] = None,
    employee_id: Optional[UUID] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """List attendance records with filters."""
    query = db.query(Attendance)
    if client_id:
        query = query.filter(Attendance.client_id == client_id)
    if employee_id:
        query = query.filter(Attendance.employee_id == employee_id)
    if date_from:
        query = query.filter(Attendance.date >= date_from)
    if date_to:
        query = query.filter(Attendance.date <= date_to)

    records = query.order_by(Attendance.date.desc()).offset(skip).limit(limit).all()
    result = []
    for r in records:
        emp = db.query(Employee).filter(Employee.id == r.employee_id).first()
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": emp.full_name if emp else "N/A",
            "client_id": r.client_id,
            "date": r.date,
            "hours": r.hours,
            "attendance_type": r.attendance_type.value,
            "notes": r.notes,
        })
    return result


@router.post("/attendance", status_code=status.HTTP_201_CREATED)
async def create_attendance(
    data: AttendanceCreate,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Create a single attendance record."""
    emp = db.query(Employee).filter(Employee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    # Check for duplicate
    existing = db.query(Attendance).filter(
        Attendance.employee_id == data.employee_id,
        Attendance.date == data.date,
        Attendance.attendance_type == data.attendance_type,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Registro de asistencia duplicado para esta fecha y tipo")

    record = Attendance(
        id=uuid4(),
        employee_id=data.employee_id,
        client_id=data.client_id,
        date=data.date,
        hours=data.hours,
        attendance_type=data.attendance_type,
        notes=data.notes,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    return {"id": record.id, "message": "Registro de asistencia creado"}


@router.post("/attendance/import-csv", response_model=AttendanceCsvPreview)
async def import_attendance_csv(
    client_id: UUID = Query(...),
    file: UploadFile = File(...),
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Upload CSV of attendance, preview with duplicate detection."""
    _get_client_or_404(db, client_id)

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Archivo demasiado grande (max 5MB)")

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows = []
    valid = 0
    duplicates = 0
    unmapped = 0

    # Cache employees by code and name for lookup
    employees = db.query(Employee).filter(Employee.client_id == client_id, Employee.is_active == True).all()
    emp_by_code = {e.employee_code: e for e in employees if e.employee_code}
    emp_by_name = {e.full_name.lower(): e for e in employees}

    for row in reader:
        csv_row = AttendanceCsvRow(
            employee_code=row.get("employee_code", "").strip() or None,
            employee_name=row.get("employee_name", "").strip() or None,
            date=row.get("date", "").strip(),
            hours=float(row.get("hours", 0)),
            attendance_type=row.get("attendance_type", "REGULAR").strip().upper(),
            notes=row.get("notes", "").strip() or None,
        )

        # Map employee
        emp = None
        if csv_row.employee_code and csv_row.employee_code in emp_by_code:
            emp = emp_by_code[csv_row.employee_code]
        elif csv_row.employee_name and csv_row.employee_name.lower() in emp_by_name:
            emp = emp_by_name[csv_row.employee_name.lower()]

        if emp:
            csv_row.employee_id = emp.id
            # Check duplicate
            existing = db.query(Attendance).filter(
                Attendance.employee_id == emp.id,
                Attendance.date == csv_row.date,
                Attendance.attendance_type == csv_row.attendance_type,
            ).first()
            if existing:
                csv_row.is_duplicate = True
                duplicates += 1
            else:
                valid += 1
        else:
            unmapped += 1

        rows.append(csv_row)

    return AttendanceCsvPreview(
        rows=rows,
        total_rows=len(rows),
        valid_rows=valid,
        duplicate_rows=duplicates,
        unmapped_rows=unmapped,
    )


@router.post("/attendance/import-csv/confirm")
async def confirm_attendance_csv(
    rows: list[AttendanceCsvRow],
    client_id: UUID = Query(...),
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Confirm and persist valid CSV attendance rows."""
    created = 0
    for row in rows:
        if row.is_duplicate or not row.employee_id:
            continue
        record = Attendance(
            id=uuid4(),
            employee_id=row.employee_id,
            client_id=client_id,
            date=row.date,
            hours=row.hours,
            attendance_type=row.attendance_type,
            notes=row.notes,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(record)
        created += 1

    db.commit()
    create_audit_log(
        db=db, user_id=current_user.id,
        entity_type="payroll_attendance", entity_id=uuid4(),
        action="csv_import", description=f"Importacion CSV: {created} registros creados",
    )
    return {"created": created, "message": f"{created} registros de asistencia importados"}


# ============ Payroll Runs ============


@router.get("/runs", response_model=list[PayrollRunResponse])
async def list_payroll_runs(
    client_id: Optional[UUID] = None,
    run_status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """List payroll runs."""
    query = db.query(PayrollRun)
    if client_id:
        query = query.filter(PayrollRun.client_id == client_id)
    if run_status:
        query = query.filter(PayrollRun.status == run_status)

    runs = query.order_by(PayrollRun.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for r in runs:
        client = db.query(Company).filter(Company.id == r.client_id).first()
        approved_by = None
        if r.approved_by_id:
            approver = db.query(User).filter(User.id == r.approved_by_id).first()
            approved_by = approver.full_name if approver else None
        result.append(PayrollRunResponse(
            id=r.id,
            client_id=r.client_id,
            client_name=client.name if client else None,
            period_start=r.period_start,
            period_end=r.period_end,
            pay_frequency=r.pay_frequency.value,
            status=r.status.value,
            total_gross=r.total_gross or 0,
            total_deductions=r.total_deductions or 0,
            total_net=r.total_net or 0,
            employee_count=r.employee_count or 0,
            currency=r.currency,
            approved_by_name=approved_by,
            approved_at=r.approved_at,
            notes=r.notes,
            created_at=r.created_at,
        ))
    return result


@router.post("/runs", response_model=PayrollRunResponse, status_code=status.HTTP_201_CREATED)
async def create_payroll_run(
    data: PayrollRunCreate,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Create a new payroll run in DRAFT status."""
    client = _get_client_or_404(db, data.client_id)

    run = PayrollRun(
        id=uuid4(),
        client_id=data.client_id,
        period_start=data.period_start,
        period_end=data.period_end,
        pay_frequency=data.pay_frequency,
        status=PayrollRunStatus.DRAFT,
        notes=data.notes,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    create_audit_log(
        db=db, user_id=current_user.id,
        entity_type="payroll_run", entity_id=run.id,
        action="create", description=f"Nomina creada: {data.period_start} - {data.period_end}",
    )
    return PayrollRunResponse(
        id=run.id,
        client_id=run.client_id,
        client_name=client.name,
        period_start=run.period_start,
        period_end=run.period_end,
        pay_frequency=run.pay_frequency.value,
        status=run.status.value,
        total_gross=0, total_deductions=0, total_net=0,
        employee_count=0,
        currency=run.currency,
        notes=run.notes,
        created_at=run.created_at,
    )


@router.post("/runs/{run_id}/validate")
async def validate_payroll_run(
    run_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Validate a payroll run - check attendance completeness."""
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Nomina no encontrada")
    if run.status != PayrollRunStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Solo se puede validar una nomina en estado DRAFT")

    # Get active employees with contracts matching this run's frequency
    employees = (
        db.query(Employee)
        .join(Contract, Contract.employee_id == Employee.id)
        .filter(
            Employee.client_id == run.client_id,
            Employee.is_active == True,
            Contract.is_active == True,
            Contract.pay_frequency == run.pay_frequency,
        )
        .all()
    )

    warnings = []
    for emp in employees:
        attendance_count = (
            db.query(Attendance)
            .filter(
                Attendance.employee_id == emp.id,
                Attendance.date >= run.period_start,
                Attendance.date <= run.period_end,
            )
            .count()
        )
        if attendance_count == 0:
            warnings.append(f"{emp.full_name}: sin registros de asistencia en el periodo")

    run.status = PayrollRunStatus.VALIDATED
    run.employee_count = len(employees)
    run.updated_at = datetime.utcnow()
    db.commit()

    create_audit_log(
        db=db, user_id=current_user.id,
        entity_type="payroll_run", entity_id=run.id,
        action="validate", description=f"Nomina validada: {len(employees)} empleados",
    )
    return {
        "status": "VALIDATED",
        "employee_count": len(employees),
        "warnings": warnings,
    }


@router.post("/runs/{run_id}/calculate")
async def calculate_payroll_run(
    run_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Calculate payroll for all employees: gross, deductions, net, payslips."""
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Nomina no encontrada")
    if run.status != PayrollRunStatus.VALIDATED:
        raise HTTPException(status_code=400, detail="Solo se puede calcular una nomina VALIDADA")

    # Delete previous lines + breakdowns + provisions if recalculating
    existing_lines = db.query(PayrollLine).filter(PayrollLine.payroll_run_id == run.id).all()
    for line in existing_lines:
        db.query(PayrollDeductionBreakdown).filter(PayrollDeductionBreakdown.payroll_line_id == line.id).delete()
        db.query(PayrollProvision).filter(PayrollProvision.payroll_line_id == line.id).delete()
        db.query(Payslip).filter(Payslip.payroll_line_id == line.id).delete()
    db.query(PayrollLine).filter(PayrollLine.payroll_run_id == run.id).delete()

    # Get active employees with matching contracts
    employees_with_contracts = (
        db.query(Employee, Contract)
        .join(Contract, Contract.employee_id == Employee.id)
        .filter(
            Employee.client_id == run.client_id,
            Employee.is_active == True,
            Contract.is_active == True,
            Contract.pay_frequency == run.pay_frequency,
        )
        .all()
    )

    calculator = PayrollCalculatorSV()

    total_gross = Decimal("0")
    total_deductions_sum = Decimal("0")
    total_net = Decimal("0")
    client = db.query(Company).filter(Company.id == run.client_id).first()

    for emp, contract in employees_with_contracts:
        # Get attendance in period
        attendance = (
            db.query(Attendance)
            .filter(
                Attendance.employee_id == emp.id,
                Attendance.date >= run.period_start,
                Attendance.date <= run.period_end,
            )
            .all()
        )

        hours_regular = sum(a.hours for a in attendance if a.attendance_type == AttendanceType.REGULAR)
        hours_overtime = sum(a.hours for a in attendance if a.attendance_type == AttendanceType.OVERTIME)
        days_worked = len(set(a.date for a in attendance if a.attendance_type == AttendanceType.REGULAR))

        # Use PayrollCalculatorSV for accurate SV calculations
        salary = Decimal(str(contract.base_salary))
        result = calculator.calcular_planilla(salary)

        # Build JSONB deductions detail (legacy compat)
        deductions_detail = [
            {"name": "ISSS", "type": "PERCENTAGE", "amount": float(result.isss_employee)},
            {"name": "AFP", "type": "PERCENTAGE", "amount": float(result.afp_employee)},
            {"name": "ISR", "type": "PERCENTAGE", "amount": float(result.isr)},
        ]

        line = PayrollLine(
            id=uuid4(),
            payroll_run_id=run.id,
            employee_id=emp.id,
            contract_id=contract.id,
            base_salary=float(salary),
            days_worked=days_worked,
            hours_regular=hours_regular,
            hours_overtime=hours_overtime,
            gross_pay=float(result.gross_salary),
            total_deductions=float(result.total_deductions),
            net_pay=float(result.net_salary),
            deductions_detail=deductions_detail,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(line)
        db.flush()

        # Create PayrollDeductionBreakdown records
        breakdowns = [
            (DeductionCategory.ISSS, result.isss_employee, "ISSS empleado (3%)"),
            (DeductionCategory.AFP, result.afp_employee, "AFP empleado (7.25%)"),
            (DeductionCategory.INCOME_TAX, result.isr, "ISR"),
        ]
        for cat, amount, desc in breakdowns:
            if amount > 0:
                db.add(PayrollDeductionBreakdown(
                    id=uuid4(),
                    payroll_line_id=line.id,
                    deduction_type=cat,
                    amount=amount,
                    description=desc,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                ))

        # Create PayrollProvision records (monthly accrual)
        hire_date = emp.hire_date or run.period_start
        aguinaldo_monthly = calculator.calcular_aguinaldo(salary, hire_date) / Decimal("12")
        vacaciones_monthly = calculator.calcular_vacaciones(salary) / Decimal("12")

        for ptype, amount in [
            (ProvisionType.AGUINALDO, aguinaldo_monthly),
            (ProvisionType.VACACIONES, vacaciones_monthly),
        ]:
            if amount > 0:
                db.add(PayrollProvision(
                    id=uuid4(),
                    payroll_line_id=line.id,
                    provision_type=ptype,
                    amount=amount,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                ))

        # Generate payslip HTML
        html = generate_payslip_html(
            employee_name=emp.full_name,
            employee_code=emp.employee_code,
            department=emp.department,
            position=emp.position,
            client_name=client.name if client else "N/A",
            period_start=str(run.period_start),
            period_end=str(run.period_end),
            base_salary=float(salary),
            hours_regular=hours_regular,
            hours_overtime=hours_overtime,
            gross_pay=float(result.gross_salary),
            deductions=deductions_detail,
            total_deductions=float(result.total_deductions),
            net_pay=float(result.net_salary),
            currency=contract.currency,
        )
        payslip = Payslip(
            id=uuid4(),
            payroll_line_id=line.id,
            html_content=html,
            generated_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(payslip)

        total_gross += result.gross_salary
        total_deductions_sum += result.total_deductions
        total_net += result.net_salary

    # Update run totals
    run.total_gross = float(total_gross)
    run.total_deductions = float(total_deductions_sum)
    run.total_net = float(total_net)
    run.employee_count = len(employees_with_contracts)
    run.status = PayrollRunStatus.CALCULATED
    run.updated_at = datetime.utcnow()
    db.commit()

    create_audit_log(
        db=db, user_id=current_user.id,
        entity_type="payroll_run", entity_id=run.id,
        action="calculate",
        description=f"Nomina calculada: {len(employees_with_contracts)} empleados, neto total {run.currency} {float(total_net):,.2f}",
    )
    return {
        "status": "CALCULATED",
        "employee_count": len(employees_with_contracts),
        "total_gross": run.total_gross,
        "total_deductions": run.total_deductions,
        "total_net": run.total_net,
    }


@router.post("/runs/{run_id}/approve")
async def approve_payroll_run(
    run_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Approve a calculated payroll run."""
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Nomina no encontrada")
    if run.status != PayrollRunStatus.CALCULATED:
        raise HTTPException(status_code=400, detail="Solo se puede aprobar una nomina CALCULADA")

    run.status = PayrollRunStatus.APPROVED
    run.approved_by_id = current_user.id
    run.approved_at = datetime.utcnow()
    run.updated_at = datetime.utcnow()
    db.commit()

    create_audit_log(
        db=db, user_id=current_user.id,
        entity_type="payroll_run", entity_id=run.id,
        action="approve", description="Nomina aprobada",
    )
    return {"status": "APPROVED", "approved_by": current_user.full_name}


@router.get("/runs/{run_id}/lines", response_model=list[PayrollLineResponse])
async def get_payroll_lines(
    run_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Get payroll lines for a run."""
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Nomina no encontrada")

    lines = db.query(PayrollLine).filter(PayrollLine.payroll_run_id == run_id).all()
    result = []
    for line in lines:
        emp = db.query(Employee).filter(Employee.id == line.employee_id).first()
        result.append(PayrollLineResponse(
            id=line.id,
            employee_id=line.employee_id,
            employee_name=emp.full_name if emp else "N/A",
            employee_code=emp.employee_code if emp else None,
            department=emp.department if emp else None,
            base_salary=line.base_salary,
            days_worked=line.days_worked,
            hours_regular=line.hours_regular or 0,
            hours_overtime=line.hours_overtime or 0,
            gross_pay=line.gross_pay,
            total_deductions=line.total_deductions or 0,
            net_pay=line.net_pay,
            deductions_detail=line.deductions_detail,
        ))
    return result


@router.get("/runs/{run_id}/payslips")
async def get_payroll_payslips(
    run_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Get payslips for a payroll run."""
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Nomina no encontrada")

    lines = db.query(PayrollLine).filter(PayrollLine.payroll_run_id == run_id).all()
    payslips = []
    for line in lines:
        emp = db.query(Employee).filter(Employee.id == line.employee_id).first()
        slip = db.query(Payslip).filter(Payslip.payroll_line_id == line.id).first()
        payslips.append({
            "employee_id": line.employee_id,
            "employee_name": emp.full_name if emp else "N/A",
            "payslip_id": slip.id if slip else None,
            "html_content": slip.html_content if slip else None,
            "generated_at": slip.generated_at if slip else None,
        })
    return payslips


@router.get("/runs/{run_id}/export.csv")
async def export_payroll_csv(
    run_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Export payroll run as CSV."""
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Nomina no encontrada")

    lines = db.query(PayrollLine).filter(PayrollLine.payroll_run_id == run_id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Empleado", "Codigo", "Departamento", "Salario Base",
        "Horas Regulares", "Horas Extra", "Bruto", "Deducciones", "Neto",
    ])

    for line in lines:
        emp = db.query(Employee).filter(Employee.id == line.employee_id).first()
        writer.writerow([
            emp.full_name if emp else "N/A",
            emp.employee_code if emp else "",
            emp.department if emp else "",
            f"{line.base_salary:.2f}",
            f"{line.hours_regular or 0:.1f}",
            f"{line.hours_overtime or 0:.1f}",
            f"{line.gross_pay:.2f}",
            f"{line.total_deductions or 0:.2f}",
            f"{line.net_pay:.2f}",
        ])

    output.seek(0)
    filename = f"nomina_{run.period_start}_{run.period_end}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ============ Deduction Types ============


@router.get("/deduction-types", response_model=list[DeductionTypeResponse])
async def list_deduction_types(
    client_id: UUID = Query(...),
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """List deduction types for a client."""
    types = (
        db.query(DeductionType)
        .filter(DeductionType.client_id == client_id, DeductionType.is_active == True)
        .order_by(DeductionType.name)
        .all()
    )
    return [
        DeductionTypeResponse(
            id=t.id,
            client_id=t.client_id,
            name=t.name,
            description=t.description,
            calc_type=t.calc_type.value,
            value=t.value,
            is_active=t.is_active,
            is_mandatory=t.is_mandatory,
            created_at=t.created_at,
        )
        for t in types
    ]


@router.post("/deduction-types", response_model=DeductionTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_deduction_type(
    data: DeductionTypeCreate,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Create a deduction type."""
    _get_client_or_404(db, data.client_id)

    dt = DeductionType(
        id=uuid4(),
        client_id=data.client_id,
        name=data.name,
        description=data.description,
        calc_type=data.calc_type,
        value=data.value,
        is_mandatory=data.is_mandatory,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(dt)
    db.commit()
    db.refresh(dt)

    return DeductionTypeResponse(
        id=dt.id,
        client_id=dt.client_id,
        name=dt.name,
        description=dt.description,
        calc_type=dt.calc_type.value,
        value=dt.value,
        is_active=dt.is_active,
        is_mandatory=dt.is_mandatory,
        created_at=dt.created_at,
    )


# ============ Reports ============


@router.get("/reports/summary", response_model=PayrollSummaryReport)
async def payroll_summary_report(
    client_id: UUID = Query(...),
    period_start: Optional[str] = None,
    period_end: Optional[str] = None,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Get payroll summary report for a client."""
    client = _get_client_or_404(db, client_id)

    query = db.query(PayrollRun).filter(PayrollRun.client_id == client_id)
    if period_start:
        query = query.filter(PayrollRun.period_start >= period_start)
    if period_end:
        query = query.filter(PayrollRun.period_end <= period_end)

    runs = query.filter(PayrollRun.status != PayrollRunStatus.CANCELLED).all()

    total_gross = sum(r.total_gross or 0 for r in runs)
    total_deductions = sum(r.total_deductions or 0 for r in runs)
    total_net = sum(r.total_net or 0 for r in runs)
    total_employees = max((r.employee_count or 0) for r in runs) if runs else 0

    period = ""
    if period_start and period_end:
        period = f"{period_start} - {period_end}"
    elif runs:
        period = f"{min(r.period_start for r in runs)} - {max(r.period_end for r in runs)}"

    return PayrollSummaryReport(
        client_name=client.name,
        period=period,
        total_employees=total_employees,
        total_gross=round(total_gross, 2),
        total_deductions=round(total_deductions, 2),
        total_net=round(total_net, 2),
        runs_count=len(runs),
        currency=runs[0].currency if runs else "USD",
    )


@router.get("/reports/detail", response_model=list[PayrollDetailLine])
async def payroll_detail_report(
    run_id: UUID = Query(...),
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Get per-employee detail for a payroll run."""
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Nomina no encontrada")

    lines = db.query(PayrollLine).filter(PayrollLine.payroll_run_id == run_id).all()
    result = []
    for line in lines:
        emp = db.query(Employee).filter(Employee.id == line.employee_id).first()
        result.append(PayrollDetailLine(
            employee_name=emp.full_name if emp else "N/A",
            employee_code=emp.employee_code if emp else None,
            department=emp.department if emp else None,
            base_salary=line.base_salary,
            gross_pay=line.gross_pay,
            total_deductions=line.total_deductions or 0,
            net_pay=line.net_pay,
        ))
    return result


# ============ SPU Generation ============


@router.post("/runs/{run_id}/spu")
async def generate_spu_file(
    run_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Generate SPU (Planilla Única) file for ISSS/AFP submission."""
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")
    if run.status not in (PayrollRunStatus.CALCULATED, PayrollRunStatus.APPROVED, PayrollRunStatus.PAID):
        raise HTTPException(status_code=400, detail="La nómina debe estar calculada para generar SPU")

    generator = SPUGenerator()
    content, validation = generator.generate(db, run_id)

    if not validation.valid:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "No se puede generar SPU — errores de validación",
                "errors": validation.errors,
                "warnings": validation.warnings,
            },
        )

    create_audit_log(
        db=db, user_id=current_user.id,
        entity_type="payroll_spu", entity_id=run_id,
        action="generate_spu",
        description=f"SPU generado: {validation.employee_count} empleados, ISSS ${validation.total_isss}, AFP ${validation.total_afp}",
    )

    filename = f"SPU_{run.period_start.strftime('%Y%m')}_{run.client_id}.csv"
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/runs/{run_id}/compliance")
async def check_compliance(
    run_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Run compliance checks on a payroll run before government submission."""
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")

    report = validate_payroll_compliance(db, run_id)

    return {
        "payroll_run_id": str(report.payroll_run_id),
        "compliant": report.compliant,
        "checks": [
            {"name": c.name, "passed": c.passed, "detail": c.detail}
            for c in report.checks
        ],
        "errors": report.errors,
        "warnings": report.warnings,
    }


# ============ ISSS / AFP / ISR Reports ============


@router.get("/runs/{run_id}/report/isss")
async def isss_report(
    run_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Generate ISSS contribution summary report."""
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")

    client = db.query(Company).filter(Company.id == run.client_id).first()
    lines_data = db.query(PayrollLine).filter(PayrollLine.payroll_run_id == run_id).all()

    rows = []
    total_isss_emp = Decimal("0")
    total_isss_empr = Decimal("0")
    for line in lines_data:
        emp = db.query(Employee).filter(Employee.id == line.employee_id).first()
        breakdowns = db.query(PayrollDeductionBreakdown).filter(
            PayrollDeductionBreakdown.payroll_line_id == line.id,
            PayrollDeductionBreakdown.deduction_type == DeductionCategory.ISSS,
        ).all()
        isss_emp = sum(Decimal(str(b.amount)) for b in breakdowns)
        gross = Decimal(str(line.gross_pay))
        isss_base = min(gross, Decimal("1000"))
        isss_empr = (isss_base * Decimal("0.075")).quantize(Decimal("0.01"))

        total_isss_emp += isss_emp
        total_isss_empr += isss_empr
        rows.append({
            "employee_name": emp.full_name if emp else "N/A",
            "dui": emp.document_id if emp else None,
            "gross_salary": float(gross),
            "isss_employee": float(isss_emp),
            "isss_employer": float(isss_empr),
        })

    return {
        "company_name": client.name if client else None,
        "period": f"{run.period_start} — {run.period_end}",
        "employee_count": len(rows),
        "rows": rows,
        "total_isss_employee": float(total_isss_emp),
        "total_isss_employer": float(total_isss_empr),
        "total_isss": float(total_isss_emp + total_isss_empr),
    }


@router.get("/runs/{run_id}/report/afp")
async def afp_report(
    run_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Generate AFP contribution summary report."""
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")

    client = db.query(Company).filter(Company.id == run.client_id).first()
    lines_data = db.query(PayrollLine).filter(PayrollLine.payroll_run_id == run_id).all()

    rows = []
    total_afp_emp = Decimal("0")
    total_afp_empr = Decimal("0")
    for line in lines_data:
        emp = db.query(Employee).filter(Employee.id == line.employee_id).first()
        breakdowns = db.query(PayrollDeductionBreakdown).filter(
            PayrollDeductionBreakdown.payroll_line_id == line.id,
            PayrollDeductionBreakdown.deduction_type == DeductionCategory.AFP,
        ).all()
        afp_emp = sum(Decimal(str(b.amount)) for b in breakdowns)
        gross = Decimal(str(line.gross_pay))
        afp_empr = (gross * Decimal("0.0775")).quantize(Decimal("0.01"))

        total_afp_emp += afp_emp
        total_afp_empr += afp_empr
        rows.append({
            "employee_name": emp.full_name if emp else "N/A",
            "dui": emp.document_id if emp else None,
            "gross_salary": float(gross),
            "afp_employee": float(afp_emp),
            "afp_employer": float(afp_empr),
            "afp_provider": "CONFIA",  # Default, extend when EOR integration is done
        })

    return {
        "company_name": client.name if client else None,
        "period": f"{run.period_start} — {run.period_end}",
        "employee_count": len(rows),
        "rows": rows,
        "total_afp_employee": float(total_afp_emp),
        "total_afp_employer": float(total_afp_empr),
        "total_afp": float(total_afp_emp + total_afp_empr),
    }


@router.get("/runs/{run_id}/report/isr")
async def isr_report(
    run_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
):
    """Generate ISR (income tax) summary report."""
    run = db.query(PayrollRun).filter(PayrollRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Nómina no encontrada")

    client = db.query(Company).filter(Company.id == run.client_id).first()
    lines_data = db.query(PayrollLine).filter(PayrollLine.payroll_run_id == run_id).all()

    rows = []
    total_isr = Decimal("0")
    for line in lines_data:
        emp = db.query(Employee).filter(Employee.id == line.employee_id).first()
        breakdowns = db.query(PayrollDeductionBreakdown).filter(
            PayrollDeductionBreakdown.payroll_line_id == line.id,
            PayrollDeductionBreakdown.deduction_type == DeductionCategory.INCOME_TAX,
        ).all()
        isr = sum(Decimal(str(b.amount)) for b in breakdowns)
        total_isr += isr

        gross = Decimal(str(line.gross_pay))
        isss_emp = Decimal(str(line.gross_pay)) * Decimal("0.03")
        afp_emp = Decimal(str(line.gross_pay)) * Decimal("0.0725")
        taxable_base = gross - min(isss_emp, Decimal("30")) - afp_emp

        rows.append({
            "employee_name": emp.full_name if emp else "N/A",
            "dui": emp.document_id if emp else None,
            "gross_salary": float(gross),
            "taxable_base": float(taxable_base.quantize(Decimal("0.01"))),
            "isr": float(isr),
        })

    return {
        "company_name": client.name if client else None,
        "period": f"{run.period_start} — {run.period_end}",
        "employee_count": len(rows),
        "rows": rows,
        "total_isr": float(total_isr),
    }
