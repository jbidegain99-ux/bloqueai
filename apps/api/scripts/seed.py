"""Seed script to populate database with initial data - IDEMPOTENT VERSION."""

import sys
from pathlib import Path
from uuid import uuid4
from datetime import datetime

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


def seed_database():
    """Seed the database with initial data - IDEMPOTENT."""
    db = SessionLocal()

    try:
        print("=" * 60)
        print("TALENTOS BY BLOQUE - DATABASE SEED (IDEMPOTENT)")
        print("=" * 60)

        # Create default rubric
        print("\n[1/5] RUBRIC")
        rubric = ensure_rubric(db)
        db.commit()

        # Create company
        print("\n[2/5] COMPANY")
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
        print("\n[3/5] USERS")

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

        db.commit()

        # Create candidate users with profiles
        print("\n[4/5] CANDIDATES")
        candidates_data = [
            {
                "email": "candidate1@example.com",
                "name": "Ana Martinez",
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
            # Create/update user
            user = upsert_user(
                db,
                email=cdata["email"],
                password="Candidate123!",
                full_name=cdata["name"],
                role=UserRole.CANDIDATE,
            )

            # Create/update candidate profile
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

            # Check if interview session exists
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

                # Create report
                print(f"    Creating report for '{user.email}'...")
                report = CandidateReport(
                    id=uuid4(),
                    candidate_id=candidate.id,
                    session_id=session.id,
                    status=ReportStatus.COMPLETED,
                    summary=f"Candidato con perfil solido. {cdata['headline']}. Demuestra experiencia relevante y buenas habilidades.",
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
        print("\n[5/5] JOBS")
        jobs_data = [
            {
                "title": "Senior Full Stack Developer",
                "slug_base": "senior-full-stack-developer",
                "description": """Buscamos un Senior Full Stack Developer para unirse a nuestro equipo de producto.

Responsabilidades:
- Desarrollar y mantener aplicaciones web escalables
- Colaborar con el equipo de producto y diseno
- Implementar buenas practicas de desarrollo
- Mentorear a desarrolladores junior

Requisitos:
- 5+ anos de experiencia en desarrollo web
- Dominio de React, Node.js y bases de datos
- Experiencia con cloud (AWS/GCP)
- Ingles avanzado""",
                "seniority": SeniorityLevel.SENIOR,
                "salary_min": 80000,
                "salary_max": 120000,
                "must_haves": ["React", "Node.js", "PostgreSQL", "5+ anos experiencia"],
                "nice_to_haves": ["Docker", "Kubernetes", "AWS"],
            },
            {
                "title": "Data Scientist",
                "slug_base": "data-scientist",
                "description": """Buscamos un Data Scientist para nuestro equipo de analytics.

Responsabilidades:
- Desarrollar modelos de machine learning
- Analizar grandes volumenes de datos
- Colaborar con equipos de producto
- Presentar insights a stakeholders

Requisitos:
- 3+ anos de experiencia en data science
- Python, SQL, herramientas de ML
- Experiencia con visualizacion de datos
- Habilidades de comunicacion""",
                "seniority": SeniorityLevel.MID,
                "salary_min": 60000,
                "salary_max": 90000,
                "must_haves": ["Python", "Machine Learning", "SQL", "3+ anos experiencia"],
                "nice_to_haves": ["TensorFlow", "PyTorch", "Spark"],
            },
        ]

        for jdata in jobs_data:
            # Check if job exists
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

        print("\n" + "=" * 60)
        print("DATABASE SEED COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print("\nTest accounts (all passwords updated):")
        print("-" * 40)
        print("  ADMIN:     admin@example.com / Admin123!")
        print("  RECRUITER: recruiter@example.com / Recruiter123!")
        print("  EMPLOYER:  employer@example.com / Employer123!")
        print("  CANDIDATE: candidate1@example.com / Candidate123!")
        print("  CANDIDATE: candidate2@example.com / Candidate123!")
        print("  CANDIDATE: candidate3@example.com / Candidate123!")
        print("-" * 40)

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
