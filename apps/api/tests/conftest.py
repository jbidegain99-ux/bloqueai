"""Pytest configuration and fixtures."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.candidate import Candidate
from app.models.company import Company
from app.models.lead import Lead

# Test database URL (in-memory SQLite for tests)
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test."""
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
    """Create a test company."""
    company = Company(
        name="Test Company",
        slug="test-company",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@pytest.fixture
def test_admin(db, test_company):
    """Create a test admin user."""
    user = User(
        email="admin@test.com",
        hashed_password=get_password_hash("Admin123!"),
        full_name="Test Admin",
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
def admin_token(client, test_admin):
    """Get admin access token."""
    response = client.post(
        "/auth/login",
        json={"email": "admin@test.com", "password": "Admin123!"},
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
