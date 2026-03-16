"""Payroll compliance validation service for El Salvador.

Validates payroll data against SV labor law requirements before
government submission (SPU, ISSS, AFP reports).
"""

from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.payroll import (
    PayrollRun, PayrollLine, PayrollDeductionBreakdown,
    Employee, Contract, DeductionCategory, EmployeeStatus,
)
from app.models.company import Company


ISSS_TOPE = Decimal("1000.00")
ISSS_RATE_EMP = Decimal("0.03")
AFP_RATE_EMP = Decimal("0.0725")
TOLERANCE = Decimal("0.50")  # $0.50 tolerance for rounding differences


@dataclass
class ComplianceCheck:
    """Result of a single compliance check."""
    name: str
    passed: bool
    detail: str


@dataclass
class ComplianceReport:
    """Full compliance validation report for a payroll run."""
    payroll_run_id: UUID
    compliant: bool
    checks: list[ComplianceCheck] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def validate_payroll_compliance(
    db: Session,
    payroll_run_id: UUID,
) -> ComplianceReport:
    """Run all compliance checks on a payroll run.

    Checks:
    1. All employees have DUI
    2. All employees have bank accounts
    3. No negative salaries
    4. ISSS deductions within cap
    5. ISR non-negative
    6. Net salary non-negative (no over-deduction)
    7. Contract exists and is active for each employee
    8. Payroll totals are consistent
    """
    report = ComplianceReport(payroll_run_id=payroll_run_id, compliant=True)

    run = db.query(PayrollRun).filter(PayrollRun.id == payroll_run_id).first()
    if not run:
        report.compliant = False
        report.errors.append("Nómina no encontrada")
        return report

    lines = db.query(PayrollLine).filter(
        PayrollLine.payroll_run_id == payroll_run_id
    ).all()

    if not lines:
        report.warnings.append("Nómina sin líneas de empleados")
        report.checks.append(ComplianceCheck(
            name="employee_count", passed=True,
            detail="0 empleados en la nómina",
        ))
        return report

    # Check 1: All employees have DUI
    employees_without_dui = []
    employees_without_bank = []
    for line in lines:
        emp = db.query(Employee).filter(Employee.id == line.employee_id).first()
        if not emp:
            report.errors.append(f"Empleado {line.employee_id} no encontrado en DB")
            continue
        if not emp.document_id or not emp.document_type:
            employees_without_dui.append(emp.full_name)
        if not emp.bank_account_number:
            employees_without_bank.append(emp.full_name)

    report.checks.append(ComplianceCheck(
        name="dui_present",
        passed=len(employees_without_dui) == 0,
        detail=f"{len(employees_without_dui)} empleados sin DUI" if employees_without_dui
        else f"Todos los {len(lines)} empleados tienen DUI",
    ))
    if employees_without_dui:
        report.errors.append(
            f"Empleados sin DUI: {', '.join(employees_without_dui[:5])}"
            + (f" (+{len(employees_without_dui)-5} más)" if len(employees_without_dui) > 5 else "")
        )

    # Check 2: Bank accounts
    report.checks.append(ComplianceCheck(
        name="bank_accounts",
        passed=len(employees_without_bank) == 0,
        detail=f"{len(employees_without_bank)} empleados sin cuenta bancaria" if employees_without_bank
        else f"Todos los {len(lines)} empleados tienen cuenta bancaria",
    ))
    if employees_without_bank:
        report.warnings.append(
            f"Empleados sin cuenta bancaria: {', '.join(employees_without_bank[:5])}"
        )

    # Check 3-6: Per-line validations
    negative_salaries = []
    isss_over_cap = []
    negative_isr = []
    negative_net = []
    missing_contracts = []

    for line in lines:
        emp = db.query(Employee).filter(Employee.id == line.employee_id).first()
        name = emp.full_name if emp else str(line.employee_id)

        # Negative salary
        if line.gross_pay < 0:
            negative_salaries.append(name)

        # ISSS over cap
        breakdowns = db.query(PayrollDeductionBreakdown).filter(
            PayrollDeductionBreakdown.payroll_line_id == line.id
        ).all()

        for bd in breakdowns:
            if bd.deduction_type == DeductionCategory.ISSS:
                max_isss = ISSS_TOPE * ISSS_RATE_EMP + TOLERANCE
                if Decimal(str(bd.amount)) > max_isss:
                    isss_over_cap.append(f"{name}: ${bd.amount}")
            if bd.deduction_type == DeductionCategory.INCOME_TAX:
                if Decimal(str(bd.amount)) < 0:
                    negative_isr.append(name)

        # Negative net
        if line.net_pay < 0:
            negative_net.append(name)

        # Active contract check
        if line.contract_id:
            contract = db.query(Contract).filter(Contract.id == line.contract_id).first()
            if not contract or not contract.is_active:
                missing_contracts.append(name)

    report.checks.append(ComplianceCheck(
        name="no_negative_salaries",
        passed=len(negative_salaries) == 0,
        detail=f"{len(negative_salaries)} salarios negativos" if negative_salaries
        else "Sin salarios negativos",
    ))
    if negative_salaries:
        report.errors.append(f"Salarios negativos: {', '.join(negative_salaries)}")

    report.checks.append(ComplianceCheck(
        name="isss_within_cap",
        passed=len(isss_over_cap) == 0,
        detail=f"{len(isss_over_cap)} ISSS sobre tope" if isss_over_cap
        else "ISSS dentro del tope ($30 máximo empleado)",
    ))
    if isss_over_cap:
        report.errors.append(f"ISSS sobre tope: {', '.join(isss_over_cap)}")

    report.checks.append(ComplianceCheck(
        name="isr_non_negative",
        passed=len(negative_isr) == 0,
        detail=f"{len(negative_isr)} ISR negativos" if negative_isr
        else "ISR no negativo para todos los empleados",
    ))
    if negative_isr:
        report.errors.append(f"ISR negativo: {', '.join(negative_isr)}")

    report.checks.append(ComplianceCheck(
        name="net_non_negative",
        passed=len(negative_net) == 0,
        detail=f"{len(negative_net)} netos negativos" if negative_net
        else "Salario neto positivo para todos los empleados",
    ))
    if negative_net:
        report.errors.append(f"Neto negativo (sobre-deducción): {', '.join(negative_net)}")

    report.checks.append(ComplianceCheck(
        name="active_contracts",
        passed=len(missing_contracts) == 0,
        detail=f"{len(missing_contracts)} sin contrato activo" if missing_contracts
        else "Todos los empleados tienen contrato activo",
    ))
    if missing_contracts:
        report.warnings.append(f"Sin contrato activo: {', '.join(missing_contracts)}")

    # Check 8: Totals consistency
    sum_gross = sum(Decimal(str(l.gross_pay)) for l in lines)
    sum_deductions = sum(Decimal(str(l.total_deductions)) for l in lines)
    sum_net = sum(Decimal(str(l.net_pay)) for l in lines)
    expected_net = sum_gross - sum_deductions
    totals_match = abs(sum_net - expected_net) < TOLERANCE

    report.checks.append(ComplianceCheck(
        name="totals_consistent",
        passed=totals_match,
        detail=f"Bruto ${sum_gross} - Deducciones ${sum_deductions} = Neto ${sum_net}"
        if totals_match else f"Discrepancia: esperado ${expected_net}, actual ${sum_net}",
    ))
    if not totals_match:
        report.errors.append(f"Totales inconsistentes: neto esperado ${expected_net}, actual ${sum_net}")

    report.compliant = len(report.errors) == 0
    return report
