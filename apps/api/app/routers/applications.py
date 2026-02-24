"""Application endpoints for job application wizard flow."""

import io
import os
from typing import List, Optional
from uuid import UUID, uuid4
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
import structlog

from app.core.database import get_db
from app.models.user import User
from app.models.candidate import Candidate
from app.models.job import Job, JobStatus
from app.models.application import Application, ApplicationStatus
from app.models.llm_log import LLMLog
from app.schemas.application import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationWithJob,
    ResumeUploadResponse,
    CVAnalysisResponse,
)
from app.utils.deps import get_current_user
from app.utils.cache import generate_cache_key, get_cached_analysis, set_cached_analysis
from app.middleware.rate_limit import get_user_id_or_ip, RATE_LIMIT_CV_ANALYSIS

from slowapi import Limiter

logger = structlog.get_logger()

limiter = Limiter(key_func=get_user_id_or_ip)

router = APIRouter(prefix="/applications", tags=["Applications"])


def get_candidate_for_user(db: Session, user: User) -> Candidate:
    """Get or create candidate profile for user."""
    candidate = db.query(Candidate).filter(Candidate.user_id == user.id).first()
    if not candidate:
        candidate = Candidate(
            id=uuid4(),
            user_id=user.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
    return candidate


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    request: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Application:
    """
    Create a new job application.
    This is Step 1 of the application wizard.
    """
    # Verify job exists and is active
    job = db.query(Job).filter(Job.id == request.job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Puesto no encontrado"
        )
    if job.status != JobStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este puesto ya no esta activo"
        )

    # Get or create candidate profile
    candidate = get_candidate_for_user(db, current_user)

    # Check if already applied (and not withdrawn)
    existing = db.query(Application).filter(
        and_(
            Application.candidate_id == candidate.id,
            Application.job_id == request.job_id,
            Application.status != ApplicationStatus.WITHDRAWN
        )
    ).first()

    if existing:
        # Return existing application instead of error
        logger.info("existing_application_found", application_id=str(existing.id))
        return existing

    # Create new application
    application = Application(
        id=uuid4(),
        candidate_id=candidate.id,
        job_id=request.job_id,
        status=ApplicationStatus.CREATED,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    logger.info("application_created", application_id=str(application.id), job_id=str(request.job_id))
    return application


@router.get("", response_model=List[ApplicationWithJob])
async def list_applications(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Application]:
    """List all applications for the current user."""
    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.id).first()
    if not candidate:
        return []

    query = db.query(Application).options(
        joinedload(Application.job).joinedload(Job.company)
    ).filter(Application.candidate_id == candidate.id)

    if status_filter:
        try:
            status_enum = ApplicationStatus(status_filter)
            query = query.filter(Application.status == status_enum)
        except ValueError:
            pass  # Ignore invalid status filter

    applications = query.order_by(Application.created_at.desc()).all()

    # Convert to response with job details
    result = []
    for app in applications:
        app_dict = {
            "id": app.id,
            "candidate_id": app.candidate_id,
            "job_id": app.job_id,
            "status": app.status,
            "resume_filename": app.resume_filename,
            "resume_file_type": app.resume_file_type,
            "resume_file_size": app.resume_file_size,
            "match_score": app.match_score,
            "candidate_profile": app.candidate_profile,
            "match_reasons": app.match_reasons,
            "match_gaps": app.match_gaps,
            "recommended_job_ids": app.recommended_job_ids,
            "interview_session_id": app.interview_session_id,
            "created_at": app.created_at,
            "updated_at": app.updated_at,
            "job": {
                "id": str(app.job.id),
                "title": app.job.title,
                "company": {
                    "id": str(app.job.company.id),
                    "name": app.job.company.name,
                },
                "location": app.job.location,
                "modality": app.job.modality.value if app.job.modality else None,
                "seniority": app.job.seniority.value if app.job.seniority else None,
            } if app.job else None
        }
        result.append(app_dict)

    return result


@router.get("/{application_id}", response_model=ApplicationWithJob)
async def get_application(
    application_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get a specific application by ID."""
    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aplicacion no encontrada"
        )

    application = db.query(Application).options(
        joinedload(Application.job).joinedload(Job.company)
    ).filter(
        and_(
            Application.id == application_id,
            Application.candidate_id == candidate.id
        )
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aplicacion no encontrada"
        )

    return {
        "id": application.id,
        "candidate_id": application.candidate_id,
        "job_id": application.job_id,
        "status": application.status,
        "resume_filename": application.resume_filename,
        "resume_file_type": application.resume_file_type,
        "resume_file_size": application.resume_file_size,
        "match_score": application.match_score,
        "candidate_profile": application.candidate_profile,
        "match_reasons": application.match_reasons,
        "match_gaps": application.match_gaps,
        "recommended_job_ids": application.recommended_job_ids,
        "interview_session_id": application.interview_session_id,
        "created_at": application.created_at,
        "updated_at": application.updated_at,
        "job": {
            "id": str(application.job.id),
            "title": application.job.title,
            "description": application.job.description,
            "company": {
                "id": str(application.job.company.id),
                "name": application.job.company.name,
                "industry": application.job.company.industry,
            },
            "location": application.job.location,
            "modality": application.job.modality.value if application.job.modality else None,
            "seniority": application.job.seniority.value if application.job.seniority else None,
            "must_haves": application.job.must_haves,
            "nice_to_haves": application.job.nice_to_haves,
            "salary_min": application.job.salary_min,
            "salary_max": application.job.salary_max,
            "salary_currency": application.job.salary_currency,
        } if application.job else None
    }


@router.post("/{application_id}/resume", response_model=ResumeUploadResponse)
async def upload_resume(
    application_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ResumeUploadResponse:
    """
    Upload CV/Resume for an application.
    This is Step 2 of the application wizard.
    """
    # Verify ownership
    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aplicacion no encontrada"
        )

    application = db.query(Application).filter(
        and_(
            Application.id == application_id,
            Application.candidate_id == candidate.id
        )
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aplicacion no encontrada"
        )

    # Read file content and validate
    content = await file.read()
    filename = file.filename or "file"

    from app.utils.cv_validator import validate_cv, CVValidationError

    _ERROR_CODE_TO_STATUS = {
        "invalid_extension": status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        "file_too_large": status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        "invalid_mime": status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        "corrupt_pdf": status.HTTP_422_UNPROCESSABLE_ENTITY,
        "empty_pdf": status.HTTP_422_UNPROCESSABLE_ENTITY,
    }

    try:
        cv_result = validate_cv(content, filename, file.content_type)
    except CVValidationError as e:
        raise HTTPException(
            status_code=_ERROR_CODE_TO_STATUS.get(e.code, status.HTTP_400_BAD_REQUEST),
            detail=e.message,
        )

    file_size = cv_result.file_size
    ext = cv_result.extension
    resolved_content_type = cv_result.content_type or ""

    # Extract text from file — prefer already-extracted text from validator
    resume_text = cv_result.text or ""
    if not resume_text:
        try:
            if ext == "pdf" or "pdf" in resolved_content_type:
                # Extract text from PDF
                try:
                    import pdfplumber
                    with pdfplumber.open(io.BytesIO(content)) as pdf:
                        text_parts = []
                        for page in pdf.pages:
                            page_text = page.extract_text()
                            if page_text:
                                text_parts.append(page_text)
                        resume_text = "\n".join(text_parts)
                except Exception as pdf_err:
                    logger.warning("pdf_extraction_failed", error=str(pdf_err))
                    # Try PyPDF2 as fallback
                    try:
                        from PyPDF2 import PdfReader
                        reader = PdfReader(io.BytesIO(content))
                        text_parts = []
                        for page in reader.pages:
                            text = page.extract_text()
                            if text:
                                text_parts.append(text)
                        resume_text = "\n".join(text_parts)
                    except Exception as pypdf_err:
                        logger.warning("pypdf_extraction_failed", error=str(pypdf_err))

            elif ext == "docx" or "wordprocessingml" in resolved_content_type:
                # Extract text from DOCX
                try:
                    from docx import Document
                    doc = Document(io.BytesIO(content))
                    text_parts = []
                    for para in doc.paragraphs:
                        if para.text.strip():
                            text_parts.append(para.text)
                    resume_text = "\n".join(text_parts)
                except Exception as docx_err:
                    logger.warning("docx_extraction_failed", error=str(docx_err))

        except Exception as e:
            logger.error("text_extraction_error", error=str(e))
            # Continue even if text extraction fails

    # Determine file type
    file_type = "pdf" if ext == "pdf" else "docx"

    # Update application
    application.resume_filename = filename
    application.resume_file_type = file_type
    application.resume_file_size = file_size
    application.resume_text = resume_text if resume_text else None
    application.status = ApplicationStatus.CV_UPLOADED
    application.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(application)

    logger.info(
        "resume_uploaded",
        application_id=str(application_id),
        filename=filename,
        size=file_size,
        text_length=len(resume_text) if resume_text else 0
    )

    return ResumeUploadResponse(
        success=True,
        application_id=application.id,
        filename=filename,
        file_type=file_type,
        file_size=file_size,
        status=application.status
    )


@router.post("/{application_id}/analyze", response_model=CVAnalysisResponse)
@limiter.limit(RATE_LIMIT_CV_ANALYSIS)
async def analyze_cv(
    request: Request,
    application_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CVAnalysisResponse:
    """
    Analyze CV against job requirements using OpenAI.
    This is Step 3 of the application wizard.
    """
    # Verify ownership and get application with job
    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aplicacion no encontrada"
        )

    application = db.query(Application).options(
        joinedload(Application.job).joinedload(Job.company)
    ).filter(
        and_(
            Application.id == application_id,
            Application.candidate_id == candidate.id
        )
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aplicacion no encontrada"
        )

    # Verify CV was uploaded
    if not application.resume_text and application.status == ApplicationStatus.CREATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes subir tu CV antes de analizar"
        )

    # Update status to analyzing
    application.status = ApplicationStatus.ANALYZING
    db.commit()

    # Prepare job context for OpenAI
    job = application.job
    if not job:
        logger.error("analyze_cv_no_job", application_id=str(application_id))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se encontro el puesto asociado a esta aplicacion"
        )

    # Call OpenAI for analysis
    from app.core.config import settings

    # Config uses llm_api_key
    api_key = settings.llm_api_key
    if not api_key or api_key.strip() == "":
        logger.error("analyze_cv_no_api_key", application_id=str(application_id))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Servicio de analisis no disponible. Contacta al administrador."
        )

    try:
        cv_text = application.resume_text or "CV sin texto extraido"

        # ── Cache lookup ──────────────────────────────────────────
        cache_key = generate_cache_key(cv_text, str(job.id))
        cached_result = get_cached_analysis(db, cache_key)
        cache_hit = cached_result is not None

        if cached_result:
            # Use cached analysis — skip OpenAI call entirely
            analysis = cached_result
            latency_ms = 0.0
        else:
            # ── Call OpenAI ───────────────────────────────────────

            # Build job context - inside try block to catch any attribute errors
            job_context = f"""
Puesto: {job.title or 'Sin titulo'}
Descripcion: {job.description or 'Sin descripcion'}

Requisitos obligatorios:
{chr(10).join(f'- {req}' for req in (job.must_haves or []))}

Requisitos deseables:
{chr(10).join(f'- {req}' for req in (job.nice_to_haves or []))}

Nivel de senioridad: {job.seniority.value if job.seniority else 'No especificado'}
Ubicacion: {job.location or 'No especificado'}
Modalidad: {job.modality.value if job.modality else 'No especificado'}
"""

            # OpenAI SDK v1.x requires client instantiation
            from openai import OpenAI
            client = OpenAI(api_key=api_key)

            system_prompt = """Eres un experto en reclutamiento y analisis de CVs. Tu tarea es analizar
un CV contra los requisitos de un puesto de trabajo y proporcionar:
1. Un score de match del 0 al 100
2. Un perfil del candidato extraido del CV
3. Razones por las que el candidato hace match
4. Gaps o habilidades faltantes

Responde SIEMPRE en JSON valido con esta estructura exacta:
{
  "match_score": <numero 0-100>,
  "candidate_profile": {
    "skills": ["skill1", "skill2"],
    "roles": ["rol1", "rol2"],
    "years_experience": <numero>,
    "education": ["titulo1"],
    "languages": ["idioma1"]
  },
  "match_reasons": ["razon1", "razon2", "razon3"],
  "gaps": ["gap1", "gap2"]
}"""

            user_prompt = f"""Analiza este CV contra el puesto de trabajo:

=== PUESTO ===
{job_context}

=== CV DEL CANDIDATO ===
{cv_text}

Proporciona tu analisis en formato JSON."""
            start_time = datetime.utcnow()

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )

            end_time = datetime.utcnow()
            latency_ms = (end_time - start_time).total_seconds() * 1000

            # Parse response
            import json
            result_text = response.choices[0].message.content
            try:
                analysis = json.loads(result_text)
            except (json.JSONDecodeError, TypeError) as json_err:
                logger.error(
                    "cv_analysis_json_parse_error",
                    application_id=str(application_id),
                    raw_response=result_text[:500] if result_text else None,
                    error=str(json_err),
                )
                raise ValueError(f"OpenAI returned invalid JSON: {json_err}")

            # Log the API call
            llm_log = LLMLog(
                id=uuid4(),
                user_id=current_user.id,
                model="gpt-4o-mini",
                tokens_in=response.usage.prompt_tokens if response.usage else 0,
                tokens_out=response.usage.completion_tokens if response.usage else 0,
                total_tokens=response.usage.total_tokens if response.usage else 0,
                latency_ms=int(latency_ms),
                status="success",
                endpoint="cv_analysis",
                operation="cv_analysis",
                created_at=datetime.utcnow(),
            )
            db.add(llm_log)

            # Store in cache for future requests
            set_cached_analysis(db, cache_key, analysis, job_id=job.id)

        # Extract results (from cache or fresh analysis)
        match_score = float(analysis.get("match_score", 50))
        candidate_profile = analysis.get("candidate_profile", {})
        match_reasons = analysis.get("match_reasons", [])
        gaps = analysis.get("gaps", [])

        # Get threshold using inheritance: job -> client -> system
        # 1. Try job-specific threshold
        # 2. Fallback to client (company) threshold
        # 3. Fallback to system default from settings
        from app.models.settings import SystemSettings

        # System default (from settings table or hardcoded 70)
        system_default = SystemSettings.get_int(db, 'default_match_threshold', 70)

        # Client (company) threshold
        client_threshold = None
        if job.company and job.company.match_threshold is not None:
            client_threshold = job.company.match_threshold

        # Final threshold = job ?? client ?? system
        if job.match_threshold is not None:
            match_threshold = job.match_threshold
        elif client_threshold is not None:
            match_threshold = client_threshold
        else:
            match_threshold = system_default

        logger.debug(
            "threshold_resolved",
            job_threshold=job.match_threshold,
            client_threshold=client_threshold,
            system_default=system_default,
            final_threshold=match_threshold
        )

        # Determine status based on match score vs threshold
        if match_score >= match_threshold:
            new_status = ApplicationStatus.MATCH_PASSED
        else:
            new_status = ApplicationStatus.MATCH_BELOW_THRESHOLD

        # If low match, find recommended jobs
        recommended_jobs = None
        if match_score < match_threshold:
            # Find similar jobs with potentially better match
            similar_jobs = db.query(Job).options(
                joinedload(Job.company)
            ).filter(
                Job.status == JobStatus.ACTIVE,
                Job.id != job.id
            ).limit(5).all()

            recommended_jobs = []
            for similar_job in similar_jobs:
                # Simple heuristic: check skill overlap
                candidate_skills = set(s.lower() for s in candidate_profile.get("skills", []))
                job_skills = set(s.lower() for s in (similar_job.must_haves or []))

                overlap = len(candidate_skills & job_skills)
                total = len(job_skills) if job_skills else 1
                estimated_score = min(100, (overlap / total) * 100 + 30)  # Base 30 + overlap bonus

                recommended_jobs.append({
                    "id": str(similar_job.id),
                    "title": similar_job.title,
                    "company_name": similar_job.company.name if similar_job.company else "Empresa",
                    "match_score": round(estimated_score, 1),
                    "location": similar_job.location,
                    "modality": similar_job.modality.value if similar_job.modality else None,
                })

            # Sort by estimated score and take top 3
            recommended_jobs = sorted(recommended_jobs, key=lambda x: x["match_score"], reverse=True)[:3]

        # Update application
        application.match_score = match_score
        application.candidate_profile = candidate_profile
        application.match_reasons = match_reasons
        application.match_gaps = gaps
        application.recommended_job_ids = recommended_jobs
        application.applied_threshold = match_threshold  # Store for audit trail
        application.status = new_status
        application.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(application)

        logger.info(
            "cv_analysis_completed",
            application_id=str(application_id),
            match_score=match_score,
            status=new_status.value,
            cache_hit=cache_hit,
        )

        return CVAnalysisResponse(
            success=True,
            application_id=application.id,
            match_score=match_score,
            status=new_status,
            candidate_profile=candidate_profile,
            match_reasons=match_reasons,
            match_gaps=gaps,
            recommended_jobs=recommended_jobs
        )

    except Exception as e:
        error_class = type(e).__name__
        error_msg = str(e)
        logger.error("cv_analysis_error", error=error_msg, error_type=error_class, application_id=str(application_id))

        # Revert status
        try:
            application.status = ApplicationStatus.CV_UPLOADED
            db.commit()
        except Exception:
            db.rollback()

        # Log failed attempt
        try:
            llm_log = LLMLog(
                id=uuid4(),
                user_id=current_user.id,
                model="gpt-4o-mini",
                status="error",
                error_message=error_msg[:500],
                endpoint="cv_analysis",
                created_at=datetime.utcnow(),
            )
            db.add(llm_log)
            db.commit()
        except Exception:
            pass

        # Determine error message based on error type
        if error_class == "AuthenticationError" or "api_key" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Error de autenticacion con el servicio de IA. Contacta al administrador."
            )
        elif error_class == "RateLimitError":
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Servicio de IA temporalmente no disponible. Intenta de nuevo en unos minutos."
            )
        elif "timeout" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="El analisis tardo demasiado. Intenta de nuevo."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al analizar el CV. Intenta de nuevo. ({error_class})"
            )


@router.post("/{application_id}/withdraw")
async def withdraw_application(
    application_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Withdraw an application."""
    candidate = db.query(Candidate).filter(Candidate.user_id == current_user.id).first()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aplicacion no encontrada"
        )

    application = db.query(Application).filter(
        and_(
            Application.id == application_id,
            Application.candidate_id == candidate.id
        )
    ).first()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aplicacion no encontrada"
        )

    application.status = ApplicationStatus.WITHDRAWN
    application.updated_at = datetime.utcnow()
    db.commit()

    logger.info("application_withdrawn", application_id=str(application_id))

    return {"success": True, "message": "Aplicacion retirada exitosamente"}
