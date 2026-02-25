"""Tests for El Salvador payroll calculator."""

from datetime import date
from decimal import Decimal

import pytest

from app.services.payroll_sv import PayrollCalculatorSV, PayrollResult


@pytest.fixture
def calc():
    return PayrollCalculatorSV()


# ── ISR Tests ─────────────────────────────────────────────────


class TestISR:
    def test_tramo1_exempt(self, calc: PayrollCalculatorSV):
        """Salario gravable <= $472 → ISR = 0."""
        assert calc.calcular_isr(Decimal("400")) == Decimal("0")
        assert calc.calcular_isr(Decimal("472")) == Decimal("0")

    def test_tramo2_10pct(self, calc: PayrollCalculatorSV):
        """$472.01 - $895.24 → 10% sobre excedente + $17.67."""
        isr = calc.calcular_isr(Decimal("700"))
        # excedente = 700 - 472.01 = 227.99 → 227.99 * 0.10 + 17.67 = 40.47
        assert isr == Decimal("40.47")

    def test_tramo3_20pct(self, calc: PayrollCalculatorSV):
        """$895.25 - $2038.10 → 20% sobre excedente + $60.00."""
        isr = calc.calcular_isr(Decimal("1500"))
        # excedente = 1500 - 895.25 = 604.75 → 604.75 * 0.20 + 60.00 = 180.95
        assert isr == Decimal("180.95")

    def test_tramo4_30pct(self, calc: PayrollCalculatorSV):
        """$2038.11+ → 30% sobre excedente + $288.57."""
        isr = calc.calcular_isr(Decimal("3000"))
        # excedente = 3000 - 2038.11 = 961.89 → 961.89 * 0.30 + 288.57 = 577.14
        assert isr == Decimal("577.14")

    def test_zero_salary(self, calc: PayrollCalculatorSV):
        assert calc.calcular_isr(Decimal("0")) == Decimal("0")

    def test_negative_salary(self, calc: PayrollCalculatorSV):
        assert calc.calcular_isr(Decimal("-100")) == Decimal("0")


# ── Planilla completa ─────────────────────────────────────────


class TestPlanilla:
    def test_basic_1000(self, calc: PayrollCalculatorSV):
        """Nómina básica de $1,000."""
        r = calc.calcular_planilla(Decimal("1000"))

        assert isinstance(r, PayrollResult)
        assert r.gross_salary == Decimal("1000.00")

        # ISSS emp: min(1000, 1000) * 0.03 = 30.00
        assert r.isss_employee == Decimal("30.00")
        # AFP emp: 1000 * 0.0725 = 72.50
        assert r.afp_employee == Decimal("72.50")

        # Gravable = 1000 - 30 - 72.50 = 897.50 → tramo 3
        # excedente = 897.50 - 895.25 = 2.25 → 2.25 * 0.20 + 60.00 = 60.45
        assert r.isr == Decimal("60.45")

        assert r.total_deductions == Decimal("162.95")
        assert r.net_salary == Decimal("837.05")

        # Patronal
        assert r.isss_employer == Decimal("75.00")
        assert r.afp_employer == Decimal("77.50")

        assert r.total_employer_cost == Decimal("1152.50")
        assert r.fee_talentos == Decimal("349.00")
        assert r.grand_total == Decimal("1501.50")

    def test_salary_500(self, calc: PayrollCalculatorSV):
        """Nómina de $500."""
        r = calc.calcular_planilla(Decimal("500"))
        assert r.gross_salary == Decimal("500.00")
        assert r.isss_employee == Decimal("15.00")
        assert r.afp_employee == Decimal("36.25")
        # Gravable = 500 - 15 - 36.25 = 448.75 → tramo 1 (exempt)
        assert r.isr == Decimal("0")
        assert r.net_salary == Decimal("448.75")

    def test_salary_above_isss_cap(self, calc: PayrollCalculatorSV):
        """ISSS tops at $1,000 for salaries above that."""
        r = calc.calcular_planilla(Decimal("2000"))
        # ISSS base = min(2000, 1000) = 1000
        assert r.isss_employee == Decimal("30.00")
        assert r.isss_employer == Decimal("75.00")
        # AFP is on full salary
        assert r.afp_employee == Decimal("145.00")
        assert r.afp_employer == Decimal("155.00")

    def test_with_overtime_and_bonus(self, calc: PayrollCalculatorSV):
        """Overtime and bonuses add to gross."""
        r = calc.calcular_planilla(
            Decimal("800"),
            horas_extra=Decimal("100"),
            bonificaciones=Decimal("50"),
        )
        assert r.gross_salary == Decimal("950.00")
        assert r.overtime == Decimal("100.00")
        assert r.bonuses == Decimal("50.00")

    def test_with_other_deductions(self, calc: PayrollCalculatorSV):
        """Other deductions reduce net."""
        r1 = calc.calcular_planilla(Decimal("1000"))
        r2 = calc.calcular_planilla(Decimal("1000"), otras_deducciones=Decimal("50"))
        assert r2.net_salary == r1.net_salary - Decimal("50.00")
        assert r2.other_deductions == Decimal("50.00")


# ── Aguinaldo ─────────────────────────────────────────────────


class TestAguinaldo:
    def test_1_to_3_years(self, calc: PayrollCalculatorSV):
        """1-3 años → 15 días de salario."""
        ag = calc.calcular_aguinaldo(
            Decimal("1000"),
            date(2024, 1, 1),
            date(2025, 12, 15),  # ~2 years
        )
        # 15 días * (1000/30) = 500.00
        assert ag == Decimal("500.00")

    def test_3_to_10_years(self, calc: PayrollCalculatorSV):
        """3-10 años → 19 días de salario."""
        ag = calc.calcular_aguinaldo(
            Decimal("1200"),
            date(2020, 1, 1),
            date(2025, 12, 15),  # ~6 years
        )
        # 19 días * (1200/30) = 760.00
        assert ag == Decimal("760.00")

    def test_10_plus_years(self, calc: PayrollCalculatorSV):
        """10+ años → 21 días de salario."""
        ag = calc.calcular_aguinaldo(
            Decimal("1500"),
            date(2010, 1, 1),
            date(2025, 12, 15),  # ~15 years
        )
        # 21 días * (1500/30) = 1050.00
        assert ag == Decimal("1050.00")

    def test_proportional_under_1_year(self, calc: PayrollCalculatorSV):
        """Menos de 1 año → proporcional."""
        ag = calc.calcular_aguinaldo(
            Decimal("900"),
            date(2025, 7, 1),
            date(2025, 12, 15),  # ~168 days
        )
        # proporcional = (900/30) * 15 * (168/365)
        assert ag > Decimal("0")
        assert ag < Decimal("450")  # Less than full 15 days


# ── Vacaciones ────────────────────────────────────────────────


class TestVacaciones:
    def test_standard_15_days(self, calc: PayrollCalculatorSV):
        """15 días + 30% recargo."""
        vac = calc.calcular_vacaciones(Decimal("1000"))
        # (1000/30) * 15 = 500 → 500 * 1.30 = 650.00
        assert vac == Decimal("650.00")

    def test_custom_days(self, calc: PayrollCalculatorSV):
        """Custom vacation days."""
        vac = calc.calcular_vacaciones(Decimal("1200"), dias_vacaciones=10)
        # (1200/30) * 10 = 400 → 400 * 1.30 = 520.00
        assert vac == Decimal("520.00")


# ── Indemnización ─────────────────────────────────────────────


class TestIndemnizacion:
    def test_3_years(self, calc: PayrollCalculatorSV):
        """3 años → 3 * 30 días = 90 días de salario."""
        ind = calc.calcular_indemnizacion(
            Decimal("1000"),
            date(2022, 1, 1),
            date(2025, 1, 1),
        )
        # ~3 years * 1000 (30 días / 30 días = salario mensual) ≈ 3000
        assert ind > Decimal("2900")
        assert ind < Decimal("3100")

    def test_zero_if_same_day(self, calc: PayrollCalculatorSV):
        ind = calc.calcular_indemnizacion(
            Decimal("1000"),
            date(2025, 1, 1),
            date(2025, 1, 1),
        )
        assert ind == Decimal("0")


# ── Costo total (inversa) ────────────────────────────────────


class TestCostoTotal:
    def test_net_to_gross_1000_net(self, calc: PayrollCalculatorSV):
        """Given $1000 net desired, find gross and verify."""
        result = calc.calcular_costo_total_empleador(Decimal("1000"))
        assert abs(result["salario_neto_real"] - Decimal("1000")) < Decimal("0.05")
        assert result["salario_bruto_necesario"] > Decimal("1000")
        assert result["costo_total_mensual"] > result["costo_empleador"]
        assert result["fee_talentos"] == Decimal("349.00")
