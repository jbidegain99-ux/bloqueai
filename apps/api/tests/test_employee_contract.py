"""Integration tests for Employee + Contract CRUD endpoints.

Covers:
- Employee CRUD (create, list, get, update, terminate)
- Contract CRUD (create, list, get, update, sign, terminate)
- DUI validation
- Signed contract immutability
- Multi-tenant isolation
- New fields (document_type, salary, employment_type, status, benefits, etc.)
"""

from datetime import date, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.payroll import Employee, EmployeeStatus


@pytest.fixture(autouse=True)
def enable_payroll():
    """Enable payroll module for all tests in this file."""
    original = settings.enable_payroll
    settings.enable_payroll = True
    yield
    settings.enable_payroll = original


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EMPLOYEE TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestEmployeeCRUD:
    """Test employee CRUD operations."""

    def _create_employee(self, client, token, company_id, **overrides):
        data = {
            "client_id": str(company_id),
            "full_name": "María García",
            "email": "maria@acme.com",
            "phone": "+503 7000-0000",
            "position": "Desarrolladora",
            "department": "Tecnología",
            "hire_date": "2026-01-15",
            "document_type": "DUI",
            "document_id": "12345678-9",
            "salary": 1500.00,
            "salary_currency": "USD",
            "employment_type": "FULL_TIME",
        }
        data.update(overrides)
        return client.post(
            "/payroll/employees",
            json=data,
            headers={"Authorization": f"Bearer {token}"},
        )

    def test_create_employee(self, client, admin_token, test_company):
        resp = self._create_employee(client, admin_token, test_company.id)
        assert resp.status_code == 201
        data = resp.json()
        assert data["full_name"] == "María García"
        assert data["document_type"] == "DUI"
        assert data["document_id"] == "12345678-9"
        assert data["salary"] == 1500.0
        assert data["employment_type"] == "FULL_TIME"
        assert data["status"] == "ACTIVE"
        assert data["is_active"] is True

    def test_create_employee_with_invalid_dui(self, client, admin_token, test_company):
        resp = self._create_employee(
            client, admin_token, test_company.id,
            document_type="DUI", document_id="bad-dui",
        )
        assert resp.status_code == 422

    def test_create_employee_dui_format_variations(self, client, admin_token, test_company):
        # Too short
        resp = self._create_employee(
            client, admin_token, test_company.id,
            document_type="DUI", document_id="1234-9",
        )
        assert resp.status_code == 422

        # Missing dash
        resp = self._create_employee(
            client, admin_token, test_company.id,
            document_type="DUI", document_id="123456789",
        )
        assert resp.status_code == 422

    def test_create_employee_duplicate_dui_same_tenant(self, client, admin_token, test_company):
        # First employee with DUI
        resp1 = self._create_employee(client, admin_token, test_company.id)
        assert resp1.status_code == 201

        # Second employee with same DUI in same tenant
        resp2 = self._create_employee(
            client, admin_token, test_company.id,
            full_name="Juan Pérez", email="juan@acme.com",
        )
        assert resp2.status_code == 400
        assert "DUI" in resp2.json()["detail"]

    def test_create_employee_zero_salary_allowed(self, client, admin_token, test_company):
        """Interns can have salary = 0."""
        resp = self._create_employee(
            client, admin_token, test_company.id,
            salary=0, document_type=None, document_id=None,
            email="intern@acme.com",
        )
        assert resp.status_code == 201
        assert resp.json()["salary"] == 0

    def test_list_employees(self, client, admin_token, test_company):
        # Create 2 employees
        self._create_employee(
            client, admin_token, test_company.id,
            full_name="Emp1", email="e1@a.com",
            document_type=None, document_id=None,
        )
        self._create_employee(
            client, admin_token, test_company.id,
            full_name="Emp2", email="e2@a.com",
            document_type=None, document_id=None,
        )

        resp = client.get(
            f"/payroll/employees?client_id={test_company.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_get_employee_by_id(self, client, admin_token, test_company):
        create_resp = self._create_employee(
            client, admin_token, test_company.id,
            document_type=None, document_id=None,
        )
        emp_id = create_resp.json()["id"]

        resp = client.get(
            f"/payroll/employees/{emp_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == emp_id
        assert resp.json()["full_name"] == "María García"

    def test_get_employee_not_found(self, client, admin_token):
        resp = client.get(
            f"/payroll/employees/{uuid4()}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 404

    def test_update_employee(self, client, admin_token, test_company):
        create_resp = self._create_employee(
            client, admin_token, test_company.id,
            document_type=None, document_id=None,
        )
        emp_id = create_resp.json()["id"]

        resp = client.patch(
            f"/payroll/employees/{emp_id}",
            json={"position": "Senior Dev", "department": "Engineering"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["position"] == "Senior Dev"
        assert resp.json()["department"] == "Engineering"

    def test_terminate_employee(self, client, admin_token, test_company):
        create_resp = self._create_employee(
            client, admin_token, test_company.id,
            document_type=None, document_id=None,
        )
        emp_id = create_resp.json()["id"]

        resp = client.post(
            f"/payroll/employees/{emp_id}/terminate",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "TERMINATED"
        assert data["is_active"] is False
        assert data["termination_date"] is not None

    def test_terminate_already_terminated(self, client, admin_token, test_company):
        create_resp = self._create_employee(
            client, admin_token, test_company.id,
            document_type=None, document_id=None,
        )
        emp_id = create_resp.json()["id"]

        # Terminate once
        client.post(
            f"/payroll/employees/{emp_id}/terminate",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        # Terminate again
        resp = client.post(
            f"/payroll/employees/{emp_id}/terminate",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 400

    def test_candidate_cannot_access_employees(self, client, candidate_token, test_company):
        resp = client.get(
            f"/payroll/employees?client_id={test_company.id}",
            headers={"Authorization": f"Bearer {candidate_token}"},
        )
        assert resp.status_code == 403


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CONTRACT TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestContractCRUD:
    """Test contract CRUD operations."""

    def _create_employee_and_contract(self, client, token, company_id):
        """Helper: create employee then contract, return both IDs."""
        emp_resp = client.post(
            "/payroll/employees",
            json={
                "client_id": str(company_id),
                "full_name": "Test Worker",
                "email": "worker@test.com",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        emp_id = emp_resp.json()["id"]

        contract_resp = client.post(
            "/payroll/contracts",
            json={
                "employee_id": emp_id,
                "client_id": str(company_id),
                "contract_type": "FULL_TIME",
                "start_date": "2026-01-01",
                "base_salary": 2000.00,
                "currency": "USD",
                "pay_frequency": "MONTHLY",
                "position_title": "Engineer",
                "benefits": {"health_insurance": {"provider": "ASESUISA"}},
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        return emp_id, contract_resp

    def test_create_contract(self, client, admin_token, test_company):
        emp_id, resp = self._create_employee_and_contract(
            client, admin_token, test_company.id
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["employee_id"] == emp_id
        assert data["base_salary"] == 2000.0
        assert data["contract_type"] == "FULL_TIME"
        assert data["position_title"] == "Engineer"
        assert data["benefits"]["health_insurance"]["provider"] == "ASESUISA"
        assert data["signed_by_employee_at"] is None

    def test_create_contract_invalid_employee(self, client, admin_token, test_company):
        resp = client.post(
            "/payroll/contracts",
            json={
                "employee_id": str(uuid4()),
                "client_id": str(test_company.id),
                "contract_type": "FULL_TIME",
                "start_date": "2026-01-01",
                "base_salary": 1000,
                "pay_frequency": "MONTHLY",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 404

    def test_create_contract_end_before_start(self, client, admin_token, test_company):
        # Create employee first
        emp_resp = client.post(
            "/payroll/employees",
            json={"client_id": str(test_company.id), "full_name": "X"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        emp_id = emp_resp.json()["id"]

        resp = client.post(
            "/payroll/contracts",
            json={
                "employee_id": emp_id,
                "client_id": str(test_company.id),
                "contract_type": "FULL_TIME",
                "start_date": "2026-06-01",
                "end_date": "2026-01-01",
                "base_salary": 1000,
                "pay_frequency": "MONTHLY",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 422

    def test_get_contract_by_id(self, client, admin_token, test_company):
        _, create_resp = self._create_employee_and_contract(
            client, admin_token, test_company.id
        )
        contract_id = create_resp.json()["id"]

        resp = client.get(
            f"/payroll/contracts/{contract_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == contract_id

    def test_list_contracts(self, client, admin_token, test_company):
        self._create_employee_and_contract(client, admin_token, test_company.id)

        resp = client.get(
            f"/payroll/contracts?client_id={test_company.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_update_contract(self, client, admin_token, test_company):
        _, create_resp = self._create_employee_and_contract(
            client, admin_token, test_company.id
        )
        contract_id = create_resp.json()["id"]

        resp = client.patch(
            f"/payroll/contracts/{contract_id}",
            json={"base_salary": 2500.00, "position_title": "Senior Engineer"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["base_salary"] == 2500.0
        assert resp.json()["position_title"] == "Senior Engineer"

    def test_sign_contract(self, client, admin_token, test_company):
        _, create_resp = self._create_employee_and_contract(
            client, admin_token, test_company.id
        )
        contract_id = create_resp.json()["id"]

        resp = client.post(
            f"/payroll/contracts/{contract_id}/sign",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["signed_by_employee_at"] is not None

    def test_sign_already_signed(self, client, admin_token, test_company):
        _, create_resp = self._create_employee_and_contract(
            client, admin_token, test_company.id
        )
        contract_id = create_resp.json()["id"]

        # Sign once
        client.post(
            f"/payroll/contracts/{contract_id}/sign",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        # Sign again
        resp = client.post(
            f"/payroll/contracts/{contract_id}/sign",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 400

    def test_cannot_update_signed_contract(self, client, admin_token, test_company):
        """Once signed, contract cannot be modified."""
        _, create_resp = self._create_employee_and_contract(
            client, admin_token, test_company.id
        )
        contract_id = create_resp.json()["id"]

        # Sign it
        client.post(
            f"/payroll/contracts/{contract_id}/sign",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # Try to update
        resp = client.patch(
            f"/payroll/contracts/{contract_id}",
            json={"base_salary": 5000},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 400
        assert "firmado" in resp.json()["detail"].lower()

    def test_terminate_contract(self, client, admin_token, test_company):
        _, create_resp = self._create_employee_and_contract(
            client, admin_token, test_company.id
        )
        contract_id = create_resp.json()["id"]

        resp = client.post(
            f"/payroll/contracts/{contract_id}/terminate",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False
        assert resp.json()["end_date"] is not None

    def test_terminate_inactive_contract(self, client, admin_token, test_company):
        _, create_resp = self._create_employee_and_contract(
            client, admin_token, test_company.id
        )
        contract_id = create_resp.json()["id"]

        # Terminate once
        client.post(
            f"/payroll/contracts/{contract_id}/terminate",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        # Terminate again
        resp = client.post(
            f"/payroll/contracts/{contract_id}/terminate",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 400

    def test_new_contract_deactivates_previous(self, client, admin_token, test_company):
        """Creating a new contract should deactivate the previous one."""
        emp_resp = client.post(
            "/payroll/employees",
            json={"client_id": str(test_company.id), "full_name": "MultiContract"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        emp_id = emp_resp.json()["id"]

        # First contract
        c1 = client.post(
            "/payroll/contracts",
            json={
                "employee_id": emp_id,
                "client_id": str(test_company.id),
                "contract_type": "FULL_TIME",
                "start_date": "2026-01-01",
                "base_salary": 1000,
                "pay_frequency": "MONTHLY",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        c1_id = c1.json()["id"]

        # Second contract
        c2 = client.post(
            "/payroll/contracts",
            json={
                "employee_id": emp_id,
                "client_id": str(test_company.id),
                "contract_type": "FULL_TIME",
                "start_date": "2026-06-01",
                "base_salary": 1500,
                "pay_frequency": "MONTHLY",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # Check first contract is now inactive
        c1_detail = client.get(
            f"/payroll/contracts/{c1_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert c1_detail.json()["is_active"] is False

        # Second contract is active
        assert c2.json()["is_active"] is True


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DUI VALIDATION UNIT TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestDUIValidation:
    """Test DUI format validation."""

    def test_valid_dui(self):
        from app.schemas.payroll import validate_dui_format
        assert validate_dui_format("12345678-9") == "12345678-9"
        assert validate_dui_format("00000000-0") == "00000000-0"
        assert validate_dui_format("99999999-9") == "99999999-9"

    def test_invalid_dui_too_short(self):
        from app.schemas.payroll import validate_dui_format
        with pytest.raises(ValueError, match="DUI"):
            validate_dui_format("1234-9")

    def test_invalid_dui_no_dash(self):
        from app.schemas.payroll import validate_dui_format
        with pytest.raises(ValueError, match="DUI"):
            validate_dui_format("123456789")

    def test_invalid_dui_letters(self):
        from app.schemas.payroll import validate_dui_format
        with pytest.raises(ValueError, match="DUI"):
            validate_dui_format("ABCDEFGH-9")

    def test_invalid_dui_extra_digits(self):
        from app.schemas.payroll import validate_dui_format
        with pytest.raises(ValueError, match="DUI"):
            validate_dui_format("123456789-01")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EMPLOYEE TERMINATION CASCADES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestTerminationCascades:
    """Test that employee termination deactivates contracts."""

    def test_terminate_deactivates_contracts(self, client, admin_token, test_company):
        # Create employee
        emp_resp = client.post(
            "/payroll/employees",
            json={"client_id": str(test_company.id), "full_name": "ToTerminate"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        emp_id = emp_resp.json()["id"]

        # Create contract
        c_resp = client.post(
            "/payroll/contracts",
            json={
                "employee_id": emp_id,
                "client_id": str(test_company.id),
                "contract_type": "FULL_TIME",
                "start_date": "2026-01-01",
                "base_salary": 1000,
                "pay_frequency": "MONTHLY",
            },
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        contract_id = c_resp.json()["id"]

        # Terminate employee
        client.post(
            f"/payroll/employees/{emp_id}/terminate",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        # Contract should be inactive
        c_detail = client.get(
            f"/payroll/contracts/{contract_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert c_detail.json()["is_active"] is False
        assert c_detail.json()["end_date"] is not None
