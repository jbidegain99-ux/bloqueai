"""Public endpoints (no authentication required)."""

from uuid import uuid4
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
import structlog

from app.core.database import get_db
from app.models.lead import Lead
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
