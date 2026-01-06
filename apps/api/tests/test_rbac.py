"""Tests for role-based access control."""

import pytest


class TestRBAC:
    """Test role-based access control."""

    def test_candidate_cannot_access_admin(self, client, candidate_token):
        """Test candidate cannot access admin endpoints."""
        response = client.get(
            "/admin/rubrics",
            headers={"Authorization": f"Bearer {candidate_token}"},
        )
        assert response.status_code == 403

    def test_candidate_cannot_access_employer(self, client, candidate_token):
        """Test candidate cannot access employer endpoints."""
        response = client.get(
            "/employer/jobs",
            headers={"Authorization": f"Bearer {candidate_token}"},
        )
        assert response.status_code == 403

    def test_admin_can_access_admin(self, client, admin_token):
        """Test admin can access admin endpoints."""
        response = client.get(
            "/admin/rubrics",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200

    def test_admin_can_access_employer(self, client, admin_token):
        """Test admin can access employer endpoints."""
        response = client.get(
            "/employer/jobs",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert response.status_code == 200

    def test_candidate_can_access_own_profile(self, client, candidate_token):
        """Test candidate can access their own profile."""
        response = client.get(
            "/candidate/profile",
            headers={"Authorization": f"Bearer {candidate_token}"},
        )
        assert response.status_code == 200
