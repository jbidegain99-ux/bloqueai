"""Seed script to populate database with initial data - IDEMPOTENT VERSION.

Creates:
  - Default rubric
  - Company (Bloque Internacional) — used as client for payroll
  - Users: admin, recruiter, employer, 2 employees, 3 candidates
  - 5 Payroll employees with contracts
  - 2 Payroll runs (Jan PAID, Feb DRAFT) with calculated lines
  - 3 Candidates with interview sessions and reports
  - 2 Jobs

Run: python scripts/seed.py
"""

import sys
from pathlib import Path
from uuid import uuid4
from datetime import datetime, date
from decimal import Decimal

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.candidate import Candidate
from app.models.resume import Resume, ResumeStatus
from app.models.job import Job, JobStatus, JobModality, SeniorityLevel
from app.models.interview import InterviewSession, InterviewMessage, InterviewStatus, MessageRole
from app.models.report import CandidateReport, ReportStatus
from app.models.rubric import Rubric, RubricCriteria
from app.models.payroll import (
    Employee, Contract, PayrollRun, PayrollLine, Payslip,
    PayrollDeductionBreakdown, PayrollProvision,
    PayFrequency, ContractType, PayrollRunStatus,
    EmployeeStatus, DocumentType, EmploymentType,
    DeductionCategory, ProvisionType,
)


def get_or_create_company(db: Session, name: str, slug: str, **kwargs) -> Company:
    """Get or create a company by slug."""
    company = db.query(Company).filter(Company.slug == slug).first()
    if company:
        print(f"  Company '{name}' already exists, updating...")
        for key, value in kwargs.items():
            if hasattr(company, key):
                setattr(company, key, value)
        company.updated_at = datetime.utcnow()
    else:
        print(f"  Creating company '{name}'...")
        company = Company(
            id=uuid4(),
            name=name,
            slug=slug,
            **kwargs,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(company)
    db.flush()
    return company


def upsert_user(db: Session, email: str, password: str, full_name: str, role: UserRole,
                company_id=None, **kwargs) -> User:
    """Insert or update a user by email."""
    user = db.query(User).filter(User.email == email).first()
    hashed_password = get_password_hash(password)

    if user:
        print(f"  User '{email}' already exists, updating password and role...")
        user.hashed_password = hashed_password
        user.full_name = full_name
        user.role = role
        user.company_id = company_id
        user.is_active = True
        user.is_verified = True
        user.updated_at = datetime.utcnow()
    else:
        print(f"  Creating user '{email}'...")
        user = User(
            id=uuid4(),
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            role=role,
            company_id=company_id,
            is_active=True,
            is_verified=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            **kwargs,
        )
        db.add(user)
    db.flush()
    return user


def ensure_candidate_profile(db: Session, user: User, **profile_data) -> Candidate:
    """Ensure a candidate profile exists for a user."""
    candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()

    if candidate:
        print(f"    Candidate profile for '{user.email}' exists, updating...")
        for key, value in profile_data.items():
            if hasattr(candidate, key) and value is not None:
                setattr(candidate, key, value)
        candidate.updated_at = datetime.utcnow()
    else:
        print(f"    Creating candidate profile for '{user.email}'...")
        candidate = Candidate(
            id=uuid4(),
            user_id=user.id,
            **profile_data,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(candidate)
    db.flush()
    return candidate


def ensure_rubric(db: Session) -> Rubric:
    """Ensure default rubric exists."""
    rubric = db.query(Rubric).filter(Rubric.is_default == True).first()

    if rubric:
        print("  Default rubric exists, skipping...")
        return rubric

    print("  Creating default rubric...")
    rubric = Rubric(
        id=uuid4(),
        name="Rubrica Estandar de Evaluacion",
        description="Rubrica por defecto para evaluacion de candidatos",
        is_default=True,
        is_active=True,
        min_score_threshold=3.0,
        max_candidates_shortlist=10,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(rubric)
    db.flush()

    # Add criteria
    criteria_data = [
        ("Habilidades Tecnicas", "technical_skills", 1.5, "Dominio de tecnologias y herramientas requeridas"),
        ("Comunicacion", "communication", 1.0, "Claridad y efectividad en la comunicacion"),
        ("Resolucion de Problemas", "problem_solving", 1.2, "Capacidad analitica y creatividad"),
        ("Trabajo en Equipo", "teamwork", 0.8, "Colaboracion y habilidades interpersonales"),
        ("Liderazgo", "leadership", 0.5, "Capacidad de liderar y mentorear"),
        ("Adaptabilidad", "adaptability", 0.5, "Flexibilidad ante cambios"),
        ("Fit Cultural", "cultural_fit", 0.5, "Alineacion con valores de la empresa"),
    ]

    for i, (name, key, weight, desc) in enumerate(criteria_data):
        criteria = RubricCriteria(
            id=uuid4(),
            rubric_id=rubric.id,
            name=name,
            key=key,
            weight=weight,
            description=desc,
            order=i,
            scoring_guidelines={
                "1": "No demuestra la competencia",
                "2": "Nivel basico",
                "3": "Competente",
                "4": "Muy bueno",
                "5": "Excepcional",
            },
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(criteria)

    return rubric


# ── El Salvador deduction calculators ────────────────────────

def calc_isss_employee(salary: float) -> float:
    applicable = min(salary, 1000.0)
    return min(round(applicable * 0.03, 2), 30.0)

def calc_afp_employee(salary: float) -> float:
    return round(salary * 0.0725, 2)

def calc_isr_monthly(salary: float, isss: float, afp: float) -> float:
    taxable = salary - isss - afp
    if taxable <= 472.00:
        return 0.0
    elif taxable <= 895.24:
        return round((taxable - 472.00) * 0.10, 2)
    elif taxable <= 2038.10:
        return round(42.32 + (taxable - 895.24) * 0.20, 2)
    else:
        return round(271.89 + (taxable - 2038.10) * 0.30, 2)

def calc_isss_employer(salary: float) -> float:
    applicable = min(salary, 1000.0)
    return min(round(applicable * 0.075, 2), 75.0)

def calc_afp_employer(salary: float) -> float:
    return round(salary * 0.0875, 2)


def seed_database():
    """Seed the database with initial data - IDEMPOTENT."""
    db = SessionLocal()

    try:
        print("=" * 60)
        print("TALENTOS BY BLOQUE - DATABASE SEED (IDEMPOTENT)")
        print("=" * 60)

        # Create default rubric
        print("\n[1/7] RUBRIC")
        rubric = ensure_rubric(db)
        db.commit()

        # Create company
        print("\n[2/7] COMPANY")
        company = get_or_create_company(
            db,
            name="Bloque Internacional",
            slug="bloque-internacional",
            description="Empresa lider en soluciones de capital humano y tecnologia",
            website="https://bloque.com",
            industry="Tecnologia / Recursos Humanos",
            size="51-200",
            is_active=True,
        )
        db.commit()

        # Create users
        print("\n[3/7] USERS")

        # Admin
        admin = upsert_user(
            db,
            email="admin@example.com",
            password="Admin123!",
            full_name="Administrador TalentOS",
            role=UserRole.ADMIN,
            company_id=company.id,
        )

        # Recruiter
        recruiter = upsert_user(
            db,
            email="recruiter@example.com",
            password="Recruiter123!",
            full_name="Maria Garcia - Reclutadora",
            role=UserRole.RECRUITER,
            company_id=company.id,
        )

        # Employer
        employer = upsert_user(
            db,
            email="employer@example.com",
            password="Employer123!",
            full_name="Carlos Lopez - Hiring Manager",
            role=UserRole.EMPLOYER,
            company_id=company.id,
        )

        # Employee users (linked to Employee records below)
        employee_user_1 = upsert_user(
            db,
            email="employee1@example.com",
            password="Employee123!",
            full_name="Jose Bidegain",
            role=UserRole.EMPLOYER,  # EMPLOYER role lets them access the system
            company_id=company.id,
        )

        employee_user_2 = upsert_user(
            db,
            email="employee2@example.com",
            password="Employee123!",
            full_name="Ana Martinez",
            role=UserRole.EMPLOYER,
            company_id=company.id,
        )

        db.commit()

        # Create candidate users with profiles
        print("\n[4/7] CANDIDATES")
        candidates_data = [
            {
                "email": "candidate1@example.com",
                "name": "Ana Martinez (Candidata)",
                "headline": "Senior Software Engineer | Python | React",
                "location": "Ciudad de Mexico, Mexico",
                "skills": ["Python", "React", "Node.js", "PostgreSQL", "AWS", "Docker", "Kubernetes"],
                "experience": [
                    {"title": "Senior Software Engineer", "company": "Tech Corp", "start_date": "2021-01", "end_date": "presente"},
                    {"title": "Software Engineer", "company": "Startup Inc", "start_date": "2018-06", "end_date": "2020-12"},
                ],
                "score": 4.3,
            },
            {
                "email": "candidate2@example.com",
                "name": "Roberto Sanchez",
                "headline": "Full Stack Developer | JavaScript | TypeScript",
                "location": "Bogota, Colombia",
                "skills": ["JavaScript", "TypeScript", "React", "Vue.js", "Node.js", "MongoDB", "Git"],
                "experience": [
                    {"title": "Full Stack Developer", "company": "Digital Agency", "start_date": "2020-03", "end_date": "presente"},
                    {"title": "Frontend Developer", "company": "Web Studio", "start_date": "2017-08", "end_date": "2020-02"},
                ],
                "score": 3.9,
            },
            {
                "email": "candidate3@example.com",
                "name": "Laura Fernandez",
                "headline": "Data Scientist | Machine Learning | Python",
                "location": "Buenos Aires, Argentina",
                "skills": ["Python", "Machine Learning", "TensorFlow", "PyTorch", "SQL", "Spark", "Data Analysis"],
                "experience": [
                    {"title": "Data Scientist", "company": "AI Labs", "start_date": "2019-09", "end_date": "presente"},
                    {"title": "Data Analyst", "company": "Analytics Co", "start_date": "2016-04", "end_date": "2019-08"},
                ],
                "score": 4.1,
            },
        ]

        for cdata in candidates_data:
            user = upsert_user(
                db,
                email=cdata["email"],
                password="Candidate123!",
                full_name=cdata["name"],
                role=UserRole.CANDIDATE,
            )

            candidate = ensure_candidate_profile(
                db,
                user,
                headline=cdata["headline"],
                location=cdata["location"],
                skills=cdata["skills"],
                experience=cdata["experience"],
                education=[{"degree": "Ingenieria en Sistemas", "institution": "Universidad Nacional", "year": "2016"}],
                languages=[{"language": "Espanol", "level": "Nativo"}, {"language": "Ingles", "level": "Avanzado"}],
                ai_summary=f"Profesional con experiencia solida en tecnologia. {cdata['headline']}",
                competency_scores={
                    "technical_skills": {"score": cdata["score"], "notes": "Buen dominio tecnico"},
                    "communication": {"score": cdata["score"] - 0.2, "notes": "Buena comunicacion"},
                    "problem_solving": {"score": cdata["score"] + 0.1, "notes": "Capacidad analitica"},
                    "teamwork": {"score": cdata["score"] - 0.3, "notes": "Trabajo en equipo"},
                    "leadership": {"score": cdata["score"] - 0.5, "notes": "Potencial de liderazgo"},
                },
            )

            existing_session = (
                db.query(InterviewSession)
                .filter(InterviewSession.candidate_id == candidate.id)
                .filter(InterviewSession.status == InterviewStatus.COMPLETED)
                .first()
            )

            if not existing_session:
                print(f"    Creating interview session for '{user.email}'...")
                session = InterviewSession(
                    id=uuid4(),
                    candidate_id=candidate.id,
                    status=InterviewStatus.COMPLETED,
                    current_question_index=11,
                    total_questions=12,
                    language="es",
                    started_at=datetime.utcnow().isoformat(),
                    completed_at=datetime.utcnow().isoformat(),
                    duration_seconds=1200,
                    confidence_score=85,
                    requires_review=False,
                    masked_transcript="Entrevista completada con exito.",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(session)
                db.flush()

                report = CandidateReport(
                    id=uuid4(),
                    candidate_id=candidate.id,
                    session_id=session.id,
                    status=ReportStatus.COMPLETED,
                    summary=f"Candidato con perfil solido. {cdata['headline']}. Demuestra experiencia relevante.",
                    overall_score=cdata["score"],
                    confidence_score=85,
                    competency_scores=candidate.competency_scores,
                    skills_detected=cdata["skills"],
                    strengths=["Experiencia tecnica solida", "Buena comunicacion", "Actitud proactiva"],
                    weaknesses=["Podria mejorar en liderazgo"],
                    risks=["Sin riesgos significativos"],
                    recommendations=["Adecuado para roles mid-senior", "Considerar para proyectos desafiantes"],
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(report)

        db.commit()

        # Create sample jobs
        print("\n[5/7] JOBS")
        jobs_data = [
            {
                "title": "Senior Full Stack Developer",
                "slug_base": "senior-full-stack-developer",
                "description": "Buscamos Senior Full Stack Developer para nuestro equipo de producto.",
                "seniority": SeniorityLevel.SENIOR,
                "salary_min": 80000,
                "salary_max": 120000,
                "must_haves": ["React", "Node.js", "PostgreSQL", "5+ anos experiencia"],
                "nice_to_haves": ["Docker", "Kubernetes", "AWS"],
            },
            {
                "title": "Data Scientist",
                "slug_base": "data-scientist",
                "description": "Buscamos Data Scientist para nuestro equipo de analytics.",
                "seniority": SeniorityLevel.MID,
                "salary_min": 60000,
                "salary_max": 90000,
                "must_haves": ["Python", "Machine Learning", "SQL", "3+ anos experiencia"],
                "nice_to_haves": ["TensorFlow", "PyTorch", "Spark"],
            },
        ]

        for jdata in jobs_data:
            existing_job = (
                db.query(Job)
                .filter(Job.title == jdata["title"])
                .filter(Job.company_id == company.id)
                .first()
            )

            if existing_job:
                print(f"  Job '{jdata['title']}' already exists, skipping...")
                continue

            print(f"  Creating job '{jdata['title']}'...")
            job = Job(
                id=uuid4(),
                company_id=company.id,
                created_by_id=employer.id,
                title=jdata["title"],
                slug=jdata["slug_base"] + "-" + str(uuid4())[:8],
                description=jdata["description"],
                seniority=jdata["seniority"],
                salary_min=jdata["salary_min"],
                salary_max=jdata["salary_max"],
                salary_currency="USD",
                modality=JobModality.REMOTE,
                location="Remoto",
                country="LATAM",
                must_haves=jdata["must_haves"],
                nice_to_haves=jdata["nice_to_haves"],
                responsibilities=["Desarrollo de software", "Colaboracion con equipos", "Mejora continua"],
                benefits=["Trabajo remoto", "Horario flexible", "Desarrollo profesional"],
                status=JobStatus.ACTIVE,
                rubric_id=rubric.id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(job)

        db.commit()

        # ── PAYROLL DATA ──────────────────────────────────────────
        print("\n[6/7] PAYROLL EMPLOYEES + CONTRACTS")

        employees_data = [
            {"full_name": "Jose Bidegain", "email": "jose.b@bloque.com", "dui": "12345678-9",
             "department": "Informatica", "position": "Senior Developer", "salary": 1500.00,
             "user": employee_user_1},
            {"full_name": "Ana Martinez", "email": "ana.m@bloque.com", "dui": "98765432-1",
             "department": "Recursos Humanos", "position": "HR Manager", "salary": 2000.00,
             "user": employee_user_2},
            {"full_name": "Carlos Hernandez", "email": "carlos.h@bloque.com", "dui": "11111111-1",
             "department": "Finanzas", "position": "Financial Analyst", "salary": 1200.00,
             "user": None},
            {"full_name": "Maria Lopez", "email": "maria.l@bloque.com", "dui": "22222222-2",
             "department": "Marketing", "position": "Marketing Manager", "salary": 1800.00,
             "user": None},
            {"full_name": "Juan Rodriguez", "email": "juan.r@bloque.com", "dui": "33333333-3",
             "department": "Operaciones", "position": "Operations Assistant", "salary": 950.00,
             "user": None},
        ]

        payroll_employees: list[Employee] = []
        for edata in employees_data:
            existing = db.query(Employee).filter(
                Employee.client_id == company.id,
                Employee.document_id == edata["dui"],
            ).first()

            if existing:
                print(f"  Employee '{edata['full_name']}' exists, updating...")
                existing.full_name = edata["full_name"]
                existing.salary = edata["salary"]
                existing.department = edata["department"]
                existing.position = edata["position"]
                if edata["user"]:
                    existing.user_id = edata["user"].id
                payroll_employees.append(existing)
            else:
                print(f"  Creating employee '{edata['full_name']}'...")
                emp = Employee(
                    id=uuid4(),
                    client_id=company.id,
                    user_id=edata["user"].id if edata["user"] else None,
                    full_name=edata["full_name"],
                    email=edata["email"],
                    employee_code=f"EMP-{len(payroll_employees) + 1:03d}",
                    department=edata["department"],
                    position=edata["position"],
                    hire_date=date(2025, 1, 15),
                    document_type=DocumentType.DUI,
                    document_id=edata["dui"],
                    salary=Decimal(str(edata["salary"])),
                    salary_currency="USD",
                    employment_type=EmploymentType.FULL_TIME,
                    status=EmployeeStatus.ACTIVE,
                    is_active=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(emp)
                db.flush()
                payroll_employees.append(emp)

                # Create active contract
                contract = Contract(
                    id=uuid4(),
                    employee_id=emp.id,
                    client_id=company.id,
                    contract_type=ContractType.FULL_TIME,
                    position_title=edata["position"],
                    start_date=date(2025, 1, 15),
                    base_salary=edata["salary"],
                    currency="USD",
                    pay_frequency=PayFrequency.MONTHLY,
                    is_active=True,
                    benefits={"health_insurance": True, "meal_allowance": 100},
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(contract)

        db.commit()

        # ── PAYROLL RUNS ──────────────────────────────────────────
        print("\n[7/7] PAYROLL RUNS + PAYSLIPS")

        # Check if runs already exist
        existing_run = db.query(PayrollRun).filter(
            PayrollRun.client_id == company.id,
        ).first()

        if existing_run:
            print("  Payroll runs already exist, skipping...")
        else:
            salaries = [e["salary"] for e in employees_data]

            # ── Run 1: January 2026 (PAID) ──
            print("  Creating January 2026 payroll run (PAID)...")
            total_gross_1 = sum(salaries)
            total_ded_1 = 0.0
            total_net_1 = 0.0

            run1 = PayrollRun(
                id=uuid4(),
                client_id=company.id,
                period_start=date(2026, 1, 1),
                period_end=date(2026, 1, 31),
                pay_frequency=PayFrequency.MONTHLY,
                status=PayrollRunStatus.PAID,
                total_gross=0,  # updated below
                total_deductions=0,
                total_net=0,
                employee_count=len(payroll_employees),
                currency="USD",
                approved_by_id=admin.id,
                approved_at=datetime(2026, 2, 1),
                notes="Nomina de enero 2026 - pagada",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(run1)
            db.flush()

            for i, emp in enumerate(payroll_employees):
                sal = salaries[i]
                isss = calc_isss_employee(sal)
                afp = calc_afp_employee(sal)
                isr = calc_isr_monthly(sal, isss, afp)
                total_ded = round(isss + afp + isr, 2)
                net = round(sal - total_ded, 2)
                total_ded_1 += total_ded
                total_net_1 += net

                line = PayrollLine(
                    id=uuid4(),
                    payroll_run_id=run1.id,
                    employee_id=emp.id,
                    base_salary=sal,
                    days_worked=22,
                    hours_regular=176,
                    hours_overtime=0,
                    gross_pay=sal,
                    total_deductions=total_ded,
                    net_pay=net,
                    deductions_detail=[
                        {"type": "ISSS", "amount": isss, "description": "ISSS Empleado 3%"},
                        {"type": "AFP", "amount": afp, "description": "AFP Empleado 7.25%"},
                        {"type": "INCOME_TAX", "amount": isr, "description": "ISR Tabla Progresiva"},
                    ],
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(line)
                db.flush()

                # Add deduction breakdowns
                if isss > 0:
                    db.add(PayrollDeductionBreakdown(
                        id=uuid4(), payroll_line_id=line.id,
                        deduction_type=DeductionCategory.ISSS, amount=Decimal(str(isss)),
                        description="ISSS Empleado 3%",
                        created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
                    ))
                if afp > 0:
                    db.add(PayrollDeductionBreakdown(
                        id=uuid4(), payroll_line_id=line.id,
                        deduction_type=DeductionCategory.AFP, amount=Decimal(str(afp)),
                        description="AFP Empleado 7.25%",
                        created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
                    ))
                if isr > 0:
                    db.add(PayrollDeductionBreakdown(
                        id=uuid4(), payroll_line_id=line.id,
                        deduction_type=DeductionCategory.INCOME_TAX, amount=Decimal(str(isr)),
                        description="ISR Tabla Progresiva",
                        created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
                    ))

                # Payslip
                db.add(Payslip(
                    id=uuid4(),
                    payroll_line_id=line.id,
                    html_content=f"<h1>Colilla de Pago - Enero 2026</h1><p>{emp.full_name}: Neto ${net:,.2f}</p>",
                    generated_at=datetime(2026, 2, 1),
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                ))

            # Update run totals
            run1.total_gross = total_gross_1
            run1.total_deductions = round(total_ded_1, 2)
            run1.total_net = round(total_net_1, 2)

            # ── Run 2: February 2026 (DRAFT) ──
            print("  Creating February 2026 payroll run (DRAFT)...")
            total_gross_2 = sum(salaries)
            total_ded_2 = 0.0
            total_net_2 = 0.0

            run2 = PayrollRun(
                id=uuid4(),
                client_id=company.id,
                period_start=date(2026, 2, 1),
                period_end=date(2026, 2, 28),
                pay_frequency=PayFrequency.MONTHLY,
                status=PayrollRunStatus.DRAFT,
                total_gross=0,
                total_deductions=0,
                total_net=0,
                employee_count=len(payroll_employees),
                currency="USD",
                notes="Nomina de febrero 2026 - borrador",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(run2)
            db.flush()

            for i, emp in enumerate(payroll_employees):
                sal = salaries[i]
                isss = calc_isss_employee(sal)
                afp = calc_afp_employee(sal)
                isr = calc_isr_monthly(sal, isss, afp)
                total_ded = round(isss + afp + isr, 2)
                net = round(sal - total_ded, 2)
                total_ded_2 += total_ded
                total_net_2 += net

                line = PayrollLine(
                    id=uuid4(),
                    payroll_run_id=run2.id,
                    employee_id=emp.id,
                    base_salary=sal,
                    days_worked=20,
                    hours_regular=160,
                    hours_overtime=0,
                    gross_pay=sal,
                    total_deductions=total_ded,
                    net_pay=net,
                    deductions_detail=[
                        {"type": "ISSS", "amount": isss, "description": "ISSS Empleado 3%"},
                        {"type": "AFP", "amount": afp, "description": "AFP Empleado 7.25%"},
                        {"type": "INCOME_TAX", "amount": isr, "description": "ISR Tabla Progresiva"},
                    ],
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(line)

            run2.total_gross = total_gross_2
            run2.total_deductions = round(total_ded_2, 2)
            run2.total_net = round(total_net_2, 2)

            db.commit()

        print("\n" + "=" * 60)
        print("DATABASE SEED COMPLETED SUCCESSFULLY!")
        print("=" * 60)

        # Print summary
        print("\nPayroll Summary (Jan 2026):")
        print("-" * 50)
        for i, edata in enumerate(employees_data):
            sal = edata["salary"]
            isss = calc_isss_employee(sal)
            afp = calc_afp_employee(sal)
            isr = calc_isr_monthly(sal, isss, afp)
            total_ded = round(isss + afp + isr, 2)
            net = round(sal - total_ded, 2)
            print(f"  {edata['full_name']:20s}  Bruto: ${sal:>8,.2f}  ISSS: ${isss:>5.2f}  "
                  f"AFP: ${afp:>6.2f}  ISR: ${isr:>6.2f}  Neto: ${net:>8,.2f}")

        print("\nTest Accounts:")
        print("-" * 50)
        print("  ADMIN:      admin@example.com / Admin123!")
        print("  RECRUITER:  recruiter@example.com / Recruiter123!")
        print("  EMPLOYER:   employer@example.com / Employer123!")
        print("  EMPLOYEE 1: employee1@example.com / Employee123!")
        print("  EMPLOYEE 2: employee2@example.com / Employee123!")
        print("  CANDIDATE:  candidate1@example.com / Candidate123!")
        print("-" * 50)
        print("  Company: Bloque Internacional (used as client_id for payroll)")
        print("  Payroll: enable_payroll=True (default)")
        print("-" * 50)

    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
