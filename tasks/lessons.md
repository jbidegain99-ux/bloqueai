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
