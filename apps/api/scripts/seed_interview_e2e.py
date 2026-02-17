"""Seed script to create a reproducible E2E interview test scenario.

Usage:
    cd apps/api
    source venv/bin/activate
    python scripts/seed_interview_e2e.py

This creates:
    - A test company "E2E Test Corp"
    - An employer user (hr@e2e-test.com / Test123!)
    - A candidate user (candidate@e2e-test.com / Test123!)
    - A job with rubric (threshold 60)
    - An application with match_score=85 (above threshold)
    - The candidate is ready to start an interview

After running, log in as the candidate and navigate to the interview.
"""

import sys
from pathlib import Path
from uuid import uuid4
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.candidate import Candidate
from app.models.job import Job, JobStatus, JobModality, SeniorityLevel, JobCategory
from app.models.rubric import Rubric, RubricCriteria
from app.models.application import Application, ApplicationStatus


def seed_interview_e2e():
    """Create all entities needed for an E2E interview test."""
    db: Session = SessionLocal()

    try:
        print("=== Seeding Interview E2E Test Data ===\n")

        # 1. Company
        company = db.query(Company).filter(Company.slug == "e2e-test-corp").first()
        if not company:
            company = Company(
                id=uuid4(),
                name="E2E Test Corp",
                slug="e2e-test-corp",
                description="Company for E2E testing",
                industry="Technology",
                size="51-200",
                is_active=True,
                is_client=True,
                client_code="E2E-001",
                match_threshold=60,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(company)
            db.flush()
            print(f"  Created company: {company.name} ({company.id})")
        else:
            print(f"  Company already exists: {company.name}")

        # 2. Rubric
        rubric = db.query(Rubric).filter(Rubric.name == "E2E Test Rubric").first()
        if not rubric:
            rubric = Rubric(
                id=uuid4(),
                name="E2E Test Rubric",
                description="Rubric for E2E interview testing",
                min_score_threshold=60,
                max_candidates_shortlist=10,
                is_active=True,
                is_default=False,
                version=1,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(rubric)
            db.flush()

            criteria_data = [
                ("Technical Skills", "technical", "Evaluate technical knowledge", 0.3),
                ("Communication", "communication", "Evaluate clarity and articulation", 0.25),
                ("Problem Solving", "problem_solving", "Evaluate analytical ability", 0.25),
                ("Cultural Fit", "culture_fit", "Evaluate alignment with values", 0.2),
            ]
            for i, (name, key, desc, weight) in enumerate(criteria_data):
                criteria = RubricCriteria(
                    id=uuid4(),
                    rubric_id=rubric.id,
                    name=name,
                    key=key,
                    description=desc,
                    weight=weight,
                    order=i,
                    min_score=0,
                    max_score=100,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(criteria)
            print(f"  Created rubric: {rubric.name} with 4 criteria")
        else:
            print(f"  Rubric already exists: {rubric.name}")

        # 3. Employer user
        employer = db.query(User).filter(User.email == "hr@e2e-test.com").first()
        if not employer:
            employer = User(
                id=uuid4(),
                email="hr@e2e-test.com",
                hashed_password=get_password_hash("Test123!"),
                full_name="HR Manager E2E",
                role=UserRole.EMPLOYER,
                company_id=company.id,
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(employer)
            db.flush()
            print(f"  Created employer: {employer.email}")
        else:
            print(f"  Employer already exists: {employer.email}")

        # 4. Job
        job = db.query(Job).filter(Job.slug == "e2e-fullstack-dev").first()
        if not job:
            job = Job(
                id=uuid4(),
                company_id=company.id,
                created_by_id=employer.id,
                title="Desarrollador Full Stack (E2E Test)",
                slug="e2e-fullstack-dev",
                description="Puesto de prueba para flujo E2E de entrevista.",
                department="Engineering",
                category=JobCategory.TECHNOLOGY,
                seniority=SeniorityLevel.MID,
                salary_min=50000,
                salary_max=80000,
                salary_currency="USD",
                modality=JobModality.REMOTE,
                location="Remote - LATAM",
                country="Mexico",
                must_haves=["Python", "React", "PostgreSQL", "Docker"],
                nice_to_haves=["FastAPI", "Next.js", "AWS"],
                responsibilities=["Develop features", "Code reviews", "Deploy"],
                benefits=["Remote work", "Health insurance"],
                status=JobStatus.ACTIVE,
                is_featured=False,
                rubric_id=rubric.id,
                match_threshold=60,
                display_company_name="Bloque Internacional",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(job)
            db.flush()
            print(f"  Created job: {job.title} ({job.id})")
        else:
            print(f"  Job already exists: {job.title}")

        # 5. Candidate user
        cand_user = db.query(User).filter(User.email == "candidate@e2e-test.com").first()
        if not cand_user:
            cand_user = User(
                id=uuid4(),
                email="candidate@e2e-test.com",
                hashed_password=get_password_hash("Test123!"),
                full_name="Maria Garcia (E2E Test)",
                role=UserRole.CANDIDATE,
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(cand_user)
            db.flush()
            print(f"  Created candidate user: {cand_user.email}")
        else:
            print(f"  Candidate user already exists: {cand_user.email}")

        # 6. Candidate profile
        candidate = db.query(Candidate).filter(Candidate.user_id == cand_user.id).first()
        if not candidate:
            candidate = Candidate(
                id=uuid4(),
                user_id=cand_user.id,
                headline="Full Stack Developer | Python + React",
                summary="5 years experience building web applications with Python, React, PostgreSQL.",
                skills=["Python", "React", "PostgreSQL", "Docker", "FastAPI", "Next.js"],
                experience=[
                    {
                        "title": "Full Stack Developer",
                        "company": "TechCo",
                        "duration": "3 years",
                        "description": "Built REST APIs and React frontends",
                    },
                    {
                        "title": "Backend Developer",
                        "company": "DataInc",
                        "duration": "2 years",
                        "description": "Python microservices with PostgreSQL",
                    },
                ],
                education=[
                    {
                        "degree": "Computer Science",
                        "institution": "Universidad Nacional",
                        "year": "2019",
                    }
                ],
                location="Ciudad de Mexico",
                years_experience=5,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(candidate)
            db.flush()
            print(f"  Created candidate profile: {candidate.headline}")
        else:
            print(f"  Candidate profile already exists")

        # 7. Application with high match score
        application = db.query(Application).filter(
            Application.candidate_id == candidate.id,
            Application.job_id == job.id,
        ).first()
        if not application:
            application = Application(
                id=uuid4(),
                candidate_id=candidate.id,
                job_id=job.id,
                status=ApplicationStatus.MATCH_PASSED,
                match_score=85.0,
                applied_threshold=60,
                candidate_profile={
                    "skills": candidate.skills,
                    "experience_years": 5,
                    "headline": candidate.headline,
                },
                match_reasons=["Strong Python experience", "React expertise", "PostgreSQL knowledge"],
                match_gaps=["No AWS certification"],
                resume_filename="maria_garcia_cv.pdf",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(application)
            db.flush()
            print(f"  Created application: score={application.match_score}, status={application.status.value}")
        else:
            print(f"  Application already exists: score={application.match_score}")

        db.commit()

        print("\n=== E2E Interview Seed Complete ===")
        print(f"\nCredentials:")
        print(f"  Candidate: candidate@e2e-test.com / Test123!")
        print(f"  Employer:  hr@e2e-test.com / Test123!")
        print(f"  Admin:     Use existing admin account")
        print(f"\nJob ID: {job.id}")
        print(f"Application ID: {application.id}")
        print(f"Match Score: {application.match_score} (threshold: 60)")
        print(f"\nNext steps:")
        print(f"  1. Log in as candidate@e2e-test.com")
        print(f"  2. Navigate to the job and start interview")
        print(f"  3. Complete all questions")
        print(f"  4. Check transcript/scoring in admin panel")

    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_interview_e2e()
