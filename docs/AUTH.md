# TalentOS Authentication & Multi-Tenancy

## Auth Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | None | Create user (+ company for EMPLOYER) |
| POST | `/auth/login` | None | Get access + refresh tokens |
| POST | `/auth/refresh` | None | Exchange refresh token for new pair |
| POST | `/auth/logout` | Bearer | Client-side only (discard tokens) |
| GET | `/auth/me` | Bearer | Get current user info |

## JWT Structure

### Access Token
```json
{
  "sub": "user-uuid",
  "role": "ADMIN",
  "type": "access",
  "exp": 1773614828
}
```
- **Expiry:** 30 minutes (`jwt_access_token_expire_minutes`)
- **Algorithm:** HS256
- **Note:** `company_id` is NOT in the JWT — fetched from DB on every request

### Refresh Token
```json
{
  "sub": "user-uuid",
  "type": "refresh",
  "exp": 1774219628
}
```
- **Expiry:** 7 days (`jwt_refresh_token_expire_days`)
- No role in refresh token (re-fetched from DB on refresh)

## Roles (RBAC)

| Role | Access Level |
|------|-------------|
| `CANDIDATE` | Public jobs, own applications, own interviews, own profile |
| `EMPLOYER` | Own company's jobs, candidates, shortlists |
| `RECRUITER` | Same as EMPLOYER + advanced matching |
| `ADMIN` | Full access to all companies and system settings |

### Role Dependencies (FastAPI)
```python
require_candidate  = [CANDIDATE]
require_employer   = [EMPLOYER, RECRUITER, ADMIN]
require_recruiter  = [RECRUITER, ADMIN]
require_admin      = [ADMIN]
```

## Multi-Tenancy Pattern

### How It Works
1. **User.company_id** links each user to a company (tenant)
2. **Application-level filtering** in routers: `Job.company_id == user.company_id`
3. **RLS (Row Level Security)** on all 30 database tables (Supabase production only)

### Isolation Flow
```
Request → JWT decode → get User from DB → check user.company_id
→ filter queries by company_id → return only tenant data
```

### Key Implementation
```python
# employer.py - get_job_or_404()
def get_job_or_404(db, job_id, user):
    query = db.query(Job).filter(Job.id == job_id)
    if user.role != UserRole.ADMIN and user.company_id:
        query = query.filter(Job.company_id == user.company_id)
    ...
```

### Admin Override
ADMIN role bypasses company_id filtering and sees all data across companies.

## Password Security

- **Hashing:** bcrypt via passlib
- **Requirements:** 8+ chars, 1 uppercase, 1 lowercase, 1 digit
- **Storage:** `User.hashed_password` (never stored in plaintext)

## Security Findings

### Implemented
- JWT access/refresh token pair with proper type validation
- Refresh token cannot be used as access token (type check)
- Expired tokens rejected immediately
- Deactivated users rejected even with valid JWT (DB check on every request)
- Deleted users rejected (DB lookup fails)
- Wrong-secret tokens rejected
- RBAC enforced via FastAPI dependencies
- Company-level data isolation for EMPLOYER role
- Password complexity requirements on registration
- Rate limiting via slowapi (per user_id or IP)

### NOT Implemented
- **Account lockout** — No failed attempt tracking; unlimited login attempts allowed
- **Password reset** — No forgot-password flow; no email-based reset
- **Token blacklist** — Logout is client-side only; tokens valid until expiry
- **Email verification** — `is_verified` field exists but unused in auth flow
- **2FA/MFA** — Not available
- **SSO** — Listed as Enterprise feature but not implemented
- **Session tracking** — Truly stateless; no active session list
- **Audit logging for auth** — `audit_logs` table exists but no auth events logged

## Files

| File | Purpose |
|------|---------|
| `app/routers/auth.py` | Auth endpoints |
| `app/core/security.py` | JWT encode/decode, bcrypt |
| `app/core/config.py` | JWT settings (secret, expiry) |
| `app/utils/deps.py` | `get_current_user`, `require_role` |
| `app/models/user.py` | User model + UserRole enum |
| `app/schemas/auth.py` | Request/response schemas |
| `app/middleware/feature_gate.py` | Feature gating decorators |
| `app/services/billing_service.py` | Plan-based feature checks |
