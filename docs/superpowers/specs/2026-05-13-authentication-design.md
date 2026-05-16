# Authentication — Design Spec

**Date:** 2026-05-13
**Branch:** `feature/ui-redesign`
**Status:** Spec, pending implementation plan

## Context

The app currently has no concept of users. Anyone with the URL can view and modify station data. We want to:

1. Make every action attributable to a known user (foundation for a future audit log).
2. Lay the groundwork for an analytics page that reports per-user activity.

This spec covers **authentication only**. Two follow-on sub-projects are explicitly out of scope here:

- Sub-project #2 — audit log table + attribution on PATCH endpoints
- Sub-project #3 — analytics KPIs and week/month trends

The `user.id` introduced here is the FK the future audit log will point at.

## Goals

- Username/password login for a small team of NBTC inspectors.
- Whole app gated behind login (single public `/login` page).
- Two roles: `admin` and `inspector`.
- Admin can create users, reset passwords, disable accounts, edit display names, change roles — all via a UI.
- No email-sending. No password-reset email flow. When a user forgets a password, the admin resets it to a new value and tells the user.
- Sessions last 7 days by default with sliding TTL, plus a "Remember me" toggle on the login page.

## Non-goals

- SSO (Google, SAML, etc.). The design leaves room to add later but does not build it.
- Multi-factor authentication.
- Email delivery for password reset.
- A public/anonymous view of any data.
- Audit log / activity tracking (sub-project #2).
- Multi-server brute-force protection (single-process in-memory counter is sufficient for now).

## Architecture

### Stack additions

- `iron-session` — encrypted, signed session cookie. No DB lookup per request for the session itself.
- `bcryptjs` — password hashing (pure JS, works on Turbopack/edge).
- One new env var: `SESSION_PASSWORD` (32+ random chars, used to encrypt the cookie).
- Three new env vars for the seed: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME`.

### New files and responsibilities

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` (edit) | Add `user` model |
| `prisma/seed.ts` (new) | Read admin env vars, hash password, upsert seed admin |
| `src/lib/session.ts` (new) | iron-session config + helpers (`getSession`, `setSession`, `clearSession`) |
| `src/lib/password.ts` (new) | `hashPassword`, `verifyPassword` |
| `src/lib/auth.ts` (new) | `requireUser`, `requireAdmin` server helpers — read cookie + re-check DB `active` flag |
| `src/lib/loginThrottle.ts` (new) | In-memory brute-force counter (5 attempts / 15 min per username) |
| `src/middleware.ts` (new) | Route-level gate; refreshes session TTL |
| `src/types/user.ts` (new) | `PublicUser` type — omits `password_hash` |
| `src/app/api/auth/login/route.ts` (new) | `POST` — verify creds, set session |
| `src/app/api/auth/logout/route.ts` (new) | `POST` — clear session |
| `src/app/api/auth/me/route.ts` (new) | `GET` — return current `PublicUser` |
| `src/app/api/admin/users/route.ts` (new) | `GET` list + `POST` create |
| `src/app/api/admin/users/[id]/route.ts` (new) | `PATCH` (active/role/displayName) |
| `src/app/api/admin/users/[id]/reset-password/route.ts` (new) | `POST` reset |
| `src/app/login/page.tsx` (new) | Login form (client component) |
| `src/app/admin/users/page.tsx` (new) | User management page (admin-only) |
| `src/components/admin/UserList.tsx` (new) | Table of users |
| `src/components/admin/CreateUserModal.tsx` (new) | Modal: create user |
| `src/components/admin/ResetPasswordModal.tsx` (new) | Modal: reset password |
| `src/components/admin/EditUserModal.tsx` (new) | Modal: edit displayName/role |
| `src/components/field-ops/FieldOpsHeader.tsx` (edit) | Add "Logged in as ___ / logout" chip + admin "Manage users" link |
| `src/hooks/useCurrentUser.ts` (new) | Client hook + context for current user |
| `src/contexts/UserContext.tsx` (new) | Provider that wraps the app and fetches `/api/auth/me` once |

### Existing models

No changes to `fm_station`, `interference_site`, or `cloudrf_cache` in this spec.

## Data model

```prisma
model user {
  id            Int      @id @default(autoincrement())
  username      String   @unique         // ASCII, lowercase, 3-32 chars
  password_hash String                   // bcrypt hash, never returned by any API
  display_name  String                   // shown in UI / future audit log
  role          String   @default("inspector")  // "admin" | "inspector"
  active        Boolean  @default(true)  // false = soft-disabled, cannot log in
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  created_by    Int?                     // admin who created this user (null for seeded admin)

  @@index([username])
}
```

**Notes:**

- `username` validated at API layer with `/^[a-z0-9_.-]{3,32}$/`. Normalized to lowercase on insert and on lookup.
- `password_hash` is the only password field. Plaintext is never persisted anywhere.
- `display_name` is required (not nullable) so future audit log entries never render `null`.
- `role` is `String` (not Prisma enum) so adding a third role later doesn't require a migration.
- `created_by` is a self-reference; `null` only for the seeded first admin.

**TypeScript boundary:** `src/types/user.ts` exports `PublicUser` which omits `password_hash`. Every API response uses `PublicUser`. The hash never crosses the API boundary. A unit test asserts this on the `/api/auth/me` response shape.

**Migration:** single `npx prisma db push` (no formal migrations folder yet in this repo).

## Session strategy

```ts
// src/lib/session.ts
export const sessionOptions = {
  cookieName: "fm_session",
  password: process.env.SESSION_PASSWORD!,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    // maxAge omitted when rememberMe === false (becomes a session cookie)
    path: "/",
  },
};

export type SessionData = {
  userId: number;
  username: string;
  displayName: string;
  role: "admin" | "inspector";
  issuedAt: number;
};
```

**Cookie modes (chosen at login):**

| Remember me | Cookie type | TTL |
|---|---|---|
| Unchecked (default) | Session cookie — no `maxAge`, dies on browser close | n/a |
| Checked | Persistent cookie | 7-day sliding |

**Sliding expiration:** middleware re-saves the persistent session on each authenticated request (cheap — re-seal with fresh `maxAge`). Session cookies don't slide; the browser keeps them until close.

**Stale-session safety:** disabling a user via the admin UI does not kick them out of an existing cookie session immediately. Mitigations:

1. Cookie TTL is at most 7 days.
2. `requireUser` and `requireAdmin` re-read the user row on every API call and reject if `active === false`. So even with a valid cookie, a disabled user can't perform any API action.

**Env var bootstrap:**
- `.env.example` adds `SESSION_PASSWORD=` with a comment showing `openssl rand -base64 32`.
- README documents this. Missing env var → server fails to start (loud, not silent).

## Auth flows

### Login

```
User opens any URL → middleware sees no fm_session cookie → 307 → /login?next=<path>
User submits username + password (+ rememberMe checkbox)
  → POST /api/auth/login { username, password, rememberMe }
  → handler:
      • normalize username (trim, lowercase)
      • check throttle: if username has 5+ failures in last 15 min → 429
      • prisma.user.findUnique({ where: { username } })
      • if not found OR active === false OR !verifyPassword(input, hash):
          → record failure, → 401 { error: "invalid_credentials" }
            (same response for not-found, wrong-password, and disabled — no enumeration)
      • else:
          → clear throttle counter for this username
          → setSession({ userId, username, displayName, role, issuedAt: Date.now() })
            with maxAge if rememberMe else omit maxAge
          → 200 { user: PublicUser }
Client redirects to ?next or /
```

### Logout

```
POST /api/auth/logout
  → clearSession() (sets empty cookie, maxAge: 0)
  → 200 { ok: true }
Client redirects to /login
```

### Admin create user

```
POST /api/admin/users { username, password, displayName, role }
  → requireAdmin() (reads cookie + DB-checks active === true && role === "admin")
  → validate: username regex, password length ≥ 8, role in ["admin", "inspector"], displayName non-empty
  → check username uniqueness (case-insensitive via normalized lowercase)
  → bcrypt hash, prisma.user.create
  → 201 { user: PublicUser }
```

### Admin reset password

```
POST /api/admin/users/{id}/reset-password { newPassword }
  → requireAdmin()
  → validate newPassword length ≥ 8
  → bcrypt hash, update password_hash, set updated_at
  → 200 { ok: true }
```

The admin never sees the old password (it's a hash). They simply replace it. Same UX as "give the user their password back" from the user's perspective.

### Admin edit / disable / re-enable

```
PATCH /api/admin/users/{id} { active?, role?, displayName? }
  → requireAdmin()
  → if target is self AND (active === false OR role !== current role):
       → 400 { error: "cannot_modify_self" }
  → update fields, return PublicUser
```

Self-protection: an admin cannot disable their own account or demote themselves. UI greys out those actions on the self-row, server enforces too.

### Current user (client-side)

```
GET /api/auth/me
  → reads cookie, returns PublicUser or 401
```

`useCurrentUser()` hook calls this once on mount, caches in `UserContext`, exposes `{ user, loading, logout }`.

### Error response codes (all JSON)

| Code | When |
|---|---|
| 401 invalid_credentials | bad username/password/disabled user |
| 401 not_authenticated | no/expired session |
| 403 forbidden | non-admin hitting admin route |
| 400 validation_error | bad input shape |
| 400 cannot_modify_self | admin trying to disable/demote self |
| 409 username_taken | duplicate username on create |
| 429 too_many_attempts | brute-force throttle |

## Middleware

`src/middleware.ts` — one file, one job. No DB calls.

```
allow-list: /login, /api/auth/login, /api/health, /_next/*, /favicon.ico,
            /tiles/*, public static files
  → next()

path starts with /admin or /api/admin?
  → require valid session AND session.role === "admin"
  → no session → 307 /login?next=<path>
  → not admin → 307 / (for pages) or 403 JSON (for /api/admin/*)
  → else: refresh session TTL (if persistent), next()

otherwise (gated):
  → require valid session
  → no session → 307 /login?next=<path>
  → else: refresh session TTL (if persistent), next()
```

The `active` flag is **not** checked in middleware — that's `requireUser` / `requireAdmin` in the API handlers. Middleware only validates the cookie.

## UI surface

### `/login` page

Single client component, scoped under `.field-ops-root` to match the rest of the app's theme.

```
┌─────────────────────────────────────┐
│             Field Ops               │
│                                     │
│   ┌──────────────────────────┐      │
│   │ Username                 │      │
│   └──────────────────────────┘      │
│   ┌──────────────────────────┐      │
│   │ Password           [👁]  │      │
│   └──────────────────────────┘      │
│                                     │
│   [☐] Remember me                   │
│                                     │
│   [ Sign in ]                       │
│                                     │
│   (error message slot)              │
└─────────────────────────────────────┘
```

- Heading reads "Field Ops" to match the app's identity (the homepage was renamed Field Ops in `feature/ui-redesign`).
- Submits to `/api/auth/login`.
- On 401 → inline error "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
- On 429 → "ลองใหม่อีกครั้งใน 15 นาที"
- On success → `router.replace(searchParams.get('next') ?? '/')`
- Password show/hide toggle (eyeball icon) — small QoL for users typing what an admin just told them.

### Header user chip (`FieldOpsHeader`)

```
[ ... existing header ... ]    [Manage users (admins only)]    สมชาย ใจดี [admin]  ⏻
```

- Shows `displayName`. Small role badge for admins; inspectors see name only.
- Admins see a "Manage users" link/icon → navigates to `/admin/users`.
- Logout icon → POST `/api/auth/logout` → redirect to `/login`.
- Renders nothing while `useCurrentUser()` is loading (no flash).

### `/admin/users` page

Reachable only via the header link. Not in the main 3-tab nav.

```
┌─ Manage users ──────────────────────────────[+ New user]─┐
│                                                          │
│  Username       Display name        Role     Active      │
│  ─────────────────────────────────────────────────────   │
│  somchai        สมชาย ใจดี           admin     [✓]  [⋯]  │
│  inspector1     สมศรี วงศ์ดี         inspector [✓]  [⋯]  │
│  inspector2     ทดสอบ ระบบ           inspector [ ]  [⋯]  │
│                                                          │
└──────────────────────────────────────────────────────────┘

  [⋯] menu items:
    • Edit display name / role
    • Reset password
    • Disable / Enable account

  [+ New user] modal:
    • Username (live-validated regex, uniqueness on blur)
    • Display name
    • Password (≥ 8 chars, show/hide toggle)
    • Role (radio: inspector | admin)
    • [Create]
```

- Self-row's destructive actions are greyed out (server enforces too).
- Active toggle uses optimistic update with rollback on error (mirrors `OptimizedFMStationClient` pattern).
- Inactive users render dimmed but stay in the list.

## Testing

Vitest, jsdom, ~12 new tests. Same conventions as existing tests in `src/__tests__/`.

| Layer | Test file | Assertions |
|---|---|---|
| Unit | `password.test.ts` | `hashPassword` → `verifyPassword` roundtrip; wrong password fails |
| Unit | `session.test.ts` | Sealed cookie roundtrips; tampered cookie fails to decrypt |
| API | `auth-login.test.ts` | Valid creds → 200 + cookie; bad password → 401; bad username → 401; disabled user → 401; 6th attempt → 429; `rememberMe: true` cookie has `Max-Age`; `rememberMe: false` cookie has no `Max-Age` |
| API | `auth-logout.test.ts` | Cookie cleared (`Max-Age=0`) |
| API | `auth-me.test.ts` | Valid session → 200 with `PublicUser`; no cookie → 401; cookie for disabled user → 401; response body has no `password_hash` field |
| API | `admin-users.test.ts` | Inspector → 403; admin list → 200; create dupe username → 409; weak password → 400; admin disable self → 400; admin demote self → 400 |
| API | `admin-reset-password.test.ts` | Admin resets, user logs in with new password |
| Middleware | `middleware.test.ts` | Unauth `/` → 307 `/login?next=%2F`; auth → passthrough; inspector hitting `/admin/users` → 307 `/` |
| Component | `LoginPage.test.tsx` | Fields render; submit; error on 401; redirect on success; "Remember me" state posts correctly |
| Component | `UserList.test.tsx` | Rows render; self-row destructive actions disabled; modals open |

**Test fixtures:** add `src/__tests__/helpers/session.ts` exporting `mintCookie(payload)` that produces a valid `fm_session` cookie value for tests. Existing integration tests for `/api/stations` get this helper applied so they pass with middleware in place.

**Coverage target:** 80%+ for new code (matches repo standard).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `SESSION_PASSWORD` leaked / rotated | Rotating logs everyone out (cookies become undecryptable). Documented in README. Acceptable. |
| `password_hash` accidentally returned by an API | `PublicUser` type omits the field. Every API response uses `PublicUser`. Explicit test on `/api/auth/me` shape. |
| First-admin seed uses weak password | Seed validates `ADMIN_PASSWORD` length ≥ 8. README tells the admin to change it after first login. |
| Disabled user's cookie works until expiry | `requireUser` / `requireAdmin` re-check DB `active` flag on every API call. UI may look stale until they try an action. |
| Brute-force counter in-memory, doesn't survive restart | Acceptable for single-server deploys. README notes Redis swap path. |
| Admin locks themselves out | Server rejects self-disable / self-demote (400). UI greys out those actions on self-row. Recovery: psql edit. |
| Existing tests break because middleware now blocks them | `mintCookie` helper added to test fixtures; existing tests get a session cookie. Prisma already mocked. |
| CSRF on POST/PATCH | `sameSite: lax` blocks cross-site form posts. JSON-only endpoints (already the case in this repo). No CSRF token needed. |

## Rollout

1. Continue on `feature/ui-redesign`.
2. Implement in this order so testing can be incremental:
   1. Prisma `user` model + seed script
   2. `src/lib/{session,password,auth,loginThrottle}.ts` — unit tests pass
   3. `/api/auth/{login,logout,me}` — API tests pass
   4. `src/middleware.ts` — middleware tests pass; existing API tests pass via `mintCookie`
   5. `/login` page + `UserContext` + `useCurrentUser` + header chip — manual browser smoke test
   6. `/api/admin/users/*` — API tests pass
   7. `/admin/users` page + modals — manual browser smoke test
   8. Wiki page `pages/features/authentication.md` + `wiki/index.md` entry + `wiki/log.md` entry; README seed instructions
3. **No feature flag.** Once middleware ships, the app requires login.

### Deployment checklist

- Generate `SESSION_PASSWORD` with `openssl rand -base64 32`
- Set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME` env vars
- `npx prisma db push`
- `npx prisma db seed`
- Smoke-test login in a browser
- Admin signs in and changes their own password via "Reset password" on the self-row

## What this spec does NOT include

Deferred to future sub-projects:

- Audit log table (`station_event`) — sub-project #2
- Attribution on inspection PATCH endpoints (`updatedByUserId` columns or audit-log rows) — sub-project #2
- Analytics KPIs (inspected / pending / revoked / off-air) — sub-project #3
- Week/month trend charts — sub-project #3

The `user.id` introduced in this spec is the FK those follow-ons will reference.
