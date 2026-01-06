"""Seed script to populate database with initial data."""

import sys
from pathlib import Path
from uuid import uuid4
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session

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


def seed_database():
    """Seed the database with initial data."""
    db = SessionLocal()

    try:
        print("🌱 Starting database seed...")

        # Check if already seeded
        if db.query(User).filter(User.email == "admin@talentos.local").first():
            print("⚠️  Database already seeded. Skipping.")
            return

        # Create default rubric
        print("📋 Creating default rubric...")
        default_rubric = Rubric(
            id=uuid4(),
            name="Rúbrica Estándar de Evaluación",
            description="Rúbrica por defecto para evaluación de candidatos",
            is_default=True,
            is_active=True,
            min_score_threshold=3.0,
            max_candidates_shortlist=10,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(default_rubric)
        db.flush()

        # Add criteria
        criteria_data = [
            ("Habilidades Técnicas", "technical_skills", 1.5, "Dominio de tecnologías y herramientas requeridas"),
            ("Comunicación", "communication", 1.0, "Claridad y efectividad en la comunicación"),
            ("Resolución de Problemas", "problem_solving", 1.2, "Capacidad analítica y creatividad"),
            ("Trabajo en Equipo", "teamwork", 0.8, "Colaboración y habilidades interpersonales"),
            ("Liderazgo", "leadership", 0.5, "Capacidad de liderar y mentorear"),
            ("Adaptabilidad", "adaptability", 0.5, "Flexibilidad ante cambios"),
            ("Fit Cultural", "cultural_fit", 0.5, "Alineación con valores de la empresa"),
        ]

        for i, (name, key, weight, desc) in enumerate(criteria_data):
            criteria = RubricCriteria(
                id=uuid4(),
                rubric_id=default_rubric.id,
                name=name,
                key=key,
                weight=weight,
                description=desc,
                order=i,
                scoring_guidelines={
                    "1": "No demuestra la competencia",
                    "2": "Nivel básico",
                    "3": "Competente",
                    "4": "Muy bueno",
                    "5": "Excepcional",
                },
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(criteria)

        # Create company
        print("🏢 Creating company...")
        company = Company(
            id=uuid4(),
            name="Bloque Internacional",
            slug="bloque-internacional",
            description="Empresa líder en soluciones de capital humano y tecnología",
            website="https://bloque.com",
            industry="Tecnología / Recursos Humanos",
            size="51-200",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(company)
        db.flush()

        # Create admin user
        print("👤 Creating admin user...")
        admin = User(
            id=uuid4(),
            email="admin@talentos.local",
            hashed_password=get_password_hash("Admin123!"),
            full_name="Administrador TalentOS",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
            company_id=company.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(admin)

        # Create recruiter user
        print("👤 Creating recruiter user...")
        recruiter = User(
            id=uuid4(),
            email="recruiter@talentos.local",
            hashed_password=get_password_hash("Recruiter123!"),
            full_name="María García - Reclutadora",
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
            company_id=company.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(recruiter)

        # Create employer user
        print("👤 Creating employer user...")
        employer = User(
            id=uuid4(),
            email="employer@talentos.local",
            hashed_password=get_password_hash("Employer123!"),
            full_name="Carlos López - Hiring Manager",
            role=UserRole.EMPLOYER,
            is_active=True,
            is_verified=True,
            company_id=company.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(employer)
        db.flush()

        # Create candidate users and profiles
        print("👥 Creating candidate users...")
        candidates_data = [
            {
                "email": "candidate1@example.com",
                "name": "Ana Martínez",
                "headline": "Senior Software Engineer | Python | React",
                "location": "Ciudad de México, México",
                "skills": ["Python", "React", "Node.js", "PostgreSQL", "AWS", "Docker", "Kubernetes"],
                "experience": [
                    {"title": "Senior Software Engineer", "company": "Tech Corp", "start_date": "2021-01", "end_date": "presente"},
                    {"title": "Software Engineer", "company": "Startup Inc", "start_date": "2018-06", "end_date": "2020-12"},
                ],
                "score": 4.3,
            },
            {
                "email": "candidate2@example.com",
                "name": "Roberto Sánchez",
                "headline": "Full Stack Developer | JavaScript | TypeScript",
                "location": "Bogotá, Colombia",
                "skills": ["JavaScript", "TypeScript", "React", "Vue.js", "Node.js", "MongoDB", "Git"],
                "experience": [
                    {"title": "Full Stack Developer", "company": "Digital Agency", "start_date": "2020-03", "end_date": "presente"},
                    {"title": "Frontend Developer", "company": "Web Studio", "start_date": "2017-08", "end_date": "2020-02"},
                ],
                "score": 3.9,
            },
            {
                "email": "candidate3@example.com",
                "name": "Laura Fernández",
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

        candidate_objects = []
        for cdata in candidates_data:
            # Create user
            user = User(
                id=uuid4(),
                email=cdata["email"],
                hashed_password=get_password_hash("Candidate123!"),
                full_name=cdata["name"],
                role=UserRole.CANDIDATE,
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(user)
            db.flush()

            # Create candidate profile
            candidate = Candidate(
                id=uuid4(),
                user_id=user.id,
                headline=cdata["headline"],
                location=cdata["location"],
                skills=cdata["skills"],
                experience=cdata["experience"],
                education=[{"degree": "Ingeniería en Sistemas", "institution": "Universidad Nacional", "year": "2016"}],
                languages=[{"language": "Español", "level": "Nativo"}, {"language": "Inglés", "level": "Avanzado"}],
                ai_summary=f"Profesional con experiencia sólida en tecnología. {cdata['headline']}",
                competency_scores={
                    "technical_skills": {"score": cdata["score"], "notes": "Buen dominio técnico"},
                    "communication": {"score": cdata["score"] - 0.2, "notes": "Buena comunicación"},
                    "problem_solving": {"score": cdata["score"] + 0.1, "notes": "Capacidad analítica"},
                    "teamwork": {"score": cdata["score"] - 0.3, "notes": "Trabajo en equipo"},
                    "leadership": {"score": cdata["score"] - 0.5, "notes": "Potencial de liderazgo"},
                },
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(candidate)
            db.flush()
            candidate_objects.append((candidate, cdata["score"]))

            # Create completed interview session
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
                masked_transcript="Entrevista completada con éxito.",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(session)
            db.flush()

            # Create report
            report = CandidateReport(
                id=uuid4(),
                candidate_id=candidate.id,
                session_id=session.id,
                status=ReportStatus.COMPLETED,
                summary=f"Candidato con perfil sólido. {cdata['headline']}. Demuestra experiencia relevante y buenas habilidades.",
                overall_score=cdata["score"],
                confidence_score=85,
                competency_scores=candidate.competency_scores,
                skills_detected=cdata["skills"],
                strengths=["Experiencia técnica sólida", "Buena comunicación", "Actitud proactiva"],
                weaknesses=["Podría mejorar en liderazgo"],
                risks=["Sin riesgos significativos"],
                recommendations=["Adecuado para roles mid-senior", "Considerar para proyectos desafiantes"],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(report)

        # Create sample jobs
        print("💼 Creating sample jobs...")
        jobs_data = [
            {
                "title": "Senior Full Stack Developer",
                "description": """Buscamos un Senior Full Stack Developer para unirse a nuestro equipo de producto.

Responsabilidades:
- Desarrollar y mantener aplicaciones web escalables
- Colaborar con el equipo de producto y diseño
- Implementar buenas prácticas de desarrollo
- Mentorear a desarrolladores junior

Requisitos:
- 5+ años de experiencia en desarrollo web
- Dominio de React, Node.js y bases de datos
- Experiencia con cloud (AWS/GCP)
- Inglés avanzado""",
                "seniority": SeniorityLevel.SENIOR,
                "salary_min": 80000,
                "salary_max": 120000,
                "must_haves": ["React", "Node.js", "PostgreSQL", "5+ años experiencia"],
                "nice_to_haves": ["Docker", "Kubernetes", "AWS"],
            },
            {
                "title": "Data Scientist",
                "description": """Buscamos un Data Scientist para nuestro equipo de analytics.

Responsabilidades:
- Desarrollar modelos de machine learning
- Analizar grandes volúmenes de datos
- Colaborar con equipos de producto
- Presentar insights a stakeholders

Requisitos:
- 3+ años de experiencia en data science
- Python, SQL, herramientas de ML
- Experiencia con visualización de datos
- Habilidades de comunicación""",
                "seniority": SeniorityLevel.MID,
                "salary_min": 60000,
                "salary_max": 90000,
                "must_haves": ["Python", "Machine Learning", "SQL", "3+ años experiencia"],
                "nice_to_haves": ["TensorFlow", "PyTorch", "Spark"],
            },
        ]

        for jdata in jobs_data:
            job = Job(
                id=uuid4(),
                company_id=company.id,
                created_by_id=employer.id,
                title=jdata["title"],
                slug=jdata["title"].lower().replace(" ", "-") + "-" + str(uuid4())[:8],
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
                responsibilities=["Desarrollo de software", "Colaboración con equipos", "Mejora continua"],
                benefits=["Trabajo remoto", "Horario flexible", "Desarrollo profesional"],
                status=JobStatus.ACTIVE,
                rubric_id=default_rubric.id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(job)

        db.commit()
        print("✅ Database seeded successfully!")
        print("\n📧 Test accounts created:")
        print("  Admin: admin@talentos.local / Admin123!")
        print("  Recruiter: recruiter@talentos.local / Recruiter123!")
        print("  Employer: employer@talentos.local / Employer123!")
        print("  Candidates: candidate1@example.com, candidate2@example.com, candidate3@example.com / Candidate123!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
