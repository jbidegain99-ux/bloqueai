"""Tests for public leads endpoint."""

import pytest


class TestLeadsEndpoint:
    """Test public leads endpoint."""

    def test_create_lead_success(self, client):
        """Test successful lead creation."""
        response = client.post(
            "/public/leads",
            json={
                "name": "Test User",
                "email": "test@company.com",
                "company": "Test Company",
                "country": "Mexico",
                "roles_needed": "3 developers",
                "message": "Interested in demo",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "lead_id" in data
        assert "contacto" in data["message"].lower()

    def test_create_lead_minimal(self, client):
        """Test lead creation with minimal required fields."""
        response = client.post(
            "/public/leads",
            json={
                "name": "Minimal User",
                "email": "minimal@test.com",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_create_lead_missing_name(self, client):
        """Test lead creation fails without name."""
        response = client.post(
            "/public/leads",
            json={
                "email": "test@test.com",
            },
        )
        assert response.status_code == 422

    def test_create_lead_missing_email(self, client):
        """Test lead creation fails without email."""
        response = client.post(
            "/public/leads",
            json={
                "name": "Test User",
            },
        )
        assert response.status_code == 422

    def test_create_lead_invalid_email(self, client):
        """Test lead creation fails with invalid email."""
        response = client.post(
            "/public/leads",
            json={
                "name": "Test User",
                "email": "not-an-email",
            },
        )
        assert response.status_code == 422

    def test_create_lead_empty_name(self, client):
        """Test lead creation fails with empty name."""
        response = client.post(
            "/public/leads",
            json={
                "name": "",
                "email": "test@test.com",
            },
        )
        assert response.status_code == 422

    def test_create_lead_name_too_short(self, client):
        """Test lead creation fails with name too short."""
        response = client.post(
            "/public/leads",
            json={
                "name": "A",
                "email": "test@test.com",
            },
        )
        assert response.status_code == 422


class TestPublicHealth:
    """Test public health endpoint."""

    def test_public_health(self, client):
        """Test public health endpoint."""
        response = client.get("/public/health")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "OK"
