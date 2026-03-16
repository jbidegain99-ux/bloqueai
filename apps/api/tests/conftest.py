"""Pytest configuration and fixtures."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.candidate import Candidate
from app.models.company import Company

# Use PostgreSQL for tests (JSONB, UUID, and enums require it)
SQLALCHEMY_DATABASE_URL = "postgresql://talentos:talentos@localhost:5433/talentos_test"

engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Create test database if it doesn't exist
_root_engine = create_engine("postgresql://talentos:talentos@localhost:5433/postgres")
with _root_engine.connect() as conn:
    conn.execution_options(isolation_level="AUTOCOMMIT")
    result = conn.execute(text("SELECT 1 FROM pg_database WHERE datname='talentos_test'"))
    if not result.fetchone():
        conn.execute(text("CREATE DATABASE talentos_test"))
_root_engine.dispose()

# Enable pgvector extension in test database
with engine.connect() as conn:
    conn.execution_options(isolation_level="AUTOCOMMIT")
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Create a test client with database override."""

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_company(db):
    """Create a test company (ACME Corp)."""
    company = Company(
        name="ACME Corp",
        slug="acme-corp",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@pytest.fixture
def test_company_b(db):
    """Create a second company (TechStart Inc) for isolation tests."""
    company = Company(
        name="TechStart Inc",
        slug="techstart-inc",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@pytest.fixture
def test_admin(db, test_company):
    """Create a test admin user at ACME Corp."""
    user = User(
        email="admin@acme.com",
        hashed_password=get_password_hash("Admin123!"),
        full_name="Admin ACME",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
        company_id=test_company.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_employer_b(db, test_company_b):
    """Create an employer user at TechStart Inc."""
    user = User(
        email="employer@techstart.com",
        hashed_password=get_password_hash("Employer123!"),
        full_name="Employer TechStart",
        role=UserRole.EMPLOYER,
        is_active=True,
        is_verified=True,
        company_id=test_company_b.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_candidate_user(db):
    """Create a test candidate user."""
    user = User(
        email="candidate@test.com",
        hashed_password=get_password_hash("Candidate123!"),
        full_name="Test Candidate",
        role=UserRole.CANDIDATE,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.flush()

    candidate = Candidate(user_id=user.id)
    db.add(candidate)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_inactive_user(db):
    """Create an inactive user."""
    user = User(
        email="inactive@test.com",
        hashed_password=get_password_hash("Inactive123!"),
        full_name="Inactive User",
        role=UserRole.CANDIDATE,
        is_active=False,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_token(client, test_admin):
    """Get admin access token for ACME Corp."""
    response = client.post(
        "/auth/login",
        json={"email": "admin@acme.com", "password": "Admin123!"},
    )
    return response.json()["access_token"]


@pytest.fixture
def employer_b_token(client, test_employer_b):
    """Get employer access token for TechStart Inc."""
    response = client.post(
        "/auth/login",
        json={"email": "employer@techstart.com", "password": "Employer123!"},
    )
    return response.json()["access_token"]


@pytest.fixture
def candidate_token(client, test_candidate_user):
    """Get candidate access token."""
    response = client.post(
        "/auth/login",
        json={"email": "candidate@test.com", "password": "Candidate123!"},
    )
    return response.json()["access_token"]
