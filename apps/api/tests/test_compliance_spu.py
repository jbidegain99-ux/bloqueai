"""Tests for SPU generation, compliance validation, and government reports.

Covers:
- SPU file format (header/detail/trailer, pipe-delimited, UTF-8 BOM)
- SPU validation (missing DUI, totals mismatch)
- Compliance checks (DUI, bank accounts, ISSS cap, ISR, net salary)
- ISSS/AFP/ISR report generation
- Full workflow: create payroll → calculate → compliance → SPU
"""

from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

import pytest

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.payroll import (
    Employee, Contract, PayrollRun, PayrollLine,
    PayrollDeductionBreakdown, PayrollProvision,
    PayFrequency, ContractType, PayrollRunStatus,
    DeductionCategory, ProvisionType, DocumentType, EmployeeStatus,
)
from app.services.spu_generator import SPUGenerator, SPUValidationResult
from app.services.compliance_service import validate_payroll_compliance


@pytest.fixture(autouse=True)
def enable_payroll():
    original = settings.enable_payroll
    settings.enable_payroll = True
    yield
    settings.enable_payroll = original


def _seed_payroll(db, company, admin_user, salaries):
    """Helper: create employees + contracts + payroll run + lines + breakdowns.

    Returns (run, employees) tuple.
    """
    employees = []
    for i, salary in enumerate(salaries):
        emp = Employee(
            id=uuid4(),
            client_id=company.id,
            full_name=f"Empleado {i+1}",
            email=f"emp{i+1}@test.com",
            document_type=DocumentType.DUI,
            document_id=f"{10000000+i:08d}-{i}",
            salary=salary,
            salary_currency="USD",
            status=EmployeeStatus.ACTIVE,
            is_active=True,
            hire_date=date(2024, 1, 1),
            bank_account_number=f"0000-{i+1:04d}",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(emp)
        db.flush()

        contract = Contract(
            id=uuid4(),
            employee_id=emp.id,
            client_id=company.id,
            contract_type=ContractType.FULL_TIME,
            start_date=date(2024, 1, 1),
            base_salary=salary,
            currency="USD",
            pay_frequency=PayFrequency.MONTHLY,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(contract)
        db.flush()
        employees.append(emp)

    # Create payroll run
    run = PayrollRun(
        id=uuid4(),
        client_id=company.id,
        period_start=date(2026, 3, 1),
        period_end=date(2026, 3, 31),
        pay_frequency=PayFrequency.MONTHLY,
        status=PayrollRunStatus.CALCULATED,
        currency="USD",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(run)
    db.flush()

    # Create payroll lines with deduction breakdowns
    from app.services.payroll_sv import PayrollCalculatorSV
    calc = PayrollCalculatorSV()

    total_gross = 0.0
    total_deductions = 0.0
    total_net = 0.0

    for emp in employees:
        result = calc.calcular_planilla(Decimal(str(emp.salary)))

        line = PayrollLine(
            id=uuid4(),
            payroll_run_id=run.id,
            employee_id=emp.id,
            contract_id=contract.id,
            base_salary=float(emp.salary),
            gross_pay=float(result.gross_salary),
            total_deductions=float(result.total_deductions),
            net_pay=float(result.net_salary),
            deductions_detail=[],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(line)
        db.flush()

        # Deduction breakdowns
        for cat, amount, desc in [
            (DeductionCategory.ISSS, result.isss_employee, "ISSS"),
            (DeductionCategory.AFP, result.afp_employee, "AFP"),
            (DeductionCategory.INCOME_TAX, result.isr, "ISR"),
        ]:
            if amount > 0:
                db.add(PayrollDeductionBreakdown(
                    id=uuid4(),
                    payroll_line_id=line.id,
                    deduction_type=cat,
                    amount=amount,
                    description=desc,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                ))

        total_gross += float(result.gross_salary)
        total_deductions += float(result.total_deductions)
        total_net += float(result.net_salary)

    run.total_gross = total_gross
    run.total_deductions = total_deductions
    run.total_net = total_net
    run.employee_count = len(employees)
    db.commit()

    return run, employees


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SPU GENERATOR UNIT TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestSPUGenerator:
    """Test SPU file generation."""

    def test_generate_spu_basic(self, db, test_company, test_admin):
        """Generate SPU for 3 employees at different salaries."""
        run, emps = _seed_payroll(db, test_company, test_admin, [800, 1200, 2000])

        gen = SPUGenerator()
        content, validation = gen.generate(db, run.id)

        assert validation.valid
        assert validation.employee_count == 3
        assert validation.total_isss > Decimal("0")
        assert validation.total_afp > Decimal("0")
        assert len(validation.errors) == 0

    def test_spu_format_header(self, db, test_company, test_admin):
        """SPU file starts with UTF-8 BOM and header record."""
        run, _ = _seed_payroll(db, test_company, test_admin, [1000])

        gen = SPUGenerator()
        content, _ = gen.generate(db, run.id)

        assert content.startswith("\ufeff")  # UTF-8 BOM
        lines = content.strip().split("\n")
        header = lines[0].lstrip("\ufeff")
        assert header.startswith("E|")  # Header record type

    def test_spu_format_detail_records(self, db, test_company, test_admin):
        """Each employee gets a D record with DUI and amounts."""
        run, emps = _seed_payroll(db, test_company, test_admin, [1000, 1500])

        gen = SPUGenerator()
        content, _ = gen.generate(db, run.id)

        lines = content.strip().split("\n")
        detail_lines = [l for l in lines if l.startswith("D|")]
        assert len(detail_lines) == 2

        # Check first detail has DUI
        parts = detail_lines[0].split("|")
        assert parts[0] == "D"
        assert parts[1].strip()  # DUI present

    def test_spu_format_trailer(self, db, test_company, test_admin):
        """SPU ends with trailer record (T) containing totals and checksum."""
        run, _ = _seed_payroll(db, test_company, test_admin, [1000])

        gen = SPUGenerator()
        content, _ = gen.generate(db, run.id)

        lines = content.strip().split("\n")
        trailer = lines[-1]
        assert trailer.startswith("T|")
        parts = trailer.split("|")
        assert len(parts) >= 7  # T, count, gross, isss, afp, grand_total, checksum

    def test_spu_record_count_matches(self, db, test_company, test_admin):
        """Header and trailer employee counts match detail record count."""
        run, _ = _seed_payroll(db, test_company, test_admin, [800, 1200, 2000])

        gen = SPUGenerator()
        content, _ = gen.generate(db, run.id)

        lines = content.strip().split("\n")
        header_parts = lines[0].lstrip("\ufeff").split("|")
        trailer_parts = lines[-1].split("|")
        detail_count = len([l for l in lines if l.startswith("D|")])

        header_count = int(header_parts[4].strip())
        trailer_count = int(trailer_parts[1].strip())

        assert header_count == detail_count == trailer_count == 3

    def test_spu_fails_without_dui(self, db, test_company, test_admin):
        """SPU generation fails if employee lacks DUI."""
        emp = Employee(
            id=uuid4(),
            client_id=test_company.id,
            full_name="Sin DUI",
            email="nodui@test.com",
            status=EmployeeStatus.ACTIVE,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(emp)
        db.flush()

        contract = Contract(
            id=uuid4(),
            employee_id=emp.id,
            client_id=test_company.id,
            contract_type=ContractType.FULL_TIME,
            start_date=date(2024, 1, 1),
            base_salary=1000,
            currency="USD",
            pay_frequency=PayFrequency.MONTHLY,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(contract)
        db.flush()

        run = PayrollRun(
            id=uuid4(),
            client_id=test_company.id,
            period_start=date(2026, 3, 1),
            period_end=date(2026, 3, 31),
            pay_frequency=PayFrequency.MONTHLY,
            status=PayrollRunStatus.CALCULATED,
            currency="USD",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(run)
        db.flush()

        line = PayrollLine(
            id=uuid4(),
            payroll_run_id=run.id,
            employee_id=emp.id,
            base_salary=1000,
            gross_pay=1000,
            total_deductions=162.95,
            net_pay=837.05,
            deductions_detail=[],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(line)
        db.commit()

        gen = SPUGenerator()
        content, validation = gen.generate(db, run.id)

        assert not validation.valid
        assert any("DUI" in e for e in validation.errors)

    def test_spu_validate_content(self, db, test_company, test_admin):
        """validate_spu_content() can re-validate a generated SPU file."""
        run, _ = _seed_payroll(db, test_company, test_admin, [1000, 2000])

        gen = SPUGenerator()
        content, _ = gen.generate(db, run.id)

        # Re-validate the generated content
        result = gen.validate_spu_content(content)
        assert result.valid
        assert result.employee_count == 2


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# COMPLIANCE VALIDATION TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestComplianceValidation:
    """Test compliance checks on payroll data."""

    def test_compliant_payroll(self, db, test_company, test_admin):
        """A well-formed payroll should pass all checks."""
        run, _ = _seed_payroll(db, test_company, test_admin, [1000, 1500])

        report = validate_payroll_compliance(db, run.id)

        assert report.compliant
        assert len(report.errors) == 0
        assert len(report.checks) >= 6

    def test_missing_dui_flagged(self, db, test_company, test_admin):
        """Employees without DUI should be flagged."""
        run, emps = _seed_payroll(db, test_company, test_admin, [1000])

        # Remove DUI from employee
        emps[0].document_id = None
        emps[0].document_type = None
        db.commit()

        report = validate_payroll_compliance(db, run.id)

        dui_check = next(c for c in report.checks if c.name == "dui_present")
        assert not dui_check.passed
        assert any("DUI" in e for e in report.errors)

    def test_totals_consistency(self, db, test_company, test_admin):
        """Gross - deductions should equal net."""
        run, _ = _seed_payroll(db, test_company, test_admin, [1000])

        report = validate_payroll_compliance(db, run.id)

        totals_check = next(c for c in report.checks if c.name == "totals_consistent")
        assert totals_check.passed

    def test_nonexistent_payroll(self, db):
        """Compliance check on non-existent payroll should fail."""
        report = validate_payroll_compliance(db, uuid4())
        assert not report.compliant
        assert any("no encontrada" in e for e in report.errors)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# REPORT ENDPOINT INTEGRATION TESTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestReportEndpoints:
    """Test ISSS/AFP/ISR report and SPU endpoints via HTTP."""

    def _seed_and_get_run_id(self, db, client, company, admin_token):
        """Create a calculated payroll via DB seeding, return run_id."""
        run, _ = _seed_payroll(db, company, None, [1000, 1500])
        return str(run.id)

    def test_compliance_endpoint(self, client, db, admin_token, test_company, test_admin):
        run, _ = _seed_payroll(db, test_company, test_admin, [1000])
        resp = client.get(
            f"/payroll/runs/{run.id}/compliance",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["compliant"] is True
        assert len(data["checks"]) >= 6

    def test_spu_endpoint(self, client, db, admin_token, test_company, test_admin):
        run, _ = _seed_payroll(db, test_company, test_admin, [1000, 1500])
        resp = client.post(
            f"/payroll/runs/{run.id}/spu",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]
        content = resp.text
        assert content.startswith("\ufeff")
        lines = content.strip().split("\n")
        assert lines[0].lstrip("\ufeff").startswith("E|")
        assert lines[-1].startswith("T|")

    def test_isss_report_endpoint(self, client, db, admin_token, test_company, test_admin):
        run, _ = _seed_payroll(db, test_company, test_admin, [1000])
        resp = client.get(
            f"/payroll/runs/{run.id}/report/isss",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["employee_count"] == 1
        assert data["total_isss_employee"] > 0
        assert data["total_isss_employer"] > 0
        assert data["total_isss"] == data["total_isss_employee"] + data["total_isss_employer"]

    def test_afp_report_endpoint(self, client, db, admin_token, test_company, test_admin):
        run, _ = _seed_payroll(db, test_company, test_admin, [1000])
        resp = client.get(
            f"/payroll/runs/{run.id}/report/afp",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["employee_count"] == 1
        assert data["total_afp_employee"] > 0
        assert data["total_afp_employer"] > 0

    def test_isr_report_endpoint(self, client, db, admin_token, test_company, test_admin):
        run, _ = _seed_payroll(db, test_company, test_admin, [1000])
        resp = client.get(
            f"/payroll/runs/{run.id}/report/isr",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["employee_count"] == 1
        assert data["total_isr"] >= 0

    def test_spu_fails_for_draft_payroll(self, client, db, admin_token, test_company, test_admin):
        """Cannot generate SPU for a DRAFT payroll."""
        run, _ = _seed_payroll(db, test_company, test_admin, [1000])
        run.status = PayrollRunStatus.DRAFT
        db.commit()

        resp = client.post(
            f"/payroll/runs/{run.id}/spu",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 400


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FULL WORKFLOW TEST
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestComplianceWorkflow:
    """End-to-end: create payroll → compliance check → SPU generation."""

    def test_full_workflow(self, client, db, admin_token, test_company, test_admin):
        """Complete workflow: seed → compliance → SPU → validate SPU."""
        # 1. Seed payroll with 3 employees
        run, emps = _seed_payroll(db, test_company, test_admin, [800, 1200, 2000])

        # 2. Check compliance
        resp = client.get(
            f"/payroll/runs/{run.id}/compliance",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["compliant"] is True

        # 3. Generate SPU
        resp = client.post(
            f"/payroll/runs/{run.id}/spu",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        spu_content = resp.text

        # 4. Validate the generated SPU
        gen = SPUGenerator()
        result = gen.validate_spu_content(spu_content)
        assert result.valid
        assert result.employee_count == 3

        # 5. Verify ISSS report
        resp = client.get(
            f"/payroll/runs/{run.id}/report/isss",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["employee_count"] == 3

        # 6. Verify AFP report
        resp = client.get(
            f"/payroll/runs/{run.id}/report/afp",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.json()["employee_count"] == 3
