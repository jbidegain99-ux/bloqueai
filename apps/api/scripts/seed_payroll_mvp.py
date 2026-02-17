"""Seed script for Payroll MVP E2E testing.

Creates a complete payroll scenario with:
- 1 Client company ("Nomina Demo Corp")
- 4 Candidates placed as employees
- 4 Placements (ACTIVE)
- 4 Payroll Employees (linked to candidates)
- 4 Contracts (2 MONTHLY, 2 BIWEEKLY)
- 3 Deduction Types (IMSS, ISR, Seguro de Vida)
- ~60 Attendance records (15 working days x 4 employees)
- 1 Payroll Run (APPROVED) with lines + payslips

Usage:
    cd apps/api
    python scripts/seed_payroll_mvp.py

Requires:
    - DATABASE_URL pointing to PostgreSQL
    - ENABLE_PAYROLL=true for the UI to work (not needed for this script)

Idempotent: Safe to run multiple times.
"""

import sys
import os
from datetime import datetime, date, timedelta
from uuid import uuid4

# Add parent dir to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.job import Job, JobStatus
from app.models.placement import Placement, PlacementStatus, PlacementType
from app.models.payroll import (
    Employee, Contract, Attendance, PayrollRun, PayrollLine,
    Payslip, DeductionType,
    PayFrequency, ContractType, AttendanceType, PayrollRunStatus, DeductionCalcType,
)
from app.services.payslip_generator import generate_payslip_html


# === Seed Data ===

COMPANY_NAME = "Nomina Demo Corp"
COMPANY_SLUG = "nomina-demo-corp"

EMPLOYEES_DATA = [
    {
        "full_name": "Maria Fernanda Lopez Garcia",
        "email": "maria.lopez@nominademo.com",
        "phone": "+52 55 1234 5678",
        "employee_code": "NOM-001",
        "department": "Tecnologia",
        "position": "Desarrolladora Senior",
        "contract_type": ContractType.FULL_TIME,
        "pay_frequency": PayFrequency.MONTHLY,
        "base_salary": 45000.00,
    },
    {
        "full_name": "Carlos Alberto Ramirez Torres",
        "email": "carlos.ramirez@nominademo.com",
        "phone": "+52 55 2345 6789",
        "employee_code": "NOM-002",
        "department": "Tecnologia",
        "position": "Desarrollador Full Stack",
        "contract_type": ContractType.FULL_TIME,
        "pay_frequency": PayFrequency.MONTHLY,
        "base_salary": 35000.00,
    },
    {
        "full_name": "Ana Patricia Hernandez Ruiz",
        "email": "ana.hernandez@nominademo.com",
        "phone": "+52 55 3456 7890",
        "employee_code": "NOM-003",
        "department": "Recursos Humanos",
        "position": "Coordinadora de RRHH",
        "contract_type": ContractType.FULL_TIME,
        "pay_frequency": PayFrequency.BIWEEKLY,
        "base_salary": 25000.00,
    },
    {
        "full_name": "Jorge Eduardo Martinez Diaz",
        "email": "jorge.martinez@nominademo.com",
        "phone": "+52 55 4567 8901",
        "employee_code": "NOM-004",
        "department": "Operaciones",
        "position": "Analista de Operaciones",
        "contract_type": ContractType.PART_TIME,
        "pay_frequency": PayFrequency.BIWEEKLY,
        "base_salary": 15000.00,
    },
]

DEDUCTIONS_DATA = [
    {"name": "IMSS", "description": "Seguro Social (cuota obrera)", "calc_type": DeductionCalcType.PERCENTAGE, "value": 2.5, "is_mandatory": True},
    {"name": "ISR", "description": "Impuesto sobre la renta", "calc_type": DeductionCalcType.PERCENTAGE, "value": 10.0, "is_mandatory": True},
    {"name": "Seguro de Vida", "description": "Seguro de vida grupal", "calc_type": DeductionCalcType.FIXED, "value": 150.0, "is_mandatory": False},
]

# Feb 2026 working days (Mon-Fri)
PERIOD_START = date(2026, 2, 1)
PERIOD_END = date(2026, 2, 28)


def get_working_days(start: date, end: date) -> list:
    """Get list of working days (Mon-Fri) in a date range."""
    days = []
    current = start
    while current <= end:
        if current.weekday() < 5:  # Mon=0 ... Fri=4
            days.append(current)
        current += timedelta(days=1)
    return days


def seed_payroll_mvp():
    """Main seed function."""
    db = SessionLocal()
    now = datetime.utcnow()

    try:
        print("\n" + "=" * 60)
        print("  SEED: Payroll MVP E2E Data")
        print("=" * 60)

        # === 1. Company ===
        company = db.query(Company).filter(Company.slug == COMPANY_SLUG).first()
        if not company:
            company = Company(
                id=uuid4(),
                name=COMPANY_NAME,
                slug=COMPANY_SLUG,
                description="Empresa demo para pruebas de nomina",
                industry="Tecnologia",
                size="50-100",
                is_client=True,
                is_active=True,
                match_threshold=70,
                created_at=now,
                updated_at=now,
            )
            db.add(company)
            db.flush()
            print(f"  [+] Company: {COMPANY_NAME} ({company.id})")
        else:
            print(f"  [=] Company already exists: {COMPANY_NAME} ({company.id})")

        # === 2. Job ===
        # Get admin user for created_by_id
        admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not admin_user:
            # Create a minimal admin user if none exists
            admin_user = User(
                id=uuid4(),
                email="admin@nominademo.com",
                hashed_password=get_password_hash("Admin123!"),
                full_name="Admin Nomina Demo",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
                company_id=company.id,
                created_at=now,
                updated_at=now,
            )
            db.add(admin_user)
            db.flush()
            print(f"  [+] Admin user: {admin_user.email}")

        job = db.query(Job).filter(Job.company_id == company.id, Job.title == "Equipo de Tecnologia").first()
        if not job:
            job = Job(
                id=uuid4(),
                company_id=company.id,
                created_by_id=admin_user.id,
                title="Equipo de Tecnologia",
                slug=f"equipo-tecnologia-{uuid4().hex[:8]}",
                description="Posiciones en el equipo de tecnologia de Nomina Demo Corp",
                status=JobStatus.ACTIVE,
                category="TECHNOLOGY",
                seniority="MID",
                location="Ciudad de Mexico, Mexico",
                modality="HYBRID",
                display_company_name="Bloque Internacional",
                match_threshold=70,
                created_at=now,
                updated_at=now,
            )
            db.add(job)
            db.flush()
            print(f"  [+] Job: {job.title} ({job.id})")
        else:
            print(f"  [=] Job already exists: {job.title} ({job.id})")

        # === 3. Users + Candidates + Placements + Payroll Employees + Contracts ===
        payroll_employees = []
        contracts = []

        for i, emp_data in enumerate(EMPLOYEES_DATA):
            email = emp_data["email"]

            # User
            user = db.query(User).filter(User.email == email).first()
            if not user:
                user = User(
                    id=uuid4(),
                    email=email,
                    hashed_password=get_password_hash("Test123!"),
                    full_name=emp_data["full_name"],
                    role=UserRole.CANDIDATE,
                    is_active=True,
                    is_verified=True,
                    created_at=now,
                    updated_at=now,
                )
                db.add(user)
                db.flush()
                print(f"  [+] User: {email}")
            else:
                print(f"  [=] User exists: {email}")

            # Candidate
            candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()
            if not candidate:
                candidate = Candidate(
                    id=uuid4(),
                    user_id=user.id,
                    phone=emp_data["phone"],
                    location="Ciudad de Mexico",
                    headline=emp_data["position"],
                    summary=f"Profesional con experiencia en {emp_data['department']}",
                    skills={"technical": ["Python", "SQL", "Excel"], "soft": ["Comunicacion", "Liderazgo"]},
                    created_at=now,
                    updated_at=now,
                )
                db.add(candidate)
                db.flush()
                print(f"  [+] Candidate: {emp_data['full_name']}")

            # Placement
            placement = db.query(Placement).filter(
                Placement.candidate_id == candidate.id,
                Placement.client_id == company.id,
            ).first()
            if not placement:
                placement = Placement(
                    id=uuid4(),
                    candidate_id=candidate.id,
                    client_id=company.id,
                    job_id=job.id,
                    placement_type=PlacementType.DIRECT_HIRE if emp_data["contract_type"] == ContractType.FULL_TIME else PlacementType.CONTRACT,
                    status=PlacementStatus.ACTIVE,
                    position_title=emp_data["position"],
                    department=emp_data["department"],
                    location="Ciudad de Mexico",
                    offer_date=date(2026, 1, 10),
                    start_date=date(2026, 1, 15),
                    salary_amount=emp_data["base_salary"],
                    salary_currency="MXN",
                    salary_period="monthly",
                    created_at=now,
                    updated_at=now,
                )
                db.add(placement)
                db.flush()
                print(f"  [+] Placement ACTIVE: {emp_data['full_name']}")

            # Payroll Employee
            pe = db.query(Employee).filter(
                Employee.client_id == company.id,
                Employee.employee_code == emp_data["employee_code"],
            ).first()
            if not pe:
                pe = Employee(
                    id=uuid4(),
                    client_id=company.id,
                    candidate_id=candidate.id,
                    full_name=emp_data["full_name"],
                    email=emp_data["email"],
                    phone=emp_data["phone"],
                    employee_code=emp_data["employee_code"],
                    department=emp_data["department"],
                    position=emp_data["position"],
                    is_active=True,
                    hire_date=date(2026, 1, 15),
                    created_at=now,
                    updated_at=now,
                )
                db.add(pe)
                db.flush()
                print(f"  [+] Payroll Employee: {emp_data['employee_code']} - {emp_data['full_name']}")
            else:
                print(f"  [=] Payroll Employee exists: {emp_data['employee_code']}")

            payroll_employees.append(pe)

            # Contract
            contract = db.query(Contract).filter(
                Contract.employee_id == pe.id,
                Contract.is_active == True,
            ).first()
            if not contract:
                contract = Contract(
                    id=uuid4(),
                    employee_id=pe.id,
                    client_id=company.id,
                    contract_type=emp_data["contract_type"],
                    start_date=date(2026, 1, 15),
                    base_salary=emp_data["base_salary"],
                    currency="MXN",
                    pay_frequency=emp_data["pay_frequency"],
                    is_active=True,
                    notes=f"Contrato {emp_data['contract_type'].value} para {emp_data['full_name']}",
                    created_at=now,
                    updated_at=now,
                )
                db.add(contract)
                db.flush()
                print(f"  [+] Contract: {emp_data['pay_frequency'].value} ${emp_data['base_salary']:,.2f}")
            else:
                print(f"  [=] Contract exists for {emp_data['employee_code']}")

            contracts.append(contract)

        # === 4. Deduction Types ===
        deduction_types = []
        for dd in DEDUCTIONS_DATA:
            dt = db.query(DeductionType).filter(
                DeductionType.client_id == company.id,
                DeductionType.name == dd["name"],
            ).first()
            if not dt:
                dt = DeductionType(
                    id=uuid4(),
                    client_id=company.id,
                    name=dd["name"],
                    description=dd["description"],
                    calc_type=dd["calc_type"],
                    value=dd["value"],
                    is_active=True,
                    is_mandatory=dd["is_mandatory"],
                    created_at=now,
                    updated_at=now,
                )
                db.add(dt)
                db.flush()
                print(f"  [+] DeductionType: {dd['name']} ({dd['calc_type'].value} {dd['value']})")
            else:
                print(f"  [=] DeductionType exists: {dd['name']}")
            deduction_types.append(dt)

        # === 5. Attendance Records ===
        working_days = get_working_days(PERIOD_START, PERIOD_END)
        attendance_count = 0

        for idx, pe in enumerate(payroll_employees):
            existing_att = db.query(Attendance).filter(
                Attendance.employee_id == pe.id,
                Attendance.date >= PERIOD_START,
                Attendance.date <= PERIOD_END,
            ).count()

            if existing_att > 0:
                print(f"  [=] Attendance exists for {pe.employee_code} ({existing_att} records)")
                continue

            for day_idx, day in enumerate(working_days):
                # Employee 0: 1 overtime on day 3
                # Employee 1: 1 overtime on day 5
                # Employee 2: 1 absence on day 10
                # Employee 3: regular attendance only

                # Regular attendance for all
                record = Attendance(
                    id=uuid4(),
                    employee_id=pe.id,
                    client_id=company.id,
                    date=day,
                    hours=8.0,
                    attendance_type=AttendanceType.REGULAR,
                    created_at=now,
                    updated_at=now,
                )
                db.add(record)
                attendance_count += 1

                # Special cases
                if idx == 0 and day_idx == 3:
                    ot = Attendance(
                        id=uuid4(),
                        employee_id=pe.id,
                        client_id=company.id,
                        date=day,
                        hours=3.0,
                        attendance_type=AttendanceType.OVERTIME,
                        notes="Entrega de proyecto",
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(ot)
                    attendance_count += 1

                if idx == 1 and day_idx == 5:
                    ot = Attendance(
                        id=uuid4(),
                        employee_id=pe.id,
                        client_id=company.id,
                        date=day,
                        hours=2.0,
                        attendance_type=AttendanceType.OVERTIME,
                        notes="Soporte urgente",
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(ot)
                    attendance_count += 1

                if idx == 2 and day_idx == 10:
                    # Replace the regular with absence
                    # Delete the regular one just added for this day
                    db.query(Attendance).filter(
                        Attendance.employee_id == pe.id,
                        Attendance.date == day,
                        Attendance.attendance_type == AttendanceType.REGULAR,
                    ).delete()
                    absence = Attendance(
                        id=uuid4(),
                        employee_id=pe.id,
                        client_id=company.id,
                        date=day,
                        hours=0.0,
                        attendance_type=AttendanceType.ABSENCE,
                        notes="Ausencia justificada - cita medica",
                        created_at=now,
                        updated_at=now,
                    )
                    db.add(absence)
                    # attendance_count stays same (replaced)

        db.flush()
        if attendance_count > 0:
            print(f"  [+] Attendance: {attendance_count} records created for {len(working_days)} working days")
        else:
            print(f"  [=] Attendance already exists")

        # === 6. Payroll Run ===
        run = db.query(PayrollRun).filter(
            PayrollRun.client_id == company.id,
            PayrollRun.period_start == PERIOD_START,
            PayrollRun.period_end == PERIOD_END,
        ).first()

        if run:
            print(f"  [=] PayrollRun exists: {run.status.value} ({run.id})")
        else:
            run = PayrollRun(
                id=uuid4(),
                client_id=company.id,
                period_start=PERIOD_START,
                period_end=PERIOD_END,
                pay_frequency=PayFrequency.MONTHLY,
                status=PayrollRunStatus.DRAFT,
                currency="MXN",
                created_at=now,
                updated_at=now,
            )
            db.add(run)
            db.flush()
            print(f"  [+] PayrollRun DRAFT: {PERIOD_START} - {PERIOD_END} ({run.id})")

            # === 7. Calculate Payroll (inline) ===
            total_gross = 0.0
            total_deductions_sum = 0.0
            total_net = 0.0
            line_count = 0

            # Only process MONTHLY employees for this monthly run
            for pe, contract in zip(payroll_employees, contracts):
                if contract.pay_frequency != PayFrequency.MONTHLY:
                    continue

                # Get attendance
                att_records = db.query(Attendance).filter(
                    Attendance.employee_id == pe.id,
                    Attendance.date >= PERIOD_START,
                    Attendance.date <= PERIOD_END,
                ).all()

                hours_regular = sum(a.hours for a in att_records if a.attendance_type == AttendanceType.REGULAR)
                hours_overtime = sum(a.hours for a in att_records if a.attendance_type == AttendanceType.OVERTIME)
                days_worked = len(set(a.date for a in att_records if a.attendance_type == AttendanceType.REGULAR))

                gross_pay = round(contract.base_salary, 2)

                # Apply deductions
                deductions_detail = []
                line_ded = 0.0
                for dt in deduction_types:
                    if dt.calc_type == DeductionCalcType.PERCENTAGE:
                        amount = round(gross_pay * dt.value / 100, 2)
                    else:
                        amount = round(dt.value, 2)
                    deductions_detail.append({
                        "name": dt.name,
                        "type": dt.calc_type.value,
                        "amount": amount,
                    })
                    line_ded += amount

                line_ded = round(line_ded, 2)
                net_pay = round(gross_pay - line_ded, 2)

                # Create PayrollLine
                line = PayrollLine(
                    id=uuid4(),
                    payroll_run_id=run.id,
                    employee_id=pe.id,
                    base_salary=contract.base_salary,
                    days_worked=days_worked,
                    hours_regular=hours_regular,
                    hours_overtime=hours_overtime,
                    gross_pay=gross_pay,
                    total_deductions=line_ded,
                    net_pay=net_pay,
                    deductions_detail=deductions_detail,
                    created_at=now,
                    updated_at=now,
                )
                db.add(line)
                db.flush()

                # Generate Payslip HTML
                html = generate_payslip_html(
                    employee_name=pe.full_name,
                    employee_code=pe.employee_code,
                    department=pe.department,
                    position=pe.position,
                    client_name=COMPANY_NAME,
                    period_start=str(PERIOD_START),
                    period_end=str(PERIOD_END),
                    base_salary=contract.base_salary,
                    hours_regular=hours_regular,
                    hours_overtime=hours_overtime,
                    gross_pay=gross_pay,
                    deductions=deductions_detail,
                    total_deductions=line_ded,
                    net_pay=net_pay,
                    currency="MXN",
                )
                payslip = Payslip(
                    id=uuid4(),
                    payroll_line_id=line.id,
                    html_content=html,
                    generated_at=now,
                    created_at=now,
                    updated_at=now,
                )
                db.add(payslip)

                total_gross += gross_pay
                total_deductions_sum += line_ded
                total_net += net_pay
                line_count += 1

                print(f"  [+] Line: {pe.employee_code} | Bruto: ${gross_pay:,.2f} | Ded: ${line_ded:,.2f} | Neto: ${net_pay:,.2f}")

            # Update run totals and status
            run.total_gross = round(total_gross, 2)
            run.total_deductions = round(total_deductions_sum, 2)
            run.total_net = round(total_net, 2)
            run.employee_count = line_count
            run.status = PayrollRunStatus.APPROVED
            run.approved_at = now
            run.updated_at = now

            db.flush()
            print(f"\n  [+] Run APPROVED: {line_count} employees")
            print(f"      Total Bruto:      MXN ${total_gross:,.2f}")
            print(f"      Total Deducciones: MXN ${total_deductions_sum:,.2f}")
            print(f"      Total Neto:        MXN ${total_net:,.2f}")

        db.commit()

        # === Summary ===
        print("\n" + "=" * 60)
        print("  SEED COMPLETE - Summary")
        print("=" * 60)
        print(f"  Company:     {COMPANY_NAME}")
        print(f"  Employees:   {len(payroll_employees)}")
        print(f"  Placements:  {len(payroll_employees)} ACTIVE")
        print(f"  Contracts:   {len(contracts)}")
        print(f"  Deductions:  {len(deduction_types)} types")
        print(f"  Attendance:  {attendance_count} records ({len(working_days)} working days)")
        print(f"  Payroll Run: {run.status.value} ({run.id})")
        print()
        print("  To use the Payroll UI:")
        print("    1. Set ENABLE_PAYROLL=true in environment")
        print("    2. Login as admin@bloqueai.com / Admin123!")
        print("    3. Navigate to /admin/payroll/dashboard")
        print(f"    4. Select client '{COMPANY_NAME}'")
        print()
        print("  Candidate credentials (all use Test123!):")
        for emp in EMPLOYEES_DATA:
            print(f"    - {emp['email']}")
        print()

    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_payroll_mvp()
