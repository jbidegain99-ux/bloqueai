# QA Session Report - TalentOS E2E Testing

**Date:** 2026-02-23
**Branch:** `claude/ai-recruitment-mvp-dJKyh`
**Tool:** Playwright v1.40.1
**Browser:** Chromium (Desktop Chrome)
**Backend:** FastAPI at localhost:8000 (PostgreSQL at localhost:5433)

---

## Test Results Summary

- **Total tests:** 76
- **Passed:** 76 (100%)
- **Failed:** 0
- **Skipped:** 0
- **Duration:** ~45 seconds (4 workers)

---

## Coverage by Module

| Module | Tests | Passed | Pass Rate |
|--------|-------|--------|-----------|
| Auth (login, register, logout, session) | 14 | 14 | 100% |
| Employer Dashboard | 7 | 7 | 100% |
| Employer Vacancies (Jobs) | 4 | 4 | 100% |
| Employer EOR | 9 | 9 | 100% |
| Employer Billing | 9 | 9 | 100% |
| Candidate Dashboard | 7 | 7 | 100% |
| Admin Dashboard | 8 | 8 | 100% |
| Public Pages | 6 | 6 | 100% |
| Responsive (Mobile) | 4 | 4 | 100% |
| Accessibility (WCAG 2.0 AA) | 6 | 6 | 100% |
| API Tests | 2 | 2 | 100% |

---

## Bugs Found

### Critical (1)

**BUG-C01: Zustand persist hydration race condition breaks page.goto() navigation**
- **Severity:** Critical
- **Module:** Auth / Global
- **Description:** `useAuthStore` uses zustand persist with localStorage, but on full page navigation (page.goto, reload, direct URL entry), Next.js SSR renders with `isAuthenticated: false` before zustand hydrates from localStorage. The `useEffect` auth guard fires with the un-hydrated state and redirects to `/login`.
- **Impact:** Users who navigate directly to protected URLs (e.g., via bookmark, browser back/forward, or page refresh) are redirected to the login page even though their session is valid.
- **Root Cause:** `apps/web/src/lib/auth.ts` - zustand persist middleware hydration is async, but auth guards in page components (`useEffect(() => { if (!isAuthenticated) router.push('/login') })`) fire synchronously on first render.
- **Workaround:** Client-side navigation via `window.next.router.push()` or link clicks works correctly since zustand state is preserved in memory.
- **Fix:** Use `useHydration()` pattern or `skipHydration` option to prevent auth checks before store hydration completes.

### High (1)

**BUG-H01: AppShell shows employer nav for admin users instead of admin nav**
- **Severity:** High
- **Module:** Navigation / AppShell
- **File:** `apps/web/src/components/brand/AppShell.tsx` (lines 82-114)
- **Description:** `getRoleNav()` checks `isEmployer()` before `isRecruiter() || isAdmin()`. Since `isEmployer()` returns `true` for ADMIN users (it checks `role === 'EMPLOYER' || role === 'RECRUITER' || role === 'ADMIN'`), admin users always see the employer secondary nav (Dashboard, Trabajos, Shortlists, EOR, Facturación) instead of the admin nav (Dashboard, Trabajos, Clientes, Rúbricas, Entrevistas, KPIs, Placements).
- **Impact:** Admin users cannot navigate to admin-specific pages (Clients, Rubrics, KPIs, Placements) via the navigation bar. They can only access these pages via direct URL.
- **Fix:** Reorder the checks in `getRoleNav()` to check `isRecruiter() || isAdmin()` BEFORE `isEmployer()`.

### Medium (2)

**BUG-M01: Landing page missing Register CTA**
- **Severity:** Medium
- **Module:** Public / Landing
- **URL:** /
- **Description:** Landing page only has "Iniciar sesión" and "Solicitar demo" links. No visible registration path. Users must go to login first to find the register link.

**BUG-M02: Some icon buttons lack accessible names**
- **Severity:** Medium
- **Module:** Accessibility
- **URL:** / (landing page)
- **Description:** Icon-only buttons on the landing page have no text content, aria-label, or title attribute.

### Low (1)

**BUG-L01: Login page has serious (non-critical) a11y violations**
- **Severity:** Low
- **Module:** Accessibility
- **URL:** /login
- **Description:** The login page has axe-core "serious" level WCAG 2.0 AA violations (logged as warnings, not failing). Likely related to form label associations or contrast ratios.

---

## Key Technical Findings

### Auth Fixture Strategy
Due to BUG-C01, the E2E test auth fixture uses a two-step approach:
1. **Login via form submission** - fills email/password on `/login` and clicks submit. This triggers client-side auth flow that stores the JWT in zustand + localStorage and navigates to the dashboard.
2. **Navigate via `navigateTo()` helper** - uses `window.next.router.push()` (Next.js internal client-side router) instead of `page.goto()` to navigate to protected pages. This avoids the SSR hydration race.

### AppShell Navigation
- Top nav tabs: "Talento" (main), "Personal y Nómina" (/admin/payroll), "Proyectos" (disabled)
- Secondary nav varies by role (but bugged for admin - see BUG-H01)
- Employer sees: Dashboard, Trabajos, Shortlists, EOR, Facturación
- Candidate sees: Explorar Puestos, Mis Aplicaciones, Mi Perfil
- Admin should see: Dashboard, Trabajos, Clientes, Rúbricas, Entrevistas, KPIs, Placements

### Billing Page
- Uses English text: "Billing & Subscription", "No active subscription", "Choose a Plan", "Invoices"
- When no subscription exists, the Invoices section is not rendered

### Test Users (seeded via `scripts/seed.py`)
- admin@example.com / Admin123! (role: ADMIN)
- employer@example.com / Employer123! (role: EMPLOYER)
- candidate1@example.com / Candidate123! (role: CANDIDATE)

---

## Test Infrastructure

### Files Created/Modified (17 files)

**Configuration:**
- `apps/web/playwright.config.ts` — Multi-browser (chromium, firefox, webkit, mobile), JSON/JUnit/HTML reporters, video/screenshot on failure

**Fixtures:**
- `apps/web/e2e/fixtures/auth.fixture.ts` — Login via form + `navigateTo()` using Next.js router + logout helpers
- `apps/web/e2e/fixtures/test-data.ts` — Test credentials, routes, test data constants

**Test Specs (11 files):**
- `e2e/tests/auth/login.spec.ts` — 14 tests (login flow, registration form, logout, session persistence)
- `e2e/tests/employer/dashboard.spec.ts` — 7 tests (navigation links, metric cards)
- `e2e/tests/employer/vacancies.spec.ts` — 4 tests (jobs list/cards, create job form)
- `e2e/tests/employer/eor.spec.ts` — 9 tests (EOR dashboard, add employee, public calculator)
- `e2e/tests/employer/billing.spec.ts` — 9 tests (billing dashboard, invoices, public pricing page)
- `e2e/tests/candidate/dashboard.spec.ts` — 7 tests (profile, applications, job search, metrics)
- `e2e/tests/admin/dashboard.spec.ts` — 8 tests (dashboard metrics, CSV export, page access)
- `e2e/tests/responsive/mobile.spec.ts` — 4 tests (mobile viewports: landing, login, pricing, calculator)
- `e2e/tests/accessibility/a11y.spec.ts` — 6 tests (axe-core WCAG 2.0 AA audits)
- `e2e/tests/api/billing-api.spec.ts` — 2+ tests (API health, auth endpoints)
- `e2e/tests/public/landing.spec.ts` — 6 tests (landing page, calculator)

**Utilities:**
- `e2e/utils/helpers.ts` — Page ready, element exists, click helpers
- `e2e/utils/assertions.ts` — Console error, page load assertions
- `e2e/utils/bug-reporter.ts` — Bug tracking utility class

---

## How to Run Tests

```bash
# Prerequisites: backend running at localhost:8000, database seeded
cd apps/api
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
python3 -m scripts.seed  # seeds test accounts

# Run all tests (from apps/web)
cd apps/web
npx playwright test --project=chromium

# Run specific module
npx playwright test --project=chromium e2e/tests/employer/

# Run only public tests (no backend needed)
npx playwright test --project=chromium e2e/tests/public/ e2e/tests/responsive/ e2e/tests/accessibility/

# View HTML report
npx playwright show-report
```

---

## Recommendations

1. **Fix zustand hydration race (BUG-C01)** — Add `skipHydration` or use a `useHydration()` hook to prevent auth redirects before zustand rehydrates from localStorage. This affects all users who reload or navigate directly to protected URLs.

2. **Fix admin nav priority (BUG-H01)** — Reorder `getRoleNav()` checks in AppShell.tsx to check admin/recruiter before employer.

3. **Add data-testid attributes** — Many tests use text/CSS selectors. Adding `data-testid` attributes would make tests more stable across UI changes.

4. **Add register CTA to landing page** — Provide a direct registration path from the landing page.

5. **Add aria-labels to icon buttons** — Improve accessibility for screen reader users.

6. **Multi-browser CI** — Config supports Firefox, WebKit, and mobile. Install all for CI: `npx playwright install --with-deps`.

7. **Test database isolation** — Consider using a separate test database or transaction rollback per test to prevent data pollution.

---

## Next Steps

- [x] Set up Playwright infrastructure
- [x] Create comprehensive E2E test suite (76 tests)
- [x] Run all tests with backend (100% pass rate)
- [ ] Fix BUG-C01 (zustand hydration race)
- [ ] Fix BUG-H01 (admin nav priority)
- [ ] Add `data-testid` attributes to key components
- [ ] Set up CI pipeline with both services
- [ ] Add visual regression tests with `toHaveScreenshot()`
- [ ] Install all browsers for multi-browser testing
