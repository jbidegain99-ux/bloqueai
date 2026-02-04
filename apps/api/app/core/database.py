"""Database configuration and session management."""

import os

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

# Determine if running in serverless environment (Vercel)
IS_SERVERLESS = os.environ.get("VERCEL", "") == "1" or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")

# Create database engine
# Use NullPool for serverless to avoid connection pool exhaustion
# Each request gets a fresh connection that's closed immediately
if IS_SERVERLESS:
    engine = create_engine(
        settings.database_url,
        poolclass=NullPool,
        echo=settings.api_debug,
    )
else:
    # For local development, use connection pooling
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        echo=settings.api_debug,
    )

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
