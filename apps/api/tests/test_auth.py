"""Tests for authentication endpoints."""

import pytest


class TestAuthEndpoints:
    """Test authentication endpoints."""

    def test_register_candidate(self, client):
        """Test candidate registration."""
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

    def test_register_employer(self, client):
        """Test employer registration with company."""
        response = client.post(
            "/auth/register",
            json={
                "email": "employer@test.com",
                "password": "Employer123!",
                "full_name": "Test Employer",
                "role": "EMPLOYER",
                "company_name": "New Company",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "employer@test.com"
        assert data["role"] == "EMPLOYER"
        assert data["company_id"] is not None

    def test_register_duplicate_email(self, client, test_admin):
        """Test registration with duplicate email fails."""
        response = client.post(
            "/auth/register",
            json={
                "email": "admin@test.com",
                "password": "Admin123!",
                "full_name": "Another Admin",
                "role": "CANDIDATE",
            },
        )
        assert response.status_code == 400
        assert "registrado" in response.json()["detail"].lower()

    def test_register_weak_password(self, client):
        """Test registration with weak password fails."""
        response = client.post(
            "/auth/register",
            json={
                "email": "weak@test.com",
                "password": "weak",
                "full_name": "Weak User",
                "role": "CANDIDATE",
            },
        )
        assert response.status_code == 422

    def test_login_success(self, client, test_admin):
        """Test successful login."""
        response = client.post(
            "/auth/login",
            json={"email": "admin@test.com", "password": "Admin123!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, test_admin):
        """Test login with wrong password fails."""
        response = client.post(
            "/auth/login",
            json={"email": "admin@test.com", "password": "wrong"},
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        """Test login with nonexistent user fails."""
        response = client.post(
            "/auth/login",
            json={"email": "nonexistent@test.com", "password": "any"},
        )
        assert response.status_code == 401

    def test_get_current_user(self, client, admin_token):
        """Test getting current user info."""
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@test.com"
        assert data["role"] == "ADMIN"

    def test_get_current_user_no_token(self, client):
        """Test getting current user without token fails."""
        response = client.get("/auth/me")
        assert response.status_code == 403

    def test_get_current_user_invalid_token(self, client):
        """Test getting current user with invalid token fails."""
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid_token"},
        )
        assert response.status_code == 401

    def test_refresh_token(self, client, test_admin):
        """Test token refresh."""
        # First login
        login_response = client.post(
            "/auth/login",
            json={"email": "admin@test.com", "password": "Admin123!"},
        )
        refresh_token = login_response.json()["refresh_token"]

        # Refresh
        response = client.post(
            "/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
