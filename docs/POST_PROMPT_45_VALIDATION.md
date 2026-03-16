# POST PROMPT 45 — Employee Portal + AI Chatbot Validation

## Status: COMPLETE

## Deliverables Checklist

- [x] Employee portal dashboard (`/portal`) with welcome greeting, quick actions, last payslip card, YTD summary
- [x] Payslips list page (`/portal/payslips`) with year filter, desktop table, mobile cards, annual summary
- [x] Payslip detail page (`/portal/payslips/[payslipId]`) with full breakdown and print support
- [x] Salary breakdown page (`/portal/salary`) with gross/deductions/net overview, deduction table, visual bars, YTD, benefits
- [x] Employee profile page (`/portal/profile`) with personal info, employment info, bank info, emergency contact
- [x] Documents page (`/portal/documents`) with proof-of-income generation, employment letter generation, document history
- [x] AI Assistant chatbot page (`/portal/assistant`) with Valentina persona, suggested questions, conversation history, clear button
- [x] Backend API router (`/employee/*`) with all required endpoints
- [x] Employee API client in `apps/web/src/lib/api.ts` with typed methods
- [x] Full Spanish (es-SV) localization across all pages
- [x] Playwright E2E tests covering all portal pages and navigation
- [x] Layout wrapper using AppShell for consistent branding

## Files Created/Modified

### Frontend — Pages (Next.js App Router)

| File | Description |
|------|-------------|
| `apps/web/src/app/(employee)/layout.tsx` | Employee group layout wrapping AppShell |
| `apps/web/src/app/(employee)/portal/page.tsx` | Dashboard — greeting, quick actions, last payslip, YTD |
| `apps/web/src/app/(employee)/portal/payslips/page.tsx` | Payslip list — year filter, table/cards, annual summary |
| `apps/web/src/app/(employee)/portal/payslips/[payslipId]/page.tsx` | Payslip detail — full deduction breakdown, print |
| `apps/web/src/app/(employee)/portal/salary/page.tsx` | Salary breakdown — overview cards, deduction table, visual bars, YTD, benefits |
| `apps/web/src/app/(employee)/portal/profile/page.tsx` | Profile — personal, employment, bank, emergency contact sections |
| `apps/web/src/app/(employee)/portal/documents/page.tsx` | Documents — generate proof of income, employment letter, document history |
| `apps/web/src/app/(employee)/portal/assistant/page.tsx` | AI Chatbot — Valentina persona, chat bubbles, suggested questions |

### Backend — API

| File | Description |
|------|-------------|
| `apps/api/app/routers/employee_portal.py` | FastAPI router with all `/employee/*` endpoints |

### Frontend — API Client

| File | Description |
|------|-------------|
| `apps/web/src/lib/api.ts` | `employeeApi` object with typed methods for all portal endpoints |

### Tests

| File | Description |
|------|-------------|
| `apps/web/tests/e2e/employee-portal.spec.ts` | Playwright E2E tests (15 test cases) |

## Architecture

### Route Group Pattern

The employee portal uses Next.js route groups via the `(employee)` directory. This allows a dedicated layout (`AppShell`) without affecting the URL structure. All pages are served under `/portal/*`.

```
apps/web/src/app/(employee)/
  layout.tsx              → AppShell wrapper
  portal/
    page.tsx              → Dashboard
    payslips/
      page.tsx            → Payslip list
      [payslipId]/
        page.tsx          → Payslip detail
    salary/
      page.tsx            → Salary breakdown
    profile/
      page.tsx            → Employee profile
    documents/
      page.tsx            → Document generation
    assistant/
      page.tsx            → AI Chatbot (Valentina)
```

### Auth Flow

Every page uses the `useAuthStore` Zustand store to:
1. Wait for hydration (`isHydrated`)
2. Check authentication (`isAuthenticated`, `accessToken`)
3. Redirect to `/login` if unauthenticated
4. Pass the `accessToken` to all API calls

### Data Flow

```
Page Component → employeeApi.method(token) → fetchApi() → Backend /employee/* → SQLAlchemy → Response
```

All API responses are typed with Pydantic models on the backend and TypeScript interfaces on the frontend.

## Chatbot Capabilities

The AI assistant "Valentina" provides:

- **Salary queries** — current net salary, gross salary, deduction amounts
- **Payment schedule** — next payment date, payment frequency
- **Vacation requests** — how to request time off, remaining balance
- **Tax information** — YTD ISR, ISSS, AFP totals
- **Payslip access** — link to most recent payslip
- **Document generation** — trigger proof of income or employment letter
- **Suggested questions** — 5 pre-built questions shown on first load
- **Conversation history** — full context maintained per session
- **Clear conversation** — reset button to start fresh
- **Typing indicator** — animated dots while waiting for response
- **Error handling** — inline error messages without losing chat history

### Chatbot UI Features

- Chat bubble layout with avatars (Bot for Valentina, User for employee)
- Timestamps on each message
- Auto-scroll to newest message
- Textarea with Enter-to-send (Shift+Enter for newline)
- Auto-expanding textarea (up to 120px)
- Disabled input during typing/loading
- Responsive design for mobile

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/employee/dashboard` | Dashboard data — name, position, department, last payslip, YTD summary |
| GET | `/employee/profile` | Full employee profile — personal, employment, bank, emergency contact |
| GET | `/employee/payslips?year=` | List payslips filtered by year |
| GET | `/employee/payslips/{id}` | Single payslip with full deduction breakdown |
| GET | `/employee/salary/breakdown` | Salary breakdown — base, deductions, net, visual bars, benefits, YTD |
| GET | `/employee/documents` | List of available/generated documents |
| POST | `/employee/documents/proof-of-income` | Generate proof-of-income HTML document |
| POST | `/employee/documents/generate/{type}` | Generate document by type (employment_letter, etc.) |
| POST | `/employee/assistant/chat` | Send message to AI chatbot, receive reply + suggested questions |

### Frontend API Client Methods

```typescript
employeeApi.getDashboard(token)
employeeApi.getProfile(token)
employeeApi.getPayslips(token, year?)
employeeApi.getPayslip(token, id)
employeeApi.getSalaryBreakdown(token)
employeeApi.getDocuments(token)
employeeApi.generateProofOfIncome(token)
employeeApi.generateDocument(token, type)
employeeApi.chat(token, message, history)
```

## UI/UX Highlights

- **Full Spanish localization** — all labels, placeholders, error messages, and status badges in Spanish (es-SV locale)
- **Currency formatting** — `Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' })`
- **Responsive design** — desktop tables collapse to mobile cards, chat adapts to screen size
- **BrandCard components** — consistent visual style with `BrandCard`, `BrandCardHeader` from the shared component library
- **Loading skeletons** — Skeleton components shown during data fetch
- **Error states** — AlertCircle + red banners for API errors
- **Back navigation** — every sub-page has a "Portal" back button

## Next Steps

- Ready for Prompt 46
