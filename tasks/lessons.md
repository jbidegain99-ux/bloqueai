# TalentOS Lessons Learned

## Session: 2026-03-15 - Government Compliance + SPU Generation

### SPU File Format Patterns

1. **UTF-8 BOM for Excel** — SPU files start with `\ufeff` (UTF-8 Byte Order Mark). Without this, Excel on Windows opens the CSV with garbled characters for Spanish text (á, é, ñ, etc.).

2. **Pipe delimiter, not comma** — Government CSV formats in LATAM often use `|` (pipe) instead of `,` (comma) to avoid conflicts with thousand separators (e.g., `1,000.00`). The SPU uses pipe-delimited fields.

3. **Amounts as zero-padded integers** — Monetary values are stored as cents without decimal point, zero-padded to fixed width. `$1,000.50` becomes `000100050`. This prevents parsing ambiguity across locales.

4. **Header/Detail/Trailer pattern** — Government batch files use E/D/T record types. The trailer includes a checksum and totals that must match the sum of all detail records. This enables validation without re-processing all rows.

### Compliance Validation Patterns

1. **8-point checklist** — Before government submission, validate: DUI present, bank accounts, no negatives, ISSS cap, ISR non-negative, net non-negative, active contracts, totals consistency.

2. **Tolerance for rounding** — Use $0.50 tolerance when comparing calculated totals vs stored values. Decimal→float→Decimal round-trips can introduce sub-cent differences that shouldn't fail compliance.

3. **Defensive Decimal conversion** — Always wrap values in `Decimal(str(value))` when receiving from SQLAlchemy. Database `Numeric` columns may return `float` or `int` depending on the driver, and calling `.quantize()` on a plain `int` raises `AttributeError`.

---

## Session: 2026-03-15 - Payroll Calculation Engine

### Payroll Calculation Patterns

1. **Decimal, not float** — All monetary calculations use `Decimal` with `ROUND_HALF_UP` to 2 places. This prevents floating-point drift that accumulates across thousands of employees. The `_r()` helper standardizes rounding.

2. **ISR excedente method** — SV ISR uses the "excedente" formula: `tax = (amount - bracket_start) × marginal_rate + fixed_tax`. This is NOT the same as simply multiplying the full amount by the rate. The fixed_tax absorbs the tax from lower brackets.

3. **ISSS cap vs AFP uncapped** — ISSS contributions cap at $1,000 gross/month (both employee and employer). AFP has NO cap — applied to full gross. This means high earners pay disproportionately more AFP than ISSS.

4. **Provisions are monthly accruals** — Aguinaldo (annual) and vacaciones (annual) are divided by 12 for monthly provisioning. This spreads the cost evenly and prevents cash flow surprises in December.

### Test Fixture Design

1. **Parametrized scenarios** — Use `@pytest.mark.parametrize` with named tuples for salary scenarios. Each scenario documents the hand calculation as a comment. This makes test failures immediately debuggable.

2. **Test the engine, not the router** — The `PayrollCalculatorSV` is a pure function with no DB dependencies. Test it directly (0.07s for 31 tests) rather than through HTTP endpoints (which add 20+ seconds of setup/teardown).

3. **Inverse calculator verification** — The bisection-based net-to-gross calculator is verified by checking that `|actual_net - desired_net| < $0.05`. The tolerance exists because rounding makes exact inversion impossible.

---

## Session: 2026-03-15 - Employees + Contracts CRUD

### Business Logic Patterns

1. **Signed contract immutability** — Once `signed_by_employee_at` is set, the contract PATCH endpoint rejects all updates with 400. To change terms, create a new contract (which auto-deactivates the previous one).

2. **Employee termination cascade** — Terminating an employee sets `status=TERMINATED`, `is_active=False`, `termination_date=today`, AND deactivates all active contracts with `end_date=today`. This is a soft delete — no records are deleted.

3. **One active contract per employee** — Creating a new contract automatically deactivates all previous active contracts for the same employee. This provides implicit salary history (query `payroll_contracts WHERE employee_id=X ORDER BY start_date DESC`).

4. **DUI uniqueness is per-tenant** — The same DUI can exist in different tenants (companies), but not within the same one. This handles the case where the same person could work for multiple companies on the platform.

### Validation Patterns

1. **Pydantic field_validator for DUI** — DUI format validation uses `@field_validator("document_id")` that checks `info.data.get("document_type")`. Only validates format when `document_type == "DUI"`.

2. **DB-level uniqueness check** — DUI uniqueness is checked via DB query before insert (not a unique constraint) because the constraint needs to be scoped to `client_id + document_id + document_type`.

3. **Contract date validation** — `end_date > start_date` is validated at schema level via `@field_validator("end_date")` that accesses `info.data.get("start_date")`.

---

## Session: 2026-03-15 - Auth & Multi-Tenancy Verification

### Multi-Tenancy Security Patterns

1. **company_id NOT in JWT** — Unlike many multi-tenant systems, TalentOS does NOT include `company_id` (tenantId) in the JWT payload. Instead, `company_id` is fetched from the database on every request via `get_current_user()`. This means role/company changes take effect immediately without waiting for token expiry.

2. **ADMIN bypasses tenant filtering** — The `get_job_or_404()` helper only filters by `company_id` for non-ADMIN users. ADMIN role has cross-tenant visibility by design. This is intentional for platform operators but should be documented clearly.

3. **Application-level + RLS defense-in-depth** — Tenant isolation is enforced at two levels: application queries filter by `company_id`, and PostgreSQL RLS policies (Supabase) provide database-level enforcement. Neither alone is sufficient.

### JWT Best Practices Learned

1. **Separate access/refresh tokens with type field** — Both tokens contain a `"type"` field ("access" or "refresh"). The `get_current_user` dependency checks `type == "access"`, preventing refresh tokens from being used as access tokens.

2. **Stateless but with DB validation** — Every request hits the DB to verify the user exists and `is_active == True`. This means deactivating a user takes effect immediately, at the cost of one DB query per request.

3. **No token blacklist** — Logout is client-side only. A stolen access token is valid for 30 minutes. Mitigation: short access token TTL + refresh rotation.

### Role-Based Access Control

1. **FastAPI dependency injection for RBAC** — Roles are enforced via `Depends(require_role(UserRole.ADMIN))` in endpoint signatures. This is clean but means role checks happen BEFORE endpoint code runs.

2. **Four roles, linear hierarchy** — CANDIDATE < EMPLOYER < RECRUITER < ADMIN. Each higher role includes access to all lower-role endpoints.

### Testing Patterns

1. **SQLite cannot be used for tests** — Models use JSONB, UUID, and PostgreSQL-specific enums. Tests MUST use PostgreSQL (`talentos_test` database on localhost:5433).

2. **sa.Enum vs postgresql.ENUM in Alembic** — `sa.Enum(name='x')` in `create_table()` always tries to CREATE TYPE, ignoring `create_type=False`. Must use `postgresql.ENUM(name='x', create_type=False)` to prevent duplicate type errors when the type was already created via `.create(checkfirst=True)`.

---

## Session: 2026-03-15 - Payroll Schema Extension

### Database Schema Design

1. **Non-destructive migrations** — All new columns added as nullable or with `server_default` to avoid breaking existing data. Never ALTER a column type in place; add a new column and migrate data.

2. **Numeric vs Float for money** — Use `Numeric(12, 2)` for all monetary fields (salary, deductions, provisions). `Float` causes rounding errors. Legacy payroll tables still use Float; new tables use Numeric.

3. **JSONB + relational hybrid** — Keep `deductions_detail` JSONB on PayrollLine for backward compat, but also store in `payroll_deduction_breakdowns` relational table for queryability. Gradual migration path.

4. **Benefits JSON schema** — Structure JSONB with known top-level keys (`health_insurance`, `life_insurance`, `meal_allowance`, `transport_allowance`) plus a `custom` array for extensibility. This enables partial GIN indexing while keeping flexibility.

### Multi-Tenant Filtering Patterns

1. **client_id on every table** — Every payroll table has `client_id` FK to `companies.id`. All queries MUST filter by `client_id` to prevent data leakage between tenants.

2. **RLS as defense-in-depth** — Row Level Security policies exist on all public tables (migration 020). Application-level filtering is still required; RLS is a safety net.

3. **Multi-currency strategy** — Currency stored at 3 levels:
   - Employee: `salary_currency` (display preference)
   - Contract: `currency` (legal/contractual)
   - PayrollRun: `currency` (settlement/payment)
   - Future: add exchange rate table for cross-currency payroll runs.

### Prisma vs SQLAlchemy Note
This project uses SQLAlchemy + Alembic, NOT Prisma. When planning tasks, always reference Alembic for migrations and SQLAlchemy for ORM operations.

---

## Session: 2026-02-02 - Platform Stabilization

### Patterns to Avoid

1. **Enum Serialization in FastAPI**
   - Pattern: Returning SQLAlchemy enum fields directly in dict responses
   - Fix: Always use `.value` on enum fields: `session.status.value`
   - Files affected: `admin.py` line 319, 332

2. **CSV Export Auth**
   - Pattern: Using `window.open()` with query string tokens
   - Fix: Use `fetch()` with proper Authorization header + blob download
   - Files affected: `api.ts` lines 235-272

3. **Frontend Boolean Checks**
   - Pattern: Checking `hasInterview` when variable is `hasCompletedInterview`
   - Fix: Match variable names exactly, use TypeScript for catching errors
   - Files affected: `candidate/profile/page.tsx`

4. **Optional Fields in Interfaces**
   - Pattern: Accessing `interview_session_id` without optional marker
   - Fix: Add `?` to optional fields: `interview_session_id?: string`
   - Files affected: Type definitions in `api.ts`

5. **Threshold Hardcoding**
   - Pattern: Hardcoding threshold value (70) throughout codebase
   - Fix: Use SystemSettings with inheritance: job ?? client ?? system
   - Files affected: `applications.py`, `public.py`

### Architecture Decisions

1. **Threshold Hierarchy**
   - System default (settings table) -> Client override (company.match_threshold) -> Job override (job.match_threshold)
   - Final threshold = `job.match_threshold ?? company.match_threshold ?? system_default`
   - Store applied_threshold in Application for audit trail

2. **Company as Client**
   - Company model serves dual purpose: employer and client
   - Added `is_client` flag and `client_code` for distinction
   - Jobs linked via `company_id` (already existed)

3. **Company Name Privacy**
   - Candidates always see `display_company_name` ("Bloque Internacional")
   - Employers/Admins see real company name
   - Public API never exposes real company details

4. **Application Flow**
   - CREATED -> CV_UPLOADED -> ANALYZING -> MATCH_PASSED/BELOW_THRESHOLD -> INTERVIEW_* -> COMPLETED
   - Threshold check uses hierarchical resolution
   - applied_threshold stored for audit

5. **Job Status Lifecycle**
   - DRAFT: Initial creation
   - PENDING: Awaiting approval
   - ACTIVE: Live, accepting applications
   - PAUSED: Temporarily hidden
   - CLOSED: No new apps, visible in reports
   - INACTIVE: Archived

### Implementation Patterns

1. **SystemSettings Model**
   - Key-value store with typed value columns (value_int, value_bool, value_json)
   - Class methods for easy access: `SystemSettings.get_int(db, 'key', default)`
   - Seeds default values in migration

2. **Job Copilot Service**
   - Separate service class for AI functionality
   - Logs all LLM calls to LLMLog table
   - Returns editable JSON, never auto-publishes

3. **Category-Specific Fields**
   - Template dictionary with field definitions per category
   - Stored in job.category_fields JSONB column
   - Endpoint returns template for frontend rendering

4. **Dashboard with Filters**
   - All filters optional (nullable query params)
   - Date parsing with fallback
   - Returns filter_options for UI dropdowns

### Pre-flight Checklist (Before Any Change)

- [ ] Read the file first (tool requirement)
- [ ] Understand existing patterns
- [ ] Check for enum usage and serialize properly (.value)
- [ ] Verify auth flows work correctly
- [ ] Test as all 3 roles: Candidate, Employer, Admin
- [ ] Check for hardcoded values that should be configurable
- [ ] Ensure migrations are additive (no data loss)

### Testing Notes

- Always check browser console for client-side errors
- Verify network requests in DevTools
- Test CSV downloads actually produce files (not about:blank)
- Check auth redirects work properly
- Verify threshold inheritance with different combinations

### Migration Safety

- Use `IF NOT EXISTS` for enum value additions
- Add columns with `nullable=True` or `server_default`
- Create indexes after table creation
- Seed default data in migration

### Code Organization

- Services in `/services/` for complex logic
- Models in `/models/` with proper relationships
- Routers organized by role/feature
- Export new models in `__init__.py`

### Session Summary

1. **Verification Before Implementation**
   - T1-T5 were already implemented from previous session
   - Code review verified correctness before marking done
   - Avoided re-implementing existing features

2. **New Features Implemented**
   - T6: Threshold hierarchy (SystemSettings, Company threshold, Application audit)
   - T7: Job states (PENDING, INACTIVE added)
   - T8: Category fields for generic job form
   - T9: Job Copilot AI service
   - T10: Client designation in Company model
   - T11: Dashboard with filters and export
   - T12: Placements and Assignments models

3. **Documentation**
   - tasks/todo.md with full status
   - tasks/qa.md with test checklist
   - tasks/lessons.md (this file)

---

## Session: 2026-02-02 - QA Fix Session

### New Patterns Discovered

1. **Datetime Serialization in FastAPI Dict Responses**
   - Pattern: Returning datetime fields in dict() without .isoformat()
   - Fix: Always call `dt.isoformat() if dt else None` for datetime fields
   - Files affected: `admin.py` (interviews endpoint)

2. **Nullable Score Fields**
   - Pattern: Calling `.toFixed()` on nullable number fields
   - Fix: Check for null/undefined before numeric formatting: `score ?? 0`
   - Files affected: `admin/interviews/page.tsx`

3. **Async Export Functions**
   - Pattern: Not awaiting async export functions (silently fails)
   - Fix: Always `await` async functions and add error handling
   - Files affected: `employer/jobs/[id]/page.tsx` exportCsv function

4. **Query Params vs Request Body in FastAPI**
   - Pattern: Frontend sends JSON body, backend expects Query params
   - Fix: Use Pydantic request schemas with Body(...) instead of Query(...)
   - Files affected: All copilot endpoints in `employer.py`

### New Features Implemented

1. **CV Builder IA Wizard** (`/candidate/cv-builder`)
   - 6-step wizard for creating CV from scratch
   - AI generates professional summary
   - Creates HTML/PDF CV
   - Auto-saves draft to localStorage
   - New backend service: `cv_builder.py`

2. **Clients Management UI** (`/admin/clients`)
   - Full CRUD for client management
   - Toggle is_client status
   - View linked jobs per client
   - New backend endpoints and schemas

3. **Placements Management UI** (`/admin/placements`)
   - List/create/edit placements
   - Status and type badges
   - Filter by client, status, type, dates
   - Summary cards with metrics

4. **Job Status Dropdown**
   - Employer can now change job status from detail page
   - Options: PENDING, ACTIVE, PAUSED, CLOSED, INACTIVE
   - Success/error feedback

5. **Category-Aware Job Form Placeholders**
   - Dynamic placeholders based on job category
   - Categories: TECHNOLOGY, HEALTHCARE, FINANCE, LEGAL, SALES, etc.

6. **Job Copilot Error Handling**
   - User-friendly error messages when LLM API key missing
   - Success feedback when content generated
   - Fixed body/query param mismatch

7. **Candidate Profile Enhancements**
   - CV source indicator (UPLOADED / AI_BUILDER / MANUAL)
   - CV last updated timestamp
   - Fixed false "Entrevista completada" state
   - New ResumeSource enum

### Architecture Patterns Used

1. **Pydantic Request/Response Schemas**
   - Create explicit schemas for complex endpoints
   - Better validation and documentation
   - Example: `CopilotDescriptionRequest`, `ClientCreate`

2. **Component Modals Pattern**
   - Use inline modals (fixed inset-0) for create/edit forms
   - Consistent across admin pages

3. **Status/Message State Pattern**
   ```typescript
   const [statusMessage, setStatusMessage] = useState<{type: 'success'|'error', text: string}|null>(null)
   ```
   - Auto-clear success after 3 seconds
   - Persist error until user action

4. **Draft/Autosave Pattern**
   - Use localStorage for form drafts
   - Clear on successful submit
   - Example: CV Builder saves progress

### Files Created This Session

**Backend:**
- `apps/api/app/services/cv_builder.py` - CV generation service
- `apps/api/app/schemas/copilot.py` - Copilot request/response schemas
- `apps/api/app/schemas/client.py` - Client management schemas

**Frontend:**
- `apps/web/src/app/candidate/cv-builder/page.tsx` - CV Builder wizard
- `apps/web/src/app/admin/clients/page.tsx` - Clients management
- `apps/web/src/app/admin/placements/page.tsx` - Placements management

### Key Fixes Summary

| Issue | Root Cause | Fix |
|-------|------------|-----|
| /admin/interviews crash | Null scores + datetime serialization | Added null checks + .isoformat() |
| CSV export no download | Async function not awaited | Added await + error handling |
| Copilot buttons no content | Query params vs body mismatch | Changed to Pydantic body schemas |
| Profile false states | Checking score instead of session status | Check actual InterviewSession.status |
| Job status not editable | No UI control | Added dropdown with status options |
| Dev-specific placeholders | Hardcoded React/Node | Category-aware dynamic placeholders |

---

## Session: 2026-02-17 - QA Clientes + Entrevista IA + Payroll Seeds

### Patterns Discovered

1. **Seed Script Reuse via Wrapper**
   - Pattern: Creating thin wrappers that import existing seed functions
   - Benefit: Single source of truth for seed logic, multiple entry points
   - Example: `seed_interview_high_match.py` wraps `seed_interview_e2e.py`

2. **Payroll Calculation Inline in Seeds**
   - Pattern: Router has calculation logic but no separate service layer
   - Workaround: Replicate calculation inline in seed script
   - Improvement: Extract payroll calculation into a service for reuse
   - Files affected: `payroll.py:485-580`, `seed_payroll_mvp.py`

3. **Idempotent Seeds with filter().first()**
   - Pattern: Always check if entity exists before creating
   - Use `db.query(Model).filter(Model.unique_field == value).first()`
   - If exists, reuse; if not, create
   - Critical for development workflow (run seed multiple times)

4. **Placement-Payroll Bridge**
   - Pattern: PayrollEmployee.candidate_id links to Candidate (which links to Placement)
   - Flow: Candidate → Placement (ACTIVE) → PayrollEmployee → Contract → PayrollRun
   - candidate_id is nullable (supports employees not from recruitment pipeline)

5. **BrandCardHeader Requires title Prop**
   - Pattern: `BrandCardHeader` component requires `title: string` prop, not children
   - Fix: Use `<div>` elements for custom card headers, or pass `title` prop
   - Files affected: payroll dashboard, runs/[id], reports pages

### Architecture Decisions

1. **Monthly Run Only Processes Monthly Employees**
   - PayrollRun with MONTHLY frequency only includes employees with MONTHLY contracts
   - Biweekly employees need a separate BIWEEKLY run
   - Filter: `contract.pay_frequency == run.pay_frequency`

2. **Deduction Types: Percentage vs Fixed**
   - PERCENTAGE type: `deduction = base_salary * (rate / 100)`
   - FIXED type: `deduction = rate` (flat amount)
   - Both stored in same DeductionType model, distinguished by `calculation_type`

3. **Feature Flag Gating**
   - `enable_payroll` must be True for payroll API and seeds
   - Router uses `Depends(require_payroll_enabled)` at route level
   - Seeds set it via `settings.enable_payroll = True` or direct config

### Key Metrics (Payroll Seed)

- 4 employees: 2 MONTHLY ($45k, $35k), 2 BIWEEKLY ($25k, $15k)
- 3 deduction types: IMSS 2.5%, ISR 10%, Seguro Vida $150
- ~60 attendance records over 15 business days
- 1 payroll run (MONTHLY, Feb 2026) with 2 lines processed

---

## Session: 2026-02-20 - Bug Fixes (CV Upload + Interview Button)

### Patterns Discovered

1. **Duplicate Schemas with Conflicting Types**
   - `ResumeUploadResponse` exists in BOTH `schemas/application.py` AND `schemas/resume.py`
   - `application.py` version uses `ApplicationStatus` (correct for application flow)
   - `resume.py` version uses `ResumeStatus` (correct for profile resume flow)
   - Lesson: Name schemas uniquely when they represent different domain concepts

2. **Invisible Error Display**
   - `setError()` was called but the error element only rendered inside `step === 'upload'`
   - When user was on `step === 'results'`, errors from interview start were invisible
   - Lesson: Always verify error display exists in EVERY step/view where errors can occur

3. **Missing Loading State = "Button Doesn't Work"**
   - Backend calls LLM to generate first interview question (5-10s)
   - Without spinner/disabled state, users think button is broken
   - Lesson: Any async button action needs loading state, especially with LLM calls

4. **joinedload for Related Queries**
   - `db.query(Job).filter(...)` without `joinedload(Job.company)` risks lazy-load failures
   - Especially in list queries where multiple related objects are accessed
   - Lesson: Always joinedload relationships you plan to access in the same request

5. **Use `err: unknown` not `err: any`**
   - TypeScript best practice: catch blocks should use `unknown` type
   - Check with `err instanceof Error` before accessing `.message`
   - Follows CLAUDE.md "never use any" rule

---

## Session: 2026-02-20 - Login 500 Fix + Vercel Project Migration

### Patterns Discovered

1. **Verify Env Vars Are Correct Values**
   - `NEXT_PUBLIC_API_URL` was set to `"N\n"` (garbage) on the `web` Vercel project
   - This caused ALL API proxy calls to fail with 500
   - Lesson: When debugging 500s on API proxy, first check `NEXT_PUBLIC_API_URL` value

2. **Use `printf` Not `echo` for Vercel Env Vars**
   - `echo "value" | vercel env add` adds trailing newline to the value
   - Use `printf "value" | vercel env add` instead
   - This caused Sentry source map upload to fail with "Invalid value for project"

3. **Vercel Project Linking from Monorepo Root**
   - If Vercel project has `rootDirectory: apps/web` in settings, link from repo root NOT from apps/web
   - Linking from apps/web causes double-nesting: Vercel tries to build `apps/web/apps/web`
   - `.vercel` directory should be at repo root

4. **Multiple Vercel Projects = Confusion**
   - Having both `web` and `bloqueai-ia` projects pointing to similar code caused environment variable confusion
   - Always verify which project you're deploying to with `vercel whoami` + `vercel project ls`
   - Clean up unused projects promptly

5. **Dict vs ORM Object in FastAPI response_model**
   - When `response_model` inherits from a schema with required fields (like `TimestampSchema` with `created_at`/`updated_at`), returning a dict must include ALL required fields
   - Returning an ORM object works via `from_attributes=True` which auto-extracts all matching attributes
   - Lesson: If GET returns dict but PATCH returns ORM, they may behave differently with the same `response_model`
   - Tip: When writing dict responses, check the FULL inheritance chain of the response_model for required fields

6. **Vercel Monorepo Deploy: rootDirectory + CWD**
   - If a Vercel project has `rootDirectory: apps/api` in settings, always deploy from REPO ROOT, not from `apps/api/`
   - Deploying from `apps/api/` causes double-nesting: `apps/api/apps/api`
   - For deploying different projects from same monorepo, swap `.vercel/project.json` at repo root
   - Keep a backup: `cp .vercel/project.json .vercel/project.json.frontend` before swapping

---

## Session: 2026-02-20 - Infrastructure (Cache + Rate Limiting + Health)

### Patterns Used

1. **PostgreSQL as Cache (No Redis Required)**
   - Simple table with `cache_key` (SHA-256), `result` (JSONB), `expires_at`
   - Graceful degradation: all cache operations wrapped in try/except
   - Upsert pattern: check existing before insert to handle concurrent writes
   - TTL-based expiry with `expires_at > NOW()` filter

2. **slowapi Reuse Instead of Custom Rate Limiter**
   - slowapi was already installed but only used on 1 endpoint
   - Each router creates its own `Limiter(key_func=...)` — not shared from main
   - Custom `key_func` extracts `user_id` from `request.state` (set by middleware)
   - Decorator order matters: `@router` first, then `@limiter.limit`

3. **JWT Extraction in Middleware for Rate Limiting**
   - Can't use `Depends()` in middleware, so decode JWT manually
   - Best-effort: wrapped in try/except, falls back to IP if no valid token
   - Stored in `request.state.rate_limit_user_id` for key_func to read

4. **Body Parameter Rename for slowapi Compatibility**
   - slowapi needs a parameter named `request` with type `Request`
   - When endpoint already has `request: SomeBodySchema`, rename body to `body`
   - Update ALL references to `request.field` → `body.field` in the function

5. **Health Check Service-Level Granularity**
   - Each service (DB, OpenAI, Storage) gets its own `ServiceStatus` with status + latency
   - Overall status derived from individual: all healthy → healthy, DB only → degraded, DB down → unhealthy
   - `time.monotonic()` for accurate latency measurement (not affected by wall clock changes)

---

## Session: 2026-02-21 - Semana 3 UI/Dashboard Premium (T041-T049)

### Patterns Discovered

1. **Generic Constraint `extends object` vs `extends Record<string, unknown>`**
   - `Record<string, unknown>` requires an index signature — TypeScript interfaces DON'T satisfy it
   - `extends object` works with any interface (e.g., `DataTable<UpcomingInterview>`)
   - Lesson: Use `extends object` for generic component constraints, not `Record<string, unknown>`

2. **pnpm in Monorepo — Use `pnpm add -F <workspace>`**
   - This project uses pnpm with `pnpm-workspace.yaml`, not npm
   - Running `npm install` fails with postinstall script errors (`run-s`, `husky` not found)
   - Correct command: `pnpm add -F web @dnd-kit/core` (installs in the `web` workspace)
   - Always check for `pnpm-lock.yaml` before using npm

3. **PageTransition in Next.js App Router**
   - `exit` variants in Framer Motion ONLY work with `AnimatePresence`
   - In App Router, wrap children with `AnimatePresence mode="wait"` + key by `usePathname()`
   - Best place: inside the shared layout shell (AppShell), not in each page
   - `will-change: opacity, transform` for GPU acceleration

4. **SVG Sparkline with Framer Motion**
   - Use `motion.path` with `pathLength` animation (0 → 1) for draw effect
   - Area fill: close the path to bottom corners, use semi-transparent fill
   - Color based on trend: compare `data[last]` vs `data[first]`
   - End dot with `motion.circle` + delayed `scale` animation

5. **DnD Kit Column Detection**
   - Prefix column droppable IDs with `column-` to distinguish from card IDs
   - In `onDragOver`, check if `over.id` starts with `column-` vs finding card's column
   - `PointerSensor` with `activationConstraint: { distance: 5 }` prevents accidental drags
   - Optimistic update: modify local state immediately, then call API via callback

6. **Integrate Transitions at Shell Level, Not Page Level**
   - Adding `<PageTransition>` inside `AppShell` means ALL pages get transitions automatically
   - No need to import in every `page.tsx` — reduces boilerplate and forgotten imports
   - If a page needs to opt out, it can wrap its content in a `motion.div` with `initial={false}`

### Architecture Decisions

1. **DataTable Generic API**
   - Single generic component `DataTable<T>` handles all table needs
   - `columns` array with `render` function for custom cell content
   - `actions` array with `onClick(row)` for row-level actions
   - Internal state for sort/filter/pagination — no external state management needed
   - `emptyState` slot for custom empty illustrations (composable with EmptyState component)

2. **EmptyState Variant Pattern**
   - Config object maps variant keys to defaults (icon, title, description, colors)
   - All props are overridable — variant provides sensible defaults
   - One component, 7 variants — avoids 7 separate empty state components

3. **MetricCard Format Prop**
   - Default: `value.toLocaleString('es-ES')` for numbers
   - `format` prop for custom display: `format={(v) => \`${v.toFixed(1)}%\`}`
   - Keeps component generic — works for counts, percentages, currency

4. **KanbanBoard Data Shape**
   - Input: `Record<string, KanbanCandidate[]>` — column key → candidates
   - Output: `onStatusChange(candidateId, fromColumn, toColumn)` callback
   - Consumer decides how to handle the API call — Kanban is pure view layer
   - Optimistic update built-in, rollback can be done by passing new `candidates` prop

### Component Inventory (Semana 3)

| Component | Location | Depends On |
|-----------|----------|------------|
| DataTable | `components/ui/data-table.tsx` | DropdownMenu, Skeleton, Framer Motion |
| MetricCard | `components/ui/metric-card.tsx` | Skeleton, Framer Motion |
| EmptyState | `components/ui/empty-state.tsx` | Button, Framer Motion |
| PageTransition | `components/layout/page-transition.tsx` | Framer Motion, animations.ts |
| PipelineFunnel | `components/dashboard/pipeline-funnel.tsx` | Skeleton, Framer Motion |
| KanbanBoard | `components/candidates/kanban-board.tsx` | @dnd-kit, Avatar, Badge, Skeleton, Framer Motion |
| CommandPalette | `components/ui/command-palette.tsx` | cmdk, Framer Motion, auth store |

---

## Session Fixes 2026-02-21

### Patterns Discovered

1. **cmdk Keyboard Shortcut — Capture Phase Required**
   - `document.addEventListener('keydown', handler, true)` — the `true` (capture) is essential
   - Without capture phase, Next.js or other listeners may swallow the event
   - Must call both `e.preventDefault()` and `e.stopPropagation()` for Ctrl+K

2. **Array.from(new Set()) vs Spread**
   - `[...new Set(array)]` fails with TS2802 when `downlevelIteration` is not enabled
   - Always use `Array.from(new Set(array))` for safer TypeScript compatibility

3. **Generic Constraint: `extends object` not `Record<string, unknown>`**
   - `Record<string, unknown>` rejects interfaces with defined properties
   - `extends object` accepts any non-primitive — works with all interface types
   - Applied to DataTable<T>, affects any generic component accepting user-defined types

4. **Employer Dashboard Type Casting**
   - API responses typed as `{ items?: Record<string, unknown>[] }` for safety
   - Map over items with `String(j.field ?? '')` / `Number(j.field ?? 0)` coercion
   - Never cast API response directly to domain interface — always map explicitly

5. **Dashboard Role Routing**
   - Employers at `/dashboard` get `router.replace('/employer/dashboard')` redirect
   - Avoids maintaining duplicate employer dashboard code in two locations
   - `replace` not `push` to keep clean browser history

### Architecture Decisions (Fixes)

1. **Command Palette in AppShell**
   - Mounted once at AppShell level → available on all authenticated pages
   - Role-based items computed via `useMemo` with auth store helpers
   - Logout action uses `router.push('/login')` after `logout()` from store

2. **Premium Component Adoption Pattern**
   - MetricCard, DataTable, EmptyState used consistently across all dashboards
   - QuickAction extracted as local component (not shared — too page-specific)
   - Status badge maps (label + variant) defined as page-level constants

---

## Session: 2026-02-21 - EOR Production Bug Fixes

### Patterns Discovered

1. **SQLAlchemy Enum Columns Require Python Enum Instances**
   - Passing `"CRECER"` (string) to a column typed `Enum(AFPProvider)` raises `LookupError`
   - Must convert: `AFPProvider(data.afp_provider)` before constructing the model
   - Same applies to all enum columns: `BankAccountType`, `EORPaymentFrequency`, `EORContractType`
   - Pydantic schemas use `str` fields with `@validator` normalization — the router must bridge the gap

2. **Pydantic Decimal Serializes as String in JSON**
   - `Decimal("1500.00")` becomes `"1500.00"` (string) in JSON response
   - Frontend calling `.toFixed(2)` on a string silently returns wrong result or crashes
   - Fix: Always wrap with `Number()` in TypeScript: `Number(employee.base_salary).toFixed(2)`
   - Applies to any `Decimal`, `Numeric`, or `numeric` DB column

3. **Authenticated File Downloads: fetch + Blob, Not window.open**
   - `window.open(url?token=...)` does NOT send Authorization header
   - Backend endpoints expecting `Authorization: Bearer` header reject query param tokens
   - Correct pattern: `fetch()` with header → `res.blob()` → `URL.createObjectURL()` → `a.click()`
   - Always clean up: `URL.revokeObjectURL()` + `a.remove()`

4. **Raw PDF Generation with Hardcoded Offsets = Corrupt Files**
   - Hand-rolling PDF with `%PDF-1.4` header and hardcoded xref byte offsets breaks when content varies
   - Content stream length changes with different contract data → offsets become wrong
   - Always use a proper PDF library (reportlab, FPDF, WeasyPrint)
   - reportlab `SimpleDocTemplate` + `Paragraph` + `Spacer` handles pagination automatically

5. **Alembic Version Can Get Out of Sync with DB State**
   - Tables from migrations 007-010 existed but `alembic current` showed version 006
   - This happens when tables are created outside alembic (manual SQL, other tools)
   - Fix: `alembic stamp <version>` to align the version tracker
   - Always verify with `alembic current` before running `upgrade head`

6. **SQLAlchemy Enum create_type=False May Be Ignored**
   - In migration 011, `sa.Enum(..., create_type=False)` was specified but `CREATE TYPE` still ran
   - When the type already exists → `DuplicateObject: type "afp_provider" already exists`
   - Workaround: Create tables via direct SQL with `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`

7. **Enum Comparison Values Must Match Backend Normalization**
   - Frontend compared `afp_provider === 'AFP_CRECER'` but backend stores/returns `'CRECER'`
   - Always check actual API response values, not what you assume the enum name is
   - SQLAlchemy `Enum.value` may differ from the Python enum member name

8. **try/except + db.rollback() Around db.commit()**
   - Without rollback on exception, the SQLAlchemy session enters a broken state
   - Subsequent queries on the same session fail with `InvalidRequestError`
   - Pattern: `try: db.commit() except Exception: db.rollback(); raise`

9. **Production DB Migrations Need Verification First**
   - Always run `alembic current` to check version before `upgrade`
   - Check if tables/types already exist before creating them
   - Use `DO/EXCEPTION` blocks for idempotent DDL in PostgreSQL
   - Keep a mental model of what each migration creates

10. **Vercel Auto-Deploys from Git Push**
    - Connected Vercel projects auto-deploy on `git push`
    - No manual `vercel deploy --prod` needed for code changes
    - But DB migrations must be run separately (they don't auto-run)
    - API: `bloqueai-api.vercel.app`, Frontend: `bloqueai-ia.vercel.app`

### Key Fixes Summary

| Bug | Root Cause | Fix | Commit |
|-----|-----------|-----|--------|
| 500 on employee create | String→Enum mismatch in SQLAlchemy | Explicit enum conversion in router | `3414fba` |
| Detail page crash | Decimal→String + AFP enum names | `Number()` wrap + comparison fix | `a71f6d5` |
| Contract download 401 | `window.open` doesn't send headers | `fetch` + blob download | `14f7f88` |
| Corrupt PDF | Hardcoded xref offsets in raw PDF | reportlab SimpleDocTemplate | `21e5095` |

---

## Session: 2026-02-23 - QA Bug Fixes (Prompt 23)

### Patterns Discovered

1. **Zustand Persist Hydration Race Condition**
   - `zustand/middleware/persist` hydrates async from localStorage
   - Store starts with default values (isAuthenticated: false) on SSR/page load
   - useEffect auth guards fire BEFORE hydration, causing false redirects to /login
   - Fix: Add `isHydrated` flag with `onRehydrateStorage` callback, check before redirecting
   - Pattern: `if (!isHydrated) return` as FIRST line in auth guard useEffect

2. **Role Check Order Matters**
   - `isEmployer()` included ADMIN and RECRUITER roles for convenience
   - This meant `isEmployer()` returned true for admins, checked BEFORE `isAdmin()`
   - Fix: Make role checks exclusive (isEmployer = EMPLOYER only) and check most specific first
   - Order: isAdmin → isRecruiter → isEmployer → isCandidate

3. **tsconfig.json Must Exclude E2E Test Directories**
   - Playwright test files (e2e/) use types not available in Next.js build context
   - Including them in tsconfig causes build failures (e.g., `Window` type extensions)
   - Fix: Add `"e2e"` to `exclude` array in tsconfig.json

4. **aria-label on Icon-Only Buttons**
   - Buttons with only an icon (no text) need `aria-label` for screen readers
   - Easy to miss in initial development, caught by accessibility tests
   - Always add `aria-label` when button content is purely visual

5. **role="alert" for Error Messages**
   - Screen readers need `role="alert"` to announce error messages dynamically
   - Apply to both field-level errors and form-level error banners

---

## Session: 2026-02-23 - pgvector + Embeddings (Prompt 24)

### Key Patterns

1. **pgvector Installation in Docker**
   - `postgres:16-alpine` does NOT include pgvector — must compile from source or use `pgvector/pgvector:pg16`
   - When compiling inside container: `make install` may fail on LLVM bitcode step — use `with_llvm=no`
   - For docker-compose, prefer the official pgvector Docker image: `pgvector/pgvector:pg16`

2. **Alembic Migrations with pgvector Vector Type**
   - Alembic's `sa.Column()` doesn't natively support pgvector `Vector` type
   - Use raw SQL: `op.execute("ALTER TABLE ... ADD COLUMN ... vector(1536)")`
   - For `embedding_updated_at` use standard `sa.Column(sa.DateTime())`
   - HNSW index creation also requires raw SQL with `op.execute()`

3. **Adapting Prompt Templates to Actual Codebase**
   - Prompts assume generic names (e.g., `OPENAI_API_KEY`, `CandidateProfile`)
   - Always check actual: config key names, model names, table names, import paths
   - This project uses `llm_api_key` + `llm_base_url` (not separate `OPENAI_API_KEY`)
   - Table is `candidates` (not `candidate_profiles`), jobs use `must_haves` JSONB (not `requirements` Text)

4. **EmbeddingService Design**
   - Singleton pattern for embedding service (module-level instance)
   - In-memory cache with MD5 hash keys to avoid duplicate API calls
   - `use_cache=False` option for force regeneration
   - Batch API: send multiple texts in one `embeddings.create()` call
   - Always handle enum `.value` when building text from JSONB fields that may contain enum instances

---

## Session: 2026-02-24 - Video Interview Infrastructure (Prompt 27)

### Patterns Used

1. **Lazy Imports for Optional Heavy Dependencies**
   - Pipecat and its sub-packages (deepgram, elevenlabs, anthropic) are heavy
   - Import them lazily inside `async def run()` with try/except ImportError
   - This allows the app to start even if pipecat isn't installed (graceful degradation)
   - Pattern: services that depend on optional packages should lazy-import at usage time

2. **Singleton Service Pattern for External APIs**
   - `get_livekit_service()` returns a module-level singleton
   - Service checks configuration in `__init__` and logs warning if not configured
   - No crash on startup — allows other features to work without LiveKit
   - Same pattern used by `get_embedding_service()` in embeddings module

3. **Background Tasks for Long-Running AI Processes**
   - `BackgroundTasks.add_task()` for the interview agent pipeline
   - Agent runs in background while HTTP response returns immediately
   - Background task creates its own DB session (SessionLocal) to avoid session scope issues
   - Always wrap in try/except with status update on error

4. **Pipecat Dependency Chain Impact**
   - Installing `pipecat-ai[livekit,deepgram,anthropic,elevenlabs]` bumps:
     - `pydantic` from 2.5.3 → 2.12.5
     - `openai` from 1.12.0 → 2.23.0
     - `numpy` from 1.26.4 → 2.2.6
   - Existing code still works with newer versions (backward compatible)
   - Always verify full app loads after heavy dependency installs

5. **VideoInterview vs InterviewSession**
   - Existing `InterviewSession` model handles text-based AI interviews
   - New `VideoInterview` model handles LiveKit-based video interviews
   - Both link to `Application` — different modalities for the same flow
   - Named `VideoInterview` (not `Interview`) to avoid confusion with existing model

---

## Session: 2026-02-24 - Video Interview UI (Prompt 28)

### Patterns Discovered

1. **CustomEvent Bridge for Cross-Component Communication**
   - `RoomEventHandler` (inside LiveKitRoom context) receives `DataReceived` events
   - Cannot pass data directly to `TranscriptPanel` (different component tree positions)
   - Solution: dispatch `window.CustomEvent('interview-transcript', { detail })` from handler
   - TranscriptPanel listens via `window.addEventListener('interview-transcript', ...)`
   - Simpler than lifting state up through multiple layers or adding a global store

2. **LiveKit React SDK Component Hierarchy**
   - `LiveKitRoom` must be the outermost wrapper — all hooks require its context
   - `useTracks()`, `useParticipants()`, `useRoomContext()` only work inside `LiveKitRoom`
   - `RoomAudioRenderer` must be inside `LiveKitRoom` for audio playback
   - `ControlBar` provides built-in mic/camera/leave controls with `variation="verbose"`

3. **Media Stream Cleanup Before LiveKit Connection**
   - PreJoinCheck acquires `getUserMedia()` for camera/mic preview
   - MUST call `stream.getTracks().forEach(t => t.stop())` before LiveKit connects
   - If preview tracks aren't stopped, LiveKit can't acquire the same devices
   - Pattern: stop tracks in `handleJoin()`, then call `onReady()` callback

4. **Adapting Prompt Code to Existing Patterns**
   - Prompt code used `localStorage.getItem('token')` → adapted to zustand `useAuthStore()`
   - Prompt code used Integer IDs → adapted to UUID strings
   - Prompt code imported `alert.tsx`/`scroll-area.tsx` → used plain divs (components don't exist)
   - Prompt code used `any` types → used `unknown` with `instanceof` checks per CLAUDE.md
   - Always scan prompt code for patterns that don't match the actual codebase

5. **State Machine Pattern for Multi-Step UIs**
   - Interview page uses explicit `InterviewState` type: loading | pre-join | joining | in-room | completed | error
   - Each state renders a completely different UI (not conditional visibility)
   - State transitions are explicit via `setState('next-state')`
   - Error state always provides both "back" and "retry" actions

---

## Session: 2026-02-24 - Interview Analysis (Prompt 29)

### Patterns Discovered

1. **Codebase Uses OpenAI-Compatible API, Not Anthropic Directly**
   - Prompt assumed `Anthropic(api_key=...)` but codebase uses `llm_api_key` + `llm_base_url`
   - Settings: `llm_base_url`, `llm_api_key`, `llm_model` (defaults to gpt-4o-mini)
   - Solution: Use `OpenAI(api_key=..., base_url=...)` client for analysis service
   - Any OpenAI-compatible provider works (OpenAI, Azure, local, etc.)

2. **Job Model Uses `must_haves` Not `requirements`**
   - Prompt assumed `job.requirements` (List[str]) but actual field is `job.must_haves` (JSONB)
   - Always verify actual model fields before implementing — prompts describe ideal, not actual

3. **Candidate Name Through User Relationship**
   - Candidate model has NO `full_name` — it lives on `candidate.user.full_name`
   - Must eager-load with `joinedload(Candidate.user)` to avoid N+1
   - Same applies to `candidate.user_id` for auth checks

4. **Role-Based Response Differentiation**
   - Single endpoint `/results` returns different data based on user role
   - Employers: full analysis (scores, recommendation, red flags, all details)
   - Candidates: limited feedback (impression, 2 strengths, 1 tip)
   - Avoids needing separate endpoints while protecting sensitive scoring data

5. **Analysis Caching on First Request**
   - `/analyze` endpoint checks if `ai_scores` and `ai_summary` already exist
   - If so, returns cached result immediately (no re-analysis, no extra LLM cost)
   - Pattern: idempotent analysis — calling twice is safe and cheap

---

## Session: 2026-03-04 - AI Video Interview TTS Audio Truncation Fix

### Root Cause

**ElevenLabs Free tier cannot use library voices via API (HTTP 402).**

The voice ID `xzWD1ftyNVsuUMY2ll3j` (Valentina) is a **library voice** that requires a paid ElevenLabs plan. The API returns:
```
{"detail":{"type":"payment_required","message":"Free users cannot use library voices via the API. Please upgrade your subscription to use this voice."}}
```

This caused the symptom: `diag_tts_audio bytes=24000 dur_ms=500.0 gap_ms=10001.5 n=1` — only 1 tiny audio chunk (0.5s) instead of the expected 15-20s greeting.

### How to Debug TTS Issues (diag_tts_audio metrics)

| Metric | Meaning | Healthy Value |
|--------|---------|---------------|
| `n` | Number of audio chunks received from ElevenLabs | >> 1 (typically 20-100) |
| `bytes` | Size of individual audio chunk | 4000-24000 per chunk |
| `dur_ms` | Duration of individual chunk in ms | ~500ms per chunk |
| `gap_ms` | Time since previous chunk arrived | < 500ms normally |
| `total_bytes` | Cumulative bytes for this TTS utterance | 300,000-500,000 for 15-20s |
| `sr` | Sample rate (Hz) | 24000 (default ElevenLabs PCM) |

**Red flags:**
- `n=1` with large `gap_ms` → TTS stream dying after first chunk (API error, timeout, or billing issue)
- `gap_ms > 10000` → Matches `AUDIO_CONTEXT_TIMEOUT` monkey-patch (10s) — audio context gave up waiting
- `total_frames=1` in `diag_tts_stopped` → Confirms only 1 chunk ever arrived

### Fix Applied

1. Changed voice from library voice (Valentina `xzWD1ftyNVsuUMY2ll3j`) to premade voice (Sarah `EXAVITQu4vr4xnSDxMaL`)
   - Sarah: "Mature, Reassuring, Confident" — premade voices work on Free tier
   - With `eleven_multilingual_v2` model, English voices speak Spanish fluently
   - Tested: full greeting generates 18.16 seconds / 290KB of audio
2. Updated `pipecat-ai` from 0.0.103 → 0.0.104 (latest)
3. Updated `ELEVENLABS_VOICE_ID` env var on Cloud Run
4. Deployed as image v4, revision `interview-agent-00046-kr8`

### Secondary Issue Found

pipecat 0.0.103 logs warning: `Language code [es] not applied. Language codes can only be used with multilingual models: eleven_flash_v2_5, eleven_turbo_v2_5`
- This means pipecat didn't recognize `eleven_multilingual_v2` as a multilingual model
- The language code `es` was NOT being sent to ElevenLabs websocket
- With 0.0.104 this may be fixed; if not, the multilingual v2 model auto-detects language from text

### Patterns to Remember

1. **ElevenLabs Voice Tiers**
   - Premade voices: work on Free tier API
   - Library voices: require paid plan (Starter $5/mo+)
   - Cloned voices: work on Free tier (your own clones only)
   - Always test voice accessibility with `curl` before deploying

2. **Monkey-patches Are Fragile**
   - Three monkey-patches applied to pipecat internals: BOT_VAD_STOP_SECS, AUDIO_CONTEXT_TIMEOUT, _handle_audio_context
   - These can break silently on version upgrades
   - Prefer upgrading pipecat version over patching internals
   - The `_receive_messages` patch was already removed because it "likely broke the audio flow"

3. **Cloud Run + Long-Running Interviews**
   - `/start` endpoint blocks for full interview duration (10-30 min)
   - Cloud Run allocates CPU only while HTTP request is active
   - Main API fires request with short read-timeout, treats ReadTimeout as "launched successfully"

---

## Session: 2026-03-12 - Auditoría Extensiva del Monorepo

### Auditoría & Arquitectura

1. **Componentes sin uso acumulan dead code silenciosamente**
   - Auditoría encontró 5 componentes completos (activity-feed, dialog, tooltip, kanban-board, VideoAvatar) que nunca se importan
   - Lesson: Revisar periódicamente imports con grep antes de que se acumule
   - Herramienta: `grep -r "from.*component-name" src/` para verificar uso

2. **El hook use-feature es clave para monetización**
   - Implementado completo pero nunca integrado en la app
   - Exports: `useFeature()`, `useLimit()`, `FeatureGate`, `UpgradePrompt`
   - Debe activarse ANTES de lanzar pasarela de pago

3. **Los try/except con `pass` ocultan bugs en producción**
   - admin.py tiene 34 instancias de exception handling que silencian errores
   - Patrón correcto: log.error() + re-raise o return error response
   - Nunca usar `pass` en catch blocks de endpoints API

4. **`any` type se propaga rápido si no se controla**
   - 30+ instancias encontradas, mayormente en `catch (err: any)` y `useState<any[]>`
   - Patrón correcto: `catch (err: unknown)` + `err instanceof Error`
   - Patrón correcto: `useState<SpecificType[]>([])` con interface definida

5. **Las páginas index faltantes rompen navegación directa**
   - `/employer/interviews` y `/employer/settings` no tienen page.tsx
   - Solo las sub-rutas (`/[id]`, `/billing`) funcionan
   - Siempre crear page.tsx para directorios con sub-rutas

6. **pgvector + embeddings están production-ready**
   - Cosine similarity con Vector(1536) funciona correctamente
   - Bulk generation endpoint permite backfill
   - Stats endpoint muestra coverage % - útil para monitoreo

7. **Video interviews completamente operativas**
   - LiveKit + Pipecat + Deepgram + ElevenLabs integrados y funcionando
   - Voice: usar premade voices en Free tier (library voices requieren plan paid)
   - Diagnóstico: métricas diag_tts_audio son clave para debugging audio

---

## Session: 2026-03-15 - Refactor TypeScript: Eliminar any Types

### Lección 24: Central types file vs local types — know when each is appropriate
- Created `src/types/index.ts` for shared domain types (Job, CandidateProfile, ShortlistItem, etc.)
- Local page types (e.g., `Job` in candidate/jobs/) represent different API shapes (public vs employer)
- When API returns different shapes for the same concept, use local types; central types are for shared shapes
- `publicApi.getJob()` returns more fields (company, slug, is_featured) than `employerApi.getJob()`

### Lección 25: `catch (err: any)` → `catch (err: unknown)` + helper function
- Created `getErrorMessage(err: unknown)` utility that safely extracts message from any error type
- Pattern: check `err instanceof Error` first, then fallback to string coercion
- This was 22 of the 55 `any` instances — the most common category
- The helper avoids repeating the same pattern in every catch block

### Lección 26: Removing `any` from `useState` reveals hidden null-safety bugs
- `useState<any>(null)` hides that code accesses `profile.skills.length` without null checks
- After typing as `useState<CandidateProfile | null>(null)`, TS exposes 30+ optional chaining gaps
- Fix: `(value?.length ?? 0) > 0` for conditionals, `value?.map()` for iterations
- These are bugs that `any` was hiding — runtime crashes possible on null data

### Lección 27: Add generic type params to API methods for type-safe returns
- `fetchApi<Job>(...)` makes the return type flow through to consumers
- Without generic params, `fetchApi(...)` returns `unknown`, forcing casts everywhere
- Add generics at the API layer to eliminate casts at the consumer layer
- For employer API: typed centrally. For public API: let pages cast to local types

---

## Session: 2026-03-15 - Fix Silent Exceptions in Python Routers (DEBT-02)

### Lección 28: Silent `except ValueError: pass` on query filters is reasonable but must log
- 23 of 26 silent exceptions were `except ValueError: pass` for optional query filter parsing (dates, enums)
- These are NOT bugs — ignoring invalid optional filters is correct API behavior (don't 400 for bad filter values)
- But `pass` makes debugging impossible: "why didn't my filter work?" has no answer in logs
- Fix: `logger.debug("invalid_filter_param", param=name, value=value)` — visible when needed, not noisy

### Lección 29: Error handling DURING error handling needs extra care
- `applications.py` had `except Exception: db.rollback()` when reverting status after CV analysis failure
- If the rollback itself fails, you lose both the original error context AND the rollback failure
- Pattern: always log the secondary failure with the original context (application_id, original error)
- Same applies to LLMLog creation during error flow — audit trail loss must be visible

### Lección 30: Use structlog's structured params, not f-strings, for log context
- `logger.debug("invalid_filter_param", param="category", value=category)` — structured, searchable
- NOT `logger.debug(f"Invalid category: {category}")` — harder to query, grep, aggregate
- Structured logging lets you filter by `param=category` across all endpoints in one query
- This is especially important with Sentry/Datadog where structured fields become searchable dimensions

### Lección 31: Module-level logger vs function-scoped logger
- admin.py had loggers created inside specific functions (`logger = structlog.get_logger()` at line 363, 640)
- This meant other functions had NO logger available
- Fix: add module-level `logger = structlog.get_logger()` so ALL functions can log
- Function-scoped loggers can still be used for binding extra context (e.g., `logger.bind(user_id=...)`)
