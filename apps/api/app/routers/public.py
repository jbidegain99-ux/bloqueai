"""Public endpoints (no authentication required)."""

from typing import Optional
from uuid import uuid4, UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from slowapi import Limiter
from slowapi.util import get_remote_address
import structlog

from app.core.database import get_db
from app.models.lead import Lead
from app.models.job import Job, JobStatus, JobModality, SeniorityLevel, JobCategory
from app.models.company import Company
from app.schemas.lead import LeadCreate, LeadCreateResponse
from app.schemas.base import MessageResponse

logger = structlog.get_logger()

# Rate limiter for public endpoints
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/public", tags=["Public"])


@router.post("/leads", response_model=LeadCreateResponse)
@limiter.limit("5/minute")
async def create_lead(
    request: Request,
    lead_data: LeadCreate,
    db: Session = Depends(get_db),
) -> LeadCreateResponse:
    """
    Submit a lead from the landing page contact form.

    Rate limited to 5 requests per minute per IP to prevent spam.
    """
    # Sanitize inputs
    name = lead_data.name.strip()
    email = lead_data.email.strip().lower()
    company = lead_data.company.strip() if lead_data.company else None
    country = lead_data.country.strip() if lead_data.country else None
    roles_needed = lead_data.roles_needed.strip() if lead_data.roles_needed else None
    message = lead_data.message.strip() if lead_data.message else None

    # Log lead submission (no PII in logs)
    logger.info(
        "lead_submission",
        company=company,
        country=country,
        has_message=bool(message),
        client_ip=request.client.host if request.client else None,
    )

    try:
        # Create lead
        lead = Lead(
            id=uuid4(),
            name=name,
            email=email,
            company=company,
            country=country,
            roles_needed=roles_needed,
            message=message,
            contacted=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(lead)
        db.commit()
        db.refresh(lead)

        logger.info("lead_created", lead_id=str(lead.id))

        return LeadCreateResponse(
            success=True,
            message="Gracias por tu interes. Nos pondremos en contacto contigo pronto.",
            lead_id=lead.id,
        )

    except Exception as e:
        logger.error("lead_creation_failed", error=str(e))
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al procesar tu solicitud. Por favor intenta nuevamente.",
        )


@router.get("/health")
async def public_health() -> MessageResponse:
    """Public health check endpoint."""
    return MessageResponse(message="OK")


@router.get("/jobs")
async def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search in title and description"),
    category: Optional[str] = Query(None, description="Filter by category"),
    seniority: Optional[str] = Query(None, description="Filter by seniority level"),
    modality: Optional[str] = Query(None, description="Filter by work modality"),
    location: Optional[str] = Query(None, description="Filter by location"),
    salary_min: Optional[int] = Query(None, description="Minimum salary"),
    salary_max: Optional[int] = Query(None, description="Maximum salary"),
    db: Session = Depends(get_db),
):
    """
    List active jobs with filters and pagination.

    Public endpoint - no authentication required.
    """
    query = (
        db.query(Job)
        .filter(Job.status == JobStatus.ACTIVE)
        .join(Company)
    )

    # Apply search filter
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                Job.title.ilike(search_term),
                Job.description.ilike(search_term),
                Company.name.ilike(search_term),
            )
        )

    # Apply category filter
    if category:
        try:
            cat_enum = JobCategory(category.upper())
            query = query.filter(Job.category == cat_enum)
        except ValueError:
            pass  # Invalid category, ignore

    # Apply seniority filter
    if seniority:
        try:
            sen_enum = SeniorityLevel(seniority.upper())
            query = query.filter(Job.seniority == sen_enum)
        except ValueError:
            pass

    # Apply modality filter
    if modality:
        try:
            mod_enum = JobModality(modality.upper())
            query = query.filter(Job.modality == mod_enum)
        except ValueError:
            pass

    # Apply location filter
    if location:
        query = query.filter(Job.location.ilike(f"%{location}%"))

    # Apply salary filters
    if salary_min is not None:
        query = query.filter(Job.salary_max >= salary_min)
    if salary_max is not None:
        query = query.filter(Job.salary_min <= salary_max)

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * page_size
    jobs = (
        query
        .order_by(Job.is_featured.desc(), Job.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    # Format response
    return {
        "items": [
            {
                "id": str(job.id),
                "title": job.title,
                "slug": job.slug,
                "description": job.description[:300] + "..." if len(job.description) > 300 else job.description,
                "department": job.department,
                "category": job.category.value if job.category else None,
                "seniority": job.seniority.value if job.seniority else None,
                "modality": job.modality.value if job.modality else None,
                "location": job.location,
                "country": job.country,
                "salary_min": job.salary_min,
                "salary_max": job.salary_max,
                "salary_currency": job.salary_currency,
                "must_haves": job.must_haves or [],
                "nice_to_haves": job.nice_to_haves or [],
                "benefits": job.benefits or [],
                "is_featured": job.is_featured,
                "company": {
                    "id": str(job.company.id),
                    "name": job.company.name,
                    "slug": job.company.slug,
                    "industry": job.company.industry,
                    "logo_url": job.company.logo_url,
                },
                "created_at": job.created_at.isoformat() if job.created_at else None,
            }
            for job in jobs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/jobs/{job_id}")
async def get_job_detail(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """Get detailed job information."""
    job = (
        db.query(Job)
        .filter(Job.id == job_id)
        .filter(Job.status == JobStatus.ACTIVE)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Puesto no encontrado",
        )

    return {
        "id": str(job.id),
        "title": job.title,
        "slug": job.slug,
        "description": job.description,
        "department": job.department,
        "category": job.category.value if job.category else None,
        "seniority": job.seniority.value if job.seniority else None,
        "modality": job.modality.value if job.modality else None,
        "location": job.location,
        "country": job.country,
        "timezone": job.timezone,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "salary_currency": job.salary_currency,
        "must_haves": job.must_haves or [],
        "nice_to_haves": job.nice_to_haves or [],
        "responsibilities": job.responsibilities or [],
        "benefits": job.benefits or [],
        "is_featured": job.is_featured,
        "company": {
            "id": str(job.company.id),
            "name": job.company.name,
            "slug": job.company.slug,
            "description": job.company.description,
            "industry": job.company.industry,
            "size": job.company.size,
            "website": job.company.website,
            "logo_url": job.company.logo_url,
        },
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }


@router.get("/jobs/categories/list")
async def list_job_categories():
    """Get all available job categories."""
    return {
        "categories": [
            {"value": cat.value, "label": cat.value.replace("_", " ").title()}
            for cat in JobCategory
        ]
    }


@router.get("/jobs/seniority/list")
async def list_seniority_levels():
    """Get all available seniority levels."""
    labels = {
        "INTERN": "Practicante",
        "JUNIOR": "Junior",
        "MID": "Mid-Level",
        "SENIOR": "Senior",
        "LEAD": "Lead / Principal",
        "MANAGER": "Manager",
        "DIRECTOR": "Director",
        "VP": "VP",
        "C_LEVEL": "C-Level",
    }
    return {
        "seniority_levels": [
            {"value": sen.value, "label": labels.get(sen.value, sen.value)}
            for sen in SeniorityLevel
        ]
    }


@router.get("/jobs/modality/list")
async def list_modalities():
    """Get all available work modalities."""
    labels = {
        "REMOTE": "Remoto",
        "HYBRID": "Hibrido",
        "ONSITE": "Presencial",
    }
    return {
        "modalities": [
            {"value": mod.value, "label": labels.get(mod.value, mod.value)}
            for mod in JobModality
        ]
    }
