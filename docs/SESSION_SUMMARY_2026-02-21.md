# Session Summary — 2026-02-21

## Scope

Fix 4 production bugs in the EOR (Employer of Record) module after initial deployment to production.

## Commits

| Hash | Description |
|------|-------------|
| `3414fba` | fix: resolve 500 on EOR employee create/update by converting strings to enum instances |
| `a71f6d5` | fix: employee detail crash — base_salary.toFixed on string + AFP enum mismatch |
| `14f7f88` | fix: contract download auth — use fetch+blob instead of window.open with query token |
| `21e5095` | fix: replace corrupt hand-rolled PDF generator with reportlab |

## Bugs Fixed

### 1. 500 on POST /api/eor/employees
- **Root Cause:** SQLAlchemy Enum columns require Python enum instances (`AFPProvider.CRECER`), not raw strings (`"CRECER"`)
- **Fix:** Added explicit `AFPProvider(value)`, `BankAccountType(value)`, etc. conversion in the router before model construction
- **File:** `apps/api/app/routers/eor.py`

### 2. Employee Detail Page Crash
- **Root Cause:** `base_salary` arrives as string `"1500.00"` (Pydantic Decimal serialization); calling `.toFixed(2)` on a string crashes. Additionally, AFP comparisons used `AFP_CRECER` but backend returns `CRECER`.
- **Fix:** Wrapped with `Number()` in 3 locations; updated AFP comparisons
- **Files:** `apps/web/src/app/employer/eor/[id]/page.tsx`, `apps/web/src/app/employee/profile/page.tsx`

### 3. Contract Download "Not Authenticated"
- **Root Cause:** `window.open(url?token=...)` doesn't send `Authorization: Bearer` header
- **Fix:** Replaced with `fetch()` + Authorization header + blob download pattern
- **Files:** `apps/web/src/app/employer/eor/[id]/page.tsx`, `apps/web/src/app/employee/documents/page.tsx`

### 4. Corrupt Contract PDF
- **Root Cause:** Hand-rolled raw PDF with hardcoded xref byte offsets that don't match actual object positions
- **Fix:** Replaced with `reportlab` `SimpleDocTemplate` for proper PDF generation
- **Files:** `apps/api/app/services/contract_generator.py`, `apps/api/requirements.txt`

## Production Database Work

- Production DB was at alembic migration 006 but tables from 007-010 already existed
- Stamped alembic version to 010 to align tracker with actual state
- Created EOR tables (migration 011) via direct SQL with `DO/EXCEPTION` blocks for idempotency
- Verified employee creation and listing in production

## Metrics

- **Bugs fixed:** 4
- **Files modified:** 6
- **Commits:** 4
- **Production downtime:** 0 (all fixes deployed via git push → Vercel auto-deploy)
- **Tests passing:** 20/20 (payroll_sv) + 9/9 (cv_validator) + build clean

## Key Lessons

1. SQLAlchemy Enum columns need Python enum instances, not strings
2. Pydantic `Decimal` serializes as string in JSON — always `Number()` in TypeScript
3. Authenticated file downloads need `fetch` + header, not `window.open`
4. Never hand-roll PDFs with hardcoded byte offsets — use reportlab
5. Always verify `alembic current` before running migrations in production
