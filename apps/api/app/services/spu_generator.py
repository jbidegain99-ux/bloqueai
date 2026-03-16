"""SPU (Sistema de Planilla Única) file generator for El Salvador.

The SPU is a CSV file uploaded to the Superintendencia del Sistema Financiero
containing ISSS + AFP contribution data for all employees in a payroll period.

Format: UTF-8 with BOM, pipe-delimited (|), fixed-width numeric fields.
Deadline: First 10 business days of each month.

Record types:
  E = Encabezado (header) — 1 per file
  D = Detalle (detail) — 1 per employee
  T = Trailer (totals) — 1 per file
"""

import hashlib
import io
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.payroll import (
    PayrollRun, PayrollLine, PayrollDeductionBreakdown,
    Employee, DeductionCategory,
)
from app.models.company import Company


_TWO = Decimal("0.01")


def _r(value) -> Decimal:
    return Decimal(str(value)).quantize(_TWO, rounding=ROUND_HALF_UP)


def _fmt_amount(amount, width: int = 12) -> str:
    """Format amount as zero-padded string with 2 decimal places, no dot."""
    cents = int(_r(Decimal(str(amount))) * 100)
    return str(abs(cents)).zfill(width)


def _fmt_text(text: str, width: int) -> str:
    """Left-align text, pad with spaces, strip non-ASCII."""
    clean = "".join(c for c in text if 32 <= ord(c) < 127)
    return clean[:width].ljust(width)


@dataclass
class SPUDetailRow:
    """One employee row in the SPU file."""
    dui: str
    full_name: str
    gross_salary: Decimal
    isss_employee: Decimal
    isss_employer: Decimal
    afp_employee: Decimal
    afp_employer: Decimal
    isr: Decimal
    net_salary: Decimal
    afp_provider: str  # CONFIA or CRECER


@dataclass
class SPUValidationResult:
    """Result of SPU file validation."""
    valid: bool
    errors: list[str]
    warnings: list[str]
    employee_count: int
    total_isss: Decimal
    total_afp: Decimal


class SPUGenerator:
    """Generates SPU (Planilla Única) files for ISSS/AFP submission."""

    DELIMITER = "|"

    def generate(
        self,
        db: Session,
        payroll_run_id: UUID,
        institution_code: str = "001",
    ) -> tuple[str, SPUValidationResult]:
        """Generate SPU CSV content for a payroll run.

        Returns (csv_content, validation_result).
        """
        run = db.query(PayrollRun).filter(PayrollRun.id == payroll_run_id).first()
        if not run:
            return "", SPUValidationResult(
                valid=False, errors=["Nómina no encontrada"],
                warnings=[], employee_count=0,
                total_isss=Decimal("0"), total_afp=Decimal("0"),
            )

        company = db.query(Company).filter(Company.id == run.client_id).first()
        company_name = company.name if company else "EMPRESA"

        lines = db.query(PayrollLine).filter(
            PayrollLine.payroll_run_id == payroll_run_id
        ).all()

        # Build detail rows
        detail_rows: list[SPUDetailRow] = []
        errors: list[str] = []
        warnings: list[str] = []

        for line in lines:
            emp = db.query(Employee).filter(Employee.id == line.employee_id).first()
            if not emp:
                errors.append(f"Empleado {line.employee_id} no encontrado")
                continue

            # DUI is required for SPU
            dui = emp.document_id or ""
            if not dui or not emp.document_type or emp.document_type.value != "DUI":
                errors.append(
                    f"{emp.full_name}: DUI requerido para SPU (tiene: {emp.document_type})"
                )
                continue

            # Get deduction breakdowns
            breakdowns = db.query(PayrollDeductionBreakdown).filter(
                PayrollDeductionBreakdown.payroll_line_id == line.id
            ).all()

            isss_emp = Decimal("0")
            afp_emp = Decimal("0")
            isr = Decimal("0")
            for bd in breakdowns:
                if bd.deduction_type == DeductionCategory.ISSS:
                    isss_emp = Decimal(str(bd.amount))
                elif bd.deduction_type == DeductionCategory.AFP:
                    afp_emp = Decimal(str(bd.amount))
                elif bd.deduction_type == DeductionCategory.INCOME_TAX:
                    isr = Decimal(str(bd.amount))

            # Employer contributions (recalculate from rates)
            gross = Decimal(str(line.gross_pay))
            isss_base = min(gross, Decimal("1000"))
            isss_empr = _r(isss_base * Decimal("0.075"))
            afp_empr = _r(gross * Decimal("0.0775"))

            # AFP provider from EOR employee or default
            afp_provider = "CONFIA"
            if hasattr(emp, "afp_provider") and emp.afp_provider:
                afp_provider = emp.afp_provider

            detail_rows.append(SPUDetailRow(
                dui=dui,
                full_name=emp.full_name,
                gross_salary=gross,
                isss_employee=isss_emp,
                isss_employer=isss_empr,
                afp_employee=afp_emp,
                afp_employer=afp_empr,
                isr=isr,
                net_salary=Decimal(str(line.net_pay)),
                afp_provider=afp_provider,
            ))

        total_isss = sum(r.isss_employee + r.isss_employer for r in detail_rows)
        total_afp = sum(r.afp_employee + r.afp_employer for r in detail_rows)

        validation = SPUValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            employee_count=len(detail_rows),
            total_isss=_r(total_isss),
            total_afp=_r(total_afp),
        )

        if not validation.valid:
            return "", validation

        # Generate CSV
        period = run.period_start.strftime("%Y%m")
        csv_content = self._build_csv(
            institution_code=institution_code,
            company_name=company_name,
            period=period,
            detail_rows=detail_rows,
            total_isss=_r(total_isss),
            total_afp=_r(total_afp),
        )

        return csv_content, validation

    def _build_csv(
        self,
        institution_code: str,
        company_name: str,
        period: str,
        detail_rows: list[SPUDetailRow],
        total_isss: Decimal,
        total_afp: Decimal,
    ) -> str:
        """Build the SPU CSV file content."""
        d = self.DELIMITER
        buf = io.StringIO()

        # UTF-8 BOM for Excel compatibility
        buf.write("\ufeff")

        # Header record (E)
        total_gross = sum(r.gross_salary for r in detail_rows)
        header = d.join([
            "E",
            institution_code,
            _fmt_text(company_name, 60),
            period,
            str(len(detail_rows)).zfill(6),
            _fmt_amount(_r(total_gross)),
            _fmt_amount(total_isss),
            _fmt_amount(total_afp),
        ])
        buf.write(header + "\n")

        # Detail records (D)
        for row in detail_rows:
            detail = d.join([
                "D",
                _fmt_text(row.dui, 10),
                _fmt_text(row.full_name, 60),
                _fmt_amount(row.gross_salary),
                _fmt_amount(row.isss_employee),
                _fmt_amount(row.isss_employer),
                _fmt_amount(row.afp_employee),
                _fmt_amount(row.afp_employer),
                _fmt_text(row.afp_provider, 10),
                _fmt_amount(row.isr),
                _fmt_amount(row.net_salary),
            ])
            buf.write(detail + "\n")

        # Trailer record (T)
        grand_total = _r(total_isss + total_afp)
        content_for_checksum = buf.getvalue()
        checksum = hashlib.md5(content_for_checksum.encode("utf-8")).hexdigest()[:8].upper()

        trailer = d.join([
            "T",
            str(len(detail_rows)).zfill(6),
            _fmt_amount(_r(total_gross)),
            _fmt_amount(total_isss),
            _fmt_amount(total_afp),
            _fmt_amount(grand_total),
            checksum,
        ])
        buf.write(trailer + "\n")

        return buf.getvalue()

    def validate_spu_content(self, content: str) -> SPUValidationResult:
        """Validate an existing SPU file's format and totals."""
        errors: list[str] = []
        warnings: list[str] = []
        lines_list = content.strip().split("\n")

        if not lines_list:
            return SPUValidationResult(
                valid=False, errors=["Archivo vacío"],
                warnings=[], employee_count=0,
                total_isss=Decimal("0"), total_afp=Decimal("0"),
            )

        # Remove BOM if present
        if lines_list[0].startswith("\ufeff"):
            lines_list[0] = lines_list[0][1:]

        d = self.DELIMITER

        # Check header
        header_parts = lines_list[0].split(d)
        if not header_parts or header_parts[0].strip() != "E":
            errors.append("Falta encabezado (registro tipo E)")

        # Check trailer
        trailer_parts = lines_list[-1].split(d)
        if not trailer_parts or trailer_parts[0].strip() != "T":
            errors.append("Falta trailer (registro tipo T)")

        # Count detail records
        detail_count = 0
        total_isss = Decimal("0")
        total_afp = Decimal("0")
        for line in lines_list[1:-1]:
            parts = line.split(d)
            if parts and parts[0].strip() == "D":
                detail_count += 1
                # Parse ISSS (employee + employer) and AFP (employee + employer)
                if len(parts) >= 8:
                    isss_emp = Decimal(parts[4].strip()) / 100 if parts[4].strip() else Decimal("0")
                    isss_empr = Decimal(parts[5].strip()) / 100 if parts[5].strip() else Decimal("0")
                    afp_emp = Decimal(parts[6].strip()) / 100 if parts[6].strip() else Decimal("0")
                    afp_empr = Decimal(parts[7].strip()) / 100 if parts[7].strip() else Decimal("0")
                    total_isss += isss_emp + isss_empr
                    total_afp += afp_emp + afp_empr

                # Check DUI present
                if len(parts) >= 2 and not parts[1].strip():
                    errors.append(f"Registro detalle sin DUI (fila {detail_count})")

        # Verify counts match
        if header_parts and len(header_parts) >= 5:
            declared_count = int(header_parts[4].strip()) if header_parts[4].strip().isdigit() else 0
            if declared_count != detail_count:
                errors.append(
                    f"Encabezado declara {declared_count} empleados pero hay {detail_count} registros detalle"
                )

        return SPUValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            employee_count=detail_count,
            total_isss=_r(total_isss),
            total_afp=_r(total_afp),
        )
