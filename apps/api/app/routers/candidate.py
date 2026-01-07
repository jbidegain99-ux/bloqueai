"""Candidate endpoints."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.candidate import Candidate
from app.models.resume import Resume, ResumeStatus
from app.models.interview import InterviewSession, InterviewMessage, InterviewStatus, MessageRole
from app.models.report import CandidateReport, ReportStatus
from app.schemas.candidate import CandidateProfileResponse, CandidateUpdate
from app.schemas.resume import ResumeUploadResponse, ResumeResponse
from app.schemas.interview import (
    InterviewStartRequest,
    InterviewMessageRequest,
    InterviewMessageResponse,
    InterviewSessionResponse,
    InterviewCompleteResponse,
)
from app.schemas.report import CandidateReportResponse
from app.services.storage import get_storage_service
from app.services.interview import get_interview_questions, DEFAULT_QUESTIONS
from app.services.llm import llm_provider
from app.services.cv_parser import mask_phone
from app.utils.deps import get_current_user, require_candidate

router = APIRouter(prefix="/candidate", tags=["Candidate"])


def get_or_create_candidate(db: Session, user: User) -> Candidate:
    """Get candidate profile or auto-create if it doesn't exist."""
    candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if not candidate:
        # Auto-create candidate profile for CANDIDATE role users
        from uuid import uuid4
        from datetime import datetime
        import structlog
        logger = structlog.get_logger()

        logger.info("auto_creating_candidate_profile", user_id=str(user.id), email=user.email)

        candidate = Candidate(
            id=uuid4(),
            user_id=user.id,
            headline="",
            skills=[],
            experience=[],
            education=[],
            languages=[],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)

        logger.info("candidate_profile_created", candidate_id=str(candidate.id), user_id=str(user.id))
    return candidate


@router.get("/profile", response_model=CandidateProfileResponse)
async def get_profile(
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db),
) -> Candidate:
    """Get candidate profile."""
    return get_or_create_candidate(db, current_user)


@router.patch("/profile", response_model=CandidateProfileResponse)
async def update_profile(
    update: CandidateUpdate,
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db),
) -> Candidate:
    """Update candidate profile."""
    candidate = get_or_create_candidate(db, current_user)

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "phone":
            setattr(candidate, "phone", value)
            setattr(candidate, "phone_masked", mask_phone(value))
        else:
            setattr(candidate, field, value)

    db.commit()
    db.refresh(candidate)
    return candidate


@router.post("/resume", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db),
) -> Resume:
    """Upload a resume/CV file."""
    # Validate file type
    allowed_types = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    }

    content_type = file.content_type
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de archivo no soportado. Use PDF o DOCX.",
        )

    # Validate file size (max 10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo excede el tamaño máximo de 10MB",
        )

    candidate = get_or_create_candidate(db, current_user)

    # Upload to storage (if configured)
    import io

    storage = get_storage_service()
    if storage:
        file_path = storage.upload_file(
            io.BytesIO(content),
            file.filename,
            content_type,
            folder="resumes",
        )
    else:
        # No storage configured - store path as placeholder
        from uuid import uuid4
        ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else ""
        file_path = f"resumes/{uuid4()}.{ext}" if ext else f"resumes/{uuid4()}"

    # Create resume record
    resume = Resume(
        candidate_id=candidate.id,
        filename=file.filename,
        file_path=file_path,
        file_type=allowed_types[content_type],
        file_size=f"{len(content) / 1024:.1f} KB",
        status=ResumeStatus.PENDING,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    # Queue background job for parsing
    # In a real implementation, this would be queued to Redis/RQ
    # For now, we'll do a simple inline parse
    from app.services.cv_parser import extract_text_from_file, parse_cv_with_llm

    try:
        raw_text = extract_text_from_file(content, resume.file_type)
        resume.raw_text = raw_text
        resume.status = ResumeStatus.PROCESSING
        db.commit()

        # Parse with LLM (async)
        import asyncio

        parsed_data = asyncio.get_event_loop().run_until_complete(
            parse_cv_with_llm(raw_text)
        )
        resume.parsed_data = parsed_data
        resume.status = ResumeStatus.COMPLETED

        # Update candidate profile from parsed data
        if parsed_data.get("skills"):
            candidate.skills = parsed_data["skills"]
        if parsed_data.get("experience"):
            candidate.experience = parsed_data["experience"]
        if parsed_data.get("education"):
            candidate.education = parsed_data["education"]
        if parsed_data.get("languages"):
            candidate.languages = parsed_data["languages"]
        if parsed_data.get("headline"):
            candidate.headline = parsed_data["headline"]
        if parsed_data.get("summary"):
            candidate.summary = parsed_data["summary"]
        if parsed_data.get("location"):
            candidate.location = parsed_data["location"]

        db.commit()
    except Exception as e:
        resume.status = ResumeStatus.FAILED
        resume.error_message = str(e)
        db.commit()

    db.refresh(resume)
    return resume


@router.get("/resumes", response_model=list[ResumeResponse])
async def get_resumes(
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db),
) -> list[Resume]:
    """Get all resumes for current candidate."""
    candidate = get_or_create_candidate(db, current_user)
    return db.query(Resume).filter(Resume.candidate_id == candidate.id).all()


@router.post("/interview/start", response_model=InterviewSessionResponse)
async def start_interview(
    request: InterviewStartRequest,
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db),
) -> InterviewSession:
    """Start a new interview session."""
    candidate = get_or_create_candidate(db, current_user)

    # Check for existing in-progress interview
    existing = (
        db.query(InterviewSession)
        .filter(InterviewSession.candidate_id == candidate.id)
        .filter(InterviewSession.status == InterviewStatus.IN_PROGRESS)
        .first()
    )
    if existing:
        # Return existing session
        return existing

    # Get questions
    questions = get_interview_questions(request.job_id)

    # Create session
    session = InterviewSession(
        candidate_id=candidate.id,
        job_id=request.job_id,
        status=InterviewStatus.IN_PROGRESS,
        total_questions=len(questions),
        language=request.language,
        started_at=datetime.utcnow().isoformat(),
    )
    db.add(session)
    db.flush()

    # Add first AI message
    first_question = questions[0]
    first_message = InterviewMessage(
        session_id=session.id,
        role=MessageRole.AI,
        content=first_question["question"],
        sequence=0,
        question_id=first_question["id"],
    )
    db.add(first_message)

    db.commit()
    db.refresh(session)
    return session


@router.post("/interview/{session_id}/message", response_model=InterviewSessionResponse)
async def send_interview_message(
    session_id: UUID,
    request: InterviewMessageRequest,
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db),
) -> InterviewSession:
    """Send a message in the interview."""
    candidate = get_or_create_candidate(db, current_user)

    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id)
        .filter(InterviewSession.candidate_id == candidate.id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión de entrevista no encontrada",
        )

    if session.status != InterviewStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La entrevista ya ha terminado",
        )

    # Get current message count
    message_count = (
        db.query(InterviewMessage)
        .filter(InterviewMessage.session_id == session.id)
        .count()
    )

    # Add candidate message
    candidate_msg = InterviewMessage(
        session_id=session.id,
        role=MessageRole.CANDIDATE,
        content=request.content,
        sequence=message_count,
    )
    db.add(candidate_msg)
    db.flush()

    # Determine next question
    questions = get_interview_questions(session.job_id)
    current_q_index = session.current_question_index

    if current_q_index + 1 < len(questions):
        # Get next question
        next_question = questions[current_q_index + 1]
        session.current_question_index = current_q_index + 1

        ai_msg = InterviewMessage(
            session_id=session.id,
            role=MessageRole.AI,
            content=next_question["question"],
            sequence=message_count + 1,
            question_id=next_question["id"],
        )
        db.add(ai_msg)
    else:
        # End of interview
        session.status = InterviewStatus.COMPLETED
        session.completed_at = datetime.utcnow().isoformat()

        # Calculate duration
        if session.started_at:
            start = datetime.fromisoformat(session.started_at)
            end = datetime.utcnow()
            session.duration_seconds = int((end - start).total_seconds())

        # Add closing message
        ai_msg = InterviewMessage(
            session_id=session.id,
            role=MessageRole.AI,
            content="¡Muchas gracias por tu tiempo! Hemos completado la entrevista. Tu perfil será evaluado y recibirás noticias pronto.",
            sequence=message_count + 1,
        )
        db.add(ai_msg)

    db.commit()
    db.refresh(session)
    return session


@router.post("/interview/{session_id}/complete", response_model=InterviewCompleteResponse)
async def complete_interview(
    session_id: UUID,
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db),
) -> InterviewCompleteResponse:
    """Mark interview as complete and trigger report generation."""
    candidate = get_or_create_candidate(db, current_user)

    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id)
        .filter(InterviewSession.candidate_id == candidate.id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión de entrevista no encontrada",
        )

    # Force complete if still in progress
    if session.status == InterviewStatus.IN_PROGRESS:
        session.status = InterviewStatus.COMPLETED
        session.completed_at = datetime.utcnow().isoformat()
        db.commit()

    # Create pending report
    report = CandidateReport(
        candidate_id=candidate.id,
        session_id=session.id,
        job_id=session.job_id,
        status=ReportStatus.PENDING,
    )
    db.add(report)
    db.commit()

    # In production, this would queue a background job
    # For MVP, we'll generate inline
    try:
        from app.services.interview import (
            build_transcript,
            build_masked_transcript,
            generate_candidate_report,
        )

        messages = (
            db.query(InterviewMessage)
            .filter(InterviewMessage.session_id == session.id)
            .order_by(InterviewMessage.sequence)
            .all()
        )

        message_dicts = [
            {"role": m.role.value, "content": m.content} for m in messages
        ]

        transcript = build_transcript(message_dicts)
        masked_transcript = build_masked_transcript(message_dicts)

        session.full_transcript = transcript
        session.masked_transcript = masked_transcript

        # Generate report
        report.status = ReportStatus.GENERATING

        candidate_info = {
            "name": current_user.full_name,
            "skills": candidate.skills or [],
            "experience": candidate.experience or [],
        }

        job_info = None
        if session.job_id:
            from app.models.job import Job

            job = db.query(Job).filter(Job.id == session.job_id).first()
            if job:
                job_info = {
                    "title": job.title,
                    "must_haves": job.must_haves or [],
                    "nice_to_haves": job.nice_to_haves or [],
                    "seniority": job.seniority.value,
                }

        import asyncio

        report_data = asyncio.get_event_loop().run_until_complete(
            generate_candidate_report(transcript, candidate_info, job_info)
        )

        # Update report
        report.summary = report_data.get("summary")
        report.overall_score = report_data.get("overall_score")
        report.confidence_score = report_data.get("confidence_score")
        report.competency_scores = report_data.get("competency_scores", {})
        report.skills_detected = report_data.get("skills_detected", [])
        report.strengths = report_data.get("strengths", [])
        report.weaknesses = report_data.get("weaknesses", [])
        report.risks = report_data.get("risks", [])
        report.recommendations = report_data.get("recommendations", [])
        report.flags = report_data.get("flags", [])
        report.raw_ai_output = report_data
        report.status = ReportStatus.COMPLETED

        # Update candidate competency scores
        candidate.competency_scores = report.competency_scores
        candidate.ai_summary = report.summary
        candidate.ai_skills = [
            {"skill": s, "source": "interview"} for s in report.skills_detected
        ]

        db.commit()
        report_status = "completed"
    except Exception as e:
        report.status = ReportStatus.FAILED
        db.commit()
        report_status = f"failed: {str(e)}"

    return InterviewCompleteResponse(
        session_id=session.id,
        status=session.status,
        message="Entrevista completada. Tu reporte está siendo generado.",
        report_status=report_status,
    )


@router.get("/interview/{session_id}", response_model=InterviewSessionResponse)
async def get_interview_session(
    session_id: UUID,
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db),
) -> InterviewSession:
    """Get interview session details."""
    candidate = get_or_create_candidate(db, current_user)

    session = (
        db.query(InterviewSession)
        .filter(InterviewSession.id == session_id)
        .filter(InterviewSession.candidate_id == candidate.id)
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión de entrevista no encontrada",
        )

    return session


@router.get("/interviews", response_model=list[InterviewSessionResponse])
async def get_interviews(
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db),
) -> list[InterviewSession]:
    """Get all interview sessions for current candidate."""
    candidate = get_or_create_candidate(db, current_user)
    return (
        db.query(InterviewSession)
        .filter(InterviewSession.candidate_id == candidate.id)
        .order_by(InterviewSession.created_at.desc())
        .all()
    )


@router.get("/report", response_model=CandidateReportResponse)
async def get_latest_report(
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db),
) -> CandidateReport:
    """Get latest candidate report."""
    candidate = get_or_create_candidate(db, current_user)

    report = (
        db.query(CandidateReport)
        .filter(CandidateReport.candidate_id == candidate.id)
        .order_by(CandidateReport.created_at.desc())
        .first()
    )
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tienes reportes generados aún",
        )

    return report
