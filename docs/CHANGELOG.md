# TalentOS Critical Fixes - Changelog

**Date:** 2026-01-29
**Version:** MVP+ Critical Fixes
**Branch:** `claude/talentOS-critical-fixes-phz85`

---

## Summary

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
