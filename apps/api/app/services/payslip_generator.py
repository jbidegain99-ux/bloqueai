"""Payslip HTML generator for payroll lines."""

from datetime import datetime
from typing import Optional, List


def generate_payslip_html(
    employee_name: str,
    employee_code: Optional[str],
    department: Optional[str],
    position: Optional[str],
    client_name: str,
    period_start: str,
    period_end: str,
    base_salary: float,
    hours_regular: float,
    hours_overtime: float,
    gross_pay: float,
    deductions: List[dict],
    total_deductions: float,
    net_pay: float,
    currency: str = "MXN",
) -> str:
    """Generate an HTML payslip document."""

    deductions_rows = ""
    for d in deductions:
        deductions_rows += f"""
        <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">{d.get('name', '')}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">{d.get('type', '')}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">{currency} {d.get('amount', 0):,.2f}</td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Boleta de Pago - {employee_name}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }}
        .container {{ max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 30px; }}
        .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #1a365d; padding-bottom: 15px; margin-bottom: 20px; }}
        .company {{ font-size: 20px; font-weight: bold; color: #1a365d; }}
        .period {{ color: #666; font-size: 14px; }}
        .section {{ margin: 20px 0; }}
        .section-title {{ font-size: 14px; font-weight: bold; color: #1a365d; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; }}
        table {{ width: 100%; border-collapse: collapse; }}
        .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
        .info-item {{ font-size: 13px; }}
        .info-label {{ color: #666; }}
        .total-row {{ font-weight: bold; background: #f7f7f7; }}
        .net-pay {{ font-size: 22px; color: #1a365d; font-weight: bold; text-align: right; padding: 15px; background: #f0f4f8; border-radius: 8px; margin-top: 20px; }}
        .footer {{ margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 11px; color: #999; text-align: center; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <div class="company">{client_name}</div>
                <div class="period">Boleta de Pago</div>
            </div>
            <div style="text-align:right;">
                <div class="period">Periodo: {period_start} - {period_end}</div>
                <div class="period">Generado: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}</div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Datos del Empleado</div>
            <div class="info-grid">
                <div class="info-item"><span class="info-label">Nombre:</span> {employee_name}</div>
                <div class="info-item"><span class="info-label">Codigo:</span> {employee_code or 'N/A'}</div>
                <div class="info-item"><span class="info-label">Departamento:</span> {department or 'N/A'}</div>
                <div class="info-item"><span class="info-label">Puesto:</span> {position or 'N/A'}</div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Ingresos</div>
            <table>
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #eee;">Salario Base</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">{currency} {base_salary:,.2f}</td>
                </tr>
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #eee;">Horas Regulares</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">{hours_regular:.1f} hrs</td>
                </tr>
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #eee;">Horas Extra</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">{hours_overtime:.1f} hrs</td>
                </tr>
                <tr class="total-row">
                    <td style="padding:8px;">Total Bruto</td>
                    <td style="padding:8px;text-align:right;">{currency} {gross_pay:,.2f}</td>
                </tr>
            </table>
        </div>

        <div class="section">
            <div class="section-title">Deducciones</div>
            <table>
                <tr style="background:#f7f7f7;">
                    <th style="padding:8px;text-align:left;">Concepto</th>
                    <th style="padding:8px;text-align:right;">Tipo</th>
                    <th style="padding:8px;text-align:right;">Monto</th>
                </tr>
                {deductions_rows}
                <tr class="total-row">
                    <td style="padding:8px;" colspan="2">Total Deducciones</td>
                    <td style="padding:8px;text-align:right;">{currency} {total_deductions:,.2f}</td>
                </tr>
            </table>
        </div>

        <div class="net-pay">
            Pago Neto: {currency} {net_pay:,.2f}
        </div>

        <div class="footer">
            Este documento es generado automaticamente por TalentOS. No requiere firma.
        </div>
    </div>
</body>
</html>"""
