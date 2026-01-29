# TalentOS Critical Fixes - Implementation Plan

**Date:** 2026-01-29
**Branch:** `claude/talentOS-critical-fixes-phz85`
**Tech Lead:** Claude (AI Assistant)

---

## 1. Current Architecture Summary

### Stack
- **Frontend:** Next.js 14 (App Router) + React 18 + Tailwind CSS + Radix UI
- **Backend:** FastAPI + SQLAlchemy 2.0 + PostgreSQL
- **Auth:** Custom JWT (python-jose)
- **AI:** OpenAI API (with stub mode fallback)
- **Storage:** MinIO (S3-compatible)

### Key Routes
| Module | Frontend | Backend |
|--------|----------|---------|
| Candidate | `/candidate/*` | `/candidate/*`, `/applications/*` |
| Employer | `/employer/*` | `/employer/*` |
| Admin | `/admin/*` | `/admin/*` |

---

## 2. Problems Identified

### CRITICAL (Blocking)

| ID | Problem | Location | Impact |
|----|---------|----------|--------|
| P1 | **Interview doesn't start** | `/candidate/interview/page.tsx` is legacy redirect page | Users cannot complete interviews |
| P2 | **Threshold hardcoded 70%** | `applications.py:534`, `apply/[jobId]/page.tsx:62` | Cannot configure per-job threshold |
| P3 | **Candidate profile shows false states** | `profile/page.tsx:62-129` | Shows "Entrevista IA" card without real interview |
| P4 | **Export CSV fails** | `api.ts:205-207` uses `window.open` with query token | about:blank, no download |
| P5 | **Admin interviews may error** | Possible enum serialization issues | Page crash |

### HIGH (UX/Security)

| ID | Problem | Location | Impact |
|----|---------|----------|--------|
| P6 | **Real company name exposed** | Multiple frontend files show `job.company.name` | Violates confidentiality |
| P7 | **No pre-step CV message** | `/candidate/apply/[jobId]` jumps to upload | Poor UX |
| P8 | **No location filters** | Jobs board missing country/city/modality filters | Poor UX |

### MEDIUM (Future-ready)

| ID | Problem | Location | Impact |
|----|---------|----------|--------|
| P9 | Job status visibility | Candidates might see DRAFT/PAUSED jobs | Data leak |
| P10 | No Client entity | Only Company exists | Cannot segment metrics |

---

## 3. Execution Plan

### PHASE 1: Critical Bug Fixes (Tasks T1-T5)

#### T1: Fix Gating UI
**Goal:** Candidate dashboard/profile should NOT show "Entrevista IA" card unless they have an approved application (match >= threshold).

**Changes:**
- `apps/web/src/app/candidate/profile/page.tsx`
  - Remove direct link to `/candidate/interview`
  - Only show interview card if there's an application with `status === MATCH_PASSED` or `INTERVIEW_STARTED`
  - Add API call to check applications status

**Risk:** Low - UI only change
**Rollback:** Revert file

---

#### T2: Fix Interview End-to-End
**Goal:** "Iniciar entrevista" must create InterviewSession and open a working interview UI.

**Changes:**
1. Create new interview UI page: `apps/web/src/app/candidate/interview/[sessionId]/page.tsx`
   - Real-time chat interface with AI
   - Calls `/candidate/interview/{session_id}/message` API
   - Progress indicator (question X of N)
   - Complete button triggers `/candidate/interview/{session_id}/complete`

2. Update `apps/web/src/app/candidate/apply/[jobId]/page.tsx`
   - `handleStartInterview` should:
     1. Call `candidateApi.startInterview(token, jobId)`
     2. Get `session_id` from response
     3. Redirect to `/candidate/interview/${sessionId}`

3. Update `apps/web/src/lib/api.ts`
   - Ensure `startInterview` returns full session object including `id`
   - Add `getInterviewSession` and `sendInterviewMessage` methods

**Risk:** Medium - New UI + integration
**Rollback:** Revert files, interview stays broken but doesn't break other features

---

#### T3: Fix Candidate Profile State
**Goal:** Profile shows real CV data and correct interview status.

**Changes:**
- `apps/web/src/app/candidate/profile/page.tsx`
  - Fetch applications list to determine interview availability
  - `hasInterview` should check for actual completed InterviewSession
  - Show "CV procesado" only if candidate has skills/experience from actual CV upload
  - Show "Entrevista completada" only if there's a COMPLETED interview session

**Risk:** Low - State logic only
**Rollback:** Revert file

---

#### T4: Fix Export CSV Auth
**Goal:** Export CSV downloads correctly with proper authentication.

**Changes:**
1. **Backend** `apps/api/app/routers/employer.py`
   - Add query param token support OR use different approach
   - Option A: Accept `?token=` query parameter for this endpoint
   - Option B: Return pre-signed URL

2. **Frontend** `apps/web/src/lib/api.ts`
   - Option A: Keep window.open but backend accepts query token
   - Option B: Use fetch with Authorization header, create blob, trigger download

**Decision:** Option B (more secure - no token in URL)

**Implementation:**
```typescript
exportShortlist: async (token: string, jobId: string) => {
  const response = await fetch(`${API_URL}/employer/jobs/${jobId}/shortlist/export.csv`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Export failed');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shortlist-${jobId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**Risk:** Low
**Rollback:** Revert to window.open

---

#### T5: Fix Admin Interviews
**Goal:** `/admin/interviews` loads without errors.

**Analysis:**
- Backend `format_interview_for_review` returns `session.status` as enum
- Frontend expects string or handles enum `.value`

**Changes:**
1. **Backend** `apps/api/app/routers/admin.py`
   - In `format_interview_for_review`, ensure `status` is converted to string: `"status": session.status.value`

2. **Frontend** `apps/web/src/app/admin/interviews/page.tsx`
   - Add defensive checks for null/undefined values
   - Wrap in error boundary

**Risk:** Low
**Rollback:** Revert files

---

### PHASE 2: Core Improvements (Tasks T6-T8)

#### T6: Dynamic Threshold
**Goal:** Threshold configurable at system/job level.

**Changes:**
1. **Backend Model** - Add `match_threshold` to Job model:
   ```python
   # apps/api/app/models/job.py
   match_threshold = Column(Integer, nullable=True)  # NULL = use system default
   ```

2. **Migration** - Add column with default NULL

3. **Backend Logic** - `apps/api/app/routers/applications.py`
   - Replace hardcoded `70` with:
   ```python
   threshold = job.match_threshold or 70  # System default
   ```

4. **Frontend** - Update `apply/[jobId]/page.tsx`
   - Fetch threshold from job details or config endpoint
   - Use dynamic threshold for UI display

**Risk:** Medium - Schema change
**Rollback:** Column is nullable, can revert code while keeping column

---

#### T7: Pre-step CV + Example
**Goal:** Before upload, show preparation message and "Ver ejemplo CV" option.

**Changes:**
1. `apps/web/src/app/candidate/apply/[jobId]/page.tsx`
   - Add new step `pre-upload` before `upload`
   - Show message: "Asegurate de que tu CV este actualizado..."
   - Button "Ver ejemplo de CV" opens modal with template

2. Create example CV generator (optional - can be static template initially)

**Risk:** Low - UI only
**Rollback:** Remove pre-step, direct to upload

---

#### T8: Location Filters
**Goal:** Jobs board filters by country/city/modality.

**Changes:**
1. **Backend** `apps/api/app/routers/public.py`
   - Already has `modality` and `location` params
   - Add `country` param
   - Add endpoints for distinct values: `/public/jobs/locations/list`

2. **Frontend** Jobs board
   - Add filter dropdowns for Country, City, Modality
   - Call API with filter params

**Risk:** Low
**Rollback:** Remove filters

---

### PHASE 3: Security & Polish (Tasks T9-T10)

#### T9: Job Status Visibility
**Goal:** Candidates only see ACTIVE jobs.

**Verification:**
- `apps/api/app/routers/public.py` - Check if already filters by ACTIVE
- If not, add filter

**Risk:** Low
**Rollback:** Remove filter

---

#### T10: Hide Company Name
**Goal:** Candidates always see "Bloque Internacional" instead of real company.

**Changes:**
1. **Backend** - Add `display_company_name` field to Job response for candidates
2. **Frontend** - Replace all `job.company.name` with `job.display_company_name || "Bloque Internacional"`

**Files to update:**
- `apps/web/src/app/candidate/jobs/page.tsx`
- `apps/web/src/app/candidate/jobs/[jobId]/page.tsx`
- `apps/web/src/app/candidate/apply/[jobId]/page.tsx`
- `apps/web/src/app/candidate/applications/page.tsx`

**Risk:** Low - Display only
**Rollback:** Revert frontend files

---

## 4. Migration Strategy

```sql
-- T6: Add match_threshold to jobs
ALTER TABLE jobs ADD COLUMN match_threshold INTEGER;

-- T10: Add display_company_name to jobs (optional, can use computed)
ALTER TABLE jobs ADD COLUMN display_company_name VARCHAR(255) DEFAULT 'Bloque Internacional';
```

**Approach:**
- Nullable columns = backwards compatible
- No data loss
- Can run without downtime

---

## 5. Testing Checklist

### Candidate Flow
- [ ] Q1: Browse jobs with location filters
- [ ] Q2: Job detail shows "Bloque Internacional" not real company
- [ ] Q3: Apply shows pre-step CV message
- [ ] Q4: Upload CV → match score displayed
- [ ] Q5: Match < threshold → recommendations shown, no interview
- [ ] Q6: Match >= threshold → interview available
- [ ] Q7: Start interview → real chat UI opens
- [ ] Q8: Complete interview → report generated
- [ ] Q9: Profile shows correct CV/interview status

### Employer Flow
- [ ] Q10: Export CSV downloads file correctly

### Admin Flow
- [ ] Q11: /admin/interviews loads
- [ ] Q12: Can view interview details

---

## 6. Rollback Plan

Each task can be independently rolled back by reverting specific commits:
- T1-T5: Revert frontend/backend files
- T6: Revert migration (DROP COLUMN) + code revert
- T7-T10: Revert frontend files only

---

## 7. Definition of Done

- [ ] D1: Interview works end-to-end with gating
- [ ] D2: Profile shows real states
- [ ] D3: Export CSV works
- [ ] D4: Admin interviews loads
- [ ] D5: Location filters work
- [ ] D6: Company name hidden from candidates
- [ ] D7: Pre-step CV implemented
- [ ] D8: All QA tests pass
- [ ] D9: No regressions

---

## 8. Execution Order

1. **T1** - Fix gating (prevents false access)
2. **T2** - Fix interview (enables core flow)
3. **T3** - Fix profile (shows correct state)
4. **T4** - Fix CSV export (unblocks employer)
5. **T5** - Fix admin interviews (unblocks admin)
6. **T6** - Dynamic threshold (enhances gating)
7. **T10** - Hide company name (security)
8. **T7** - Pre-step CV (UX)
9. **T8** - Location filters (UX)
10. **T9** - Job status visibility (cleanup)

---

**Next Steps:** Begin implementation with T1.
