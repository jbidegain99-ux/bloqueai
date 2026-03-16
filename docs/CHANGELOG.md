# TalentOS Changelog

---

## [2026-03-16] Employee Portal + AI Chatbot Assistant (Prompt 45)

### Added
- **Employee Portal** — Full self-service portal at `/portal` with 6 sub-pages:
  - Dashboard: Welcome card, last payslip summary, YTD summary, quick actions
  - Payslips: List with year filter, mobile card view, detail page with print/PDF
  - Salary Breakdown: Monthly deduction calculator (ISSS/AFP/ISR), visual bars, YTD, benefits
  - Profile: Personal info, employment info, masked bank details, emergency contact
  - Documents: Generate proof of income and employment letters (HTML → print)
  - AI Assistant "Valentina": WhatsApp-style chat with Claude API integration

- **AI Chatbot "Valentina"** — Spanish-speaking payroll assistant:
  - Expert in El Salvador labor law (ISSS, AFP, ISR, aguinaldo, vacaciones)
  - Contextual: uses employee's real salary data in responses
  - Safety guardrails: refuses salary promises, financial advice, other employees' data
  - Warm, natural salvadoreño Spanish (not translation)
  - Fallback mock response when API unavailable
  - Suggestion chips for quick questions

- **Backend API** — 9 new endpoints under `/employee/`:
  - `GET /employee/profile` — Employee's own profile
  - `GET /employee/dashboard` — Dashboard with YTD summary
  - `GET /employee/payslips` — Payslip list (filterable by year)
  - `GET /employee/payslips/{id}` — Payslip detail with deduction breakdown
  - `GET /employee/salary/breakdown` — Monthly deduction calculator
  - `GET /employee/documents` — Available documents list
  - `POST /employee/documents/proof-of-income` — Generate proof of income HTML
  - `POST /employee/documents/generate/{type}` — Generate employment letter
  - `POST /employee/assistant/chat` — Claude-powered chatbot

- **Frontend API Client** — `employeeApi` with 15+ TypeScript interfaces (zero `any` types)
- **AppShell Navigation** — Employee portal section with 6 nav items
- **E2E Tests** — Playwright tests for all portal pages and chatbot interaction
- **Mobile-First Design** — Responsive layouts, card views on mobile, touch-friendly targets

### Architecture
- Route group: `(employee)/portal/` with shared layout
- Backend: FastAPI router with `get_current_user` auth (employee can only see own data)
- Chatbot: Anthropic SDK → Claude claude-sonnet-4-20250514 with system prompt + employee salary context
- El Salvador tax calculations: ISSS 3% (cap $30), AFP 7.25%, ISR progressive table

---

## [2026-03-15] Extend Payroll Schema v1.0 — LATAM Payroll Models

### Added
- **6 new enum types**: `DocumentType` (DUI/NIT/PASSPORT/CURP/CEDULA), `EmployeeStatus`, `EmploymentType`, `PaymentMethod`, `DeductionCategory` (ISSS/AFP/ISR/LOAN), `ProvisionType` (AGUINALDO/VACACIONES/BONUS/INDEMNIZACION)
- **PayrollDeductionBreakdown** table — relational deduction line items per payroll line (replaces JSONB-only approach)
- **PayrollProvision** table — provision accruals (aguinaldo, vacaciones, bonus, indemnización) per payroll line
- **Employee fields**: `document_type`, `document_id`, `salary`, `salary_currency`, `employment_type`, `status`, `bank_account_number`
- **Contract fields**: `position_title`, `benefits` (JSONB), `document_url`, `signed_by_employee_at`
- **PayrollRun fields**: `payment_method`
- **PayrollLine fields**: `contract_id` (FK to payroll_contracts)
- **Payslip fields**: `document_url`
- **docs/SETUP.md** — Local development setup, architecture overview, database schema guide

### Migration
- `021_extend_payroll_models.py` — Non-destructive ALTER TABLE + CREATE TABLE (zero breaking changes to existing data)

### Design Decisions
- Multi-currency at 3 levels: employee (display), contract (legal), payroll run (settlement)
- Benefits stored as extensible JSONB with structured schema (health, life, meal, transport, custom array)
- Salary history tracked implicitly via Contract records (each contract = a salary snapshot)
- Deduction breakdowns as both relational table (for queries/reports) and legacy JSONB (backward compat)

---

## [2026-03-15] Fix Silent Exceptions in Python Routers (DEBT-02)

### Changed
- **0 silent `except: pass` patterns remain** across all routers (was 26)
- Added structured logging to all 26 silent exception handlers across 5 files
- Added module-level `structlog` logger to `admin.py` (was missing)

### Files Modified
- `apps/api/app/routers/admin.py` — 16 `except ValueError: pass` → `logger.debug("invalid_date_param"|"invalid_filter_param", ...)` + added module-level logger
- `apps/api/app/routers/public.py` — 3 enum validation → `logger.debug("invalid_filter_param", ...)`
- `apps/api/app/routers/eor.py` — 3 enum validation → `logger.debug("invalid_filter_param", ...)`
- `apps/api/app/routers/applications.py` — 2 critical: `logger.error("status_revert_failed")` + `logger.warning("llm_log_creation_failed")`
- `apps/api/app/routers/interviews.py` — 2 JSON parse → `logger.warning("recommendation_json_parse_failed")`

### Logging Strategy Applied
| Category | Count | Log Level | Rationale |
|----------|-------|-----------|-----------|
| Date/enum filter validation | 22 | `debug` | Optional params, not errors |
| DB rollback failure | 1 | `error` | Error during error handling |
| Audit log creation failure | 1 | `warning` | Audit trail loss |
| JSON parse failure | 2 | `warning` | Data integrity issue |

---

## [2026-03-15] Refactor: Eliminar 55 any Types (DEBT-01)

### Changed
- **0 `any` types remain** across entire `apps/web/src/` codebase (was 55)
- Created `src/types/index.ts` with 15+ shared interfaces (Job, CandidateProfile, ShortlistItem, DashboardKpis, etc.)
- Added `getErrorMessage(err: unknown)` utility — replaces 22 `catch (err: any)` patterns
- Added generic type params to `employerApi`, `candidateApi`, `adminApi` methods in `api.ts`
- Exported `User` interface from `lib/auth.ts`
- Fixed 30+ hidden null-safety issues exposed after removing `any` (optional chaining gaps)

### Files Modified (20+)
- `src/types/index.ts` (new)
- `src/lib/api.ts` — typed API methods, fixed validation error handler
- `src/lib/auth.ts` — exported User interface
- `src/app/employer/jobs/page.tsx`, `[id]/page.tsx`, `new/page.tsx`
- `src/app/employer/shortlists/page.tsx`, `dashboard/page.tsx`
- `src/app/candidate/profile/page.tsx`, `interview/[sessionId]/page.tsx`
- `src/app/candidate/apply/[jobId]/page.tsx`, `applications/page.tsx`
- `src/app/candidate/cv-builder/page.tsx`, `jobs/page.tsx`, `jobs/[jobId]/page.tsx`
- `src/app/admin/kpis/page.tsx`, `clients/page.tsx`, `placements/page.tsx`
- `src/app/admin/interviews/page.tsx`, `settings/page.tsx`
- `src/app/page.tsx`, `register/page.tsx`
- `src/app/employer/jobs/[id]/candidates/[candidateId]/page.tsx`

---

## [2026-03-12] Auditoría Extensiva del Monorepo

### Audited
- **Monorepo completo**: 4 apps + 1 service, 208+ archivos de código
- **50 rutas frontend**: Todas funcionales, 0 redundantes
- **90+ endpoints API**: Todos implementados (excepto avatar stubs)
- **29 modelos DB**: Completos con RLS habilitado
- **AI Pipeline**: CV Analysis, Video Interviews, Matching, Shortlisting - todos operativos

### Found
- **2 items deuda técnica crítica**: 30+ `any` types + 34 try/except silenciosos
- **5 componentes sin uso**: activity-feed, dialog, tooltip, kanban-board, VideoAvatar
- **1 hook sin integrar**: use-feature (feature gating)
- **2 páginas index faltantes**: `/employer/interviews`, `/employer/settings`
- **NIT placeholder** en contract_generator.py

### Generated
- `AUDIT_REPORTS/AUDIT_REPORT_2026-03-12.md` - Reporte ejecutivo completo
- Actualizado `tasks/todo.md` con backlog consolidado
- Actualizado `tasks/lessons.md` con 7 lecciones nuevas

---

## [2026-02-21] EOR Production Bug Fixes

**Branch:** `claude/ai-recruitment-mvp-dJKyh`

### Fixed
- **500 on POST /api/eor/employees** — String values passed to SQLAlchemy Enum columns; added explicit enum conversion (`3414fba`)
- **Employee detail page crash** — `base_salary.toFixed()` on string (Decimal serialization) + AFP enum comparison mismatch (`a71f6d5`)
- **Contract download "Not authenticated"** — `window.open` doesn't send Authorization header; replaced with `fetch` + blob download (`14f7f88`)
- **Corrupt contract PDF** — Hand-rolled PDF with hardcoded xref offsets; replaced with reportlab `SimpleDocTemplate` (`21e5095`)

### Changed
- `apps/api/app/routers/eor.py` — Enum conversion + try/except with rollback
- `apps/api/app/services/contract_generator.py` — reportlab PDF generation
- `apps/api/requirements.txt` — Added `reportlab>=4.0.0`
- `apps/web/src/app/employer/eor/[id]/page.tsx` — Number() wrapping, AFP comparisons, blob download
- `apps/web/src/app/employee/profile/page.tsx` — Number() wrapping, AFP comparisons
- `apps/web/src/app/employee/documents/page.tsx` — Blob download with auth

### Infrastructure
- Production DB migrated from version 006 → 011 (EOR tables created via direct SQL)
- Alembic version tracker stamped to 011

---

## [2026-02-21] Semana 3 — UI/Dashboard Premium + E2E Tests + EOR Module

### Added
- **DataTable** — Generic sortable/filterable/paginated table component
- **MetricCard** — Sparkline SVG with trend indicators
- **EmptyState** — 7 variants with illustrations
- **PageTransition** — Framer Motion route transitions
- **PipelineFunnel** — Animated recruitment funnel visualization
- **KanbanBoard** — Drag-and-drop candidate board with @dnd-kit
- **CommandPalette** — Ctrl+K navigation with cmdk
- **ActivityFeed** — Timeline component with relative timestamps in Spanish
- **E2E Tests** — Candidate flow (7 tests) + Interview flow (3 tests) with Playwright
- **CV Validator** — Extracted utility with extension/size/MIME/corrupt/empty checks
- **EOR Module** — Complete Employer of Record for El Salvador (19 endpoints, 10 pages)
- **Salary Calculator** — Public page with SV tax breakdown

### Changed
- Admin dashboard redesigned with premium components
- Employer dashboard migrated to MetricCard + DataTable
- Candidate dashboard migrated with real API data

---

## [2026-02-20] Infrastructure + Bug Fixes + Vercel Migration

### Added
- **Pino Logger** — Structured JSON logging for Next.js
- **Sentry** — Error tracking with source maps (client + server + edge)
- **CV Cache** — PostgreSQL-based cache for CV analysis results (SHA-256 keyed)
- **Rate Limiting** — slowapi on OpenAI endpoints (10-50/hour per user)
- **Health Check** — Service-level status with latency metrics

### Fixed
- CV upload 500 (schema mismatch + missing joinedload)
- Interview button dead (missing loading state + invisible error display)
- Login 500 in production (garbage `NEXT_PUBLIC_API_URL` on wrong Vercel project)
- Candidate profile 500 (missing `created_at`/`updated_at` in dict response)

### Changed
- Migrated from `web` to `bloqueai-ia` Vercel project
- Deleted unused `web` Vercel project

---

## [2026-01-29] MVP+ Critical Fixes (Original)

**Branch:** `claude/talentOS-critical-fixes-phz85`

### Summary

This release addresses critical bugs and implements key UX improvements for the TalentOS recruitment platform.

---

## Critical Bug Fixes

### [T1] Interview Gating UI
**Problem:** Candidate profile showed "Entrevista IA" card even without an approved application.

**Fix:**
- Profile now checks application status before showing interview card
- Interview access only enabled for MATCH_PASSED, INTERVIEW_STARTED, or INTERVIEW_COMPLETED
- Removed direct link to legacy interview page

**Files:** `apps/web/src/app/candidate/profile/page.tsx`

---

### [T2] Interview End-to-End Flow
**Problem:** "Iniciar entrevista" button didn't actually start an interview - redirected to legacy page.

**Fix:**
- Created new interview session page with real-time chat UI
- Proper navigation from apply flow to interview session
- Applications page navigates directly to existing interview sessions

**Files:**
- `apps/web/src/app/candidate/interview/[sessionId]/page.tsx` (NEW)
- `apps/web/src/app/candidate/apply/[jobId]/page.tsx`
- `apps/web/src/app/candidate/applications/page.tsx`
- `apps/web/src/lib/api.ts`

---

### [T3] Candidate Profile State
**Problem:** Profile showed "CV procesado" and "Entrevista completada" even when not true.

**Fix:**
- Profile now reflects actual CV data (skills, experience from parsed CV)
- Interview status based on actual completed reports
- Proper state display for all scenarios

**Files:** `apps/web/src/app/candidate/profile/page.tsx`

---

### [T4] Export CSV Authentication
**Problem:** CSV export opened blank page due to auth failure (token in query string not read by backend).

**Fix:**
- Changed from `window.open` to `fetch` with Authorization header
- Proper blob download with Content-Disposition filename extraction
- Error handling for failed exports

**Files:** `apps/web/src/lib/api.ts`

---

### [T5] Admin Interviews Page
**Problem:** Page crashed with "Application error" due to enum serialization.

**Fix:**
- Converted enum values to strings in API response
- `session.status.value` and `msg.role.value` now properly serialized

**Files:** `apps/api/app/routers/admin.py`

---

## Core Improvements

### [T6] Dynamic Match Threshold
**Previously:** Hardcoded 70% threshold everywhere.

**Now:**
- Threshold configurable per job via `job.match_threshold`
- Falls back to system default (70%)
- Frontend displays job-specific threshold

**Files:**
- `apps/api/app/models/job.py`
- `apps/api/app/routers/applications.py`
- `apps/api/app/routers/public.py`
- `apps/api/alembic/versions/006_add_job_threshold_and_display_name.py`
- `apps/web/src/app/candidate/apply/[jobId]/page.tsx`

---

### [T7] Pre-step CV Message
**Previously:** Application jumped directly to CV upload.

**Now:**
- New "Preparacion" step before upload
- Shows tips for optimizing CV
- Lists job requirements
- "Ver ejemplo de CV" modal with template

**Files:** `apps/web/src/app/candidate/apply/[jobId]/page.tsx`

---

### [T8] Location Filters
**Previously:** No way to filter jobs by country.

**Now:**
- Country filter dropdown in jobs board
- New `/public/jobs/locations/list` endpoint
- Backend filtering by country parameter

**Files:**
- `apps/api/app/routers/public.py`
- `apps/web/src/app/candidate/jobs/page.tsx`
- `apps/web/src/lib/api.ts`

---

### [T10] Company Name Privacy
**Previously:** Real company names visible to candidates.

**Now:**
- Candidates always see "Bloque Internacional"
- Added `display_company_name` column with default
- Real company hidden in all candidate-facing APIs

**Files:**
- `apps/api/app/models/job.py`
- `apps/api/app/routers/public.py`
- `apps/api/alembic/versions/006_add_job_threshold_and_display_name.py`

---

## Database Migrations

### Migration 006: Job Threshold and Display Name
```sql
ALTER TABLE jobs ADD COLUMN match_threshold INTEGER;
ALTER TABLE jobs ADD COLUMN display_company_name VARCHAR(255) DEFAULT 'Bloque Internacional';
```

**Rollback:**
```sql
ALTER TABLE jobs DROP COLUMN IF EXISTS match_threshold;
ALTER TABLE jobs DROP COLUMN IF EXISTS display_company_name;
```

---

## API Changes

### New Endpoints
- `GET /public/jobs/locations/list` - Returns distinct countries and locations from active jobs

### Modified Endpoints
- `GET /public/jobs` - Added `country` query parameter
- `GET /public/jobs/{job_id}` - Returns `match_threshold` and hides real company
- `GET /admin/interviews` - Fixed enum serialization

---

## Breaking Changes

None. All changes are backward compatible.

---

## Files Changed Summary

### Frontend (apps/web)
- `src/app/candidate/profile/page.tsx` - Gating + state fix
- `src/app/candidate/interview/[sessionId]/page.tsx` - NEW interview UI
- `src/app/candidate/apply/[jobId]/page.tsx` - Pre-step + dynamic threshold
- `src/app/candidate/applications/page.tsx` - Interview navigation
- `src/app/candidate/jobs/page.tsx` - Location filters
- `src/lib/api.ts` - Export CSV fix + new API methods

### Backend (apps/api)
- `app/models/job.py` - New columns
- `app/routers/public.py` - Location filters + company hiding
- `app/routers/applications.py` - Dynamic threshold
- `app/routers/admin.py` - Enum serialization fix
- `alembic/versions/006_add_job_threshold_and_display_name.py` - NEW migration

### Documentation (docs/)
- `IMPLEMENTATION_PLAN.md` - Technical plan
- `QA.md` - Test cases and results
- `CHANGELOG.md` - This file

---

## How to Deploy

1. Run database migration:
   ```bash
   cd apps/api
   alembic upgrade head
   ```

2. Restart backend:
   ```bash
   npm run dev  # or production deployment
   ```

3. Deploy frontend (Vercel auto-deploys on push)

---

## Rollback Plan

If issues occur:
1. Revert git commits
2. Run `alembic downgrade 005` to remove new columns
3. Redeploy

---

**Author:** Claude (AI Assistant)
**Reviewed by:** Pending human review
