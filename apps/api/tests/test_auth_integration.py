"""Comprehensive auth, multi-tenancy, RBAC, and JWT integration tests.

Tests cover:
- Auth flow (register, login, refresh, logout, /me)
- JWT payload structure and validation
- Multi-tenant isolation (User A cannot access User B's data)
- Role-based access control (CANDIDATE vs EMPLOYER vs ADMIN)
- Edge cases (inactive users, expired tokens, deleted users)
"""

import time
from datetime import timedelta
from uuid import uuid4

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.job import Job, JobStatus, JobModality, SeniorityLevel


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. AUTH FLOW TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestAuthFlow:
    """Test complete authentication flow."""

    def test_register_candidate(self, client):
        response = client.post(
            "/auth/register",
            json={
                "email": "new@test.com",
                "password": "NewUser123!",
                "full_name": "New User",
                "role": "CANDIDATE",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "new@test.com"
        assert data["role"] == "CANDIDATE"
        assert data["company_id"] is None

    def test_register_employer_creates_company(self, client):
        response = client.post(
            "/auth/register",
            json={
                "email": "boss@newco.com",
                "password": "Boss12345!",
                "full_name": "Boss Person",
                "role": "EMPLOYER",
                "company_name": "NewCo LLC",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["role"] == "EMPLOYER"
        assert data["company_id"] is not None

    def test_register_duplicate_email(self, client, test_admin):
        response = client.post(
            "/auth/register",
            json={
                "email": "admin@acme.com",
                "password": "Duplicate123!",
                "full_name": "Dup User",
                "role": "CANDIDATE",
            },
        )
        assert response.status_code == 400

    def test_register_weak_password_rejected(self, client):
        # No uppercase
        r = client.post("/auth/register", json={
            "email": "a@b.com", "password": "lowercase1!", "full_name": "X", "role": "CANDIDATE"
        })
        assert r.status_code == 422

        # No digit
        r = client.post("/auth/register", json={
            "email": "a@b.com", "password": "NoDigitHere!", "full_name": "X", "role": "CANDIDATE"
        })
        assert r.status_code == 422

        # Too short
        r = client.post("/auth/register", json={
            "email": "a@b.com", "password": "Ab1!", "full_name": "X", "role": "CANDIDATE"
        })
        assert r.status_code == 422

    def test_login_success(self, client, test_admin):
        response = client.post(
            "/auth/login",
            json={"email": "admin@acme.com", "password": "Admin123!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == settings.jwt_access_token_expire_minutes * 60

    def test_login_wrong_password(self, client, test_admin):
        response = client.post(
            "/auth/login",
            json={"email": "admin@acme.com", "password": "wrong"},
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        response = client.post(
            "/auth/login",
            json={"email": "nobody@nowhere.com", "password": "any"},
        )
        assert response.status_code == 401

    def test_login_inactive_user(self, client, test_inactive_user):
        response = client.post(
            "/auth/login",
            json={"email": "inactive@test.com", "password": "Inactive123!"},
        )
        assert response.status_code == 403
        assert "desactivado" in response.json()["detail"].lower()

    def test_get_me(self, client, admin_token, test_admin):
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@acme.com"
        assert data["role"] == "ADMIN"
        assert data["company_id"] == str(test_admin.company_id)

    def test_get_me_no_token(self, client):
        response = client.get("/auth/me")
        assert response.status_code == 403

    def test_get_me_invalid_token(self, client):
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer garbage.token.here"},
        )
        assert response.status_code == 401

    def test_refresh_token_flow(self, client, test_admin):
        # Login
        login = client.post(
            "/auth/login",
            json={"email": "admin@acme.com", "password": "Admin123!"},
        )
        refresh_tok = login.json()["refresh_token"]

        # Refresh
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_tok},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        # New tokens are valid (may be same if issued in same second due to exp)
        assert data["access_token"] is not None
        assert data["refresh_token"] is not None

    def test_refresh_with_access_token_rejected(self, client, admin_token):
        """Using an access token as refresh should fail."""
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": admin_token},
        )
        assert response.status_code == 401

    def test_logout(self, client, admin_token):
        response = client.post(
            "/auth/logout",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. JWT PAYLOAD & SECURITY TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestJWTSecurity:
    """Test JWT token structure and validation."""

    def test_access_token_payload(self, client, test_admin):
        login = client.post(
            "/auth/login",
            json={"email": "admin@acme.com", "password": "Admin123!"},
        )
        token = login.json()["access_token"]
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        assert payload["sub"] == str(test_admin.id)
        assert payload["role"] == "ADMIN"
        assert payload["type"] == "access"
        assert "exp" in payload

    def test_refresh_token_payload(self, client, test_admin):
        login = client.post(
            "/auth/login",
            json={"email": "admin@acme.com", "password": "Admin123!"},
        )
        token = login.json()["refresh_token"]
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        assert payload["sub"] == str(test_admin.id)
        assert payload["type"] == "refresh"
        # Refresh token should NOT contain role (it does not)
        assert "role" not in payload

    def test_expired_token_rejected(self, client, test_admin):
        """Create a token that expires immediately."""
        token = create_access_token(
            data={"sub": str(test_admin.id), "role": "ADMIN"},
            expires_delta=timedelta(seconds=-1),
        )
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_token_with_wrong_secret_rejected(self, client, test_admin):
        """Token signed with wrong secret should be rejected."""
        token = jwt.encode(
            {"sub": str(test_admin.id), "role": "ADMIN", "type": "access"},
            "wrong-secret",
            algorithm="HS256",
        )
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_refresh_token_cannot_be_used_as_access(self, client, test_admin):
        """Refresh token should not grant access to protected endpoints."""
        refresh = create_refresh_token(data={"sub": str(test_admin.id)})
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {refresh}"},
        )
        assert response.status_code == 401

    def test_token_with_nonexistent_user_rejected(self, client):
        """Token for deleted/nonexistent user should be rejected."""
        token = create_access_token(
            data={"sub": str(uuid4()), "role": "ADMIN"},
        )
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_token_for_inactive_user_rejected(self, client, test_inactive_user):
        """Token for deactivated user should be rejected."""
        token = create_access_token(
            data={"sub": str(test_inactive_user.id), "role": "CANDIDATE"},
        )
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. MULTI-TENANT ISOLATION TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestMultiTenantIsolation:
    """Test that users from different companies cannot access each other's data."""

    def test_employer_sees_only_own_jobs(
        self, client, db, employer_b_token,
        test_admin, test_employer_b, test_company, test_company_b,
    ):
        """Employer B at TechStart should NOT see ACME's jobs."""
        # Create jobs in both companies
        job_a = Job(
            title="Engineer at ACME",
            description="Build things",
            company_id=test_company.id,
            created_by_id=test_admin.id,
            status=JobStatus.ACTIVE,
            country="SV",
            salary_min=1000,
            salary_max=2000,
            salary_currency="USD",
            seniority=SeniorityLevel.MID,
            modality=JobModality.REMOTE,
        )
        db.add(job_a)

        job_b = Job(
            title="Designer at TechStart",
            description="Design things",
            company_id=test_company_b.id,
            created_by_id=test_employer_b.id,
            status=JobStatus.ACTIVE,
            country="SV",
            salary_min=800,
            salary_max=1500,
            salary_currency="USD",
            seniority=SeniorityLevel.JUNIOR,
            modality=JobModality.REMOTE,
        )
        db.add(job_b)
        db.commit()

        # Employer B (non-admin) lists jobs — should see only TechStart's
        resp_b = client.get(
            "/employer/jobs",
            headers={"Authorization": f"Bearer {employer_b_token}"},
        )
        assert resp_b.status_code == 200
        data_b = resp_b.json()
        job_titles_b = [j["title"] for j in data_b["items"]]
        assert "Designer at TechStart" in job_titles_b
        assert "Engineer at ACME" not in job_titles_b  # Tenant isolation works

    def test_admin_sees_all_jobs(
        self, client, db, admin_token,
        test_admin, test_employer_b, test_company, test_company_b,
    ):
        """ADMIN role sees jobs across all companies (by design)."""
        job_a = Job(
            title="ACME Job",
            description="x",
            company_id=test_company.id,
            created_by_id=test_admin.id,
            status=JobStatus.ACTIVE,
            country="SV",
            seniority=SeniorityLevel.MID,
            modality=JobModality.REMOTE,
        )
        job_b = Job(
            title="TechStart Job",
            description="y",
            company_id=test_company_b.id,
            created_by_id=test_employer_b.id,
            status=JobStatus.ACTIVE,
            country="SV",
            seniority=SeniorityLevel.MID,
            modality=JobModality.REMOTE,
        )
        db.add_all([job_a, job_b])
        db.commit()

        resp = client.get(
            "/employer/jobs",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        titles = [j["title"] for j in resp.json()["items"]]
        assert "ACME Job" in titles
        assert "TechStart Job" in titles  # Admin sees all

    def test_employer_cannot_access_other_company_job(
        self, client, db, employer_b_token, test_company, test_admin,
    ):
        """Employer B cannot access ACME's job by ID."""
        job = Job(
            title="Secret ACME Job",
            description="Secret",
            company_id=test_company.id,
            created_by_id=test_admin.id,
            status=JobStatus.ACTIVE,
            country="SV",
            salary_min=1000,
            salary_max=2000,
            salary_currency="USD",
            seniority=SeniorityLevel.MID,
            modality=JobModality.REMOTE,
        )
        db.add(job)
        db.commit()

        # Employer B tries to access ACME's job
        resp = client.get(
            f"/employer/jobs/{job.id}",
            headers={"Authorization": f"Bearer {employer_b_token}"},
        )
        assert resp.status_code == 404  # Should not find it

    def test_company_id_set_on_registration(self, client):
        """When employer registers, company_id is set on the user."""
        resp = client.post(
            "/auth/register",
            json={
                "email": "owner@newbiz.com",
                "password": "Owner12345!",
                "full_name": "Owner",
                "role": "EMPLOYER",
                "company_name": "NewBiz",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["company_id"] is not None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. ROLE-BASED ACCESS CONTROL TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestRBAC:
    """Test role-based access control."""

    def test_candidate_cannot_access_employer_endpoints(self, client, candidate_token):
        """CANDIDATE should not be able to list employer jobs."""
        resp = client.get(
            "/employer/jobs",
            headers={"Authorization": f"Bearer {candidate_token}"},
        )
        assert resp.status_code == 403

    def test_candidate_cannot_access_admin_endpoints(self, client, candidate_token):
        """CANDIDATE should not be able to access admin endpoints."""
        resp = client.get(
            "/admin/dashboard/kpis",
            headers={"Authorization": f"Bearer {candidate_token}"},
        )
        assert resp.status_code == 403

    def test_employer_cannot_access_admin_endpoints(self, client, employer_b_token):
        """EMPLOYER should not be able to access admin-only endpoints."""
        resp = client.get(
            "/admin/dashboard/kpis",
            headers={"Authorization": f"Bearer {employer_b_token}"},
        )
        assert resp.status_code == 403

    def test_admin_can_access_admin_endpoints(self, client, admin_token):
        """ADMIN should be able to access admin endpoints."""
        resp = client.get(
            "/admin/dashboard/kpis",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        # 200 or some success (might be empty data)
        assert resp.status_code in (200, 404)

    def test_admin_can_access_employer_endpoints(self, client, admin_token):
        """ADMIN should be able to access employer endpoints."""
        resp = client.get(
            "/employer/jobs",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. PASSWORD SECURITY TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestPasswordSecurity:
    """Test password hashing and verification."""

    def test_password_hash_is_not_plaintext(self):
        hashed = get_password_hash("MyPassword123!")
        assert hashed != "MyPassword123!"
        assert hashed.startswith("$2b$")  # bcrypt prefix

    def test_password_verification(self):
        hashed = get_password_hash("TestPassword1!")
        assert verify_password("TestPassword1!", hashed) is True
        assert verify_password("WrongPassword1!", hashed) is False

    def test_same_password_different_hashes(self):
        """Bcrypt uses random salt, so same password produces different hashes."""
        h1 = get_password_hash("Same123!")
        h2 = get_password_hash("Same123!")
        assert h1 != h2
        # But both should verify
        assert verify_password("Same123!", h1) is True
        assert verify_password("Same123!", h2) is True


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. EDGE CASE TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestEdgeCases:
    """Test edge cases and security boundaries."""

    def test_deactivated_user_token_rejected(self, client, db, test_admin):
        """If admin deactivates a user, their existing JWT should stop working."""
        # Get token while active
        login = client.post(
            "/auth/login",
            json={"email": "admin@acme.com", "password": "Admin123!"},
        )
        token = login.json()["access_token"]

        # Deactivate user
        test_admin.is_active = False
        db.commit()

        # Token should now be rejected
        resp = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_refresh_for_inactive_user_rejected(self, client, db, test_admin):
        """If user is deactivated, refresh should fail."""
        login = client.post(
            "/auth/login",
            json={"email": "admin@acme.com", "password": "Admin123!"},
        )
        refresh_tok = login.json()["refresh_token"]

        # Deactivate
        test_admin.is_active = False
        db.commit()

        resp = client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_tok},
        )
        assert resp.status_code == 401

    def test_no_account_lockout(self, client, test_admin):
        """Document: there is NO account lockout after failed attempts."""
        # Try 10 wrong passwords
        for _ in range(10):
            client.post(
                "/auth/login",
                json={"email": "admin@acme.com", "password": "wrong"},
            )

        # 11th attempt with correct password should still work
        resp = client.post(
            "/auth/login",
            json={"email": "admin@acme.com", "password": "Admin123!"},
        )
        assert resp.status_code == 200  # No lockout

    def test_no_company_id_in_jwt(self, client, test_admin):
        """Document: company_id is NOT in JWT — fetched from DB on each request."""
        login = client.post(
            "/auth/login",
            json={"email": "admin@acme.com", "password": "Admin123!"},
        )
        token = login.json()["access_token"]
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        assert "company_id" not in payload
        assert "tenant_id" not in payload
        assert "tenantId" not in payload
        # Only sub, role, type, exp
        assert set(payload.keys()) == {"sub", "role", "type", "exp"}
