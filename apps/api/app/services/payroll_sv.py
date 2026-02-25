"""
Motor de cálculo de nómina para El Salvador.

Basado en legislación laboral vigente 2024-2025:
- Código de Trabajo de El Salvador
- Ley del Seguro Social (ISSS)
- Ley del Sistema de Ahorro para Pensiones (AFP)
- Ley de Impuesto sobre la Renta (ISR)

Tasas:
- ISSS Patronal: 7.5%   | Empleado: 3%   | Tope: $1,000
- AFP  Patronal: 7.75%  | Empleado: 7.25%
- ISR: tablas progresivas mensuales

Prestaciones de ley:
- Aguinaldo: 15/19/21 días según antigüedad
- Vacaciones: 15 días + 30% recargo
- Indemnización: 30 días por año
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional


# ── Helpers ───────────────────────────────────────────────────

_TWO = Decimal("0.01")


def _r(value: Decimal) -> Decimal:
    """Round to 2 decimal places (half-up)."""
    return value.quantize(_TWO, rounding=ROUND_HALF_UP)


# ── Result dataclass ──────────────────────────────────────────


@dataclass
class PayrollResult:
    """Full payroll breakdown for one employee."""

    # Ingresos
    base_salary: Decimal
    overtime: Decimal
    bonuses: Decimal
    gross_salary: Decimal

    # Deducciones empleado
    isss_employee: Decimal
    afp_employee: Decimal
    isr: Decimal
    other_deductions: Decimal
    total_deductions: Decimal

    # Neto empleado
    net_salary: Decimal

    # Aportes patronales
    isss_employer: Decimal
    afp_employer: Decimal

    # Totales
    total_employer_cost: Decimal
    fee_talentos: Decimal
    grand_total: Decimal


# ── Calculator ────────────────────────────────────────────────


class PayrollCalculatorSV:
    """Calculadora de nómina para El Salvador."""

    # Tasas vigentes 2024-2025
    ISSS_PATRONAL = Decimal("0.075")
    ISSS_EMPLEADO = Decimal("0.03")
    AFP_PATRONAL = Decimal("0.0775")
    AFP_EMPLEADO = Decimal("0.0725")
    ISSS_TOPE = Decimal("1000.00")

    # Fee TalentOS por empleado/mes
    FEE_TALENTOS = Decimal("349.00")

    # Tablas ISR mensual El Salvador (rangos, tasa marginal, cuota fija)
    ISR_TRAMOS = [
        (Decimal("0"), Decimal("472.00"), Decimal("0"), Decimal("0")),
        (Decimal("472.01"), Decimal("895.24"), Decimal("0.10"), Decimal("17.67")),
        (Decimal("895.25"), Decimal("2038.10"), Decimal("0.20"), Decimal("60.00")),
        (Decimal("2038.11"), Decimal("999999"), Decimal("0.30"), Decimal("288.57")),
    ]

    # ── ISR ────────────────────────────────────────────────

    def calcular_isr(self, salario_gravable: Decimal) -> Decimal:
        """ISR según tablas progresivas de El Salvador.

        El salario gravable ya debe tener descontados ISSS y AFP del empleado.
        """
        if salario_gravable <= Decimal("0"):
            return Decimal("0")

        for desde, hasta, tasa, cuota_fija in self.ISR_TRAMOS:
            if desde <= salario_gravable <= hasta:
                excedente = salario_gravable - desde
                isr = _r(excedente * tasa + cuota_fija)
                return isr

        # Fallback for amounts above table (shouldn't happen with 999999 ceiling)
        _, _, tasa, cuota_fija = self.ISR_TRAMOS[-1]
        desde = self.ISR_TRAMOS[-1][0]
        excedente = salario_gravable - desde
        return _r(excedente * tasa + cuota_fija)

    # ── ISSS helpers ──────────────────────────────────────

    def _isss_base(self, salario_bruto: Decimal) -> Decimal:
        """ISSS cotiza sobre el menor entre el salario y el tope."""
        return min(salario_bruto, self.ISSS_TOPE)

    # ── Nómina completa ──────────────────────────────────

    def calcular_planilla(
        self,
        salario_base: Decimal,
        horas_extra: Decimal = Decimal("0"),
        bonificaciones: Decimal = Decimal("0"),
        otras_deducciones: Decimal = Decimal("0"),
    ) -> PayrollResult:
        """Calcula nómina completa de un empleado.

        Parameters
        ----------
        salario_base : Decimal
            Salario mensual bruto.
        horas_extra : Decimal
            Monto ya calculado de horas extra.
        bonificaciones : Decimal
            Bonos, comisiones, etc.
        otras_deducciones : Decimal
            Descuentos adicionales (préstamos, etc.).
        """
        gross = _r(salario_base + horas_extra + bonificaciones)

        # ISSS sobre tope
        isss_base = self._isss_base(gross)
        isss_emp = _r(isss_base * self.ISSS_EMPLEADO)
        isss_pat = _r(isss_base * self.ISSS_PATRONAL)

        # AFP sobre salario bruto completo
        afp_emp = _r(gross * self.AFP_EMPLEADO)
        afp_pat = _r(gross * self.AFP_PATRONAL)

        # Salario gravable para ISR = bruto − ISSS emp − AFP emp
        gravable = _r(gross - isss_emp - afp_emp)
        isr = self.calcular_isr(gravable)

        total_deductions = _r(isss_emp + afp_emp + isr + otras_deducciones)
        net = _r(gross - total_deductions)

        # Costo empleador = bruto + aportes patronales
        employer_cost = _r(gross + isss_pat + afp_pat)
        grand = _r(employer_cost + self.FEE_TALENTOS)

        return PayrollResult(
            base_salary=salario_base,
            overtime=horas_extra,
            bonuses=bonificaciones,
            gross_salary=gross,
            isss_employee=isss_emp,
            afp_employee=afp_emp,
            isr=isr,
            other_deductions=otras_deducciones,
            total_deductions=total_deductions,
            net_salary=net,
            isss_employer=isss_pat,
            afp_employer=afp_pat,
            total_employer_cost=employer_cost,
            fee_talentos=self.FEE_TALENTOS,
            grand_total=grand,
        )

    # ── Aguinaldo ─────────────────────────────────────────

    def calcular_aguinaldo(
        self,
        salario_base: Decimal,
        fecha_inicio: date,
        fecha_calculo: Optional[date] = None,
    ) -> Decimal:
        """Aguinaldo según antigüedad.

        - 1-3 años:  15 días de salario
        - 3-10 años: 19 días de salario
        - 10+ años:  21 días de salario

        Si el empleado no ha cumplido 1 año, se paga proporcional
        al tiempo trabajado (días trabajados / 365 * días de aguinaldo).
        Se paga entre el 12 y 20 de diciembre.
        """
        if fecha_calculo is None:
            fecha_calculo = date.today()

        # Antigüedad en años
        delta = fecha_calculo - fecha_inicio
        years = delta.days / Decimal("365.25")

        if years < 1:
            # Proporcional: 15 días * (días trabajados / 365)
            dias_aguinaldo = Decimal("15")
            proporcion = Decimal(str(delta.days)) / Decimal("365")
            salario_diario = salario_base / Decimal("30")
            return _r(salario_diario * dias_aguinaldo * proporcion)

        if years < 3:
            dias = Decimal("15")
        elif years < 10:
            dias = Decimal("19")
        else:
            dias = Decimal("21")

        salario_diario = salario_base / Decimal("30")
        return _r(salario_diario * dias)

    # ── Vacaciones ────────────────────────────────────────

    def calcular_vacaciones(
        self,
        salario_base: Decimal,
        dias_vacaciones: int = 15,
    ) -> Decimal:
        """Vacaciones anuales: 15 días continuos + 30% de recargo.

        Remuneración = (salario_diario * días) * 1.30
        """
        salario_diario = salario_base / Decimal("30")
        base_vacaciones = salario_diario * Decimal(str(dias_vacaciones))
        recargo = _r(base_vacaciones * Decimal("0.30"))
        return _r(base_vacaciones + recargo)

    # ── Indemnización ─────────────────────────────────────

    def calcular_indemnizacion(
        self,
        salario_base: Decimal,
        fecha_inicio: date,
        fecha_despido: date,
    ) -> Decimal:
        """Indemnización por despido sin causa justificada.

        30 días de salario por cada año de servicio.
        Proporcional para fracciones de año.
        """
        delta = fecha_despido - fecha_inicio
        if delta.days <= 0:
            return Decimal("0")

        years = Decimal(str(delta.days)) / Decimal("365.25")
        # 30 días de salario por año
        salario_diario = salario_base / Decimal("30")
        indemnizacion = salario_diario * Decimal("30") * years
        return _r(indemnizacion)

    # ── Calculadora inversa (neto → bruto) ────────────────

    def calcular_costo_total_empleador(
        self,
        salario_neto_deseado: Decimal,
    ) -> dict:
        """Dado un salario neto deseado, calcular el bruto necesario
        y el costo total para el empleador incluyendo fee TalentOS.

        Usa método iterativo de bisección para resolver el bruto.
        """
        # Bisección: encontrar bruto tal que net == neto_deseado
        low = salario_neto_deseado
        high = salario_neto_deseado * Decimal("2.5")

        for _ in range(100):
            mid = _r((low + high) / Decimal("2"))
            result = self.calcular_planilla(mid)
            diff = result.net_salary - salario_neto_deseado

            if abs(diff) < Decimal("0.01"):
                break

            if diff < 0:
                low = mid
            else:
                high = mid

        final = self.calcular_planilla(mid)
        return {
            "salario_neto_deseado": salario_neto_deseado,
            "salario_bruto_necesario": final.gross_salary,
            "isss_empleado": final.isss_employee,
            "afp_empleado": final.afp_employee,
            "isr": final.isr,
            "total_deducciones": final.total_deductions,
            "salario_neto_real": final.net_salary,
            "isss_patronal": final.isss_employer,
            "afp_patronal": final.afp_employer,
            "costo_empleador": final.total_employer_cost,
            "fee_talentos": final.fee_talentos,
            "costo_total_mensual": final.grand_total,
        }
