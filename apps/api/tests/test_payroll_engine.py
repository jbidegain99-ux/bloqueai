"""Exhaustive payroll calculation accuracy tests.

10 salary scenarios validated against hand-calculated values.
Uses Decimal for exact comparison (no floating point errors).
Tests the PayrollCalculatorSV engine that powers all payroll runs.

SV Tax Rates (2024-2025):
  ISSS: Employee 3%, Employer 7.5%, Cap $1,000
  AFP:  Employee 7.25%, Employer 7.75%
  ISR:  Progressive brackets (see ISR_TRAMOS in payroll_sv.py)
"""

from datetime import date
from decimal import Decimal

import pytest

from app.services.payroll_sv import PayrollCalculatorSV, PayrollResult


@pytest.fixture
def calc():
    return PayrollCalculatorSV()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 10 SALARY SCENARIOS — Hand-calculated accuracy validation
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Each scenario documents the hand calculation step by step.
# Format: (gross, expected_isss_emp, expected_afp_emp, expected_isr, expected_net)

SCENARIOS = [
    # Scenario 1: Minimum wage (~$365)
    # ISSS: 365*0.03=10.95, AFP: 365*0.0725=26.46
    # Gravable: 365-10.95-26.46=327.59 → Tramo 1 (<=472): ISR=0
    # Net: 365-10.95-26.46-0=327.59
    ("minimum_wage_365", Decimal("365"), Decimal("10.95"), Decimal("26.46"), Decimal("0"), Decimal("327.59")),

    # Scenario 2: $500
    # ISSS: 500*0.03=15, AFP: 500*0.0725=36.25
    # Gravable: 500-15-36.25=448.75 → Tramo 1 (<=472): ISR=0
    # Net: 500-15-36.25-0=448.75
    ("salary_500", Decimal("500"), Decimal("15.00"), Decimal("36.25"), Decimal("0"), Decimal("448.75")),

    # Scenario 3: $700 — enters ISR tramo 2
    # ISSS: 700*0.03=21, AFP: 700*0.0725=50.75
    # Gravable: 700-21-50.75=628.25 → Tramo 2 (472.01-895.24): 10%
    # ISR: (628.25-472.01)*0.10+17.67 = 15.624+17.67 = 33.29
    # Net: 700-21-50.75-33.29=594.96
    ("salary_700", Decimal("700"), Decimal("21.00"), Decimal("50.75"), Decimal("33.29"), Decimal("594.96")),

    # Scenario 4: $1,000 — ISR tramo 3
    # ISSS: min(1000,1000)*0.03=30, AFP: 1000*0.0725=72.50
    # Gravable: 1000-30-72.50=897.50 → Tramo 3 (895.25-2038.10): 20%
    # ISR: (897.50-895.25)*0.20+60.00 = 0.45+60.00 = 60.45
    # Net: 1000-30-72.50-60.45=837.05
    ("salary_1000", Decimal("1000"), Decimal("30.00"), Decimal("72.50"), Decimal("60.45"), Decimal("837.05")),

    # Scenario 5: $1,200 — deeper into tramo 3
    # ISSS: min(1200,1000)*0.03=30 (capped), AFP: 1200*0.0725=87.00
    # Gravable: 1200-30-87=1083 → Tramo 3: (1083-895.25)*0.20+60.00=37.55+60.00=97.55
    # Net: 1200-30-87-97.55=985.45
    ("salary_1200", Decimal("1200"), Decimal("30.00"), Decimal("87.00"), Decimal("97.55"), Decimal("985.45")),

    # Scenario 6: $1,500 — mid tramo 3
    # ISSS: 30 (capped), AFP: 1500*0.0725=108.75
    # Gravable: 1500-30-108.75=1361.25 → Tramo 3: (1361.25-895.25)*0.20+60.00=93.20+60.00=153.20
    # Net: 1500-30-108.75-153.20=1208.05
    ("salary_1500", Decimal("1500"), Decimal("30.00"), Decimal("108.75"), Decimal("153.20"), Decimal("1208.05")),

    # Scenario 7: $2,000 — near top of tramo 3
    # ISSS: 30 (capped), AFP: 2000*0.0725=145
    # Gravable: 2000-30-145=1825 → Tramo 3: (1825-895.25)*0.20+60.00=185.95+60.00=245.95
    # Net: 2000-30-145-245.95=1579.05
    ("salary_2000", Decimal("2000"), Decimal("30.00"), Decimal("145.00"), Decimal("245.95"), Decimal("1579.05")),

    # Scenario 8: $3,000 — tramo 4 (30%)
    # ISSS: 30 (capped), AFP: 3000*0.0725=217.50
    # Gravable: 3000-30-217.50=2752.50 → Tramo 4 (>2038.11): 30%
    # ISR: (2752.50-2038.11)*0.30+288.57 = 214.32+288.57 = 502.89
    # Net: 3000-30-217.50-502.89=2249.61
    ("salary_3000", Decimal("3000"), Decimal("30.00"), Decimal("217.50"), Decimal("502.89"), Decimal("2249.61")),

    # Scenario 9: $5,000 — high salary, tramo 4
    # ISSS: 30 (capped), AFP: 5000*0.0725=362.50
    # Gravable: 5000-30-362.50=4607.50 → Tramo 4: (4607.50-2038.11)*0.30+288.57 = 770.82+288.57 = 1059.39
    # Net: 5000-30-362.50-1059.39=3548.11
    ("salary_5000", Decimal("5000"), Decimal("30.00"), Decimal("362.50"), Decimal("1059.39"), Decimal("3548.11")),

    # Scenario 10: $10,000 — executive salary
    # ISSS: 30 (capped), AFP: 10000*0.0725=725
    # Gravable: 10000-30-725=9245 → Tramo 4: (9245-2038.11)*0.30+288.57 = 2162.07+288.57 = 2450.64
    # Net: 10000-30-725-2450.64=6794.36
    ("salary_10000", Decimal("10000"), Decimal("30.00"), Decimal("725.00"), Decimal("2450.64"), Decimal("6794.36")),
]


class TestAccuracyScenarios:
    """Test 10 salary scenarios against hand-calculated values."""

    @pytest.mark.parametrize("name,gross,exp_isss,exp_afp,exp_isr,exp_net", SCENARIOS)
    def test_scenario(self, calc, name, gross, exp_isss, exp_afp, exp_isr, exp_net):
        r = calc.calcular_planilla(gross)

        assert r.isss_employee == exp_isss, (
            f"[{name}] ISSS employee: expected {exp_isss}, got {r.isss_employee}"
        )
        assert r.afp_employee == exp_afp, (
            f"[{name}] AFP employee: expected {exp_afp}, got {r.afp_employee}"
        )
        assert r.isr == exp_isr, (
            f"[{name}] ISR: expected {exp_isr}, got {r.isr}"
        )
        assert r.net_salary == exp_net, (
            f"[{name}] Net: expected {exp_net}, got {r.net_salary}"
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EMPLOYER COST SCENARIOS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestEmployerCost:
    """Verify employer-side costs (ISSS patronal + AFP patronal)."""

    def test_employer_isss_1000(self, calc):
        r = calc.calcular_planilla(Decimal("1000"))
        # ISSS patronal: min(1000,1000)*0.075=75
        assert r.isss_employer == Decimal("75.00")

    def test_employer_isss_capped(self, calc):
        r = calc.calcular_planilla(Decimal("3000"))
        # ISSS patronal: min(3000,1000)*0.075=75 (capped)
        assert r.isss_employer == Decimal("75.00")

    def test_employer_afp(self, calc):
        r = calc.calcular_planilla(Decimal("2000"))
        # AFP patronal: 2000*0.0775=155
        assert r.afp_employer == Decimal("155.00")

    def test_total_employer_cost(self, calc):
        r = calc.calcular_planilla(Decimal("1000"))
        # Employer cost = gross + ISSS patronal + AFP patronal
        expected = Decimal("1000") + Decimal("75") + Decimal("77.50")
        assert r.total_employer_cost == expected


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EDGE CASES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestEdgeCases:
    """Test boundary conditions and edge cases."""

    def test_zero_salary(self, calc):
        r = calc.calcular_planilla(Decimal("0"))
        assert r.gross_salary == Decimal("0")
        assert r.isss_employee == Decimal("0")
        assert r.afp_employee == Decimal("0")
        assert r.isr == Decimal("0")
        assert r.net_salary == Decimal("0")

    def test_at_isss_cap_exactly(self, calc):
        """Salary exactly at ISSS cap ($1,000)."""
        r = calc.calcular_planilla(Decimal("1000"))
        assert r.isss_employee == Decimal("30.00")  # 1000*0.03
        assert r.isss_employer == Decimal("75.00")   # 1000*0.075

    def test_just_above_isss_cap(self, calc):
        """Salary $1,001 — ISSS should still be capped at $1,000 base."""
        r = calc.calcular_planilla(Decimal("1001"))
        assert r.isss_employee == Decimal("30.00")   # Still capped
        assert r.afp_employee == Decimal("72.57")     # 1001*0.0725=72.5725, rounded

    def test_at_isr_bracket_boundary_472(self, calc):
        """Gravable at $472 — should be exempt (tramo 1)."""
        # Need gross where gravable <= 472
        # gravable = gross - gross*0.03 - gross*0.0725 = gross*0.8975
        # 472 / 0.8975 ≈ 525.97, but rounding pushes it above 472.01
        # Use 525.00 to stay safely below bracket 2
        r = calc.calcular_planilla(Decimal("525"))
        gravable = r.gross_salary - r.isss_employee - r.afp_employee
        assert gravable <= Decimal("472.00")
        assert r.isr == Decimal("0")

    def test_overtime_adds_to_gross(self, calc):
        r = calc.calcular_planilla(Decimal("800"), horas_extra=Decimal("200"))
        assert r.gross_salary == Decimal("1000")
        assert r.overtime == Decimal("200")

    def test_other_deductions_reduce_net(self, calc):
        r1 = calc.calcular_planilla(Decimal("1000"))
        r2 = calc.calcular_planilla(Decimal("1000"), otras_deducciones=Decimal("100"))
        assert r2.net_salary == r1.net_salary - Decimal("100")
        assert r2.other_deductions == Decimal("100")

    def test_decimal_precision_no_float_drift(self, calc):
        """Verify no float precision issues across multiple calculations."""
        r = calc.calcular_planilla(Decimal("1234.56"))
        # All amounts should be Decimal with exactly 2 decimal places
        assert isinstance(r.net_salary, Decimal)
        assert r.net_salary == r.net_salary.quantize(Decimal("0.01"))
        # Verify: gross - deductions == net
        expected_net = r.gross_salary - r.total_deductions
        assert r.net_salary == expected_net


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# INVERSE CALCULATOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestInverseCalculator:
    """Test net-to-gross calculation."""

    @pytest.mark.parametrize("desired_net", [
        Decimal("500"), Decimal("800"), Decimal("1000"),
        Decimal("1500"), Decimal("2000"), Decimal("3000"),
    ])
    def test_inverse_accuracy(self, calc, desired_net):
        result = calc.calcular_costo_total_empleador(desired_net)
        actual_net = result["salario_neto_real"]
        assert abs(actual_net - desired_net) < Decimal("0.05"), (
            f"Inverse for net={desired_net}: got {actual_net}, diff={actual_net-desired_net}"
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PROVISIONS (Aguinaldo + Vacaciones)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class TestProvisions:
    """Test aguinaldo and vacaciones calculations."""

    def test_aguinaldo_2_years(self, calc):
        ag = calc.calcular_aguinaldo(Decimal("1000"), date(2024, 1, 1), date(2026, 1, 15))
        # 15 days * (1000/30) = 500
        assert ag == Decimal("500.00")

    def test_vacaciones_standard(self, calc):
        vac = calc.calcular_vacaciones(Decimal("1000"))
        # (1000/30)*15*1.30 = 650
        assert vac == Decimal("650.00")

    def test_indemnizacion_5_years(self, calc):
        ind = calc.calcular_indemnizacion(Decimal("1200"), date(2020, 6, 1), date(2025, 6, 1))
        # ~5 years * 1200 ≈ 6000
        assert ind > Decimal("5800")
        assert ind < Decimal("6200")

    def test_monthly_provision_aguinaldo(self, calc):
        """Monthly accrual = annual aguinaldo / 12."""
        annual = calc.calcular_aguinaldo(Decimal("1000"), date(2024, 1, 1), date(2026, 3, 15))
        monthly = annual / Decimal("12")
        assert monthly > Decimal("0")
        assert monthly < Decimal("100")  # 500/12 ≈ 41.67
