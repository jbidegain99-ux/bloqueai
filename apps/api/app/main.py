"""TalentOS by Bloque - Main FastAPI Application."""

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import structlog

from app.core.config import settings
from app.middleware.rate_limit import get_user_id_or_ip
from app.core.database import engine, Base
from app.routers import (
    auth_router,
    candidate_router,
    employer_router,
    admin_router,
    health_router,
    public_router,
    applications_router,
    payroll_router,
    eor_router,
    billing_router,
    embeddings_router,
    matching_router,
    interviews_router,
)

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
        if settings.log_format == "json"
        else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Rate limiter — keyed by user_id (from JWT) or IP fallback
limiter = Limiter(key_func=get_user_id_or_ip)


def ensure_embedding_columns():
    """Ensure embedding columns exist in the database.

    The vector embedding columns were added in migrations 014/015 but these
    may not have been run on the production database. This check adds the
    columns if they're missing so the ORM doesn't fail on queries.
    """
    from app.core.database import engine
    from sqlalchemy import text, inspect

    try:
        inspector = inspect(engine)

        # Check jobs table
        job_columns = {c["name"] for c in inspector.get_columns("jobs")}
        with engine.begin() as conn:
            if "job_embedding" not in job_columns:
                logger.info("Adding missing job_embedding column to jobs table")
                conn.execute(text(
                    "ALTER TABLE jobs ADD COLUMN job_embedding bytea NULL"
                ))
            if "embedding_updated_at" not in job_columns:
                logger.info("Adding missing embedding_updated_at column to jobs table")
                conn.execute(text(
                    "ALTER TABLE jobs ADD COLUMN embedding_updated_at TIMESTAMP NULL"
                ))

        # Check candidates table
        candidate_columns = {c["name"] for c in inspector.get_columns("candidates")}
        with engine.begin() as conn:
            if "profile_embedding" not in candidate_columns:
                logger.info("Adding missing profile_embedding column to candidates table")
                conn.execute(text(
                    "ALTER TABLE candidates ADD COLUMN profile_embedding bytea NULL"
                ))
            if "embedding_updated_at" not in candidate_columns:
                logger.info("Adding missing embedding_updated_at column to candidates table")
                conn.execute(text(
                    "ALTER TABLE candidates ADD COLUMN embedding_updated_at TIMESTAMP NULL"
                ))

        # Check candidate_job_matches table exists
        if "candidate_job_matches" not in inspector.get_table_names():
            logger.info("Creating missing candidate_job_matches table")
            with engine.begin() as conn:
                conn.execute(text("""
                    CREATE TABLE candidate_job_matches (
                        id UUID PRIMARY KEY,
                        candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
                        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
                        overall_score DOUBLE PRECISION NOT NULL DEFAULT 0,
                        semantic_score DOUBLE PRECISION NOT NULL DEFAULT 0,
                        skills_score DOUBLE PRECISION NOT NULL DEFAULT 0,
                        status VARCHAR(20) NOT NULL DEFAULT 'pending',
                        match_metadata JSONB DEFAULT '{}',
                        recruiter_notes TEXT,
                        reviewed_at TIMESTAMP,
                        created_at TIMESTAMP NOT NULL DEFAULT now(),
                        updated_at TIMESTAMP NOT NULL DEFAULT now(),
                        UNIQUE (candidate_id, job_id)
                    )
                """))
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_match_job_score "
                    "ON candidate_job_matches (job_id, overall_score)"
                ))
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_match_candidate_score "
                    "ON candidate_job_matches (candidate_id, overall_score)"
                ))

    except Exception as e:
        logger.warning("ensure_embedding_columns_failed", error=str(e))


def run_seed_on_startup():
    """Run seed script on startup to ensure base data exists."""
    from app.core.database import SessionLocal
    from app.models.user import User, UserRole
    from app.models.rubric import Rubric, RubricCriteria
    from app.core.security import get_password_hash
    from uuid import uuid4
    from datetime import datetime

    db = SessionLocal()
    try:
        # Check if default rubric exists
        rubric = db.query(Rubric).filter(Rubric.is_default == True).first()
        if not rubric:
            logger.info("Creating default rubric...")
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
                    min_score=1,
                    max_score=5,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(criteria)
            db.commit()
            logger.info("Default rubric created successfully")

        # Check if admin user exists
        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if not admin:
            logger.info("Creating admin user...")
            admin = User(
                id=uuid4(),
                email="admin@bloqueai.com",
                hashed_password=get_password_hash("Admin123!"),
                full_name="Administrador TalentOS",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(admin)
            db.commit()
            logger.info("Admin user created: admin@bloqueai.com / Admin123!")

        # Seed billing plans
        seed_plans(db)

    except Exception as e:
        logger.error("seed_startup_error", error=str(e))
        db.rollback()
    finally:
        db.close()


def seed_plans(db):
    """Seed default billing plans if they don't exist."""
    from app.models.billing import Plan, PlanTier

    existing = db.query(Plan).first()
    if existing:
        return

    logger.info("Creating default billing plans...")

    plans_data = [
        {
            "name": "Free",
            "tier": PlanTier.FREE,
            "description": "Para empezar a explorar TalentOS",
            "price_monthly": 0.0,
            "price_annual": 0.0,
            "limits": {
                "jobs": 3,
                "candidates": 50,
                "interviews_per_month": 10,
                "ai_reports": 5,
                "users": 2,
            },
            "features": [
                "basic_ats",
                "candidate_search",
                "manual_shortlist",
            ],
        },
        {
            "name": "Growth",
            "tier": PlanTier.GROWTH,
            "description": "Para equipos en crecimiento",
            "price_monthly": 99.0,
            "price_annual": 990.0,
            "limits": {
                "jobs": 15,
                "candidates": 500,
                "interviews_per_month": 100,
                "ai_reports": 50,
                "users": 10,
            },
            "features": [
                "basic_ats",
                "candidate_search",
                "manual_shortlist",
                "ai_matching",
                "ai_interviews",
                "bulk_import",
                "job_copilot",
                "email_templates",
            ],
        },
        {
            "name": "Professional",
            "tier": PlanTier.PROFESSIONAL,
            "description": "Para empresas que necesitan todo el poder de la IA",
            "price_monthly": 249.0,
            "price_annual": 2490.0,
            "limits": {
                "jobs": -1,
                "candidates": -1,
                "interviews_per_month": -1,
                "ai_reports": -1,
                "users": 50,
            },
            "features": [
                "basic_ats",
                "candidate_search",
                "manual_shortlist",
                "ai_matching",
                "ai_interviews",
                "bulk_import",
                "job_copilot",
                "email_templates",
                "advanced_analytics",
                "custom_rubrics",
                "api_access",
                "payroll",
                "eor",
            ],
        },
        {
            "name": "Enterprise",
            "tier": PlanTier.ENTERPRISE,
            "description": "Solución personalizada para grandes organizaciones",
            "price_monthly": 0.0,
            "price_annual": 0.0,
            "limits": {
                "jobs": -1,
                "candidates": -1,
                "interviews_per_month": -1,
                "ai_reports": -1,
                "users": -1,
            },
            "features": [
                "basic_ats",
                "candidate_search",
                "manual_shortlist",
                "ai_matching",
                "ai_interviews",
                "bulk_import",
                "job_copilot",
                "email_templates",
                "advanced_analytics",
                "custom_rubrics",
                "api_access",
                "payroll",
                "eor",
                "custom_branding",
                "sso",
                "dedicated_support",
                "sla",
            ],
        },
    ]

    for plan_data in plans_data:
        plan = Plan(
            id=uuid4(),
            name=plan_data["name"],
            tier=plan_data["tier"],
            description=plan_data["description"],
            price_monthly=plan_data["price_monthly"],
            price_annual=plan_data["price_annual"],
            currency="USD",
            is_active=True,
            limits=plan_data["limits"],
            features=plan_data["features"],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(plan)

    db.commit()
    logger.info("Default billing plans created successfully")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting TalentOS API", version="1.0.0")
    # Ensure schema is up to date (adds missing embedding columns if needed)
    ensure_embedding_columns()
    # Run seed on startup
    run_seed_on_startup()
    yield
    logger.info("Shutting down TalentOS API")


# Create FastAPI app
app = FastAPI(
    title="TalentOS by Bloque API",
    description="AI-powered recruitment platform API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add CORS middleware
# Use allow_origin_regex to support Vercel preview URLs (*.vercel.app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with timing."""
    start_time = time.time()

    # Generate request ID
    import uuid

    request_id = str(uuid.uuid4())[:8]

    # Add request ID to state
    request.state.request_id = request_id

    # Extract user_id from JWT for rate limiting (best-effort)
    try:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            from jose import jwt
            token = auth_header[7:]
            payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
            request.state.rate_limit_user_id = payload.get("sub")
    except Exception:
        pass  # No valid token — rate limiter will fall back to IP

    # Process request
    response = await call_next(request)

    # Calculate duration
    duration = time.time() - start_time

    # Log request
    logger.info(
        "request",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round(duration * 1000, 2),
        client_ip=request.client.host if request.client else None,
    )

    # Add request ID to response headers
    response.headers["X-Request-ID"] = request_id

    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unhandled exceptions."""
    logger.error(
        "unhandled_exception",
        request_id=getattr(request.state, "request_id", None),
        path=request.url.path,
        error=str(exc),
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Error interno del servidor"},
    )


# Include routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(candidate_router)
app.include_router(employer_router)
app.include_router(admin_router)
app.include_router(public_router)
app.include_router(applications_router)
app.include_router(payroll_router)
app.include_router(eor_router)
app.include_router(billing_router)
app.include_router(embeddings_router)
app.include_router(matching_router)
app.include_router(interviews_router)


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "TalentOS by Bloque API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_debug,
    )
