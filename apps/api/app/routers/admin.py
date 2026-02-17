"""Admin and recruiter endpoints."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.rubric import Rubric, RubricCriteria
from app.models.candidate import Candidate
from app.models.job import Job, JobStatus
from app.models.interview import InterviewSession, InterviewStatus
from app.models.report import CandidateReport, ReportStatus
from app.models.shortlist import ShortlistItem, ShortlistStatus
from app.models.audit import AuditLog
from app.schemas.rubric import (
    RubricCreate,
    RubricUpdate,
    RubricResponse,
    RubricCriteriaResponse,
    RubricSimulationRequest,
    RubricSimulationResponse,
)
from app.schemas.report import CandidateReportResponse, ReportOverrideRequest
from app.schemas.interview import InterviewSessionForReview
from app.schemas.dashboard import DashboardKPIs
from app.services.ranking import rank_candidates_for_job
from app.services.audit import log_rubric_change, log_score_override
from app.utils.deps import get_current_user, require_recruiter, require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


# ============ Rubrics ============


@router.get("/rubrics", response_model=list[RubricResponse])
async def list_rubrics(
    include_inactive: bool = False,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> list[Rubric]:
    """List all rubrics."""
    query = db.query(Rubric)
    if not include_inactive:
        query = query.filter(Rubric.is_active == True)
    return query.order_by(Rubric.name).all()


@router.post("/rubrics", response_model=RubricResponse, status_code=status.HTTP_201_CREATED)
async def create_rubric(
    request: RubricCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Rubric:
    """Create a new rubric."""
    rubric = Rubric(
        name=request.name,
        description=request.description,
        min_score_threshold=request.min_score_threshold,
        max_candidates_shortlist=request.max_candidates_shortlist,
    )
    db.add(rubric)
    db.flush()

    # Add criteria
    for i, criteria_data in enumerate(request.criteria):
        criteria = RubricCriteria(
            rubric_id=rubric.id,
            name=criteria_data.name,
            key=criteria_data.key,
            description=criteria_data.description,
            weight=criteria_data.weight,
            order=i,
            min_score=criteria_data.min_score,
            max_score=criteria_data.max_score,
            scoring_guidelines=criteria_data.scoring_guidelines,
        )
        db.add(criteria)

    db.commit()
    db.refresh(rubric)

    # Log audit
    log_rubric_change(
        db=db,
        user_id=current_user.id,
        rubric_id=rubric.id,
        action="create",
        old_values={},
        new_values={"name": rubric.name, "criteria_count": len(request.criteria)},
    )

    return rubric


@router.get("/rubrics/{rubric_id}", response_model=RubricResponse)
async def get_rubric(
    rubric_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> Rubric:
    """Get rubric details."""
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rúbrica no encontrada",
        )
    return rubric


@router.patch("/rubrics/{rubric_id}", response_model=RubricResponse)
async def update_rubric(
    rubric_id: UUID,
    request: RubricUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Rubric:
    """Update a rubric (creates new version)."""
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rúbrica no encontrada",
        )

    old_values = {
        "name": rubric.name,
        "min_score_threshold": rubric.min_score_threshold,
        "max_candidates_shortlist": rubric.max_candidates_shortlist,
    }

    # Update basic fields
    if request.name is not None:
        rubric.name = request.name
    if request.description is not None:
        rubric.description = request.description
    if request.min_score_threshold is not None:
        rubric.min_score_threshold = request.min_score_threshold
    if request.max_candidates_shortlist is not None:
        rubric.max_candidates_shortlist = request.max_candidates_shortlist
    if request.is_active is not None:
        rubric.is_active = request.is_active

    # Update criteria if provided
    if request.criteria is not None:
        # Delete existing criteria
        db.query(RubricCriteria).filter(RubricCriteria.rubric_id == rubric.id).delete()

        # Add new criteria
        for i, criteria_data in enumerate(request.criteria):
            criteria = RubricCriteria(
                rubric_id=rubric.id,
                name=criteria_data.name,
                key=criteria_data.key,
                description=criteria_data.description,
                weight=criteria_data.weight,
                order=i,
                min_score=criteria_data.min_score,
                max_score=criteria_data.max_score,
                scoring_guidelines=criteria_data.scoring_guidelines,
            )
            db.add(criteria)

    rubric.version += 1
    db.commit()
    db.refresh(rubric)

    # Log audit
    new_values = {
        "name": rubric.name,
        "min_score_threshold": rubric.min_score_threshold,
        "max_candidates_shortlist": rubric.max_candidates_shortlist,
        "version": rubric.version,
    }
    log_rubric_change(
        db=db,
        user_id=current_user.id,
        rubric_id=rubric.id,
        action="update",
        old_values=old_values,
        new_values=new_values,
    )

    return rubric


@router.post("/rubrics/{rubric_id}/simulate", response_model=RubricSimulationResponse)
async def simulate_rubric(
    rubric_id: UUID,
    request: RubricSimulationRequest,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> RubricSimulationResponse:
    """Simulate rubric changes and see impact on rankings."""
    rubric = db.query(Rubric).filter(Rubric.id == rubric_id).first()
    if not rubric:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rúbrica no encontrada",
        )

    job = db.query(Job).filter(Job.id == request.job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trabajo no encontrado",
        )

    # Get original ranking
    original_ranked = rank_candidates_for_job(db, job, 10)
    original_ranking = [
        {
            "candidate_id": str(r["candidate"].id),
            "rank": i + 1,
            "score": r["total_score"],
        }
        for i, r in enumerate(original_ranked)
    ]

    # Apply weight changes temporarily
    for criteria in rubric.criteria:
        if criteria.key in request.criteria_weights:
            criteria.weight = request.criteria_weights[criteria.key]

    # Get new ranking
    new_ranked = rank_candidates_for_job(db, job, 10)
    new_ranking = [
        {
            "candidate_id": str(r["candidate"].id),
            "rank": i + 1,
            "score": r["total_score"],
        }
        for i, r in enumerate(new_ranked)
    ]

    # Rollback weight changes
    db.rollback()

    # Calculate changes
    changes = []
    original_positions = {r["candidate_id"]: r["rank"] for r in original_ranking}
    for new in new_ranking:
        cid = new["candidate_id"]
        if cid in original_positions:
            old_rank = original_positions[cid]
            new_rank = new["rank"]
            if old_rank != new_rank:
                changes.append({
                    "candidate_id": cid,
                    "old_rank": old_rank,
                    "new_rank": new_rank,
                    "change": old_rank - new_rank,
                })

    return RubricSimulationResponse(
        original_ranking=original_ranking,
        new_ranking=new_ranking,
        changes=changes,
    )


# ============ Interview Review ============


def format_interview_for_review(session: InterviewSession) -> dict:
    """Transform InterviewSession to InterviewSessionForReview format."""
    # Build transcript from messages
    transcript = []
    for msg in session.messages:
        role = "assistant" if msg.role.value in ["AI", "SYSTEM"] else "user"
        transcript.append({
            "role": role,
            "content": msg.content,
            "timestamp": msg.created_at.isoformat() if msg.created_at else None,
        })

    # Get latest report if any
    report = None
    if session.reports:
        latest_report = sorted(session.reports, key=lambda r: r.created_at, reverse=True)[0]
        report = {
            "id": str(latest_report.id),
            "overall_score": latest_report.overall_score if latest_report.overall_score is not None else 0.0,
            "summary": latest_report.summary,
            "confidence_score": latest_report.confidence_score if latest_report.confidence_score is not None else 0,
            "score_overridden": latest_report.score_overridden or False,
            "original_score": latest_report.original_score,
            "competency_scores": latest_report.competency_scores or {},
        }

    # Build candidate info
    candidate_info = None
    if session.candidate:
        user_info = None
        if session.candidate.user:
            user_info = {
                "full_name": session.candidate.user.full_name,
                "email": session.candidate.user.email,
            }
        candidate_info = {
            "id": str(session.candidate.id),
            "user": user_info,
        }

    # Calculate duration in minutes
    duration_minutes = None
    if session.duration_seconds:
        duration_minutes = session.duration_seconds // 60

    return {
        "id": str(session.id),
        "candidate_id": str(session.candidate_id),
        "job_id": str(session.job_id) if session.job_id else None,
        "status": session.status.value if hasattr(session.status, 'value') else str(session.status),
        "current_question_index": session.current_question_index,
        "total_questions": session.total_questions,
        "interview_type": session.interview_type,
        "language": session.language,
        "started_at": session.started_at if session.started_at else None,
        "completed_at": session.completed_at if session.completed_at else None,
        "duration_seconds": session.duration_seconds,
        "has_inconsistencies": session.has_inconsistencies,
        "confidence_score": session.confidence_score,
        "requires_review": session.requires_review,
        "messages": [
            {
                "role": msg.role.value if hasattr(msg.role, 'value') else str(msg.role),
                "content": msg.content,
                "sequence": msg.sequence,
                "question_id": msg.question_id,
            }
            for msg in session.messages
        ],
        "masked_transcript": session.masked_transcript,
        "ai_analysis": session.ai_analysis or {},
        "candidate_name": session.candidate.user.full_name if session.candidate and session.candidate.user else None,
        "job_title": session.job.title if session.job else None,
        # New fields for frontend
        "candidate": candidate_info,
        "report": report,
        "transcript": transcript,
        "total_messages": len(session.messages),
        "duration_minutes": duration_minutes,
    }


@router.get("/interviews")
async def list_interviews(
    status_filter: Optional[str] = Query(None, description="Filter by status: COMPLETED, IN_PROGRESS, ALL"),
    flagged_only: bool = Query(False, description="Only show flagged interviews"),
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> list[dict]:
    """List all interviews with optional filters."""
    import structlog
    from sqlalchemy.orm import joinedload
    logger = structlog.get_logger()

    query = db.query(InterviewSession).options(
        joinedload(InterviewSession.candidate).joinedload(Candidate.user),
        joinedload(InterviewSession.messages),
        joinedload(InterviewSession.reports),
        joinedload(InterviewSession.job),
    )

    # Apply status filter
    if status_filter and status_filter != "ALL":
        if status_filter == "COMPLETED":
            query = query.filter(InterviewSession.status == InterviewStatus.COMPLETED)
        elif status_filter == "IN_PROGRESS":
            query = query.filter(InterviewSession.status == InterviewStatus.IN_PROGRESS)

    # Apply flagged filter
    if flagged_only:
        query = query.filter(InterviewSession.requires_review == True)

    interviews = query.order_by(InterviewSession.created_at.desc()).limit(limit).all()

    logger.info("admin_list_interviews", count=len(interviews), status_filter=status_filter, flagged_only=flagged_only)

    return [format_interview_for_review(i) for i in interviews]


@router.get("/interviews/flagged")
async def get_flagged_interviews(
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Get interviews flagged for review."""
    from sqlalchemy.orm import joinedload

    interviews = (
        db.query(InterviewSession)
        .options(
            joinedload(InterviewSession.candidate).joinedload(Candidate.user),
            joinedload(InterviewSession.messages),
            joinedload(InterviewSession.reports),
            joinedload(InterviewSession.job),
        )
        .filter(InterviewSession.requires_review == True)
        .filter(InterviewSession.status == InterviewStatus.COMPLETED)
        .order_by(InterviewSession.completed_at.desc())
        .limit(50)
        .all()
    )

    return [format_interview_for_review(i) for i in interviews]


@router.get("/interviews/{session_id}")
async def get_interview_for_review(
    session_id: UUID,
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> dict:
    """Get interview details for review."""
    from sqlalchemy.orm import joinedload

    session = (
        db.query(InterviewSession)
        .options(
            joinedload(InterviewSession.candidate).joinedload(Candidate.user),
            joinedload(InterviewSession.messages),
            joinedload(InterviewSession.reports),
            joinedload(InterviewSession.job),
        )
        .filter(InterviewSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión no encontrada",
        )
    return format_interview_for_review(session)


# ============ Score Override ============


@router.post("/reports/{report_id}/override", response_model=CandidateReportResponse)
async def override_report_score(
    report_id: UUID,
    request: ReportOverrideRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> CandidateReport:
    """Override a candidate report score."""
    report = db.query(CandidateReport).filter(CandidateReport.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reporte no encontrado",
        )

    original_score = report.overall_score

    report.original_score = original_score
    report.overall_score = request.new_score
    report.score_overridden = True
    report.override_reason = request.reason
    report.reviewed_by_id = current_user.id

    db.commit()
    db.refresh(report)

    # Log audit
    log_score_override(
        db=db,
        user_id=current_user.id,
        report_id=report.id,
        original_score=original_score or 0,
        new_score=request.new_score,
        reason=request.reason,
    )

    return report


# ============ Dashboard KPIs ============


@router.get("/dashboard/kpis", response_model=DashboardKPIs)
async def get_dashboard_kpis(
    current_user: User = Depends(require_recruiter),
    db: Session = Depends(get_db),
) -> DashboardKPIs:
    """Get dashboard KPIs."""
    # Candidate metrics
    total_candidates = db.query(Candidate).count()
    candidates_with_interviews = (
        db.query(Candidate)
        .join(InterviewSession)
        .distinct()
        .count()
    )
    interviews_completed = (
        db.query(InterviewSession)
        .filter(InterviewSession.status == InterviewStatus.COMPLETED)
        .count()
    )
    interviews_in_progress = (
        db.query(InterviewSession)
        .filter(InterviewSession.status == InterviewStatus.IN_PROGRESS)
        .count()
    )

    # Job metrics
    active_jobs = db.query(Job).filter(Job.status == JobStatus.ACTIVE).count()

    # Shortlist metrics
    shortlists_generated = db.query(ShortlistItem.job_id).distinct().count()
    candidates_shortlisted = db.query(ShortlistItem).count()
    candidates_contacted = (
        db.query(ShortlistItem)
        .filter(ShortlistItem.status.in_([
            ShortlistStatus.CONTACTED,
            ShortlistStatus.INTERVIEW_SCHEDULED,
            ShortlistStatus.HIRED,
        ]))
        .count()
    )
    candidates_hired = (
        db.query(ShortlistItem)
        .filter(ShortlistItem.status == ShortlistStatus.HIRED)
        .count()
    )

    # Average scores
    avg_score_result = (
        db.query(func.avg(CandidateReport.overall_score))
        .filter(CandidateReport.status == ReportStatus.COMPLETED)
        .scalar()
    )
    avg_interview_score = float(avg_score_result) if avg_score_result else None

    # Flagged interviews
    flagged_interviews_count = (
        db.query(InterviewSession)
        .filter(InterviewSession.requires_review == True)
        .count()
    )

    # Score overrides
    score_overrides_count = (
        db.query(CandidateReport)
        .filter(CandidateReport.score_overridden == True)
        .count()
    )

    # Conversion rates
    interview_completion_rate = None
    if candidates_with_interviews > 0:
        interview_completion_rate = interviews_completed / candidates_with_interviews

    shortlist_to_contact_rate = None
    if candidates_shortlisted > 0:
        shortlist_to_contact_rate = candidates_contacted / candidates_shortlisted

    contact_to_hire_rate = None
    if candidates_contacted > 0:
        contact_to_hire_rate = candidates_hired / candidates_contacted

    return DashboardKPIs(
        total_candidates=total_candidates,
        candidates_with_interviews=candidates_with_interviews,
        interviews_completed=interviews_completed,
        interviews_in_progress=interviews_in_progress,
        active_jobs=active_jobs,
        total_applications=0,  # Would need applications table
        shortlists_generated=shortlists_generated,
        candidates_shortlisted=candidates_shortlisted,
        candidates_contacted=candidates_contacted,
        candidates_hired=candidates_hired,
        interview_completion_rate=interview_completion_rate,
        shortlist_to_contact_rate=shortlist_to_contact_rate,
        contact_to_hire_rate=contact_to_hire_rate,
        avg_interview_score=avg_interview_score,
        flagged_interviews_count=flagged_interviews_count,
        score_overrides_count=score_overrides_count,
    )


# ============ Audit Logs ============


@router.get("/audit-logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Get audit logs."""
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()

    return [
        {
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id),
            "action": log.action,
            "description": log.description,
            "old_values": log.old_values,
            "new_values": log.new_values,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


# ============ Data Seeding ============


@router.post("/seed/jobs")
async def seed_jobs(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Seed the database with sample jobs. Admin only."""
    import structlog
    from app.models.company import Company
    from app.models.rubric import Rubric
    from app.core.security import get_password_hash
    from uuid import uuid4
    from datetime import datetime
    import random

    logger = structlog.get_logger()
    logger.info("admin_seed_jobs_started", user_id=str(current_user.id))

    # Check if default rubric exists
    rubric = db.query(Rubric).filter(Rubric.is_default == True).first()
    if not rubric:
        return {"success": False, "message": "No default rubric found. Run seed.py first."}

    # Import job templates from seed script
    from app.models.job import JobStatus, JobModality, SeniorityLevel, JobCategory

    # Sample companies
    COMPANIES = [
        {"name": "TechNova Solutions", "slug": "technova-solutions", "industry": "Tecnologia", "description": "Empresa lider en desarrollo de software.", "size": "201-500"},
        {"name": "MediCare Plus", "slug": "medicare-plus", "industry": "Salud", "description": "Red de clinicas y hospitales.", "size": "501-1000"},
        {"name": "Legal Partners International", "slug": "legal-partners", "industry": "Legal", "description": "Firma de abogados corporativos.", "size": "51-200"},
        {"name": "IndustriaMex", "slug": "industriamex", "industry": "Manufactura", "description": "Fabricante de componentes automotrices.", "size": "1001-5000"},
        {"name": "Banco Financiero Central", "slug": "banco-financiero", "industry": "Finanzas", "description": "Institucion financiera.", "size": "1001-5000"},
        {"name": "Sonrisas Dental Group", "slug": "sonrisas-dental", "industry": "Dental", "description": "Red de clinicas dentales.", "size": "51-200"},
    ]

    # Sample job templates
    JOB_TEMPLATES = [
        {"title": "Desarrollador Full Stack", "category": JobCategory.TECHNOLOGY, "salary": (45000, 90000), "must_haves": ["JavaScript", "React", "Node.js"]},
        {"title": "Desarrollador Backend Python", "category": JobCategory.TECHNOLOGY, "salary": (50000, 95000), "must_haves": ["Python", "FastAPI", "PostgreSQL"]},
        {"title": "Data Engineer", "category": JobCategory.TECHNOLOGY, "salary": (55000, 100000), "must_haves": ["Python", "SQL", "ETL"]},
        {"title": "Medico General", "category": JobCategory.HEALTHCARE, "salary": (50000, 90000), "must_haves": ["Titulo de medicina", "Cedula profesional"]},
        {"title": "Enfermero/a Registrado/a", "category": JobCategory.HEALTHCARE, "salary": (30000, 55000), "must_haves": ["Licenciatura en enfermeria"]},
        {"title": "Abogado Corporativo", "category": JobCategory.LEGAL, "salary": (50000, 100000), "must_haves": ["Titulo de abogado", "Derecho corporativo"]},
        {"title": "Contador Publico", "category": JobCategory.FINANCE, "salary": (35000, 65000), "must_haves": ["Titulo de contador", "Contabilidad"]},
        {"title": "Ingeniero de Produccion", "category": JobCategory.MANUFACTURING, "salary": (40000, 75000), "must_haves": ["Ingenieria industrial", "Lean Manufacturing"]},
        {"title": "Dentista General", "category": JobCategory.DENTAL, "salary": (40000, 80000), "must_haves": ["Titulo de odontologo", "Cedula profesional"]},
        {"title": "Ortodoncista", "category": JobCategory.DENTAL, "salary": (70000, 130000), "must_haves": ["Especialidad en ortodoncia"]},
        {"title": "Ejecutivo de Ventas", "category": JobCategory.SALES, "salary": (25000, 50000), "must_haves": ["Ventas", "Negociacion"]},
        {"title": "Gerente de Marketing", "category": JobCategory.MARKETING, "salary": (60000, 100000), "must_haves": ["Estrategia de marketing", "Presupuestos"]},
        {"title": "Reclutador/a", "category": JobCategory.HUMAN_RESOURCES, "salary": (25000, 45000), "must_haves": ["Reclutamiento", "Entrevistas"]},
        {"title": "Coordinador de Logistica", "category": JobCategory.LOGISTICS, "salary": (30000, 50000), "must_haves": ["Logistica", "Supply chain"]},
        {"title": "Ingeniero Mecanico", "category": JobCategory.ENGINEERING, "salary": (40000, 75000), "must_haves": ["Ingenieria mecanica", "AutoCAD"]},
    ]

    LOCATIONS = [
        ("Ciudad de Mexico, CDMX", "Mexico"),
        ("Guadalajara, Jalisco", "Mexico"),
        ("Monterrey, Nuevo Leon", "Mexico"),
        ("Remote - Mexico", "Mexico"),
        ("Remote - LATAM", "LATAM"),
    ]

    jobs_created = 0

    try:
        # Create companies and employers
        for comp_data in COMPANIES:
            company = db.query(Company).filter(Company.slug == comp_data["slug"]).first()
            if not company:
                company = Company(
                    id=uuid4(),
                    name=comp_data["name"],
                    slug=comp_data["slug"],
                    description=comp_data["description"],
                    industry=comp_data["industry"],
                    size=comp_data["size"],
                    website=f"https://{comp_data['slug']}.com",
                    is_active=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(company)
                db.flush()

            # Create employer for company
            email = f"hr@{comp_data['slug']}.com"
            employer = db.query(User).filter(User.email == email).first()
            if not employer:
                employer = User(
                    id=uuid4(),
                    email=email,
                    hashed_password=get_password_hash("Employer123!"),
                    full_name=f"HR Manager - {comp_data['name']}",
                    role=UserRole.EMPLOYER,
                    company_id=company.id,
                    is_active=True,
                    is_verified=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(employer)
                db.flush()

            # Create jobs for this company
            for template in JOB_TEMPLATES:
                for _ in range(random.randint(2, 4)):
                    seniority = random.choice([SeniorityLevel.JUNIOR, SeniorityLevel.MID, SeniorityLevel.SENIOR])
                    modality = random.choice([JobModality.REMOTE, JobModality.HYBRID, JobModality.ONSITE])
                    location_data = random.choice(LOCATIONS)

                    # Check if job exists
                    existing = db.query(Job).filter(
                        Job.company_id == company.id,
                        Job.title == template["title"],
                        Job.seniority == seniority,
                        Job.location == location_data[0]
                    ).first()

                    if existing:
                        continue

                    job = Job(
                        id=uuid4(),
                        company_id=company.id,
                        created_by_id=employer.id,
                        title=template["title"],
                        slug=f"{template['title'].lower().replace(' ', '-')}-{str(uuid4())[:8]}",
                        description=f"Buscamos {template['title']} para unirse a nuestro equipo en {company.name}.",
                        department=template["category"].value.replace("_", " ").title(),
                        category=template["category"],
                        seniority=seniority,
                        salary_min=template["salary"][0],
                        salary_max=template["salary"][1],
                        salary_currency="USD",
                        modality=modality,
                        location=location_data[0],
                        country=location_data[1],
                        must_haves=template["must_haves"],
                        nice_to_haves=[],
                        responsibilities=[],
                        benefits=["Trabajo remoto", "Seguro de gastos medicos", "Bono anual"],
                        status=JobStatus.ACTIVE,
                        is_featured=random.random() > 0.9,
                        rubric_id=rubric.id,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                    )
                    db.add(job)
                    jobs_created += 1

        db.commit()
        logger.info("admin_seed_jobs_completed", jobs_created=jobs_created)

        return {
            "success": True,
            "message": f"Seed completado. {jobs_created} trabajos creados.",
            "jobs_created": jobs_created,
        }

    except Exception as e:
        db.rollback()
        logger.error("admin_seed_jobs_error", error=str(e))
        return {"success": False, "message": f"Error: {str(e)}"}


# ============ System Settings ============


@router.get("/settings")
async def list_settings(
    category: Optional[str] = Query(None, description="Filter by category"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict]:
    """List all system settings."""
    from app.models.settings import SystemSettings

    query = db.query(SystemSettings)
    if category:
        query = query.filter(SystemSettings.category == category)

    settings_list = query.order_by(SystemSettings.category, SystemSettings.key).all()

    return [
        {
            "id": str(s.id),
            "key": s.key,
            "value": s.value,
            "value_int": s.value_int,
            "value_bool": s.value_bool,
            "value_json": s.value_json,
            "description": s.description,
            "category": s.category,
            "is_editable": s.is_editable,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in settings_list
    ]


@router.get("/settings/{key}")
async def get_setting(
    key: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Get a specific setting by key."""
    from app.models.settings import SystemSettings

    setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuracion no encontrada"
        )

    return {
        "id": str(setting.id),
        "key": setting.key,
        "value": setting.value,
        "value_int": setting.value_int,
        "value_bool": setting.value_bool,
        "value_json": setting.value_json,
        "description": setting.description,
        "category": setting.category,
        "is_editable": setting.is_editable,
    }


@router.patch("/settings/{key}")
async def update_setting(
    key: str,
    value: Optional[str] = Query(None),
    value_int: Optional[int] = Query(None),
    value_bool: Optional[bool] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Update a system setting."""
    from app.models.settings import SystemSettings
    from datetime import datetime

    setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuracion no encontrada"
        )

    if not setting.is_editable:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta configuracion no se puede editar"
        )

    # Update the appropriate value field
    if value is not None:
        setting.value = value
    if value_int is not None:
        setting.value_int = value_int
    if value_bool is not None:
        setting.value_bool = value_bool

    setting.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(setting)

    import structlog
    structlog.get_logger().info("setting_updated", key=key, by=str(current_user.id))

    return {
        "success": True,
        "key": setting.key,
        "value": setting.value,
        "value_int": setting.value_int,
        "value_bool": setting.value_bool,
    }


# ============ Enhanced Dashboard with Filters ============


@router.get("/dashboard/metrics")
async def get_dashboard_metrics(
    client_id: Optional[UUID] = Query(None, description="Filter by client/company"),
    job_id: Optional[UUID] = Query(None, description="Filter by specific job"),
    category: Optional[str] = Query(None, description="Filter by job category"),
    location: Optional[str] = Query(None, description="Filter by location"),
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    status_filter: Optional[str] = Query(None, description="Filter by application status"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Get dashboard metrics with filters."""
    from app.models.application import Application, ApplicationStatus
    from app.models.job import Job, JobStatus, JobCategory
    from app.models.interview import InterviewSession, InterviewStatus
    from app.models.shortlist import ShortlistItem
    from app.models.company import Company
    from app.models.settings import SystemSettings
    from datetime import datetime, timedelta
    from sqlalchemy import func

    # Parse dates
    start_date = None
    end_date = None
    if date_from:
        try:
            start_date = datetime.strptime(date_from, "%Y-%m-%d")
        except ValueError:
            pass
    if date_to:
        try:
            end_date = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
        except ValueError:
            pass

    # Get system threshold
    system_threshold = SystemSettings.get_int(db, 'default_match_threshold', 70)

    # Build base queries with filters
    apps_query = db.query(Application).join(Job)

    if client_id:
        apps_query = apps_query.filter(Job.company_id == client_id)
    if job_id:
        apps_query = apps_query.filter(Application.job_id == job_id)
    if category:
        try:
            cat_enum = JobCategory(category.upper())
            apps_query = apps_query.filter(Job.category == cat_enum)
        except ValueError:
            pass
    if location:
        apps_query = apps_query.filter(Job.location.ilike(f"%{location}%"))
    if start_date:
        apps_query = apps_query.filter(Application.created_at >= start_date)
    if end_date:
        apps_query = apps_query.filter(Application.created_at < end_date)
    if status_filter:
        try:
            status_enum = ApplicationStatus(status_filter)
            apps_query = apps_query.filter(Application.status == status_enum)
        except ValueError:
            pass

    # Calculate metrics
    total_applications = apps_query.count()

    # Applications above threshold
    above_threshold = apps_query.filter(
        Application.match_score >= system_threshold
    ).count()

    # Interviews started
    interviews_started = apps_query.filter(
        Application.status.in_([
            ApplicationStatus.INTERVIEW_STARTED,
            ApplicationStatus.INTERVIEW_COMPLETED,
            ApplicationStatus.COMPLETED
        ])
    ).count()

    # Interviews completed
    interviews_completed = apps_query.filter(
        Application.status.in_([
            ApplicationStatus.INTERVIEW_COMPLETED,
            ApplicationStatus.COMPLETED
        ])
    ).count()

    # Shortlisted
    shortlist_query = db.query(ShortlistItem).join(Job)
    if client_id:
        shortlist_query = shortlist_query.filter(Job.company_id == client_id)
    if job_id:
        shortlist_query = shortlist_query.filter(ShortlistItem.job_id == job_id)
    shortlisted = shortlist_query.count()

    # Active jobs
    jobs_query = db.query(Job).filter(Job.status == JobStatus.ACTIVE)
    if client_id:
        jobs_query = jobs_query.filter(Job.company_id == client_id)
    if category:
        try:
            cat_enum = JobCategory(category.upper())
            jobs_query = jobs_query.filter(Job.category == cat_enum)
        except ValueError:
            pass
    active_jobs = jobs_query.count()

    # Applications by status
    status_breakdown = {}
    for s in ApplicationStatus:
        count_query = apps_query.filter(Application.status == s)
        # Need to re-apply filters since we're creating new queries
        status_breakdown[s.value] = db.query(Application).join(Job).filter(
            Application.status == s
        )
        if client_id:
            status_breakdown[s.value] = status_breakdown[s.value].filter(Job.company_id == client_id)
        if job_id:
            status_breakdown[s.value] = status_breakdown[s.value].filter(Application.job_id == job_id)
        if start_date:
            status_breakdown[s.value] = status_breakdown[s.value].filter(Application.created_at >= start_date)
        if end_date:
            status_breakdown[s.value] = status_breakdown[s.value].filter(Application.created_at < end_date)
        status_breakdown[s.value] = status_breakdown[s.value].count()

    # Get clients for filter dropdown
    clients = db.query(Company).filter(Company.is_active == True).order_by(Company.name).all()

    return {
        "metrics": {
            "total_applications": total_applications,
            "above_threshold": above_threshold,
            "threshold_rate": round(above_threshold / total_applications * 100, 1) if total_applications > 0 else 0,
            "interviews_started": interviews_started,
            "interviews_completed": interviews_completed,
            "completion_rate": round(interviews_completed / interviews_started * 100, 1) if interviews_started > 0 else 0,
            "shortlisted": shortlisted,
            "active_jobs": active_jobs,
        },
        "status_breakdown": status_breakdown,
        "filters_applied": {
            "client_id": str(client_id) if client_id else None,
            "job_id": str(job_id) if job_id else None,
            "category": category,
            "location": location,
            "date_from": date_from,
            "date_to": date_to,
            "status": status_filter,
        },
        "filter_options": {
            "clients": [
                {"id": str(c.id), "name": c.name}
                for c in clients
            ],
            "statuses": [s.value for s in ApplicationStatus],
            "categories": [c.value for c in JobCategory],
        },
        "system_threshold": system_threshold,
    }


@router.get("/dashboard/export.csv")
async def export_dashboard_csv(
    client_id: Optional[UUID] = Query(None),
    job_id: Optional[UUID] = Query(None),
    category: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Export filtered dashboard data as CSV."""
    import csv
    import io
    from fastapi.responses import StreamingResponse
    from app.models.application import Application, ApplicationStatus
    from app.models.job import Job, JobCategory
    from app.models.candidate import Candidate
    from datetime import datetime, timedelta

    # Parse dates
    start_date = None
    end_date = None
    if date_from:
        try:
            start_date = datetime.strptime(date_from, "%Y-%m-%d")
        except ValueError:
            pass
    if date_to:
        try:
            end_date = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
        except ValueError:
            pass

    # Build query with filters
    query = db.query(Application).join(Job).join(Candidate)

    if client_id:
        query = query.filter(Job.company_id == client_id)
    if job_id:
        query = query.filter(Application.job_id == job_id)
    if category:
        try:
            cat_enum = JobCategory(category.upper())
            query = query.filter(Job.category == cat_enum)
        except ValueError:
            pass
    if start_date:
        query = query.filter(Application.created_at >= start_date)
    if end_date:
        query = query.filter(Application.created_at < end_date)
    if status_filter:
        try:
            status_enum = ApplicationStatus(status_filter)
            query = query.filter(Application.status == status_enum)
        except ValueError:
            pass

    applications = query.order_by(Application.created_at.desc()).limit(1000).all()

    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Application ID",
        "Created At",
        "Job Title",
        "Job Category",
        "Company",
        "Location",
        "Candidate Headline",
        "Match Score",
        "Applied Threshold",
        "Status",
        "Has Interview",
    ])

    for app in applications:
        writer.writerow([
            str(app.id),
            app.created_at.isoformat() if app.created_at else "",
            app.job.title if app.job else "",
            app.job.category.value if app.job and app.job.category else "",
            app.job.company.name if app.job and app.job.company else "",
            app.job.location if app.job else "",
            app.candidate.headline if app.candidate else "",
            app.match_score or "",
            app.applied_threshold or "",
            app.status.value,
            "Yes" if app.interview_session_id else "No",
        ])

    output.seek(0)

    # Generate filename with date
    filename = f"dashboard_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        },
    )


# ============ Placements Management ============


@router.get("/placements")
async def list_placements(
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    type_filter: Optional[str] = Query(None, description="Filter by placement type"),
    date_from: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """List all placements with filters."""
    from app.models.placement import Placement, PlacementStatus, PlacementType
    from app.models.company import Company
    from app.models.candidate import Candidate
    from app.models.job import Job
    from sqlalchemy.orm import joinedload
    from datetime import datetime, timedelta

    query = db.query(Placement).options(
        joinedload(Placement.candidate).joinedload(Candidate.user),
        joinedload(Placement.client),
        joinedload(Placement.job),
    )

    if client_id:
        query = query.filter(Placement.client_id == client_id)
    if status_filter:
        try:
            status_enum = PlacementStatus(status_filter.upper())
            query = query.filter(Placement.status == status_enum)
        except ValueError:
            pass
    if type_filter:
        try:
            type_enum = PlacementType(type_filter.upper())
            query = query.filter(Placement.placement_type == type_enum)
        except ValueError:
            pass

    # Date filters
    if date_from:
        try:
            start_date = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(Placement.start_date >= start_date)
        except ValueError:
            pass
    if date_to:
        try:
            end_date = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Placement.start_date < end_date)
        except ValueError:
            pass

    total = query.count()
    placements = (
        query
        .order_by(Placement.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Get clients for filter dropdown
    clients = db.query(Company).filter(Company.is_client == True).order_by(Company.name).all()

    return {
        "items": [
            {
                "id": str(p.id),
                "candidate_id": str(p.candidate_id),
                "candidate_name": p.candidate.user.full_name if p.candidate and p.candidate.user else None,
                "client_id": str(p.client_id),
                "client_name": p.client.name if p.client else None,
                "job_id": str(p.job_id) if p.job_id else None,
                "job_title": p.job.title if p.job else None,
                "position_title": p.position_title,
                "department": p.department,
                "location": p.location,
                "placement_type": p.placement_type.value,
                "status": p.status.value,
                "start_date": p.start_date.isoformat() if p.start_date else None,
                "end_date": p.end_date.isoformat() if p.end_date else None,
                "salary_amount": p.salary_amount,
                "salary_currency": p.salary_currency,
                "salary_period": p.salary_period,
                "notes": p.notes,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in placements
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "filter_options": {
            "clients": [{"id": str(c.id), "name": c.name} for c in clients],
            "statuses": [s.value for s in PlacementStatus],
            "types": [t.value for t in PlacementType],
        },
    }


@router.get("/placements/report")
async def placements_report(
    client_id: Optional[UUID] = Query(None, description="Filter by client"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Get placement report by client."""
    from app.models.placement import Placement, PlacementStatus
    from app.models.company import Company
    from datetime import datetime, timedelta
    from sqlalchemy import func

    # Parse dates
    start_date = None
    end_date = None
    if date_from:
        try:
            start_date = datetime.strptime(date_from, "%Y-%m-%d")
        except ValueError:
            pass
    if date_to:
        try:
            end_date = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
        except ValueError:
            pass

    # Build query
    query = db.query(Placement)
    if client_id:
        query = query.filter(Placement.client_id == client_id)
    if start_date:
        query = query.filter(Placement.start_date >= start_date)
    if end_date:
        query = query.filter(Placement.start_date < end_date)

    # Active placements
    active_count = query.filter(Placement.status == PlacementStatus.ACTIVE).count()

    # Completed in period
    completed_count = query.filter(Placement.status == PlacementStatus.COMPLETED).count()

    # By client breakdown
    by_client = (
        db.query(
            Company.name,
            func.count(Placement.id).label("count")
        )
        .join(Placement, Placement.client_id == Company.id)
        .filter(Placement.status == PlacementStatus.ACTIVE)
        .group_by(Company.name)
        .all()
    )

    return {
        "summary": {
            "active_placements": active_count,
            "completed_in_period": completed_count,
        },
        "by_client": [
            {"client": name, "active_count": count}
            for name, count in by_client
        ],
        "filters": {
            "client_id": str(client_id) if client_id else None,
            "date_from": date_from,
            "date_to": date_to,
        },
    }


@router.get("/placements/{placement_id}")
async def get_placement(
    placement_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Get a specific placement by ID."""
    from app.models.placement import Placement
    from app.models.candidate import Candidate
    from sqlalchemy.orm import joinedload

    placement = (
        db.query(Placement)
        .options(
            joinedload(Placement.candidate).joinedload(Candidate.user),
            joinedload(Placement.client),
            joinedload(Placement.job),
        )
        .filter(Placement.id == placement_id)
        .first()
    )

    if not placement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Placement no encontrado"
        )

    return {
        "id": str(placement.id),
        "candidate_id": str(placement.candidate_id),
        "candidate_name": placement.candidate.user.full_name if placement.candidate and placement.candidate.user else None,
        "client_id": str(placement.client_id),
        "client_name": placement.client.name if placement.client else None,
        "job_id": str(placement.job_id) if placement.job_id else None,
        "job_title": placement.job.title if placement.job else None,
        "position_title": placement.position_title,
        "department": placement.department,
        "location": placement.location,
        "placement_type": placement.placement_type.value,
        "status": placement.status.value,
        "offer_date": placement.offer_date.isoformat() if placement.offer_date else None,
        "start_date": placement.start_date.isoformat() if placement.start_date else None,
        "end_date": placement.end_date.isoformat() if placement.end_date else None,
        "salary_amount": placement.salary_amount,
        "salary_currency": placement.salary_currency,
        "salary_period": placement.salary_period,
        "placement_fee": placement.placement_fee,
        "fee_percentage": placement.fee_percentage,
        "fee_paid": placement.fee_paid,
        "notes": placement.notes,
        "created_at": placement.created_at.isoformat() if placement.created_at else None,
        "updated_at": placement.updated_at.isoformat() if placement.updated_at else None,
    }


@router.post("/placements", status_code=status.HTTP_201_CREATED)
async def create_placement(
    candidate_id: UUID = Query(..., description="Candidate ID"),
    client_id: UUID = Query(..., description="Client company ID"),
    position_title: str = Query(..., min_length=1, max_length=255),
    placement_type: str = Query(..., description="Placement type"),
    job_id: Optional[UUID] = Query(None, description="Associated job ID"),
    department: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    salary_amount: Optional[float] = Query(None),
    salary_currency: Optional[str] = Query("USD"),
    salary_period: Optional[str] = Query("monthly"),
    notes: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Create a new placement."""
    from app.models.placement import Placement, PlacementStatus, PlacementType
    from app.models.candidate import Candidate
    from app.models.company import Company
    from app.models.job import Job
    from uuid import uuid4
    from datetime import datetime

    # Validate candidate exists
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidato no encontrado"
        )

    # Validate client exists
    client = db.query(Company).filter(Company.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    # Validate job if provided
    if job_id:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trabajo no encontrado"
            )

    # Parse placement type
    try:
        type_enum = PlacementType(placement_type.upper())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de placement invalido. Valores validos: {[t.value for t in PlacementType]}"
        )

    # Parse dates
    parsed_start_date = None
    parsed_end_date = None
    if start_date:
        try:
            parsed_start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de fecha invalido. Use YYYY-MM-DD"
            )
    if end_date:
        try:
            parsed_end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de fecha invalido. Use YYYY-MM-DD"
            )

    placement = Placement(
        id=uuid4(),
        candidate_id=candidate_id,
        client_id=client_id,
        job_id=job_id,
        position_title=position_title,
        placement_type=type_enum,
        status=PlacementStatus.PENDING,
        department=department,
        location=location,
        start_date=parsed_start_date,
        end_date=parsed_end_date,
        salary_amount=salary_amount,
        salary_currency=salary_currency,
        salary_period=salary_period,
        notes=notes,
    )

    db.add(placement)
    db.commit()
    db.refresh(placement)

    return {
        "id": str(placement.id),
        "candidate_id": str(placement.candidate_id),
        "candidate_name": candidate.user.full_name if candidate.user else None,
        "client_id": str(placement.client_id),
        "client_name": client.name,
        "job_id": str(placement.job_id) if placement.job_id else None,
        "position_title": placement.position_title,
        "placement_type": placement.placement_type.value,
        "status": placement.status.value,
        "start_date": placement.start_date.isoformat() if placement.start_date else None,
        "end_date": placement.end_date.isoformat() if placement.end_date else None,
        "created_at": placement.created_at.isoformat() if placement.created_at else None,
    }


@router.patch("/placements/{placement_id}")
async def update_placement(
    placement_id: UUID,
    status_update: Optional[str] = Query(None, description="New status"),
    position_title: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    placement_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    salary_amount: Optional[float] = Query(None),
    salary_currency: Optional[str] = Query(None),
    salary_period: Optional[str] = Query(None),
    notes: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Update a placement."""
    from app.models.placement import Placement, PlacementStatus, PlacementType
    from app.models.candidate import Candidate
    from sqlalchemy.orm import joinedload
    from datetime import datetime

    placement = (
        db.query(Placement)
        .options(
            joinedload(Placement.candidate).joinedload(Candidate.user),
            joinedload(Placement.client),
            joinedload(Placement.job),
        )
        .filter(Placement.id == placement_id)
        .first()
    )

    if not placement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Placement no encontrado"
        )

    # Update status
    if status_update:
        try:
            placement.status = PlacementStatus(status_update.upper())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Estado invalido. Valores validos: {[s.value for s in PlacementStatus]}"
            )

    # Update placement type
    if placement_type:
        try:
            placement.placement_type = PlacementType(placement_type.upper())
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo invalido. Valores validos: {[t.value for t in PlacementType]}"
            )

    # Update other fields
    if position_title is not None:
        placement.position_title = position_title
    if department is not None:
        placement.department = department
    if location is not None:
        placement.location = location
    if salary_amount is not None:
        placement.salary_amount = salary_amount
    if salary_currency is not None:
        placement.salary_currency = salary_currency
    if salary_period is not None:
        placement.salary_period = salary_period
    if notes is not None:
        placement.notes = notes

    # Parse and update dates
    if start_date is not None:
        if start_date == "":
            placement.start_date = None
        else:
            try:
                placement.start_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Formato de fecha invalido. Use YYYY-MM-DD"
                )

    if end_date is not None:
        if end_date == "":
            placement.end_date = None
        else:
            try:
                placement.end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Formato de fecha invalido. Use YYYY-MM-DD"
                )

    db.commit()
    db.refresh(placement)

    return {
        "id": str(placement.id),
        "candidate_id": str(placement.candidate_id),
        "candidate_name": placement.candidate.user.full_name if placement.candidate and placement.candidate.user else None,
        "client_id": str(placement.client_id),
        "client_name": placement.client.name if placement.client else None,
        "job_id": str(placement.job_id) if placement.job_id else None,
        "job_title": placement.job.title if placement.job else None,
        "position_title": placement.position_title,
        "department": placement.department,
        "location": placement.location,
        "placement_type": placement.placement_type.value,
        "status": placement.status.value,
        "start_date": placement.start_date.isoformat() if placement.start_date else None,
        "end_date": placement.end_date.isoformat() if placement.end_date else None,
        "salary_amount": placement.salary_amount,
        "salary_currency": placement.salary_currency,
        "salary_period": placement.salary_period,
        "notes": placement.notes,
        "created_at": placement.created_at.isoformat() if placement.created_at else None,
        "updated_at": placement.updated_at.isoformat() if placement.updated_at else None,
    }


# ============ Clients Management ============


@router.get("/clients")
async def list_clients(
    include_non_clients: bool = Query(False, description="Include companies that are not clients"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search by name or client_code"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """List all clients (companies with is_client=True)."""
    from app.models.company import Company
    from app.models.job import Job

    query = db.query(Company)

    # Filter by is_client unless include_non_clients
    if not include_non_clients:
        query = query.filter(Company.is_client == True)

    # Filter by active status
    if is_active is not None:
        query = query.filter(Company.is_active == is_active)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Company.name.ilike(search_term)) |
            (Company.client_code.ilike(search_term))
        )

    total = query.count()

    # Get clients with pagination
    clients = (
        query
        .order_by(Company.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Get job counts for each client
    job_counts = {}
    if clients:
        client_ids = [c.id for c in clients]
        counts = (
            db.query(Job.company_id, func.count(Job.id))
            .filter(Job.company_id.in_(client_ids))
            .group_by(Job.company_id)
            .all()
        )
        job_counts = {str(cid): count for cid, count in counts}

    return {
        "items": [
            {
                "id": str(c.id),
                "name": c.name,
                "slug": c.slug,
                "description": c.description,
                "website": c.website,
                "industry": c.industry,
                "size": c.size,
                "logo_url": c.logo_url,
                "is_active": c.is_active,
                "is_client": c.is_client,
                "client_code": c.client_code,
                "match_threshold": c.match_threshold,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
                "job_count": job_counts.get(str(c.id), 0),
            }
            for c in clients
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("/clients", status_code=status.HTTP_201_CREATED)
async def create_client(
    name: str = Query(..., min_length=1, max_length=255),
    description: Optional[str] = Query(None),
    website: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    size: Optional[str] = Query(None),
    client_code: Optional[str] = Query(None),
    match_threshold: Optional[int] = Query(None, ge=0, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Create a new client."""
    from app.models.company import Company
    from uuid import uuid4
    from datetime import datetime
    import re

    # Generate slug from name
    slug_base = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    slug = slug_base

    # Check for slug uniqueness
    existing = db.query(Company).filter(Company.slug == slug).first()
    if existing:
        slug = f"{slug_base}-{str(uuid4())[:8]}"

    # Check for client_code uniqueness if provided
    if client_code:
        existing_code = db.query(Company).filter(Company.client_code == client_code).first()
        if existing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El codigo de cliente '{client_code}' ya existe"
            )

    client = Company(
        id=uuid4(),
        name=name,
        slug=slug,
        description=description,
        website=website,
        industry=industry,
        size=size,
        is_active=True,
        is_client=True,
        client_code=client_code,
        match_threshold=match_threshold,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(client)
    db.commit()
    db.refresh(client)

    return {
        "id": str(client.id),
        "name": client.name,
        "slug": client.slug,
        "description": client.description,
        "website": client.website,
        "industry": client.industry,
        "size": client.size,
        "logo_url": client.logo_url,
        "is_active": client.is_active,
        "is_client": client.is_client,
        "client_code": client.client_code,
        "match_threshold": client.match_threshold,
        "created_at": client.created_at.isoformat() if client.created_at else None,
        "updated_at": client.updated_at.isoformat() if client.updated_at else None,
        "job_count": 0,
    }


@router.get("/clients/{client_id}")
async def get_client(
    client_id: UUID,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Get a specific client by ID."""
    from app.models.company import Company
    from app.models.job import Job

    client = db.query(Company).filter(Company.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    # Get job count
    job_count = db.query(Job).filter(Job.company_id == client_id).count()

    return {
        "id": str(client.id),
        "name": client.name,
        "slug": client.slug,
        "description": client.description,
        "website": client.website,
        "industry": client.industry,
        "size": client.size,
        "logo_url": client.logo_url,
        "is_active": client.is_active,
        "is_client": client.is_client,
        "client_code": client.client_code,
        "match_threshold": client.match_threshold,
        "created_at": client.created_at.isoformat() if client.created_at else None,
        "updated_at": client.updated_at.isoformat() if client.updated_at else None,
        "job_count": job_count,
    }


@router.patch("/clients/{client_id}")
async def update_client(
    client_id: UUID,
    name: Optional[str] = Query(None, min_length=1, max_length=255),
    description: Optional[str] = Query(None),
    website: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    size: Optional[str] = Query(None),
    client_code: Optional[str] = Query(None),
    match_threshold: Optional[int] = Query(None, ge=0, le=100),
    is_client: Optional[bool] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Update a client."""
    from app.models.company import Company
    from app.models.job import Job
    from datetime import datetime

    client = db.query(Company).filter(Company.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    # Check for client_code uniqueness if being updated
    if client_code is not None and client_code != client.client_code:
        existing_code = db.query(Company).filter(
            Company.client_code == client_code,
            Company.id != client_id
        ).first()
        if existing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El codigo de cliente '{client_code}' ya existe"
            )

    # Update fields
    if name is not None:
        client.name = name
    if description is not None:
        client.description = description
    if website is not None:
        client.website = website
    if industry is not None:
        client.industry = industry
    if size is not None:
        client.size = size
    if client_code is not None:
        client.client_code = client_code
    if match_threshold is not None:
        client.match_threshold = match_threshold
    if is_client is not None:
        client.is_client = is_client
    if is_active is not None:
        client.is_active = is_active

    client.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(client)

    # Get job count
    job_count = db.query(Job).filter(Job.company_id == client_id).count()

    return {
        "id": str(client.id),
        "name": client.name,
        "slug": client.slug,
        "description": client.description,
        "website": client.website,
        "industry": client.industry,
        "size": client.size,
        "logo_url": client.logo_url,
        "is_active": client.is_active,
        "is_client": client.is_client,
        "client_code": client.client_code,
        "match_threshold": client.match_threshold,
        "created_at": client.created_at.isoformat() if client.created_at else None,
        "updated_at": client.updated_at.isoformat() if client.updated_at else None,
        "job_count": job_count,
    }


@router.get("/clients/{client_id}/jobs")
async def get_client_jobs(
    client_id: UUID,
    status_filter: Optional[str] = Query(None, description="Filter by job status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """List jobs for a specific client."""
    from app.models.company import Company
    from app.models.job import Job, JobStatus

    # Verify client exists
    client = db.query(Company).filter(Company.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    query = db.query(Job).filter(Job.company_id == client_id)

    # Apply status filter
    if status_filter:
        try:
            status_enum = JobStatus(status_filter.upper())
            query = query.filter(Job.status == status_enum)
        except ValueError:
            pass

    total = query.count()

    jobs = (
        query
        .order_by(Job.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "items": [
            {
                "id": str(j.id),
                "title": j.title,
                "status": j.status.value if j.status else None,
                "category": j.category.value if j.category else None,
                "seniority": j.seniority.value if j.seniority else None,
                "location": j.location,
                "modality": j.modality.value if j.modality else None,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in jobs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }
