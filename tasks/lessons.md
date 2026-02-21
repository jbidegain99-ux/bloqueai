# TalentOS Lessons Learned

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
