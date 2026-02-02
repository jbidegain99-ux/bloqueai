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
from app.schemas.candidate import (
    CandidateProfileResponse,
    CandidateUpdate,
    CVBuilderRequest,
    CVBuilderResponse,
)
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
) -> dict:
    """Get candidate profile with resume and interview status."""
    candidate = get_or_create_candidate(db, current_user)

    # Get latest completed resume for CV info
    latest_resume = (
        db.query(Resume)
        .filter(Resume.candidate_id == candidate.id)
        .filter(Resume.status == ResumeStatus.COMPLETED)
        .order_by(Resume.updated_at.desc())
        .first()
    )

    # Check if there's a completed interview session
    completed_interview = (
        db.query(InterviewSession)
        .filter(InterviewSession.candidate_id == candidate.id)
        .filter(InterviewSession.status == InterviewStatus.COMPLETED)
        .first()
    )

    # Build response with additional fields
    profile_data = {
        "id": candidate.id,
        "user_id": candidate.user_id,
        "phone_masked": candidate.phone_masked,
        "location": candidate.location,
        "linkedin_url": candidate.linkedin_url,
        "github_url": candidate.github_url,
        "headline": candidate.headline,
        "summary": candidate.summary,
        "skills": candidate.skills or [],
        "ai_summary": candidate.ai_summary,
        "ai_skills": candidate.ai_skills or [],
        "experience": candidate.experience or [],
        "education": candidate.education or [],
        "languages": candidate.languages or [],
        "certifications": candidate.certifications or [],
        "competency_scores": candidate.competency_scores or {},
        # Resume info
        "resume_updated_at": latest_resume.updated_at if latest_resume else None,
        "resume_source": latest_resume.source.value if latest_resume else None,
        # Interview status - based on actual completed interview session
        "has_completed_interview": completed_interview is not None,
    }

    return profile_data


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

    # Parse CV inline (for Vercel serverless compatibility)
    from app.services.cv_parser import extract_text_from_file, parse_cv_with_llm
    import structlog
    logger = structlog.get_logger()

    try:
        logger.info("cv_parsing_started", resume_id=str(resume.id), filename=file.filename)

        # Extract raw text
        raw_text = extract_text_from_file(content, resume.file_type)
        resume.raw_text = raw_text
        resume.status = ResumeStatus.PROCESSING
        db.commit()

        logger.info("cv_text_extracted", resume_id=str(resume.id), text_length=len(raw_text))

        # Parse with LLM (await directly since we're in async function)
        parsed_data = await parse_cv_with_llm(raw_text)
        resume.parsed_data = parsed_data
        resume.status = ResumeStatus.COMPLETED

        logger.info("cv_parsing_completed", resume_id=str(resume.id), skills_count=len(parsed_data.get("skills", [])))

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

        candidate.updated_at = datetime.utcnow()
        db.commit()

        logger.info("candidate_profile_updated", candidate_id=str(candidate.id))
    except Exception as e:
        logger.error("cv_parsing_failed", resume_id=str(resume.id), error=str(e))
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
    """Start a new interview session with dynamic AI questions."""
    import structlog
    logger = structlog.get_logger()

    candidate = get_or_create_candidate(db, current_user)

    # Check for existing in-progress interview for this job
    existing_query = (
        db.query(InterviewSession)
        .filter(InterviewSession.candidate_id == candidate.id)
        .filter(InterviewSession.status == InterviewStatus.IN_PROGRESS)
    )
    if request.job_id:
        existing_query = existing_query.filter(InterviewSession.job_id == request.job_id)

    existing = existing_query.first()
    if existing:
        # Return existing session
        return existing

    # Determine total questions (dynamic interviews typically 8-12 questions)
    total_questions = 10

    # Create session
    session = InterviewSession(
        candidate_id=candidate.id,
        job_id=request.job_id,
        status=InterviewStatus.IN_PROGRESS,
        total_questions=total_questions,
        language=request.language or "es",
        interview_type="dynamic" if request.job_id else "general",
        started_at=datetime.utcnow().isoformat(),
    )
    db.add(session)
    db.flush()

    logger.info("interview_session_created", session_id=str(session.id), job_id=str(request.job_id) if request.job_id else None)

    # Use Interview Orchestrator for dynamic first question
    try:
        from app.services.interview_orchestrator import create_orchestrator_for_session

        orchestrator = await create_orchestrator_for_session(
            session_id=session.id,
            job_id=request.job_id,
            candidate_id=candidate.id,
            db=db,
        )

        first_response = await orchestrator.generate_first_question()
        first_message_content = first_response.get("message", "")

        # Store phase info in session metadata
        session.ai_analysis = {
            "current_phase": first_response.get("phase", "introduction"),
            "dynamic_mode": True,
        }

        logger.info("dynamic_first_question_generated", session_id=str(session.id))
    except Exception as e:
        logger.error("dynamic_question_failed_using_fallback", error=str(e))
        # Fallback to static questions
        questions = get_interview_questions(request.job_id)
        first_message_content = questions[0]["question"]
        session.ai_analysis = {"dynamic_mode": False, "fallback_reason": str(e)}

    # Add first AI message
    first_message = InterviewMessage(
        session_id=session.id,
        role=MessageRole.AI,
        content=first_message_content,
        sequence=0,
        question_id="intro",
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
    """Send a message in the interview with dynamic AI responses."""
    import structlog
    logger = structlog.get_logger()

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
            detail="Sesion de entrevista no encontrada",
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

    current_q_index = session.current_question_index

    # Check if we should use dynamic mode
    ai_analysis = session.ai_analysis or {}
    use_dynamic = ai_analysis.get("dynamic_mode", False)

    if use_dynamic and current_q_index + 1 < session.total_questions:
        # Use Interview Orchestrator for dynamic next question
        try:
            from app.services.interview_orchestrator import create_orchestrator_for_session

            orchestrator = await create_orchestrator_for_session(
                session_id=session.id,
                job_id=session.job_id,
                candidate_id=candidate.id,
                db=db,
            )

            # Build conversation history
            messages = (
                db.query(InterviewMessage)
                .filter(InterviewMessage.session_id == session.id)
                .order_by(InterviewMessage.sequence)
                .all()
            )
            conversation_history = [
                {"role": "assistant" if m.role == MessageRole.AI else "user", "content": m.content}
                for m in messages
            ]

            current_phase = ai_analysis.get("current_phase", "experience")

            # Generate next question
            next_response = await orchestrator.generate_next_question(
                conversation_history=conversation_history,
                current_phase=current_phase,
                question_number=current_q_index + 1,
                total_questions=session.total_questions,
            )

            next_message_content = next_response.get("message", "")
            should_end = next_response.get("should_end", False)

            # Update session metadata
            ai_analysis["current_phase"] = next_response.get("phase", current_phase)
            if next_response.get("internal_notes"):
                ai_analysis["last_evaluation"] = next_response.get("internal_notes", {}).get("evaluation", {})
            session.ai_analysis = ai_analysis

            session.current_question_index = current_q_index + 1

            if should_end or current_q_index + 1 >= session.total_questions - 1:
                # Generate closing message
                closing_message = await orchestrator.generate_closing_message()
                session.status = InterviewStatus.COMPLETED
                session.completed_at = datetime.utcnow().isoformat()

                if session.started_at:
                    start = datetime.fromisoformat(session.started_at)
                    end = datetime.utcnow()
                    session.duration_seconds = int((end - start).total_seconds())

                ai_msg = InterviewMessage(
                    session_id=session.id,
                    role=MessageRole.AI,
                    content=closing_message,
                    sequence=message_count + 1,
                )
            else:
                ai_msg = InterviewMessage(
                    session_id=session.id,
                    role=MessageRole.AI,
                    content=next_message_content,
                    sequence=message_count + 1,
                    question_id=f"dynamic_{current_q_index + 1}",
                )

            db.add(ai_msg)
            logger.info("dynamic_question_generated", session_id=str(session.id), question_num=current_q_index + 1)

        except Exception as e:
            logger.error("dynamic_question_failed", error=str(e), session_id=str(session.id))
            # Fallback to static questions
            questions = get_interview_questions(session.job_id)
            if current_q_index + 1 < len(questions):
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
                # End interview
                session.status = InterviewStatus.COMPLETED
                session.completed_at = datetime.utcnow().isoformat()
                ai_msg = InterviewMessage(
                    session_id=session.id,
                    role=MessageRole.AI,
                    content="Muchas gracias por tu tiempo! Hemos completado la entrevista.",
                    sequence=message_count + 1,
                )
                db.add(ai_msg)
    else:
        # Use static questions (fallback mode)
        questions = get_interview_questions(session.job_id)

        if current_q_index + 1 < len(questions):
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

            if session.started_at:
                start = datetime.fromisoformat(session.started_at)
                end = datetime.utcnow()
                session.duration_seconds = int((end - start).total_seconds())

            ai_msg = InterviewMessage(
                session_id=session.id,
                role=MessageRole.AI,
                content="Muchas gracias por tu tiempo! Hemos completado la entrevista. Tu perfil sera evaluado y recibiras noticias pronto.",
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
    import structlog
    logger = structlog.get_logger()

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

    logger.info("complete_interview_called", session_id=str(session_id), candidate_id=str(candidate.id), current_status=session.status.value)

    # Check for existing completed report (idempotency)
    existing_report = (
        db.query(CandidateReport)
        .filter(CandidateReport.session_id == session.id)
        .filter(CandidateReport.status == ReportStatus.COMPLETED)
        .first()
    )
    if existing_report:
        logger.info("report_already_exists", session_id=str(session_id), report_id=str(existing_report.id))
        return InterviewCompleteResponse(
            session_id=session.id,
            status=session.status,
            message="Entrevista ya completada. Tu reporte está listo.",
            report_status="completed",
        )

    # Force complete if still in progress
    if session.status == InterviewStatus.IN_PROGRESS:
        session.status = InterviewStatus.COMPLETED
        session.completed_at = datetime.utcnow().isoformat()
        db.commit()
        logger.info("session_marked_completed", session_id=str(session_id))

    # Check for pending/generating report (avoid duplicates)
    pending_report = (
        db.query(CandidateReport)
        .filter(CandidateReport.session_id == session.id)
        .filter(CandidateReport.status.in_([ReportStatus.PENDING, ReportStatus.GENERATING]))
        .first()
    )

    if pending_report:
        # Use existing pending report
        report = pending_report
        logger.info("using_existing_pending_report", session_id=str(session_id), report_id=str(report.id))
    else:
        # Create new report
        report = CandidateReport(
            candidate_id=candidate.id,
            session_id=session.id,
            job_id=session.job_id,
            status=ReportStatus.PENDING,
        )
        db.add(report)
        db.commit()
        logger.info("new_report_created", session_id=str(session_id), report_id=str(report.id))

    # Generate report inline (for Vercel serverless compatibility)
    import structlog
    logger = structlog.get_logger()

    try:
        from app.services.interview import (
            build_transcript,
            build_masked_transcript,
            generate_candidate_report,
        )

        logger.info("report_generation_started", session_id=str(session.id))

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
        db.commit()

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

        # Await directly since we're in async function
        report_data = await generate_candidate_report(transcript, candidate_info, job_info)

        logger.info("report_data_generated", session_id=str(session.id), overall_score=report_data.get("overall_score"))

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
        candidate.updated_at = datetime.utcnow()

        db.commit()
        report_status = "completed"

        logger.info("report_generation_completed", session_id=str(session.id), report_id=str(report.id))
    except Exception as e:
        logger.error("report_generation_failed", session_id=str(session.id), error=str(e))
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
    """Get latest completed candidate report."""
    candidate = get_or_create_candidate(db, current_user)

    # Only return COMPLETED reports
    report = (
        db.query(CandidateReport)
        .filter(CandidateReport.candidate_id == candidate.id)
        .filter(CandidateReport.status == ReportStatus.COMPLETED)
        .order_by(CandidateReport.created_at.desc())
        .first()
    )
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tienes reportes completados aún",
        )

    return report


@router.post("/cv/generate", response_model=CVBuilderResponse)
async def generate_cv_from_wizard(
    request: CVBuilderRequest,
    current_user: User = Depends(require_candidate),
    db: Session = Depends(get_db),
) -> dict:
    """Generate CV from wizard data using AI.

    This endpoint:
    1. Takes structured CV data from the wizard
    2. Generates a professional summary with AI
    3. Creates an HTML CV and optionally a PDF
    4. Saves a Resume record with source=AI_BUILDER
    5. Updates the CandidateProfile with extracted data
    """
    import structlog
    from app.services.cv_builder import build_cv
    from app.models.resume import ResumeSource
    from app.services.storage import get_storage_service
    from app.services.cv_parser import mask_phone

    logger = structlog.get_logger()

    candidate = get_or_create_candidate(db, current_user)

    logger.info(
        "cv_builder_request",
        candidate_id=str(candidate.id),
        user_id=str(current_user.id),
    )

    try:
        # Convert pydantic models to dicts
        personal_info = request.personal_info.model_dump()
        work_history = [w.model_dump() for w in request.work_history]
        education = [e.model_dump() for e in request.education]
        skills = request.skills.model_dump()
        languages = [l.model_dump() for l in request.languages]

        # Build CV with AI
        result = await build_cv(
            personal_info=personal_info,
            work_history=work_history,
            education=education,
            skills=skills,
            languages=languages,
            candidate_id=candidate.id,
        )

        # Create Resume record
        resume = Resume(
            candidate_id=candidate.id,
            filename=f"cv_builder_{candidate.id}.html",
            file_path=result["file_path"] or f"cv-builder/{candidate.id}.html",
            file_type="html",
            file_size="Generated",
            status=ResumeStatus.COMPLETED,
            source=ResumeSource.AI_BUILDER,
            parsed_data=result["parsed_data"],
        )
        db.add(resume)
        db.flush()

        # Update candidate profile from parsed data
        parsed = result["parsed_data"]

        if parsed.get("skills"):
            candidate.skills = parsed["skills"]
        if parsed.get("experience"):
            candidate.experience = parsed["experience"]
        if parsed.get("education"):
            candidate.education = parsed["education"]
        if parsed.get("languages"):
            candidate.languages = parsed["languages"]
        if parsed.get("headline"):
            candidate.headline = parsed["headline"]
        if parsed.get("summary"):
            candidate.summary = parsed["summary"]
        if parsed.get("location"):
            candidate.location = parsed["location"]
        if parsed.get("phone"):
            candidate.phone = parsed["phone"]
            candidate.phone_masked = mask_phone(parsed["phone"])

        candidate.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(resume)

        # Get file URL if storage is configured
        file_url = None
        storage = get_storage_service()
        if storage and result["file_path"]:
            file_url = storage.get_presigned_url(result["file_path"], expires_hours=24)

        logger.info(
            "cv_builder_success",
            candidate_id=str(candidate.id),
            resume_id=str(resume.id),
        )

        return {
            "success": True,
            "message": "CV generado exitosamente",
            "resume_id": resume.id,
            "file_url": file_url,
            "summary": result["summary"],
            "html_preview": result["html_content"],
        }

    except Exception as e:
        logger.error(
            "cv_builder_failed",
            candidate_id=str(candidate.id),
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar el CV: {str(e)}",
        )
