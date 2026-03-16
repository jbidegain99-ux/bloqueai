# TalentOS - Local Development Setup

## Prerequisites

- Docker & Docker Compose
- Node.js >= 18 + pnpm
- Python 3.11+

## 1. Clone and Install

```bash
git clone <repo-url> && cd TalenOS
pnpm install
cd apps/api && pip install -r requirements.txt && cd ../..
```

## 2. Environment Variables

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://talentos:talentos@localhost:5432/talentos` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis for queues/cache |
| `MINIO_ENDPOINT` | `localhost:9000` | S3-compatible file storage |
| `JWT_SECRET_KEY` | (change in prod) | Token signing |
| `LLM_API_KEY` | (empty = stub mode) | OpenAI-compatible API key |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Frontend API target |

## 3. Start Infrastructure

```bash
docker compose up -d   # PostgreSQL, Redis, MinIO
```

## 4. Database Setup

```bash
cd apps/api
alembic upgrade head    # Apply all 21 migrations
```

### Reset Database

```bash
alembic downgrade base  # Drop all tables
alembic upgrade head    # Recreate from scratch
```

### Seed Data

```bash
python -m app.seed      # If seed script exists
# Or via API: POST /api/auth/register to create first admin user
```

## 5. Run the App

```bash
# From project root:
pnpm dev                # Starts all apps via Turbo

# Or individually:
cd apps/api && uvicorn app.main:app --reload --port 8000
cd apps/web && pnpm dev  # Port 3000
```

## 6. Verify

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs (Swagger UI)
- MinIO console: http://localhost:9001

## Architecture Overview

```
TalenOS/
├── apps/
│   ├── api/           # FastAPI backend (Python)
│   │   ├── app/
│   │   │   ├── models/     # SQLAlchemy ORM models (24 files)
│   │   │   ├── routers/    # API endpoints (13 modules)
│   │   │   ├── core/       # Config, DB, security
│   │   │   └── worker/     # Background jobs (RQ)
│   │   └── alembic/        # Database migrations
│   ├── web/           # Next.js 14 frontend (TypeScript)
│   │   └── src/
│   │       ├── app/        # App Router pages
│   │       ├── components/ # UI components (shadcn/ui)
│   │       ├── lib/        # API client, auth, utils
│   │       └── types/      # TypeScript interfaces
│   └── worker/        # Background job runner
├── services/
│   └── interview-agent/   # AI interview microservice
├── supabase/
│   └── migrations/        # RLS policies
└── docs/              # Documentation
```

## Database Schema (Payroll Module)

The payroll module uses multi-tenant filtering via `client_id` on all tables:

- **payroll_employees** - Employee records with identity docs, salary, bank info
- **payroll_contracts** - Employment contracts with benefits JSON and payment terms
- **payroll_runs** - Payroll period runs with approval workflow
- **payroll_lines** - Per-employee calculations within a run
- **payroll_deduction_breakdowns** - ISSS, AFP, ISR, loans per line
- **payroll_provisions** - Aguinaldo, vacaciones, bonus accruals per line
- **payroll_payslips** - Generated payslip documents (HTML + PDF URL)
- **payroll_deduction_types** - Configurable deduction rules per client
- **payroll_tax_configs** - Tax rule configuration per client
- **payroll_attendance** - Daily attendance tracking

### Multi-Currency

The `currency` field (ISO 4217, e.g. `USD`, `MXN`, `COP`) is stored at:
- Employee level (`salary_currency`) — base display currency
- Contract level (`currency`) — contractual salary currency
- PayrollRun level (`currency`) — run settlement currency

### Benefits JSON Structure

The `benefits` JSONB column on `payroll_contracts` uses this schema:

```json
{
  "health_insurance": { "provider": "ASESUISA", "plan": "premium", "employer_pct": 100 },
  "life_insurance": { "coverage_usd": 50000 },
  "meal_allowance": { "monthly_usd": 150 },
  "transport_allowance": { "monthly_usd": 75 },
  "custom": [
    { "name": "Gym membership", "value": "Monthly reimbursement up to $50" }
  ]
}
```

## EOR Module (Employer of Record)

Separate from the generic payroll module, the EOR module handles El Salvador-specific compliance:
- `eor_employees` - DUI/NIT, ISSS, AFP provider, bank details
- `eor_payroll_runs` - With employer contributions (ISSS patronal, AFP patronal)
- `eor_payroll_items` - Full breakdown: gross, deductions, ISR, net, fees
- `eor_vacation_requests` - Request/approval workflow
