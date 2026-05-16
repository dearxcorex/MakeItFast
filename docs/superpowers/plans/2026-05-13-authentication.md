# Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add username/password authentication so every action is attributable to a known user. Whole app gated behind login. Two roles (admin/inspector). Admin can create users, reset passwords, disable accounts via UI. No email sending. Sessions are 7-day sliding with a "Remember me" toggle.

**Architecture:** A new Prisma `user` model holds username, bcrypt hash, display name, role, and active flag. iron-session encrypts session state into a signed cookie (no DB lookup per request for session itself). A Next.js middleware gates every route except `/login`, `/api/auth/login`, `/api/health`, and static assets. Sensitive helpers (`requireUser`/`requireAdmin`) re-check `user.active` from the DB on every API call so a disabled user's cookie is rejected immediately. Admin UI lives at `/admin/users` (separate route, not in the main 3-tab nav).

**Tech Stack:** Next.js 15 (App Router, Turbopack), React 19, TypeScript, Prisma + PostgreSQL, `iron-session` v8 for cookie sessions, `bcryptjs` for password hashing, vitest + @testing-library/react for tests, `.field-ops-root` scoped CSS to match existing theme.

**Spec:** `docs/superpowers/specs/2026-05-13-authentication-design.md`

---

## Scope Check

This plan covers ONE subsystem (authentication). Two follow-on sub-projects are explicitly out of scope and will get their own spec + plan cycles:

- Sub-project #2 — audit log table + attribution on PATCH endpoints
- Sub-project #3 — analytics KPIs + week/month trends

The `user.id` introduced here is the FK the future audit log will reference.

## File Structure

**Create:**

| Path | Responsibility |
|---|---|
| `prisma/seed.ts` | Read admin env vars, hash password, upsert seeded admin |
| `src/lib/session.ts` | iron-session config, helpers for route handlers + middleware |
| `src/lib/password.ts` | `hashPassword`, `verifyPassword` (bcryptjs) |
| `src/lib/auth.ts` | `requireUser`, `requireAdmin` — read cookie + DB-check `active` |
| `src/lib/loginThrottle.ts` | In-memory brute-force counter (5 attempts / 15 min per username) |
| `src/middleware.ts` | Route-level gate; refreshes session TTL for persistent cookies |
| `src/types/user.ts` | `PublicUser` type (omits `password_hash`) |
| `src/contexts/UserContext.tsx` | Provider that fetches `/api/auth/me` once and exposes user |
| `src/hooks/useCurrentUser.ts` | Hook for `UserContext` consumers |
| `src/app/api/auth/login/route.ts` | `POST` — verify creds, set session |
| `src/app/api/auth/logout/route.ts` | `POST` — clear session |
| `src/app/api/auth/me/route.ts` | `GET` — return current `PublicUser` |
| `src/app/api/admin/users/route.ts` | `GET` list + `POST` create |
| `src/app/api/admin/users/[id]/route.ts` | `PATCH` (active/role/displayName) |
| `src/app/api/admin/users/[id]/reset-password/route.ts` | `POST` reset |
| `src/app/login/page.tsx` | Login form (client component) |
| `src/app/admin/users/page.tsx` | Admin user management page wrapper |
| `src/components/admin/UserList.tsx` | Table of users |
| `src/components/admin/CreateUserModal.tsx` | Modal: create user |
| `src/components/admin/EditUserModal.tsx` | Modal: edit displayName/role |
| `src/components/admin/ResetPasswordModal.tsx` | Modal: reset password |
| `src/__tests__/helpers/session.ts` | `mintCookie(payload)` test helper |
| `src/__tests__/password.test.ts` | Hash + verify roundtrip |
| `src/__tests__/session.test.ts` | Seal/unseal + tamper detection |
| `src/__tests__/loginThrottle.test.ts` | Throttle behavior |
| `src/__tests__/auth-helpers.test.ts` | `requireUser` / `requireAdmin` |
| `src/__tests__/auth-login.test.ts` | Login endpoint |
| `src/__tests__/auth-logout.test.ts` | Logout endpoint |
| `src/__tests__/auth-me.test.ts` | Me endpoint + no hash leak |
| `src/__tests__/middleware.test.ts` | Middleware gating |
| `src/__tests__/admin-users.test.ts` | Admin CRUD + self-protection |
| `src/__tests__/admin-reset-password.test.ts` | Password reset |
| `src/__tests__/LoginPage.test.tsx` | Login form behavior |
| `src/__tests__/UserList.test.tsx` | User list behavior |
| `.env.example` | Sample env (SESSION_PASSWORD, ADMIN_*) |
| `wiki/pages/features/authentication.md` | Feature documentation |

**Modify:**

| Path | Change |
|---|---|
| `prisma/schema.prisma` | Add `user` model |
| `package.json` | Add `prisma.seed` config + deps |
| `src/components/field-ops/FieldOpsHeader.tsx` | Add user chip + Manage users link + logout |
| `src/app/layout.tsx` | Wrap children in `<UserProvider>` |
| `src/__tests__/api-routes.test.ts` | Use `mintCookie` helper so existing tests pass with middleware |
| `wiki/index.md` | Add authentication entry |
| `wiki/log.md` | Implementation log entry |
| `README.md` | Seed instructions + env var docs |

---

## Task 1: Install dependencies and env scaffolding

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Modify: `.env.local` (manual, by developer — not committed)

- [ ] **Step 1: Install iron-session and bcryptjs**

```bash
npm install iron-session bcryptjs
npm install --save-dev @types/bcryptjs tsx
```

- [ ] **Step 2: Create `.env.example`**

Create file `.env.example`:

```bash
# Database (used by Prisma)
DATABASE_URL="postgresql://user:password@localhost:5432/fm_station_tracker"

# Session encryption — required.
# Generate with: openssl rand -base64 32
# Rotating this value logs every user out (existing cookies become undecryptable).
SESSION_PASSWORD="paste-32-char-secret-here-paste-32-char-secret-here"

# Initial admin user (read only by `npx prisma db seed`)
# Change the admin's password via /admin/users after first login.
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="changeMeAfterFirstLogin"
ADMIN_DISPLAY_NAME="Admin"
```

- [ ] **Step 3: Add seed config to `package.json`**

In `package.json`, add a top-level `prisma` block (after `scripts`):

```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
```

- [ ] **Step 4: Verify install**

Run: `npm ls iron-session bcryptjs`
Expected: both listed with versions, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore(auth): install iron-session + bcryptjs, add .env.example"
```

---

## Task 2: Prisma `user` model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the `user` model**

Append to `prisma/schema.prisma` (after the last model):

```prisma
model user {
  id            Int      @id @default(autoincrement())
  username      String   @unique
  password_hash String
  display_name  String
  role          String   @default("inspector")
  active        Boolean  @default(true)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  created_by    Int?

  @@index([username])
}
```

- [ ] **Step 2: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" message.

- [ ] **Step 3: Push schema to DB**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 4: Verify the table exists**

Run: `npx prisma studio` (optional, manual check) — confirm `user` table appears empty.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(auth): add user model"
```

---

## Task 3: Seed script for initial admin

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write `prisma/seed.ts`**

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = (process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const displayName = (process.env.ADMIN_DISPLAY_NAME ?? "").trim();

  if (!username || !/^[a-z0-9_.-]{3,32}$/.test(username)) {
    throw new Error(
      "ADMIN_USERNAME must be 3-32 chars, [a-z0-9_.-]. Set it in .env."
    );
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 chars. Set it in .env.");
  }
  if (!displayName) {
    throw new Error("ADMIN_DISPLAY_NAME must be non-empty. Set it in .env.");
  }

  const password_hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      display_name: displayName,
      role: "admin",
      active: true,
    },
    create: {
      username,
      password_hash,
      display_name: displayName,
      role: "admin",
      active: true,
    },
  });

  console.log(`Seeded admin user: ${user.username} (id=${user.id})`);
  console.log(
    "IMPORTANT: change this password from /admin/users after first login."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Run the seed**

Ensure `.env.local` has `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME` set, then run:

```bash
npx prisma db seed
```

Expected output:
```
Seeded admin user: <username> (id=1)
IMPORTANT: change this password from /admin/users after first login.
```

- [ ] **Step 3: Verify in DB**

Run: `npx prisma studio`, check that one row exists in `user` table with `role=admin`, `active=true`, and a long bcrypt hash in `password_hash`.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(auth): seed script for initial admin"
```

---

## Task 4: Password helpers (TDD)

**Files:**
- Create: `src/__tests__/password.test.ts`
- Create: `src/lib/password.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/password.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password helpers", () => {
  it("verifies a correctly hashed password", async () => {
    const hash = await hashPassword("hunter2!!");
    expect(await verifyPassword("hunter2!!", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("hunter2!!");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("produces different hashes for the same password (salt)", async () => {
    const h1 = await hashPassword("same");
    const h2 = await hashPassword("same");
    expect(h1).not.toBe(h2);
  });
});
```

- [ ] **Step 2: Run the test — should fail**

Run: `npx vitest run src/__tests__/password.test.ts`
Expected: FAIL — module `@/lib/password` not found.

- [ ] **Step 3: Implement `src/lib/password.ts`**

```ts
import bcrypt from "bcryptjs";

const COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4: Run the test — should pass**

Run: `npx vitest run src/__tests__/password.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/password.ts src/__tests__/password.test.ts
git commit -m "feat(auth): password hashing helpers"
```

---

## Task 5: Session helpers (TDD)

**Files:**
- Create: `src/__tests__/session.test.ts`
- Create: `src/lib/session.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/session.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  sealSessionData,
  readSessionFromCookie,
  type SessionData,
} from "@/lib/session";

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
});

const SAMPLE: SessionData = {
  userId: 7,
  username: "tester",
  displayName: "Tester",
  role: "inspector",
  issuedAt: 1_700_000_000_000,
};

describe("session helpers", () => {
  it("seals and reads back the same payload", async () => {
    const sealed = await sealSessionData(SAMPLE);
    expect(sealed).toBeTypeOf("string");
    const read = await readSessionFromCookie(sealed);
    expect(read).toEqual(SAMPLE);
  });

  it("returns null for a tampered cookie", async () => {
    const sealed = await sealSessionData(SAMPLE);
    const tampered = sealed.slice(0, -3) + "AAA";
    expect(await readSessionFromCookie(tampered)).toBeNull();
  });

  it("returns null when cookie is undefined", async () => {
    expect(await readSessionFromCookie(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test — should fail**

Run: `npx vitest run src/__tests__/session.test.ts`
Expected: FAIL — `@/lib/session` not found.

- [ ] **Step 3: Implement `src/lib/session.ts`**

```ts
import { getIronSession, sealData, unsealData, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export const COOKIE_NAME = "fm_session";

export type SessionData = {
  userId: number;
  username: string;
  displayName: string;
  role: "admin" | "inspector";
  issuedAt: number;
};

function getPassword(): string {
  const p = process.env.SESSION_PASSWORD;
  if (!p || p.length < 32) {
    throw new Error(
      "SESSION_PASSWORD env var is missing or shorter than 32 chars."
    );
  }
  return p;
}

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionCookieMode = "persistent" | "session";

export function buildSessionOptions(mode: SessionCookieMode) {
  return {
    cookieName: COOKIE_NAME,
    password: getPassword(),
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      // When "session" mode, omit maxAge so the browser treats it as a session cookie.
      ...(mode === "persistent" ? { maxAge: SESSION_TTL_SECONDS } : {}),
    },
  };
}

/** For Route Handlers: returns the iron-session for the current request. */
export async function getSession(
  mode: SessionCookieMode = "persistent"
): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), buildSessionOptions(mode));
}

/** Encrypts a session payload into a cookie string. Used by the test helper. */
export async function sealSessionData(data: SessionData): Promise<string> {
  return sealData(data, { password: getPassword() });
}

/** Decrypts a cookie string back to a session payload. Returns null on tamper/expiry. */
export async function readSessionFromCookie(
  cookieValue: string | undefined
): Promise<SessionData | null> {
  if (!cookieValue) return null;
  try {
    return await unsealData<SessionData>(cookieValue, { password: getPassword() });
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test — should pass**

Run: `npx vitest run src/__tests__/session.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/__tests__/session.test.ts
git commit -m "feat(auth): session cookie helpers (iron-session)"
```

---

## Task 6: Login throttle (TDD)

**Files:**
- Create: `src/__tests__/loginThrottle.test.ts`
- Create: `src/lib/loginThrottle.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/loginThrottle.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordFailedAttempt,
  isThrottled,
  clearAttempts,
  __resetThrottleForTests,
} from "@/lib/loginThrottle";

beforeEach(() => {
  __resetThrottleForTests();
});

describe("login throttle", () => {
  it("allows the first 5 attempts then throttles the 6th", () => {
    const user = "alice";
    for (let i = 0; i < 5; i++) {
      expect(isThrottled(user)).toBe(false);
      recordFailedAttempt(user);
    }
    expect(isThrottled(user)).toBe(true);
  });

  it("isolates throttle by username", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("alice");
    expect(isThrottled("alice")).toBe(true);
    expect(isThrottled("bob")).toBe(false);
  });

  it("clears throttle when explicitly cleared (successful login)", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("alice");
    expect(isThrottled("alice")).toBe(true);
    clearAttempts("alice");
    expect(isThrottled("alice")).toBe(false);
  });

  it("expires the window after 15 minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    for (let i = 0; i < 5; i++) recordFailedAttempt("alice");
    expect(isThrottled("alice")).toBe(true);
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(isThrottled("alice")).toBe(false);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run the test — should fail**

Run: `npx vitest run src/__tests__/loginThrottle.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/loginThrottle.ts`**

```ts
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Attempt = { count: number; firstAt: number };
const attempts = new Map<string, Attempt>();

function key(username: string) {
  return username.trim().toLowerCase();
}

export function recordFailedAttempt(username: string): void {
  const k = key(username);
  const now = Date.now();
  const cur = attempts.get(k);
  if (!cur || now - cur.firstAt > WINDOW_MS) {
    attempts.set(k, { count: 1, firstAt: now });
  } else {
    cur.count += 1;
  }
}

export function isThrottled(username: string): boolean {
  const k = key(username);
  const cur = attempts.get(k);
  if (!cur) return false;
  if (Date.now() - cur.firstAt > WINDOW_MS) {
    attempts.delete(k);
    return false;
  }
  return cur.count >= MAX_ATTEMPTS;
}

export function clearAttempts(username: string): void {
  attempts.delete(key(username));
}

/** Test-only: reset all state. Do not call from production code. */
export function __resetThrottleForTests(): void {
  attempts.clear();
}
```

- [ ] **Step 4: Run the test — should pass**

Run: `npx vitest run src/__tests__/loginThrottle.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/loginThrottle.ts src/__tests__/loginThrottle.test.ts
git commit -m "feat(auth): in-memory login throttle"
```

---

## Task 7: `PublicUser` type + test cookie helper

**Files:**
- Create: `src/types/user.ts`
- Create: `src/__tests__/helpers/session.ts`

- [ ] **Step 1: Write `src/types/user.ts`**

```ts
export type UserRole = "admin" | "inspector";

export type PublicUser = {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: string; // ISO
  createdBy: number | null;
};
```

- [ ] **Step 2: Write `src/__tests__/helpers/session.ts`**

```ts
import { sealSessionData, COOKIE_NAME, type SessionData } from "@/lib/session";

/**
 * Builds a valid encrypted session cookie value for tests.
 * The header form is `${COOKIE_NAME}=<sealed>` suitable for `Cookie` headers.
 */
export async function mintCookie(
  override: Partial<SessionData> = {}
): Promise<{ name: string; value: string; header: string }> {
  process.env.SESSION_PASSWORD =
    process.env.SESSION_PASSWORD ??
    "test-session-password-32-chars-or-more!!!";

  const data: SessionData = {
    userId: 1,
    username: "tester",
    displayName: "Tester",
    role: "inspector",
    issuedAt: Date.now(),
    ...override,
  };
  const value = await sealSessionData(data);
  return { name: COOKIE_NAME, value, header: `${COOKIE_NAME}=${value}` };
}

export async function mintAdminCookie(override: Partial<SessionData> = {}) {
  return mintCookie({ role: "admin", ...override });
}
```

- [ ] **Step 3: Verify it imports cleanly**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors related to the new files.

- [ ] **Step 4: Commit**

```bash
git add src/types/user.ts src/__tests__/helpers/session.ts
git commit -m "feat(auth): PublicUser type + mintCookie test helper"
```

---

## Task 8: Auth helpers — `requireUser` / `requireAdmin` (TDD)

**Files:**
- Create: `src/__tests__/auth-helpers.test.ts`
- Create: `src/lib/auth.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/auth-helpers.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { user: { findUnique: vi.fn() } },
}));

// Mock next/headers cookies() to return a fake cookie store keyed by our helper
const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v ? { name, value: v } : undefined;
    },
  }),
}));

import prisma from "@/lib/prisma";
import { requireUser, requireAdmin, AuthError } from "@/lib/auth";
import { mintCookie, mintAdminCookie } from "./helpers/session";
import { COOKIE_NAME } from "@/lib/session";

beforeEach(() => {
  cookieStore.clear();
  vi.clearAllMocks();
});

describe("requireUser", () => {
  it("throws AuthError(401) when no cookie", async () => {
    await expect(requireUser()).rejects.toMatchObject({
      name: "AuthError",
      status: 401,
    });
  });

  it("returns the user when cookie is valid and user is active", async () => {
    const cookie = await mintCookie({ userId: 42 });
    cookieStore.set(COOKIE_NAME, cookie.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 42,
      username: "tester",
      display_name: "Tester",
      role: "inspector",
      active: true,
      password_hash: "x",
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null,
    } as any);

    const user = await requireUser();
    expect(user.id).toBe(42);
    expect(user.role).toBe("inspector");
  });

  it("throws 401 when DB says user is inactive", async () => {
    const cookie = await mintCookie({ userId: 42 });
    cookieStore.set(COOKIE_NAME, cookie.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 42,
      username: "tester",
      display_name: "Tester",
      role: "inspector",
      active: false,
      password_hash: "x",
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null,
    } as any);

    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
});

describe("requireAdmin", () => {
  it("throws 403 for an inspector cookie", async () => {
    const cookie = await mintCookie({ userId: 42, role: "inspector" });
    cookieStore.set(COOKIE_NAME, cookie.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 42,
      username: "tester",
      display_name: "Tester",
      role: "inspector",
      active: true,
      password_hash: "x",
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null,
    } as any);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("returns user for an admin", async () => {
    const cookie = await mintAdminCookie({ userId: 1 });
    cookieStore.set(COOKIE_NAME, cookie.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 1,
      username: "boss",
      display_name: "Boss",
      role: "admin",
      active: true,
      password_hash: "x",
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null,
    } as any);
    const user = await requireAdmin();
    expect(user.role).toBe("admin");
  });
});
```

- [ ] **Step 2: Run the test — should fail**

Run: `npx vitest run src/__tests__/auth-helpers.test.ts`
Expected: FAIL — `@/lib/auth` not found.

- [ ] **Step 3: Implement `src/lib/auth.ts`**

```ts
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { COOKIE_NAME, readSessionFromCookie } from "@/lib/session";
import type { PublicUser } from "@/types/user";

export class AuthError extends Error {
  status: 401 | 403;
  code: "not_authenticated" | "forbidden";
  constructor(status: 401 | 403, code: AuthError["code"], message?: string) {
    super(message ?? code);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

function toPublic(row: {
  id: number;
  username: string;
  display_name: string;
  role: string;
  active: boolean;
  created_at: Date;
  created_by: number | null;
}): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role === "admin" ? "admin" : "inspector",
    active: row.active,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
  };
}

export async function requireUser(): Promise<PublicUser> {
  const store = await cookies();
  const cookieValue = store.get(COOKIE_NAME)?.value;
  const session = await readSessionFromCookie(cookieValue);
  if (!session) {
    throw new AuthError(401, "not_authenticated");
  }
  const row = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!row || !row.active) {
    throw new AuthError(401, "not_authenticated");
  }
  return toPublic(row);
}

export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new AuthError(403, "forbidden");
  }
  return user;
}
```

- [ ] **Step 4: Run the test — should pass**

Run: `npx vitest run src/__tests__/auth-helpers.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/__tests__/auth-helpers.test.ts
git commit -m "feat(auth): requireUser / requireAdmin helpers"
```

---

## Task 9: `POST /api/auth/login` (TDD)

**Files:**
- Create: `src/__tests__/auth-login.test.ts`
- Create: `src/app/api/auth/login/route.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/auth-login.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: { user: { findUnique: vi.fn() } },
}));

// Capture cookie operations from iron-session's save()
const cookieMutations: { name: string; value: string; options: any }[] = [];
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: (name: string, value: string, options: any) => {
      cookieMutations.push({ name, value, options });
    },
    delete: (name: string) => {
      cookieMutations.push({ name, value: "", options: { maxAge: 0 } });
    },
  }),
}));

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/auth/login/route";
import { hashPassword } from "@/lib/password";
import { __resetThrottleForTests } from "@/lib/loginThrottle";

const userRow = async (over: Partial<any> = {}) => ({
  id: 1,
  username: "alice",
  display_name: "Alice",
  role: "inspector",
  active: true,
  password_hash: await hashPassword("hunter2!!"),
  created_at: new Date(),
  updated_at: new Date(),
  created_by: null,
  ...over,
});

function req(body: any) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
  cookieMutations.length = 0;
  vi.clearAllMocks();
  __resetThrottleForTests();
});

describe("POST /api/auth/login", () => {
  it("returns 200 + PublicUser on valid creds", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(await userRow());
    const res = await POST(
      req({ username: "alice", password: "hunter2!!", rememberMe: true })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({
      id: 1,
      username: "alice",
      displayName: "Alice",
      role: "inspector",
    });
    expect(body.user.password_hash).toBeUndefined();
    expect(cookieMutations.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 401 for wrong password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(await userRow());
    const res = await POST(
      req({ username: "alice", password: "wrong", rememberMe: false })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_credentials");
  });

  it("returns 401 for unknown username (no enumeration)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const res = await POST(
      req({ username: "ghost", password: "anything", rememberMe: false })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_credentials");
  });

  it("returns 401 for disabled user (same response shape)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      await userRow({ active: false })
    );
    const res = await POST(
      req({ username: "alice", password: "hunter2!!", rememberMe: false })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_credentials");
  });

  it("rejects malformed input with 400", async () => {
    const res = await POST(req({ username: "", password: "" }));
    expect(res.status).toBe(400);
  });

  it("throttles after 5 failed attempts with 429", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(await userRow());
    for (let i = 0; i < 5; i++) {
      await POST(
        req({ username: "alice", password: "wrong", rememberMe: false })
      );
    }
    const res = await POST(
      req({ username: "alice", password: "wrong", rememberMe: false })
    );
    expect(res.status).toBe(429);
  });

  it("rememberMe=true sets maxAge in cookie", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(await userRow());
    await POST(
      req({ username: "alice", password: "hunter2!!", rememberMe: true })
    );
    const setCookie = cookieMutations.find((c) => c.name === "fm_session");
    expect(setCookie?.options.maxAge).toBeGreaterThan(0);
  });

  it("rememberMe=false omits maxAge (session cookie)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(await userRow());
    await POST(
      req({ username: "alice", password: "hunter2!!", rememberMe: false })
    );
    const setCookie = cookieMutations.find((c) => c.name === "fm_session");
    expect(setCookie?.options.maxAge).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test — should fail**

Run: `npx vitest run src/__tests__/auth-login.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Implement `src/app/api/auth/login/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { getSession, type SessionCookieMode } from "@/lib/session";
import {
  recordFailedAttempt,
  isThrottled,
  clearAttempts,
} from "@/lib/loginThrottle";

const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }
  const { username: rawUsername, password, rememberMe } = body as {
    username?: unknown;
    password?: unknown;
    rememberMe?: unknown;
  };

  if (typeof rawUsername !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }
  const username = rawUsername.trim().toLowerCase();
  if (!USERNAME_RE.test(username) || password.length === 0) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  if (isThrottled(username)) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429 }
    );
  }

  const row = await prisma.user.findUnique({ where: { username } });
  const okPassword =
    row && row.active ? await verifyPassword(password, row.password_hash) : false;

  if (!row || !row.active || !okPassword) {
    recordFailedAttempt(username);
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 401 }
    );
  }

  clearAttempts(username);

  const mode: SessionCookieMode = rememberMe === true ? "persistent" : "session";
  const session = await getSession(mode);
  session.userId = row.id;
  session.username = row.username;
  session.displayName = row.display_name;
  session.role = row.role === "admin" ? "admin" : "inspector";
  session.issuedAt = Date.now();
  await session.save();

  return NextResponse.json(
    {
      user: {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        role: row.role,
        active: row.active,
        createdAt: row.created_at.toISOString(),
        createdBy: row.created_by,
      },
    },
    { status: 200 }
  );
}
```

- [ ] **Step 4: Run the test — should pass**

Run: `npx vitest run src/__tests__/auth-login.test.ts`
Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/login/route.ts src/__tests__/auth-login.test.ts
git commit -m "feat(auth): POST /api/auth/login"
```

---

## Task 10: `POST /api/auth/logout` (TDD)

**Files:**
- Create: `src/__tests__/auth-logout.test.ts`
- Create: `src/app/api/auth/logout/route.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/auth-logout.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const cookieMutations: { name: string; value: string; options: any }[] = [];
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ name: "fm_session", value: "anything" }),
    set: (name: string, value: string, options: any) => {
      cookieMutations.push({ name, value, options });
    },
    delete: (name: string) => {
      cookieMutations.push({ name, value: "", options: { maxAge: 0 } });
    },
  }),
}));

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
  cookieMutations.length = 0;
});

import { POST } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout", () => {
  it("clears the session cookie and returns 200", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/auth/logout", { method: "POST" })
    );
    expect(res.status).toBe(200);
    const cleared = cookieMutations.find((c) => c.name === "fm_session");
    expect(cleared).toBeDefined();
    // iron-session's destroy() either sets maxAge=0 or deletes the cookie.
    expect(cleared!.options.maxAge === 0 || cleared!.value === "").toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — should fail**

Run: `npx vitest run src/__tests__/auth-logout.test.ts`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement `src/app/api/auth/logout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 4: Run the test — should pass**

Run: `npx vitest run src/__tests__/auth-logout.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/logout/route.ts src/__tests__/auth-logout.test.ts
git commit -m "feat(auth): POST /api/auth/logout"
```

---

## Task 11: `GET /api/auth/me` (TDD)

**Files:**
- Create: `src/__tests__/auth-me.test.ts`
- Create: `src/app/api/auth/me/route.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/auth-me.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { user: { findUnique: vi.fn() } },
}));

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v ? { name, value: v } : undefined;
    },
    set: () => {},
    delete: () => {},
  }),
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/auth/me/route";
import { mintCookie } from "./helpers/session";
import { COOKIE_NAME } from "@/lib/session";

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
  cookieStore.clear();
  vi.clearAllMocks();
});

describe("GET /api/auth/me", () => {
  it("returns 401 when no cookie", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with PublicUser and no password_hash for valid session", async () => {
    const c = await mintCookie({ userId: 5 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 5,
      username: "tester",
      display_name: "Tester",
      role: "inspector",
      active: true,
      password_hash: "SHOULD-NEVER-LEAK",
      created_at: new Date("2026-01-01"),
      updated_at: new Date("2026-01-01"),
      created_by: null,
    } as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe(5);
    expect(body.user.displayName).toBe("Tester");
    expect(JSON.stringify(body)).not.toContain("SHOULD-NEVER-LEAK");
    expect(body.user.password_hash).toBeUndefined();
  });

  it("returns 401 for cookie whose user is disabled", async () => {
    const c = await mintCookie({ userId: 5 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 5,
      username: "tester",
      display_name: "Tester",
      role: "inspector",
      active: false,
      password_hash: "x",
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null,
    } as any);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test — should fail**

Run: `npx vitest run src/__tests__/auth-me.test.ts`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement `src/app/api/auth/me/route.ts`**

```ts
import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ user }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run the test — should pass**

Run: `npx vitest run src/__tests__/auth-me.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/me/route.ts src/__tests__/auth-me.test.ts
git commit -m "feat(auth): GET /api/auth/me"
```

---

## Task 12: Middleware (TDD)

**Files:**
- Create: `src/__tests__/middleware.test.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/middleware.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
});

import { middleware } from "@/middleware";
import { mintCookie, mintAdminCookie } from "./helpers/session";
import { COOKIE_NAME } from "@/lib/session";

function reqWithCookie(path: string, cookieValue?: string) {
  const url = new URL(`http://localhost${path}`);
  const req = new NextRequest(url, { method: "GET" });
  if (cookieValue) {
    req.cookies.set(COOKIE_NAME, cookieValue);
  }
  return req;
}

describe("middleware", () => {
  it("allows /login without a session", async () => {
    const res = await middleware(reqWithCookie("/login"));
    expect(res.status).not.toBe(307);
  });

  it("allows /api/auth/login without a session", async () => {
    const res = await middleware(reqWithCookie("/api/auth/login"));
    expect(res.status).not.toBe(307);
  });

  it("redirects unauthenticated requests to /login with ?next", async () => {
    const res = await middleware(reqWithCookie("/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?next=%2F");
  });

  it("lets an authenticated request through", async () => {
    const c = await mintCookie();
    const res = await middleware(reqWithCookie("/", c.value));
    expect(res.status).not.toBe(307);
  });

  it("redirects an inspector hitting /admin/users to /", async () => {
    const c = await mintCookie({ role: "inspector" });
    const res = await middleware(reqWithCookie("/admin/users", c.value));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/^http:\/\/localhost\/$/);
  });

  it("returns 403 JSON for an inspector hitting /api/admin/users", async () => {
    const c = await mintCookie({ role: "inspector" });
    const res = await middleware(reqWithCookie("/api/admin/users", c.value));
    expect(res.status).toBe(403);
  });

  it("lets an admin through /admin/users", async () => {
    const c = await mintAdminCookie();
    const res = await middleware(reqWithCookie("/admin/users", c.value));
    expect(res.status).not.toBe(307);
  });
});
```

- [ ] **Step 2: Run the test — should fail**

Run: `npx vitest run src/__tests__/middleware.test.ts`
Expected: FAIL — `@/middleware` not found.

- [ ] **Step 3: Implement `src/middleware.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, readSessionFromCookie } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];
const ASSET_PREFIXES = ["/_next", "/favicon", "/tiles", "/icons"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (ASSET_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  // Static files (anything with a dot, e.g. /robots.txt)
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;
  return false;
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const cookieValue = req.cookies.get(COOKIE_NAME)?.value;
  const session = await readSessionFromCookie(cookieValue);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "not_authenticated" },
        { status: 401 }
      );
    }
    const next = encodeURIComponent(pathname);
    const loginUrl = new URL(`/login?next=${next}`, req.url);
    return NextResponse.redirect(loginUrl, 307);
  }

  if (isAdminPath(pathname) && session.role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url), 307);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next's internal asset paths.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
```

- [ ] **Step 4: Run the test — should pass**

Run: `npx vitest run src/__tests__/middleware.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/__tests__/middleware.test.ts
git commit -m "feat(auth): middleware gates all routes except public allow-list"
```

---

## Task 13: Update existing API tests to use `mintCookie`

**Files:**
- Modify: `src/__tests__/api-routes.test.ts`

The existing API route tests don't pass cookies. The route handlers themselves don't call `requireUser` yet, so they would still pass — but to keep tests realistic and future-proof, we add a shared cookie header to test requests.

- [ ] **Step 1: Inspect the existing test file**

Run: `head -50 src/__tests__/api-routes.test.ts`
Note the existing `vi.mock('@/lib/prisma', ...)` and how `NextRequest` is constructed.

- [ ] **Step 2: Add the cookie helper import and apply to every request constructor**

At the top of `src/__tests__/api-routes.test.ts`, add:

```ts
import { mintCookie } from "./helpers/session";

let TEST_COOKIE = "";
beforeAll(async () => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
  const c = await mintCookie();
  TEST_COOKIE = c.header;
});
```

Then, anywhere the test constructs a `new NextRequest(...)`, add a `Cookie` header:

```ts
new NextRequest(url, {
  method: "GET",
  headers: { cookie: TEST_COOKIE },
})
```

If `beforeAll` isn't imported, add it to the existing `vitest` import.

> **Note:** the route handlers under `/api/stations` and `/api/interference` do not yet call `requireUser` — that's a deliberate scope choice for this plan (auth is opt-in for these endpoints). Sub-project #2 (audit log) will add `requireUser` to each PATCH handler. For *this* plan, the cookie is forwarded only because middleware will be running in integration; unit tests of route handlers don't exercise middleware.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass. If a test fails because of strict header parsing, only add cookies where needed.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/api-routes.test.ts
git commit -m "test(auth): apply mintCookie helper to existing API tests"
```

---

## Task 14: `UserContext` + `useCurrentUser` hook

**Files:**
- Create: `src/contexts/UserContext.tsx`
- Create: `src/hooks/useCurrentUser.ts`

- [ ] **Step 1: Write `src/contexts/UserContext.tsx`**

```tsx
"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { PublicUser } from "@/types/user";

type Ctx = {
  user: PublicUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

export const UserContext = createContext<Ctx>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const body = await res.json();
        setUser(body.user as PublicUser);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <UserContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </UserContext.Provider>
  );
}
```

- [ ] **Step 2: Write `src/hooks/useCurrentUser.ts`**

```ts
"use client";

import { useContext } from "react";
import { UserContext } from "@/contexts/UserContext";

export function useCurrentUser() {
  return useContext(UserContext);
}
```

- [ ] **Step 3: Wire `UserProvider` into the root layout**

Read `src/app/layout.tsx`, then wrap the existing `{children}` in `<UserProvider>`:

```tsx
import { UserProvider } from "@/contexts/UserContext";

// inside the body return:
<UserProvider>{children}</UserProvider>
```

- [ ] **Step 4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors in the new files.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/UserContext.tsx src/hooks/useCurrentUser.ts src/app/layout.tsx
git commit -m "feat(auth): UserContext + useCurrentUser hook"
```

---

## Task 15: Login page

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/__tests__/LoginPage.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/LoginPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: replaceMock }),
  useSearchParams: () => new URLSearchParams("next=%2F"),
}));

beforeEach(() => {
  replaceMock.mockClear();
  vi.restoreAllMocks();
});

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  it("renders username, password, remember-me, submit", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("submits and redirects on success", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 1 } }), { status: 200 }) as any
    );
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "hunter2!!" },
    });
    fireEvent.click(screen.getByLabelText(/remember me/i));
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    const call = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({
      username: "alice",
      password: "hunter2!!",
      rememberMe: true,
    });
  });

  it("shows error on 401", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_credentials" }), {
        status: 401,
      }) as any
    );
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง/)
      ).toBeInTheDocument()
    );
  });

  it("shows throttle message on 429", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "too_many_attempts" }), {
        status: 429,
      }) as any
    );
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText(/ลองใหม่อีกครั้งใน 15 นาที/)).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Run the test — should fail**

Run: `npx vitest run src/__tests__/LoginPage.test.tsx`
Expected: FAIL — `@/app/login/page` not found.

- [ ] **Step 3: Implement `src/app/login/page.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password, rememberMe }),
      });
      if (res.ok) {
        router.replace(next);
        return;
      }
      if (res.status === 429) {
        setError("ลองใหม่อีกครั้งใน 15 นาที");
      } else {
        setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="field-ops-root min-h-screen flex items-center justify-center bg-[var(--fo-bg)] text-[var(--fo-fg)] p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-[var(--fo-surface)] p-6 shadow-xl space-y-4"
      >
        <h1 className="text-2xl font-semibold text-center">Field Ops</h1>

        <div>
          <label htmlFor="username" className="block text-sm mb-1">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border border-[var(--fo-border)] bg-transparent px-3 py-2"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm mb-1">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--fo-border)] bg-transparent px-3 py-2 pr-10"
              required
            />
            <button
              type="button"
              aria-label={showPw ? "Hide password" : "Show password"}
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-70"
            >
              {showPw ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Remember me
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-[var(--fo-accent)] text-black font-medium py-2 disabled:opacity-60"
        >
          {submitting ? "..." : "Sign in"}
        </button>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run the test — should pass**

Run: `npx vitest run src/__tests__/LoginPage.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx src/__tests__/LoginPage.test.tsx
git commit -m "feat(auth): /login page with username, password, remember-me"
```

---

## Task 16: Header user chip in `FieldOpsHeader`

**Files:**
- Modify: `src/components/field-ops/FieldOpsHeader.tsx`

- [ ] **Step 1: Read the current header**

Run: `cat src/components/field-ops/FieldOpsHeader.tsx`
Note the existing props, layout, and where the rightmost element of the bar lives.

- [ ] **Step 2: Add a `UserChip` block**

In `src/components/field-ops/FieldOpsHeader.tsx`, add inside the rightmost group of the header (next to existing controls):

```tsx
import Link from "next/link";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function UserChip() {
  const { user, loading, logout } = useCurrentUser();
  if (loading || !user) return null;
  return (
    <div className="flex items-center gap-2">
      {user.role === "admin" && (
        <Link
          href="/admin/users"
          className="text-xs px-2 py-1 rounded-md border border-[var(--fo-border)] opacity-80 hover:opacity-100"
        >
          Manage users
        </Link>
      )}
      <span className="text-sm">{user.displayName}</span>
      {user.role === "admin" && (
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--fo-accent)]/20 border border-[var(--fo-accent)]/40">
          admin
        </span>
      )}
      <button
        type="button"
        onClick={() => void logout()}
        aria-label="Log out"
        className="text-base opacity-70 hover:opacity-100"
      >
        ⏻
      </button>
    </div>
  );
}
```

Then render `<UserChip />` in the header's right group.

- [ ] **Step 3: Run existing header tests**

Run: `npx vitest run src/__tests__/field-ops-header-location.test.tsx`
Expected: still passing (we didn't change the locating badge).

- [ ] **Step 4: Commit**

```bash
git add src/components/field-ops/FieldOpsHeader.tsx
git commit -m "feat(auth): user chip + logout in Field Ops header"
```

---

## Task 17: `GET` + `POST /api/admin/users` (TDD)

**Files:**
- Create: `src/__tests__/admin-users.test.ts`
- Create: `src/app/api/admin/users/route.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/admin-users.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v ? { name, value: v } : undefined;
    },
    set: () => {},
    delete: () => {},
  }),
}));

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/users/route";
import { mintAdminCookie, mintCookie } from "./helpers/session";
import { COOKIE_NAME } from "@/lib/session";

const adminRow = (over: Partial<any> = {}) => ({
  id: 1,
  username: "boss",
  display_name: "Boss",
  role: "admin",
  active: true,
  password_hash: "x",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  created_by: null,
  ...over,
});

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
  cookieStore.clear();
  vi.clearAllMocks();
});

describe("GET /api/admin/users", () => {
  it("returns 403 for inspectors", async () => {
    const c = await mintCookie({ role: "inspector", userId: 9 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      adminRow({ id: 9, role: "inspector" }) as any
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 list for admins, no password_hash in payload", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      adminRow(),
      adminRow({
        id: 2,
        username: "alice",
        display_name: "Alice",
        role: "inspector",
      }),
    ] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(2);
    expect(JSON.stringify(body)).not.toContain("password_hash");
  });
});

describe("POST /api/admin/users", () => {
  const validBody = {
    username: "newone",
    password: "longenough1",
    displayName: "New One",
    role: "inspector",
  };

  function req(body: any) {
    return new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("403 for inspector", async () => {
    const c = await mintCookie({ role: "inspector", userId: 9 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      adminRow({ id: 9, role: "inspector" }) as any
    );
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
  });

  it("400 on weak password", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    const res = await POST(req({ ...validBody, password: "short" }));
    expect(res.status).toBe(400);
  });

  it("400 on bad username", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    const res = await POST(req({ ...validBody, username: "BadName!!" }));
    expect(res.status).toBe(400);
  });

  it("409 on duplicate username", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(adminRow() as any) // requireAdmin lookup
      .mockResolvedValueOnce(adminRow({ id: 5 }) as any); // duplicate check
    const res = await POST(req(validBody));
    expect(res.status).toBe(409);
  });

  it("201 on success and returns PublicUser with no password_hash", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(adminRow() as any) // requireAdmin
      .mockResolvedValueOnce(null); // dup check
    vi.mocked(prisma.user.create).mockResolvedValue(
      adminRow({
        id: 7,
        username: "newone",
        display_name: "New One",
        role: "inspector",
        password_hash: "SHOULD-NEVER-LEAK",
        created_by: 1,
      }) as any
    );
    const res = await POST(req(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.id).toBe(7);
    expect(JSON.stringify(body)).not.toContain("SHOULD-NEVER-LEAK");
  });
});
```

- [ ] **Step 2: Run the test — should fail**

Run: `npx vitest run src/__tests__/admin-users.test.ts`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement `src/app/api/admin/users/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import type { PublicUser } from "@/types/user";

const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;

function toPublic(row: any): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role === "admin" ? "admin" : "inspector",
    active: row.active,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
  };
}

export async function GET() {
  try {
    await requireAdmin();
    const rows = await prisma.user.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json({ users: rows.map(toPublic) }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAdmin();
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    const { username: raw, password, displayName, role } = body ?? {};
    if (
      typeof raw !== "string" ||
      typeof password !== "string" ||
      typeof displayName !== "string" ||
      typeof role !== "string"
    ) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    const username = raw.trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    if (!displayName.trim()) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    if (role !== "admin" && role !== "inspector") {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }

    const password_hash = await hashPassword(password);
    const created = await prisma.user.create({
      data: {
        username,
        password_hash,
        display_name: displayName.trim(),
        role,
        active: true,
        created_by: me.id,
      },
    });

    return NextResponse.json({ user: toPublic(created) }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run the test — should pass**

Run: `npx vitest run src/__tests__/admin-users.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/users/route.ts src/__tests__/admin-users.test.ts
git commit -m "feat(auth): admin users list + create endpoints"
```

---

## Task 18: `PATCH /api/admin/users/[id]` (TDD)

**Files:**
- Modify: `src/__tests__/admin-users.test.ts` (append new describe block)
- Create: `src/app/api/admin/users/[id]/route.ts`

- [ ] **Step 1: Append failing test to `admin-users.test.ts`**

At the bottom of `src/__tests__/admin-users.test.ts`, add (also add to the existing prisma mock: `update: vi.fn()` under `user`):

```ts
import { PATCH } from "@/app/api/admin/users/[id]/route";

function patchReq(id: string, body: any) {
  return new NextRequest(`http://localhost/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/users/[id]", () => {
  it("updates active flag and returns 200", async () => {
    const c = await mintAdminCookie({ userId: 1 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    vi.mocked(prisma.user.update).mockResolvedValue(
      adminRow({ id: 5, active: false }) as any
    );
    const res = await PATCH(patchReq("5", { active: false }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejects self-disable with 400 cannot_modify_self", async () => {
    const c = await mintAdminCookie({ userId: 1 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    const res = await PATCH(patchReq("1", { active: false }), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("cannot_modify_self");
  });

  it("rejects self-demote with 400", async () => {
    const c = await mintAdminCookie({ userId: 1 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    const res = await PATCH(patchReq("1", { role: "inspector" }), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(400);
  });

  it("403 for inspector", async () => {
    const c = await mintCookie({ role: "inspector", userId: 9 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      adminRow({ id: 9, role: "inspector" }) as any
    );
    const res = await PATCH(patchReq("5", { active: false }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npx vitest run src/__tests__/admin-users.test.ts`
Expected: new tests fail; route module not found.

- [ ] **Step 3: Implement `src/app/api/admin/users/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/auth";
import type { PublicUser } from "@/types/user";

function toPublic(row: any): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role === "admin" ? "admin" : "inspector",
    active: row.active,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
  };
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAdmin();
    const { id: idStr } = await ctx.params;
    const id = Number.parseInt(idStr, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const data: { active?: boolean; role?: string; display_name?: string } = {};
    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.role === "string") {
      if (body.role !== "admin" && body.role !== "inspector") {
        return NextResponse.json(
          { error: "validation_error" },
          { status: 400 }
        );
      }
      data.role = body.role;
    }
    if (typeof body.displayName === "string") {
      const dn = body.displayName.trim();
      if (!dn) {
        return NextResponse.json(
          { error: "validation_error" },
          { status: 400 }
        );
      }
      data.display_name = dn;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    // Self-protection: cannot disable self, cannot demote self.
    if (id === me.id) {
      if (data.active === false) {
        return NextResponse.json(
          { error: "cannot_modify_self" },
          { status: 400 }
        );
      }
      if (data.role !== undefined && data.role !== me.role) {
        return NextResponse.json(
          { error: "cannot_modify_self" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
    });

    return NextResponse.json({ user: toPublic(updated) }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run — should pass**

Run: `npx vitest run src/__tests__/admin-users.test.ts`
Expected: all admin-users tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/users/[id]/route.ts src/__tests__/admin-users.test.ts
git commit -m "feat(auth): PATCH admin user (active/role/display) with self-protection"
```

---

## Task 19: `POST /api/admin/users/[id]/reset-password` (TDD)

**Files:**
- Create: `src/__tests__/admin-reset-password.test.ts`
- Create: `src/app/api/admin/users/[id]/reset-password/route.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/admin-reset-password.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v ? { name, value: v } : undefined;
    },
    set: () => {},
    delete: () => {},
  }),
}));

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/admin/users/[id]/reset-password/route";
import { mintAdminCookie, mintCookie } from "./helpers/session";
import { COOKIE_NAME } from "@/lib/session";

const adminRow = () => ({
  id: 1,
  username: "boss",
  display_name: "Boss",
  role: "admin",
  active: true,
  password_hash: "x",
  created_at: new Date(),
  updated_at: new Date(),
  created_by: null,
});

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
  cookieStore.clear();
  vi.clearAllMocks();
});

function req(id: string, body: any) {
  return new NextRequest(
    `http://localhost/api/admin/users/${id}/reset-password`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

describe("POST /api/admin/users/[id]/reset-password", () => {
  it("403 for inspector", async () => {
    const c = await mintCookie({ role: "inspector", userId: 9 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...adminRow(),
      id: 9,
      role: "inspector",
    } as any);
    const res = await POST(req("5", { newPassword: "newpass1!" }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(403);
  });

  it("400 on weak password", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    const res = await POST(req("5", { newPassword: "short" }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(400);
  });

  it("200 on success and updates hash", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    const res = await POST(req("5", { newPassword: "longenough1" }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ password_hash: expect.any(String) }),
      })
    );
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npx vitest run src/__tests__/admin-reset-password.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/api/admin/users/[id]/reset-password/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: idStr } = await ctx.params;
    const id = Number.parseInt(idStr, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    const { newPassword } = body ?? {};
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const password_hash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id },
      data: { password_hash },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run — should pass**

Run: `npx vitest run src/__tests__/admin-reset-password.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/users/[id]/reset-password/route.ts src/__tests__/admin-reset-password.test.ts
git commit -m "feat(auth): admin reset-password endpoint"
```

---

## Task 20: `/admin/users` page + `UserList` component (TDD)

**Files:**
- Create: `src/__tests__/UserList.test.tsx`
- Create: `src/components/admin/UserList.tsx`
- Create: `src/app/admin/users/page.tsx`

- [ ] **Step 1: Write failing test for `UserList`**

Create `src/__tests__/UserList.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserList } from "@/components/admin/UserList";
import type { PublicUser } from "@/types/user";

const users: PublicUser[] = [
  {
    id: 1,
    username: "boss",
    displayName: "Boss",
    role: "admin",
    active: true,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: null,
  },
  {
    id: 2,
    username: "alice",
    displayName: "Alice",
    role: "inspector",
    active: true,
    createdAt: "2026-01-02T00:00:00Z",
    createdBy: 1,
  },
  {
    id: 3,
    username: "bob",
    displayName: "Bob",
    role: "inspector",
    active: false,
    createdAt: "2026-01-03T00:00:00Z",
    createdBy: 1,
  },
];

describe("UserList", () => {
  it("renders one row per user with username and display name", () => {
    render(
      <UserList
        users={users}
        currentUserId={1}
        onResetPassword={() => {}}
        onEdit={() => {}}
        onToggleActive={() => {}}
      />
    );
    expect(screen.getByText("boss")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("dims inactive users", () => {
    const { container } = render(
      <UserList
        users={users}
        currentUserId={1}
        onResetPassword={() => {}}
        onEdit={() => {}}
        onToggleActive={() => {}}
      />
    );
    const bobRow = container.querySelector('[data-userid="3"]');
    expect(bobRow?.className).toMatch(/opacity-/);
  });

  it("disables destructive actions on the self row", () => {
    render(
      <UserList
        users={users}
        currentUserId={1}
        onResetPassword={() => {}}
        onEdit={() => {}}
        onToggleActive={() => {}}
      />
    );
    const disableSelf = screen
      .getByTestId("toggle-active-1")
      .getAttribute("disabled");
    expect(disableSelf).not.toBeNull();
  });

  it("fires onResetPassword when button clicked", () => {
    const onReset = vi.fn();
    render(
      <UserList
        users={users}
        currentUserId={1}
        onResetPassword={onReset}
        onEdit={() => {}}
        onToggleActive={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId("reset-password-2"));
    expect(onReset).toHaveBeenCalledWith(users[1]);
  });
});
```

- [ ] **Step 2: Run — should fail**

Run: `npx vitest run src/__tests__/UserList.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `src/components/admin/UserList.tsx`**

```tsx
"use client";

import type { PublicUser } from "@/types/user";

type Props = {
  users: PublicUser[];
  currentUserId: number;
  onResetPassword: (user: PublicUser) => void;
  onEdit: (user: PublicUser) => void;
  onToggleActive: (user: PublicUser, nextActive: boolean) => void;
};

export function UserList({
  users,
  currentUserId,
  onResetPassword,
  onEdit,
  onToggleActive,
}: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left opacity-70">
          <th className="py-2">Username</th>
          <th>Display name</th>
          <th>Role</th>
          <th>Active</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          return (
            <tr
              key={u.id}
              data-userid={u.id}
              className={`border-t border-[var(--fo-border)] ${
                u.active ? "" : "opacity-50"
              }`}
            >
              <td className="py-2 font-mono">{u.username}</td>
              <td>{u.displayName}</td>
              <td>
                <span className="text-xs uppercase tracking-wider">
                  {u.role}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  data-testid={`toggle-active-${u.id}`}
                  disabled={isSelf}
                  onClick={() => onToggleActive(u, !u.active)}
                  className="text-xs underline disabled:opacity-40 disabled:no-underline"
                  aria-label={u.active ? "Disable" : "Enable"}
                >
                  {u.active ? "✓" : "—"}
                </button>
              </td>
              <td className="text-right">
                <button
                  type="button"
                  data-testid={`edit-${u.id}`}
                  onClick={() => onEdit(u)}
                  className="text-xs underline mr-2"
                >
                  Edit
                </button>
                <button
                  type="button"
                  data-testid={`reset-password-${u.id}`}
                  onClick={() => onResetPassword(u)}
                  className="text-xs underline"
                >
                  Reset password
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Run — should pass**

Run: `npx vitest run src/__tests__/UserList.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Implement the page wrapper `src/app/admin/users/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { PublicUser } from "@/types/user";
import { UserList } from "@/components/admin/UserList";
import { CreateUserModal } from "@/components/admin/CreateUserModal";
import { EditUserModal } from "@/components/admin/EditUserModal";
import { ResetPasswordModal } from "@/components/admin/ResetPasswordModal";

export default function AdminUsersPage() {
  const { user: me, loading } = useCurrentUser();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [resetting, setResetting] = useState<PublicUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoadingList(true);
    const res = await fetch("/api/admin/users", { credentials: "include" });
    if (res.ok) {
      const body = await res.json();
      setUsers(body.users as PublicUser[]);
    }
    setLoadingList(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (loading || !me) return null;

  async function toggleActive(target: PublicUser, nextActive: boolean) {
    const prev = users;
    setUsers((cur) =>
      cur.map((u) => (u.id === target.id ? { ...u, active: nextActive } : u))
    );
    const res = await fetch(`/api/admin/users/${target.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    });
    if (!res.ok) {
      setUsers(prev);
      alert("Failed to update user");
    }
  }

  return (
    <div className="field-ops-root min-h-screen bg-[var(--fo-bg)] text-[var(--fo-fg)] p-6">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Manage users</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-[var(--fo-accent)] text-black px-3 py-1.5 text-sm"
        >
          + New user
        </button>
      </header>

      {loadingList ? (
        <p>Loading…</p>
      ) : (
        <UserList
          users={users}
          currentUserId={me.id}
          onResetPassword={setResetting}
          onEdit={setEditing}
          onToggleActive={toggleActive}
        />
      )}

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            fetchUsers();
          }}
        />
      )}
      {editing && (
        <EditUserModal
          user={editing}
          isSelf={editing.id === me.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchUsers();
          }}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={() => setResetting(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/UserList.tsx src/app/admin/users/page.tsx src/__tests__/UserList.test.tsx
git commit -m "feat(auth): /admin/users page + UserList"
```

---

## Task 21: `CreateUserModal`

**Files:**
- Create: `src/components/admin/CreateUserModal.tsx`

- [ ] **Step 1: Write `src/components/admin/CreateUserModal.tsx`**

```tsx
"use client";

import { useState } from "react";

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;

export function CreateUserModal({ onClose, onCreated }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"admin" | "inspector">("inspector");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameOk = USERNAME_RE.test(username.trim().toLowerCase());
  const passwordOk = password.length >= 8;
  const displayNameOk = displayName.trim().length > 0;
  const formOk = usernameOk && passwordOk && displayNameOk;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: username.trim().toLowerCase(),
        password,
        displayName: displayName.trim(),
        role,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      onCreated();
      return;
    }
    if (res.status === 409) {
      setError("Username already taken");
    } else if (res.status === 400) {
      setError("Invalid input");
    } else {
      setError("Failed to create user");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-[var(--fo-surface)] p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">New user</h2>

        <label className="block text-sm">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--fo-border)] bg-transparent px-3 py-2"
            autoFocus
          />
          {username && !usernameOk && (
            <span className="text-xs text-red-400">
              3-32 chars, [a-z0-9_.-] only
            </span>
          )}
        </label>

        <label className="block text-sm">
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--fo-border)] bg-transparent px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          Password
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--fo-border)] bg-transparent px-3 py-2 pr-10"
            />
            <button
              type="button"
              aria-label={showPw ? "Hide" : "Show"}
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-70"
            >
              {showPw ? "🙈" : "👁"}
            </button>
          </div>
          {password && !passwordOk && (
            <span className="text-xs text-red-400">at least 8 chars</span>
          )}
        </label>

        <fieldset className="text-sm">
          <legend className="mb-1">Role</legend>
          <label className="mr-3">
            <input
              type="radio"
              name="role"
              value="inspector"
              checked={role === "inspector"}
              onChange={() => setRole("inspector")}
            />{" "}
            Inspector
          </label>
          <label>
            <input
              type="radio"
              name="role"
              value="admin"
              checked={role === "admin"}
              onChange={() => setRole("admin")}
            />{" "}
            Admin
          </label>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!formOk || submitting}
            className="rounded-md bg-[var(--fo-accent)] text-black px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {submitting ? "..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/CreateUserModal.tsx
git commit -m "feat(auth): create-user modal"
```

---

## Task 22: `EditUserModal`

**Files:**
- Create: `src/components/admin/EditUserModal.tsx`

- [ ] **Step 1: Write `src/components/admin/EditUserModal.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { PublicUser } from "@/types/user";

type Props = {
  user: PublicUser;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function EditUserModal({ user, isSelf, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<"admin" | "inspector">(user.role);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body: Record<string, unknown> = {};
    if (displayName.trim() !== user.displayName) {
      body.displayName = displayName.trim();
    }
    if (role !== user.role && !isSelf) {
      body.role = role;
    }
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      onSaved();
      return;
    }
    const errBody = await res.json().catch(() => ({}));
    setError(errBody.error ?? "Failed to save");
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-[var(--fo-surface)] p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">
          Edit user · <span className="font-mono">{user.username}</span>
        </h2>

        <label className="block text-sm">
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--fo-border)] bg-transparent px-3 py-2"
          />
        </label>

        <fieldset className="text-sm">
          <legend className="mb-1">Role</legend>
          <label className="mr-3">
            <input
              type="radio"
              name="role"
              value="inspector"
              disabled={isSelf}
              checked={role === "inspector"}
              onChange={() => setRole("inspector")}
            />{" "}
            Inspector
          </label>
          <label>
            <input
              type="radio"
              name="role"
              value="admin"
              disabled={isSelf}
              checked={role === "admin"}
              onChange={() => setRole("admin")}
            />{" "}
            Admin
          </label>
          {isSelf && (
            <p className="text-xs opacity-70 mt-1">
              You cannot change your own role.
            </p>
          )}
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[var(--fo-accent)] text-black px-3 py-1.5 text-sm"
          >
            {submitting ? "..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/EditUserModal.tsx
git commit -m "feat(auth): edit-user modal"
```

---

## Task 23: `ResetPasswordModal`

**Files:**
- Create: `src/components/admin/ResetPasswordModal.tsx`

- [ ] **Step 1: Write `src/components/admin/ResetPasswordModal.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { PublicUser } from "@/types/user";

type Props = {
  user: PublicUser;
  onClose: () => void;
  onDone: () => void;
};

export function ResetPasswordModal({ user, onClose, onDone }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const mismatch = confirm.length > 0 && newPassword !== confirm;
  const canSubmit =
    newPassword.length >= 8 && newPassword === confirm && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    setSubmitting(false);
    if (res.ok) {
      setSuccess(true);
      return;
    }
    setError("Failed to reset password");
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-[var(--fo-surface)] p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold">
          Reset password for{" "}
          <span className="font-mono">{user.username}</span>
        </h2>

        {success ? (
          <>
            <p className="text-sm">
              Password reset. Tell the user the new password verbally or via
              chat:
            </p>
            <pre className="rounded-md bg-black/40 p-3 font-mono text-sm select-all">
              {newPassword}
            </pre>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onDone}
                className="rounded-md bg-[var(--fo-accent)] text-black px-3 py-1.5 text-sm"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block text-sm">
              New password
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[var(--fo-border)] bg-transparent px-3 py-2 pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide" : "Show"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-70"
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
              {tooShort && (
                <span className="text-xs text-red-400">at least 8 chars</span>
              )}
            </label>

            <label className="block text-sm">
              Confirm
              <input
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--fo-border)] bg-transparent px-3 py-2"
              />
              {mismatch && (
                <span className="text-xs text-red-400">
                  passwords do not match
                </span>
              )}
            </label>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-md bg-[var(--fo-accent)] text-black px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {submitting ? "..." : "Reset"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/ResetPasswordModal.tsx
git commit -m "feat(auth): reset-password modal"
```

---

## Task 24: Full test suite + build check

**Files:** none (verification only)

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: every test passes. If something fails, fix the cause inline before committing again.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: build succeeds. Watch for type errors and unused imports.

- [ ] **Step 4: Boot dev server and smoke test**

Run: `npm run dev` (in a separate terminal).

Manual checklist:
1. Open `http://localhost:3000/` — should redirect to `/login?next=%2F`.
2. Submit blank form — button stays clickable, server returns 400. UI may show inline error.
3. Submit wrong credentials — error "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" appears.
4. Log in with seeded admin credentials, "Remember me" UNchecked — redirects to `/`.
5. Close browser tab, reopen `http://localhost:3000/` — should redirect to `/login` (session cookie died).
6. Log in again with "Remember me" CHECKED — close tab, reopen — should still be logged in.
7. Click "Manage users" — page loads with the seeded admin row visible.
8. Click "+ New user" — create an `inspector` user with password `testpass1`.
9. Log out (⏻ icon), log in as the new inspector.
10. Verify "Manage users" link does NOT appear in the header for the inspector.
11. Navigate to `/admin/users` manually — should redirect to `/`.
12. Try `curl -i http://localhost:3000/api/admin/users` — should return `401`.
13. Log out, log in as admin, reset the inspector's password, log in as inspector with the new password.
14. Disable the inspector — they should be unable to log in (`invalid_credentials` 401).

If any step fails, debug and commit the fix as `fix(auth): <what>`. Do not skip steps.

- [ ] **Step 5: Commit any fixes from smoke testing**

If you made fixes:

```bash
git add -p
git commit -m "fix(auth): <description>"
```

If no fixes were needed, skip the commit.

---

## Task 25: Wiki + README

**Files:**
- Create: `wiki/pages/features/authentication.md`
- Modify: `wiki/index.md`
- Modify: `wiki/log.md`
- Modify: `README.md`

- [ ] **Step 1: Create `wiki/pages/features/authentication.md`**

```markdown
---
title: Authentication
type: feature
created: 2026-05-13
updated: 2026-05-13
sources: [codebase, design-spec]
tags: [auth, session, admin]
---

# Authentication

Username/password authentication gates the entire app. Two roles: `admin` and `inspector`. No email-sending; admins reset passwords directly to a new value typed in the admin UI.

## Data model

`user` table — see `prisma/schema.prisma`. Key columns: `username` (unique, `[a-z0-9_.-]{3,32}`), `password_hash` (bcryptjs), `display_name`, `role` (`admin`|`inspector`), `active`, `created_at`, `created_by`.

## Session

- `iron-session` v8 encrypts session data into a single signed cookie `fm_session`.
- `httpOnly`, `sameSite=lax`, `secure` in production.
- "Remember me" checked → 7-day sliding persistent cookie. Unchecked → session cookie (dies on browser close).
- Encrypted payload: `{ userId, username, displayName, role, issuedAt }`. No DB lookup per request for the session itself; `requireUser` / `requireAdmin` re-check `active` on every API call.

## Middleware

`src/middleware.ts` gates all routes except:
- `/login`, `/api/auth/login`, `/api/health`
- `/_next/*`, `/favicon*`, `/tiles/*`, `/icons/*`
- Any path ending in a file extension (`/robots.txt` etc.)

Unauthenticated → 307 `/login?next=<path>` for pages, 401 JSON for `/api/*`.
Non-admin on `/admin*` or `/api/admin*` → 307 `/` for pages, 403 JSON for `/api/admin/*`.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | `{ username, password, rememberMe }`; 5-attempt / 15-min throttle |
| POST | `/api/auth/logout` | clears cookie |
| GET | `/api/auth/me` | returns current PublicUser or 401 |
| GET | `/api/admin/users` | list (admin only) |
| POST | `/api/admin/users` | create (admin only) |
| PATCH | `/api/admin/users/[id]` | edit displayName/role/active (admin only); self-disable / self-demote → 400 |
| POST | `/api/admin/users/[id]/reset-password` | reset (admin only) |

## UI

- `/login` — public login form with "Remember me" toggle and show/hide password
- `/admin/users` — user list, create/edit/disable/reset modals (admin only)
- `FieldOpsHeader` — `displayName` chip + admin "Manage users" link + logout

## Bootstrap

`prisma/seed.ts` reads `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME` from env, bcrypts the password, upserts the row with `role=admin`, `active=true`. The admin must change their password from `/admin/users` after first login.

## See also

- [[system-overview]]
- [[database-schema]]
```

- [ ] **Step 2: Add entry in `wiki/index.md`**

Under "## Features":

```markdown
- [[authentication]] — Username/password gating, two roles (admin/inspector), `iron-session` cookies, admin user management at `/admin/users`
```

- [ ] **Step 3: Append entry to `wiki/log.md`**

```markdown
## [2026-05-13] implement | Authentication

**Type**: Feature
**Branch**: `feature/ui-redesign`
**Pages created**: 1
- `pages/features/authentication.md`
**Pages updated**: 1
- `index.md` — added authentication under Features

**Scope**: Username/password login gates the whole app. iron-session cookies (7-day sliding when Remember me; session cookie otherwise). Two roles. Admin user management UI at `/admin/users`. No email reset — admin resets passwords directly. Bcryptjs hashes. New `user` Prisma model.

**Out of scope**: Audit log (sub-project #2), analytics KPIs (sub-project #3). `user.id` is the FK those will reference.
```

- [ ] **Step 4: Update `README.md`**

Append (or insert in the "Getting Started" section) a setup section:

```markdown
## Authentication setup

The app requires login for every route except `/login`. Bootstrap the first admin before starting the dev server.

1. Generate a session secret:
   ```bash
   openssl rand -base64 32
   ```
2. Add to `.env.local`:
   ```
   SESSION_PASSWORD="<paste output above>"
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<at least 8 chars>
   ADMIN_DISPLAY_NAME="<display name>"
   ```
3. Push schema and seed:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
4. Start dev:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000`, log in with the admin credentials, then **change the admin password** from `/admin/users` (click "Reset password" on your own row).

Rotating `SESSION_PASSWORD` logs every user out (existing cookies become undecryptable).
```

- [ ] **Step 5: Commit**

```bash
git add wiki/pages/features/authentication.md wiki/index.md wiki/log.md README.md
git commit -m "docs(auth): wiki page + README setup instructions"
```

---

## Self-Review

### Spec coverage check

| Spec section | Plan task(s) |
|---|---|
| Stack additions (iron-session, bcryptjs, SESSION_PASSWORD) | Task 1 |
| Three admin env vars (ADMIN_*) | Task 1, Task 3 |
| `user` Prisma model | Task 2 |
| Seed script | Task 3 |
| `src/lib/password.ts` | Task 4 |
| `src/lib/session.ts` | Task 5 |
| `src/lib/loginThrottle.ts` | Task 6 |
| `src/types/user.ts` PublicUser | Task 7 |
| `src/lib/auth.ts` (requireUser/requireAdmin) | Task 8 |
| `POST /api/auth/login` (incl. throttle + rememberMe) | Task 9 |
| `POST /api/auth/logout` | Task 10 |
| `GET /api/auth/me` (no hash leak) | Task 11 |
| `src/middleware.ts` | Task 12 |
| Existing tests still pass | Task 13, Task 24 |
| `UserContext` + `useCurrentUser` | Task 14 |
| `/login` page (Field Ops heading + Remember me) | Task 15 |
| Header user chip + logout + Manage users link | Task 16 |
| `GET /api/admin/users`, `POST /api/admin/users` | Task 17 |
| `PATCH /api/admin/users/[id]` (self-protection) | Task 18 |
| `POST /api/admin/users/[id]/reset-password` | Task 19 |
| `/admin/users` page + UserList | Task 20 |
| `CreateUserModal` | Task 21 |
| `EditUserModal` | Task 22 |
| `ResetPasswordModal` | Task 23 |
| Wiki + README docs | Task 25 |
| Smoke tests (login, remember-me, admin gating) | Task 24 |

No gaps.

### Type / naming consistency

- `PublicUser` shape (`id`, `username`, `displayName`, `role`, `active`, `createdAt`, `createdBy`) used identically in Tasks 8, 9, 11, 17, 18, 20.
- `COOKIE_NAME` constant exported from `src/lib/session.ts` and used in tests (Tasks 7, 8, 11, 17, 19).
- `SessionData` shape (`userId`, `username`, `displayName`, `role`, `issuedAt`) consistent across Tasks 5, 7, 8, 9, 12.
- `requireAdmin()` / `requireUser()` signatures match throughout.
- `AuthError` thrown with `status` + `code` consistently caught in every route handler.

### Placeholder scan

No TBD / TODO / "implement later" / "similar to Task N" present. Every code block is concrete.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-13-authentication.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
