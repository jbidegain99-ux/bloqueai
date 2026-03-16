# TalentOS Payroll Calculation Engine

## Architecture

```
PayrollCalculatorSV (pure calculations, Decimal precision)
    ├── calcular_planilla()      → Full payroll breakdown
    ├── calcular_isr()           → ISR progressive brackets
    ├── calcular_aguinaldo()     → Christmas bonus by seniority
    ├── calcular_vacaciones()    → Vacation pay + 30% surcharge
    ├── calcular_indemnizacion() → Severance pay
    └── calcular_costo_total_empleador() → Net-to-gross inverse

Payroll Router (workflow)
    POST /payroll/runs              → Create DRAFT
    POST /payroll/runs/{id}/validate → Validate attendance
    POST /payroll/runs/{id}/calculate → Calculate using PayrollCalculatorSV
    POST /payroll/runs/{id}/approve  → Admin approval
```

## SV Tax Rates (2024-2025)

### ISSS (Seguro Social)
| Type | Rate | Cap |
|------|------|-----|
| Employee | 3% | $1,000 gross/month |
| Employer | 7.5% | $1,000 gross/month |

### AFP (Pensiones)
| Type | Rate | Cap |
|------|------|-----|
| Employee | 7.25% | None (full salary) |
| Employer | 7.75% | None (full salary) |

### ISR (Impuesto sobre la Renta) — Monthly brackets
| From | To | Marginal Rate | Fixed Tax |
|------|----|--------------|-----------|
| $0 | $472.00 | 0% | $0 |
| $472.01 | $895.24 | 10% | $17.67 |
| $895.25 | $2,038.10 | 20% | $60.00 |
| $2,038.11 | + | 30% | $288.57 |

ISR base = Gross - ISSS employee - AFP employee

## Calculation Examples

### $1,000 Gross Salary
```
ISSS employee:   min(1000, 1000) × 3%    = $30.00
AFP employee:    1000 × 7.25%             = $72.50
Gravable:        1000 - 30 - 72.50        = $897.50
ISR:             (897.50-895.25)×20%+60   = $60.45
─────────────────────────────────────────────────
Total deductions:                           $162.95
NET SALARY:      1000 - 162.95            = $837.05

ISSS employer:   1000 × 7.5%             = $75.00
AFP employer:    1000 × 7.75%            = $77.50
EMPLOYER COST:   1000 + 75 + 77.50       = $1,152.50
```

### $3,000 Gross Salary (ISSS capped)
```
ISSS employee:   min(3000, 1000) × 3%    = $30.00  (capped)
AFP employee:    3000 × 7.25%             = $217.50
Gravable:        3000 - 30 - 217.50       = $2,752.50
ISR:             (2752.50-2038.11)×30%+288.57 = $502.89
─────────────────────────────────────────────────
Total deductions:                           $750.39
NET SALARY:      3000 - 750.39            = $2,249.61
```

## Provisions (Monthly Accruals)

### Aguinaldo (Christmas Bonus)
| Seniority | Days |
|-----------|------|
| < 1 year | Proportional (15 days × days/365) |
| 1-3 years | 15 days |
| 3-10 years | 19 days |
| 10+ years | 21 days |

Monthly provision = Annual aguinaldo / 12

### Vacaciones (Annual Leave)
- 15 consecutive days + 30% surcharge
- Monthly provision = (salary/30 × 15 × 1.30) / 12

### Indemnización (Severance)
- 30 days salary per year of service (proportional)

## Workflow

```
DRAFT → VALIDATED → CALCULATED → APPROVED → PAID
```

1. **DRAFT**: Admin creates payroll run for a period
2. **VALIDATED**: System checks attendance completeness
3. **CALCULATED**: PayrollCalculatorSV computes all deductions, creates:
   - `payroll_lines` — per-employee summary
   - `payroll_deduction_breakdowns` — ISSS/AFP/ISR line items
   - `payroll_provisions` — aguinaldo/vacaciones accruals
   - `payroll_payslips` — HTML payslip documents
4. **APPROVED**: Admin reviews and approves
5. **PAID**: Marked as paid (payment processing TBD)

## Technical Details

- All calculations use `Decimal` (not `float`) for precision
- Rounding: `ROUND_HALF_UP` to 2 decimal places
- ISR uses excedente method (tax = (amount - bracket_start) × rate + fixed_tax)
- ISSS cap applies to both employee and employer contributions
- AFP has no cap (applied to full gross salary)
- Inverse calculator uses bisection method (100 iterations, $0.01 tolerance)

## Files

| File | Purpose |
|------|---------|
| `services/payroll_sv.py` | Pure calculation engine (Decimal) |
| `routers/payroll.py` | CRUD + workflow endpoints |
| `models/payroll.py` | SQLAlchemy models |
| `schemas/payroll.py` | Pydantic request/response schemas |
| `services/payslip_generator.py` | HTML payslip template |
