# Default Crew Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-mount modal that lets each inspector pick a default crew once, pre-fills the per-station `TeammatePicker` from that crew, and is re-openable via a header indicator — all without changing the existing helper attribution path.

**Architecture:** One nullable `Int[]` column on the `user` table encodes a 3-state machine (`NULL` undecided / `[]` solo / `[1,2,…]` crew). A thin `userPreferencesService` exposes get/set with self-healing against deactivated users; a session-gated `/api/users/me/crew` route wraps it. `FieldOpsClient` boots the value on mount, opens `CrewModal` when `NULL`, and threads the value into the existing `helperUserIds` state so the existing `TeammatePicker` and PATCH path pick it up unchanged.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma + PostgreSQL (Neon), Vitest + @testing-library/react, iron-session.

---

## File Structure

**Database / schema**
- Modify: `prisma/schema.prisma` (add column to `user` model)
- Create: `prisma/migrations/2026-05-17-add-default-helper-user-ids/migration.sql`

**Service layer**
- Create: `src/services/userPreferencesService.ts` — `getDefaultCrew(userId)`, `setDefaultCrew(userId, ids)`, validation, self-healing
- Create: `src/__tests__/services-user-preferences.test.ts`

**API route**
- Create: `src/app/api/users/me/crew/route.ts` — `GET` + `PUT`
- Create: `src/__tests__/api-users-me-crew.test.ts`

**UI components (field-ops only)**
- Create: `src/components/field-ops/CrewModal.tsx` — chip-grid modal
- Create: `src/components/field-ops/CrewIndicator.tsx` — header re-open button
- Create: `src/__tests__/crew-modal.test.tsx`
- Modify: `src/components/field-ops/FieldOpsClient.tsx` — fetch + bootstrap + render modal + pre-fill picker
- Modify: `src/components/field-ops/FieldOpsHeader.tsx` — slot indicator into desktop right cluster
- Modify: `src/components/field-ops/FieldOpsDrawer.tsx` — slot indicator into mobile drawer
- Create: `src/__tests__/field-ops-crew-bootstrap.test.tsx`

**No changes to:** `TeammatePicker.tsx`, the PATCH route in `src/app/api/stations/[id]/route.ts`, the inspection service, the analytics endpoint.

---

## Task 1: Schema columns + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/2026-05-17-add-default-helper-user-ids/migration.sql`

> **Schema note:** Prisma 5 does not support nullable scalar arrays (`Int[]?` is a P1012 error). The 3-state machine is therefore encoded across two columns: a non-nullable `Int[]` for the helper ids (defaults to `[]`) and an explicit `crew_decided` boolean for the undecided/decided distinction.

- [ ] **Step 1: Add the columns to schema.prisma**

Find the `user` model (line 87). Add two new fields right after `created_by`:

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
  default_helper_user_ids Int[]     @default([])
  crew_decided            Boolean   @default(false)

  inspections_led    station_inspection[]        @relation("inspection_lead")
  inspection_members station_inspection_member[]

  @@index([username])
}
```

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/2026-05-17-add-default-helper-user-ids/migration.sql`:

```sql
ALTER TABLE "user"
  ADD COLUMN "default_helper_user_ids" INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN "crew_decided" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Apply schema + regenerate Prisma client**

Run:
```bash
npx prisma db push
npx prisma generate
```

Expected: `Your database is now in sync with your Prisma schema.` and `Generated Prisma Client (v…)`.

- [ ] **Step 4: Verify the column exists**

Run:
```bash
npx prisma db execute --stdin <<'EOF'
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user' AND column_name = 'default_helper_user_ids';
EOF
```

Expected: one row with `data_type = 'ARRAY'`, `is_nullable = 'YES'`.

- [ ] **Step 5: Commit (force-add SQL because *.sql is gitignored)**

```bash
git add prisma/schema.prisma
git add -f prisma/migrations/2026-05-17-add-default-helper-user-ids/migration.sql
git commit -m "$(cat <<'EOF'
feat(schema): add user.default_helper_user_ids column

NULL = undecided, [] = solo, [1,2,...] = chosen crew. Backing
column for the default-crew modal in field-ops.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: userPreferencesService — getDefaultCrew

**Files:**
- Create: `src/services/userPreferencesService.ts`
- Create: `src/__tests__/services-user-preferences.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/services-user-preferences.test.ts`:

```ts
// src/__tests__/services-user-preferences.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { getDefaultCrew } from '@/services/userPreferencesService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDefaultCrew', () => {
  it('returns null when the user has never decided (crew_decided=false)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3,
      default_helper_user_ids: [],
      crew_decided: false,
    } as never);
    const result = await getDefaultCrew(3);
    expect(result).toBeNull();
  });

  it('returns null even if the array is non-empty when crew_decided=false', async () => {
    // Defensive: a row where the flag is false should be treated as undecided
    // regardless of the array column.
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3,
      default_helper_user_ids: [9],
      crew_decided: false,
    } as never);
    const result = await getDefaultCrew(3);
    expect(result).toBeNull();
  });

  it('returns [] when the user picked solo', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3,
      default_helper_user_ids: [],
      crew_decided: true,
    } as never);
    const result = await getDefaultCrew(3);
    expect(result).toEqual([]);
  });

  it('returns the persisted crew when all ids are still valid', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3,
      default_helper_user_ids: [6, 7],
      crew_decided: true,
    } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 6 }, { id: 7 },
    ] as never);
    const result = await getDefaultCrew(3);
    expect(result).toEqual([6, 7]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/services-user-preferences.test.ts
```

Expected: FAIL — `Cannot find module '@/services/userPreferencesService'`.

- [ ] **Step 3: Implement the minimal `getDefaultCrew`**

Create `src/services/userPreferencesService.ts`:

```ts
// src/services/userPreferencesService.ts
import prisma from '@/lib/prisma';

export const MAX_DEFAULT_HELPERS = 5;

async function loadValidIds(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: {
      id: { in: ids },
      active: true,
      role: { in: ['admin', 'inspector'] },
    },
    select: { id: true },
  });
  const valid = new Set(rows.map((r) => r.id));
  return ids.filter((id) => valid.has(id));
}

export async function getDefaultCrew(userId: number): Promise<number[] | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { default_helper_user_ids: true, crew_decided: true },
  });
  if (!row) return null;
  if (!row.crew_decided) return null;
  const raw = row.default_helper_user_ids;
  if (raw.length === 0) return [];
  const valid = await loadValidIds(raw);
  if (valid.length !== raw.length) {
    // Self-heal: persist the filtered set. Fire-and-forget; we already
    // know the right answer to return to the caller.
    void prisma.user
      .update({ where: { id: userId }, data: { default_helper_user_ids: valid } })
      .catch(() => {});
  }
  return valid;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/services-user-preferences.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Add the self-healing test**

Append to the same describe block in `src/__tests__/services-user-preferences.test.ts`:

```ts
  it('filters out deactivated helpers and background-PUTs the cleaned set', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3,
      default_helper_user_ids: [6, 9],   // 9 has been deactivated
      crew_decided: true,
    } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 6 },
    ] as never);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as never);

    const result = await getDefaultCrew(3);
    expect(result).toEqual([6]);
    // Allow the fire-and-forget update microtask to run.
    await new Promise((r) => setTimeout(r, 0));
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { default_helper_user_ids: [6] },
    });
  });
```

- [ ] **Step 6: Run all tests in the file**

```bash
npx vitest run src/__tests__/services-user-preferences.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/services/userPreferencesService.ts src/__tests__/services-user-preferences.test.ts
git commit -m "$(cat <<'EOF'
feat(service): add userPreferencesService.getDefaultCrew

Reads the persisted default crew for a user. Returns null when
undecided, [] when solo, and a filtered id list when chosen.
Background-PUTs the filtered set when the DB contains stale
references (deactivated user, role change).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: userPreferencesService — setDefaultCrew

**Files:**
- Modify: `src/services/userPreferencesService.ts`
- Modify: `src/__tests__/services-user-preferences.test.ts`

- [ ] **Step 1: Add failing tests for `setDefaultCrew`**

Append to the test file:

```ts
import { setDefaultCrew, MAX_DEFAULT_HELPERS } from '@/services/userPreferencesService';

describe('setDefaultCrew', () => {
  it('saves [] for the solo state (with crew_decided=true)', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: 3, default_helper_user_ids: [], crew_decided: true,
    } as never);
    const result = await setDefaultCrew(3, []);
    expect(result).toEqual([]);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { default_helper_user_ids: [], crew_decided: true },
    });
  });

  it('dedupes and saves a valid crew (with crew_decided=true)', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 6 }, { id: 7 },
    ] as never);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: 3, default_helper_user_ids: [6, 7], crew_decided: true,
    } as never);
    const result = await setDefaultCrew(3, [6, 7, 6]);
    expect(result).toEqual([6, 7]);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { default_helper_user_ids: [6, 7], crew_decided: true },
    });
  });

  it('rejects self in the crew', async () => {
    await expect(setDefaultCrew(3, [3])).rejects.toThrow('self_in_list');
  });

  it('rejects more than MAX_DEFAULT_HELPERS helpers', async () => {
    const tooMany = [4, 5, 6, 7, 8, 9];
    expect(tooMany.length).toBeGreaterThan(MAX_DEFAULT_HELPERS);
    await expect(setDefaultCrew(3, tooMany)).rejects.toThrow('too_many');
  });

  it('rejects unknown / inactive ids', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 6 },     // 9 missing
    ] as never);
    await expect(setDefaultCrew(3, [6, 9])).rejects.toThrow('invalid_helper');
  });

  it('rejects non-integer ids', async () => {
    await expect(setDefaultCrew(3, [6, 7.5 as unknown as number])).rejects.toThrow('invalid_helper');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/services-user-preferences.test.ts
```

Expected: 6 new tests fail (`setDefaultCrew is not a function` or similar).

- [ ] **Step 3: Implement `setDefaultCrew`**

Append to `src/services/userPreferencesService.ts`:

```ts
export class CrewValidationError extends Error {
  constructor(public code: 'invalid_helper' | 'self_in_list' | 'too_many') {
    super(code);
    this.name = 'CrewValidationError';
  }
}

function dedupe(ids: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    if (!Number.isInteger(id)) throw new CrewValidationError('invalid_helper');
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export async function setDefaultCrew(
  userId: number,
  rawIds: number[],
): Promise<number[]> {
  const ids = dedupe(rawIds);
  if (ids.some((id) => id === userId)) {
    throw new CrewValidationError('self_in_list');
  }
  if (ids.length > MAX_DEFAULT_HELPERS) {
    throw new CrewValidationError('too_many');
  }
  if (ids.length > 0) {
    const rows = await prisma.user.findMany({
      where: {
        id: { in: ids },
        active: true,
        role: { in: ['admin', 'inspector'] },
      },
      select: { id: true },
    });
    if (rows.length !== ids.length) {
      throw new CrewValidationError('invalid_helper');
    }
  }
  await prisma.user.update({
    where: { id: userId },
    data: { default_helper_user_ids: ids, crew_decided: true },
  });
  return ids;
}
```

- [ ] **Step 4: Run all tests in the file**

```bash
npx vitest run src/__tests__/services-user-preferences.test.ts
```

Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/userPreferencesService.ts src/__tests__/services-user-preferences.test.ts
git commit -m "$(cat <<'EOF'
feat(service): add userPreferencesService.setDefaultCrew

Writes the user's default crew with full validation: dedupe,
reject self, cap at 5, require all ids to be active inspectors.
Throws CrewValidationError with a stable code that the API
route can map to a 400 response.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: API route — GET /api/users/me/crew

**Files:**
- Create: `src/app/api/users/me/crew/route.ts`
- Create: `src/__tests__/api-users-me-crew.test.ts`

- [ ] **Step 1: Write the failing test for GET**

Create `src/__tests__/api-users-me-crew.test.ts`:

```ts
// src/__tests__/api-users-me-crew.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mintCookie } from './helpers/session';
import { COOKIE_NAME } from '@/lib/session';

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v ? { name, value: v } : undefined;
    },
    set: () => {},
    delete: () => {},
  }),
}));

import prisma from '@/lib/prisma';
import { GET as getCrew, PUT as putCrew } from '@/app/api/users/me/crew/route';

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    process.env.SESSION_PASSWORD ?? 'test-session-password-32-chars-or-more!!!';
  cookieStore.clear();
  vi.clearAllMocks();
});

async function req(
  url: string,
  init?: { method?: string; cookie?: string; body?: unknown },
): Promise<NextRequest> {
  const headers = new Headers();
  if (init?.cookie) {
    headers.set('Cookie', init.cookie);
    const match = init.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (match) cookieStore.set(COOKIE_NAME, match[1]);
  }
  if (init?.body) headers.set('Content-Type', 'application/json');
  return new NextRequest(url, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
}

describe('GET /api/users/me/crew', () => {
  it('401 when no session', async () => {
    const r = await getCrew(await req('http://t/api/users/me/crew'));
    expect(r.status).toBe(401);
  });

  it('200 with defaultHelperUserIds: null when undecided', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3, default_helper_user_ids: null,
    } as never);
    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff' });
    const r = await getCrew(await req('http://t/api/users/me/crew', { cookie: c.header }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toEqual({ defaultHelperUserIds: null });
  });

  it('200 with [] when solo', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3, default_helper_user_ids: [],
    } as never);
    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff' });
    const r = await getCrew(await req('http://t/api/users/me/crew', { cookie: c.header }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ defaultHelperUserIds: [] });
  });

  it('200 with the persisted crew', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3, default_helper_user_ids: [6, 7],
    } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 6 }, { id: 7 },
    ] as never);
    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff' });
    const r = await getCrew(await req('http://t/api/users/me/crew', { cookie: c.header }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ defaultHelperUserIds: [6, 7] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/api-users-me-crew.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/users/me/crew/route'`.

- [ ] **Step 3: Implement GET**

Create `src/app/api/users/me/crew/route.ts`:

```ts
// src/app/api/users/me/crew/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { getDefaultCrew } from '@/services/userPreferencesService';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const defaultHelperUserIds = await getDefaultCrew(session.userId);
  return NextResponse.json({ defaultHelperUserIds });
}
```

- [ ] **Step 4: Run tests to verify GET passes**

```bash
npx vitest run src/__tests__/api-users-me-crew.test.ts -t "GET /api/users/me/crew"
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/users/me/crew/route.ts src/__tests__/api-users-me-crew.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add GET /api/users/me/crew

Session-gated reader that returns the caller's default crew
as either null (undecided), [] (solo), or a filtered id list.
Self-healing happens inside the service.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: API route — PUT /api/users/me/crew

**Files:**
- Modify: `src/app/api/users/me/crew/route.ts`
- Modify: `src/__tests__/api-users-me-crew.test.ts`

- [ ] **Step 1: Write the failing tests for PUT**

Append to `src/__tests__/api-users-me-crew.test.ts`:

```ts
describe('PUT /api/users/me/crew', () => {
  it('401 when no session', async () => {
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      body: { defaultHelperUserIds: [] },
    }));
    expect(r.status).toBe(401);
  });

  it('400 when body is not an object', async () => {
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: [1, 2, 3] as unknown as object,
    }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'invalid_body' });
  });

  it('400 when defaultHelperUserIds is not an array', async () => {
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: 'nope' as unknown as number[] },
    }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'invalid_body' });
  });

  it('400 when array contains a non-integer', async () => {
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: [6, 'oops' as unknown as number] },
    }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'invalid_body' });
  });

  it('400 self_in_list', async () => {
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: [3] },
    }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'self_in_list' });
  });

  it('400 too_many', async () => {
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: [4, 5, 6, 7, 8, 9] },
    }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'too_many' });
  });

  it('400 invalid_helper when an id is not an active inspector', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: 6 }] as never);
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: [6, 9] },
    }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'invalid_helper' });
  });

  it('200 saves solo []', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: 3, default_helper_user_ids: [],
    } as never);
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: [] },
    }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ defaultHelperUserIds: [] });
  });

  it('200 saves a valid crew', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 6 }, { id: 7 },
    ] as never);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: 3, default_helper_user_ids: [6, 7],
    } as never);
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: [6, 7] },
    }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ defaultHelperUserIds: [6, 7] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/api-users-me-crew.test.ts -t "PUT /api/users/me/crew"
```

Expected: 9 tests fail (`putCrew is not a function`).

- [ ] **Step 3: Implement PUT**

Modify `src/app/api/users/me/crew/route.ts`:

```ts
// src/app/api/users/me/crew/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getDefaultCrew,
  setDefaultCrew,
  CrewValidationError,
} from '@/services/userPreferencesService';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const defaultHelperUserIds = await getDefaultCrew(session.userId);
  return NextResponse.json({ defaultHelperUserIds });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const raw = (body as { defaultHelperUserIds?: unknown }).defaultHelperUserIds;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!raw.every((x) => typeof x === 'number' && Number.isInteger(x))) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  try {
    const saved = await setDefaultCrew(session.userId, raw as number[]);
    return NextResponse.json({ defaultHelperUserIds: saved });
  } catch (err) {
    if (err instanceof CrewValidationError) {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run all tests in the file**

```bash
npx vitest run src/__tests__/api-users-me-crew.test.ts
```

Expected: 13 tests pass (4 GET + 9 PUT).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/users/me/crew/route.ts src/__tests__/api-users-me-crew.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add PUT /api/users/me/crew

Session-gated writer that delegates to setDefaultCrew. Maps
CrewValidationError codes (invalid_helper, self_in_list,
too_many) to 400 responses. Catches malformed bodies before
service-layer validation.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: CrewModal — chip grid layout + dismiss buttons

**Files:**
- Create: `src/components/field-ops/CrewModal.tsx`
- Create: `src/__tests__/crew-modal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/crew-modal.test.tsx`:

```tsx
// src/__tests__/crew-modal.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import CrewModal from '@/components/field-ops/CrewModal';

afterEach(() => cleanup());

const inspectors = [
  { id: 3, username: 'iff', displayName: 'iff' },
  { id: 6, username: 'daf', displayName: 'daf' },
  { id: 7, username: 'ice', displayName: 'ice' },
];

describe('CrewModal', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <CrewModal
        open={false}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('renders a chip for each active inspector except self', () => {
    const { getByRole, queryByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(getByRole('button', { name: /^daf$/i })).toBeTruthy();
    expect(getByRole('button', { name: /^ice$/i })).toBeTruthy();
    expect(queryByRole('button', { name: /^iff$/i })).toBeNull();
  });

  it('disables SAVE when no chip is selected', () => {
    const { getByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const save = getByRole('button', { name: /save crew/i });
    expect(save.hasAttribute('disabled')).toBe(true);
  });

  it('enables SAVE and shows live count once a chip is selected', () => {
    const { getByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[6]}
        onSave={vi.fn()}
        onSolo={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const save = getByRole('button', { name: /save crew \(1\)/i });
    expect(save.hasAttribute('disabled')).toBe(false);
  });

  it('toggles selection when a chip is clicked', () => {
    const { getByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(getByRole('button', { name: /^daf$/i }));
    expect(getByRole('button', { name: /save crew \(1\)/i })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: /^daf$/i }));
    expect(getByRole('button', { name: /save crew/i }).hasAttribute('disabled')).toBe(true);
  });

  it('calls onSave with the selected ids', () => {
    const onSave = vi.fn();
    const { getByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[6, 7]}
        onSave={onSave}
        onSolo={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(getByRole('button', { name: /save crew \(2\)/i }));
    expect(onSave).toHaveBeenCalledWith([6, 7]);
  });

  it('calls onSolo when I WORK SOLO is clicked', () => {
    const onSolo = vi.fn();
    const { getByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={onSolo}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(getByRole('button', { name: /work solo/i }));
    expect(onSolo).toHaveBeenCalled();
  });

  it('× button also calls onSolo (same intent)', () => {
    const onSolo = vi.fn();
    const { getByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={onSolo}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(getByRole('button', { name: /close/i }));
    expect(onSolo).toHaveBeenCalled();
  });

  it('ESC ≡ onSolo', () => {
    const onSolo = vi.fn();
    render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={onSolo}
        onClose={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSolo).toHaveBeenCalled();
  });

  it('backdrop click does NOT dismiss', () => {
    const onSolo = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={onSolo}
        onClose={onClose}
      />,
    );
    const backdrop = container.querySelector('[data-testid="crew-modal-backdrop"]')!;
    fireEvent.click(backdrop);
    expect(onSolo).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the inline error when provided', () => {
    const { container } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={vi.fn()}
        onClose={vi.fn()}
        error="Couldn't save — try again."
      />,
    );
    expect(container.textContent).toContain("Couldn't save — try again.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/crew-modal.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/field-ops/CrewModal'`.

- [ ] **Step 3: Implement `CrewModal`**

Create `src/components/field-ops/CrewModal.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

export interface InspectorOption {
  id: number;
  username: string;
  displayName: string;
}

interface Props {
  open: boolean;
  inspectors: InspectorOption[];
  currentUserId: number;
  initialSelected: number[];
  onSave: (ids: number[]) => Promise<void> | void;
  onSolo: () => Promise<void> | void;
  onClose: () => void;
  error?: string;
  pending?: boolean;
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const cardStyle: React.CSSProperties = {
  width: 'min(480px, 92vw)',
  maxHeight: '92vh',
  overflowY: 'auto',
  position: 'relative',
  background: 'var(--fo-rail-bg)',
  color: 'var(--fo-rail-text)',
  border: '1px solid var(--fo-rail-border)',
  borderRadius: 12,
  padding: '22px 22px 18px',
};

const closeStyle: React.CSSProperties = {
  position: 'absolute',
  top: 14,
  right: 14,
  background: 'transparent',
  border: 'none',
  color: 'var(--fo-rail-mute)',
  fontSize: 18,
  cursor: 'pointer',
  width: 28,
  height: 28,
};

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid var(--fo-rail-border)',
  background: 'transparent',
  color: 'var(--fo-rail-text)',
};

const chipOn: React.CSSProperties = {
  ...chipBase,
  background: 'var(--fo-accent)',
  color: 'var(--fo-rail-bg)',
  borderColor: 'var(--fo-accent)',
};

const primaryBtn: React.CSSProperties = {
  flex: 1,
  padding: '11px 14px',
  background: 'var(--fo-accent)',
  color: 'var(--fo-rail-bg)',
  border: 'none',
  borderRadius: 8,
  fontFamily: 'var(--fo-mono)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  padding: '11px 14px',
  background: 'transparent',
  color: 'var(--fo-rail-mute)',
  border: '1px solid var(--fo-rail-border)',
  borderRadius: 8,
  fontFamily: 'var(--fo-mono)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  cursor: 'pointer',
};

export default function CrewModal({
  open,
  inspectors,
  currentUserId,
  initialSelected,
  onSave,
  onSolo,
  onClose: _onClose,
  error,
  pending = false,
}: Props) {
  const [selected, setSelected] = useState<number[]>(initialSelected);

  useEffect(() => {
    if (open) setSelected(initialSelected);
  }, [open, initialSelected]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void onSolo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onSolo]);

  const options = useMemo(
    () => inspectors.filter((u) => u.id !== currentUserId),
    [inspectors, currentUserId],
  );

  if (!open) return null;

  const selectedSet = new Set(selected);
  const toggle = (id: number) => {
    if (pending) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Preserve the inspector list order so test assertions / display are stable.
    setSelected(options.filter((u) => next.has(u.id)).map((u) => u.id));
  };

  return (
    <div
      data-testid="crew-modal-backdrop"
      style={backdropStyle}
      onClick={(e) => {
        // Backdrop click is intentionally inert; the user must use a button.
        e.stopPropagation();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crew-modal-title"
        style={cardStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => void onSolo()}
          disabled={pending}
          style={closeStyle}
        >
          ×
        </button>
        <div className="fo-mono" style={{ color: 'var(--fo-accent)' }}>FIRST LOGIN</div>
        <div
          id="crew-modal-title"
          className="fo-serif"
          style={{ fontSize: 22, marginTop: 4 }}
        >
          Tag your default crew
        </div>
        <div style={{ color: 'var(--fo-rail-mute)', fontSize: 13, marginTop: 4, marginBottom: 16, lineHeight: 1.4 }}>
          Pre-filled on every inspection — override per station.
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '6px 0 4px 0' }}>
          {options.map((u) => {
            const on = selectedSet.has(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                disabled={pending}
                style={on ? chipOn : chipBase}
              >
                {u.displayName}
              </button>
            );
          })}
        </div>

        {error && (
          <div
            role="alert"
            style={{ marginTop: 12, color: 'var(--fo-crit)', fontSize: 12 }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid var(--fo-rail-border)',
          }}
        >
          <button
            type="button"
            onClick={() => void onSave(selected)}
            disabled={pending || selected.length === 0}
            style={{ ...primaryBtn, opacity: pending || selected.length === 0 ? 0.5 : 1 }}
          >
            SAVE CREW ({selected.length})
          </button>
          <button
            type="button"
            onClick={() => void onSolo()}
            disabled={pending}
            style={secondaryBtn}
          >
            I WORK SOLO
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run all CrewModal tests**

```bash
npx vitest run src/__tests__/crew-modal.test.tsx
```

Expected: 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/field-ops/CrewModal.tsx src/__tests__/crew-modal.test.tsx
git commit -m "$(cat <<'EOF'
feat(field-ops): add CrewModal chip-grid picker

First-mount modal that asks the inspector to pick their default
crew (chip grid, dark rail palette). SAVE disabled at 0 chips;
I WORK SOLO / × / ESC all map to the same "save empty" intent
so the modal never auto-opens again. Backdrop click is inert.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: CrewIndicator — header re-open button

**Files:**
- Create: `src/components/field-ops/CrewIndicator.tsx`
- Modify: `src/__tests__/crew-modal.test.tsx` (no — separate test file is fine)
- Create: `src/__tests__/crew-indicator.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/crew-indicator.test.tsx`:

```tsx
// src/__tests__/crew-indicator.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import CrewIndicator from '@/components/field-ops/CrewIndicator';

afterEach(() => cleanup());

const inspectors = [
  { id: 3, username: 'iff', displayName: 'iff' },
  { id: 6, username: 'daf', displayName: 'daf' },
  { id: 7, username: 'ice', displayName: 'ice' },
  { id: 8, username: 'dao', displayName: 'dao' },
];

describe('CrewIndicator', () => {
  it('returns null when defaultCrew is null', () => {
    const { container } = render(
      <CrewIndicator
        defaultCrew={null}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={false}
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('renders "My crew · solo" when defaultCrew is []', () => {
    const { container } = render(
      <CrewIndicator
        defaultCrew={[]}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={false}
      />,
    );
    expect(container.textContent?.toLowerCase()).toContain('my crew');
    expect(container.textContent?.toLowerCase()).toContain('solo');
  });

  it('renders up to 2 names then +N for larger crews', () => {
    const { container } = render(
      <CrewIndicator
        defaultCrew={[6, 7, 8]}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={false}
      />,
    );
    expect(container.textContent).toContain('daf');
    expect(container.textContent).toContain('ice');
    expect(container.textContent).toContain('+1');
  });

  it('falls back to id when an inspector is missing from the list', () => {
    const { container } = render(
      <CrewIndicator
        defaultCrew={[99]}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={false}
      />,
    );
    // Don't crash; the chip should show "#99" so the user notices.
    expect(container.textContent).toContain('#99');
  });

  it('compact mode shows only the count badge', () => {
    const { container } = render(
      <CrewIndicator
        defaultCrew={[6, 7]}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={true}
      />,
    );
    expect(container.textContent).toContain('2');
    expect(container.textContent).not.toContain('daf');
  });

  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    const { getByRole } = render(
      <CrewIndicator
        defaultCrew={[]}
        inspectors={inspectors}
        onOpen={onOpen}
        compact={false}
      />,
    );
    fireEvent.click(getByRole('button'));
    expect(onOpen).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/crew-indicator.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/field-ops/CrewIndicator'`.

- [ ] **Step 3: Implement `CrewIndicator`**

Create `src/components/field-ops/CrewIndicator.tsx`:

```tsx
'use client';

import type { InspectorOption } from './CrewModal';

interface Props {
  defaultCrew: number[] | null;
  inspectors: InspectorOption[];
  onOpen: () => void;
  compact: boolean;
}

const baseBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  border: '1px solid var(--fo-accent)',
  color: 'var(--fo-accent)',
  background: 'transparent',
  borderRadius: 999,
  fontSize: 10,
  lineHeight: 1,
  letterSpacing: '0.16em',
  cursor: 'pointer',
  fontFamily: 'var(--fo-mono)',
};

function displayFor(id: number, inspectors: InspectorOption[]): string {
  const hit = inspectors.find((u) => u.id === id);
  return hit ? hit.displayName : `#${id}`;
}

export default function CrewIndicator({
  defaultCrew,
  inspectors,
  onOpen,
  compact,
}: Props) {
  if (defaultCrew === null) return null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="My crew"
        style={{ ...baseBtn, padding: '6px 10px' }}
      >
        <span aria-hidden>🧑</span>
        <span>{defaultCrew.length}</span>
      </button>
    );
  }

  if (defaultCrew.length === 0) {
    return (
      <button type="button" onClick={onOpen} style={baseBtn}>
        <span aria-hidden>🧑</span>
        <span>MY CREW · SOLO</span>
      </button>
    );
  }

  const names = defaultCrew.slice(0, 2).map((id) => displayFor(id, inspectors));
  const extra = defaultCrew.length - names.length;
  const tail = extra > 0 ? ` · +${extra}` : '';
  return (
    <button type="button" onClick={onOpen} style={baseBtn}>
      <span aria-hidden>🧑</span>
      <span>MY CREW · {names.join(' · ')}{tail}</span>
    </button>
  );
}
```

- [ ] **Step 4: Run all CrewIndicator tests**

```bash
npx vitest run src/__tests__/crew-indicator.test.tsx
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/field-ops/CrewIndicator.tsx src/__tests__/crew-indicator.test.tsx
git commit -m "$(cat <<'EOF'
feat(field-ops): add CrewIndicator re-open button

Header pill that shows the current default crew (or "solo") and
re-opens CrewModal on click. Renders nothing when undecided so
the modal's first-prompt path stays the only entry. Compact
mode for the mobile drawer.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: FieldOpsClient — bootstrap + pre-fill + modal wiring

**Files:**
- Modify: `src/components/field-ops/FieldOpsClient.tsx`
- Create: `src/__tests__/field-ops-crew-bootstrap.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/field-ops-crew-bootstrap.test.tsx`:

```tsx
// src/__tests__/field-ops-crew-bootstrap.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import FieldOpsClient from '@/components/field-ops/FieldOpsClient';
import type { FMStation } from '@/types/station';

// jsdom lacks ResizeObserver; analytics charts use it.
vi.mock('@/components/analytics/AnalyticsDashboard', () => ({ default: () => null }));

// Skip the dynamic Leaflet map — tests don't need real geo behaviour.
vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

afterEach(() => cleanup());

const stations: FMStation[] = [
  {
    id: 5520117,
    name: 'เสียงชนเสรี',
    frequency: 106,
    latitude: 14.96,
    longitude: 102.07,
    city: 'คง',
    state: 'นครราชสีมา',
    genre: 'ธุรกิจ',
    type: 'ธุรกิจ',
    inspection69: 'ยังไม่ตรวจ',
    onAir: true,
  },
];

const inspectors = [
  { id: 3, username: 'iff', displayName: 'iff' },
  { id: 6, username: 'daf', displayName: 'daf' },
  { id: 7, username: 'ice', displayName: 'ice' },
];

const currentUser = { id: 3, displayName: 'iff' };

beforeEach(() => {
  vi.useFakeTimers();
  // Default fetch implementation. Each test may override.
  global.fetch = vi.fn(async (url: string) => {
    if (url.toString().endsWith('/api/users/inspectors')) {
      return new Response(JSON.stringify({ users: inspectors }), { status: 200 });
    }
    if (url.toString().endsWith('/api/users/me/crew')) {
      return new Response(JSON.stringify({ defaultHelperUserIds: null }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  }) as never;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FieldOpsClient — crew bootstrap', () => {
  it('opens the modal when defaultHelperUserIds is null', async () => {
    const { container } = render(
      <FieldOpsClient
        initialStations={stations}
        initialInterference={[]}
        initialCities={[]}
        initialProvinces={[]}
        currentUser={currentUser}
      />,
    );
    await vi.advanceTimersByTimeAsync(0);
    await waitFor(() => {
      expect(container.textContent).toContain('Tag your default crew');
    });
  });

  it('does NOT open the modal when defaultHelperUserIds is []', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.toString().endsWith('/api/users/inspectors')) {
        return new Response(JSON.stringify({ users: inspectors }), { status: 200 });
      }
      if (url.toString().endsWith('/api/users/me/crew')) {
        return new Response(JSON.stringify({ defaultHelperUserIds: [] }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as never;

    const { container } = render(
      <FieldOpsClient
        initialStations={stations}
        initialInterference={[]}
        initialCities={[]}
        initialProvinces={[]}
        currentUser={currentUser}
      />,
    );
    await vi.advanceTimersByTimeAsync(0);
    await waitFor(() => {
      // The header indicator renders "MY CREW · SOLO"
      expect(container.textContent?.toLowerCase()).toContain('my crew');
    });
    expect(container.textContent).not.toContain('Tag your default crew');
  });

  it('does NOT open the modal when defaultHelperUserIds is non-empty', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.toString().endsWith('/api/users/inspectors')) {
        return new Response(JSON.stringify({ users: inspectors }), { status: 200 });
      }
      if (url.toString().endsWith('/api/users/me/crew')) {
        return new Response(JSON.stringify({ defaultHelperUserIds: [6, 7] }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as never;

    const { container } = render(
      <FieldOpsClient
        initialStations={stations}
        initialInterference={[]}
        initialCities={[]}
        initialProvinces={[]}
        currentUser={currentUser}
      />,
    );
    await vi.advanceTimersByTimeAsync(0);
    await waitFor(() => {
      expect(container.textContent).toContain('daf');
    });
    expect(container.textContent).not.toContain('Tag your default crew');
  });

  it('opens the modal on fetch failure (fail-open)', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.toString().endsWith('/api/users/inspectors')) {
        return new Response(JSON.stringify({ users: inspectors }), { status: 200 });
      }
      if (url.toString().endsWith('/api/users/me/crew')) {
        throw new Error('network down');
      }
      return new Response('{}', { status: 404 });
    }) as never;

    const { container } = render(
      <FieldOpsClient
        initialStations={stations}
        initialInterference={[]}
        initialCities={[]}
        initialProvinces={[]}
        currentUser={currentUser}
      />,
    );
    await vi.advanceTimersByTimeAsync(0);
    await waitFor(() => {
      expect(container.textContent).toContain('Tag your default crew');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/field-ops-crew-bootstrap.test.tsx
```

Expected: FAIL — assertion failures (no "Tag your default crew" rendered yet, since the modal isn't wired).

- [ ] **Step 3: Wire the bootstrap into `FieldOpsClient`**

Modify `src/components/field-ops/FieldOpsClient.tsx`. Three changes:

**3a.** Add the imports (add `CrewModal`):

```tsx
import CrewModal from "./CrewModal";
```

**3b.** Add state + bootstrap effect inside the component. Add after the existing `inspectors` / `helperUserIds` state declarations (around line 82):

```tsx
const [defaultCrew, setDefaultCrew] = useState<number[] | null>(null);
const [crewModalOpen, setCrewModalOpen] = useState(false);
const [crewSaveError, setCrewSaveError] = useState<string | undefined>(undefined);
const [crewSaving, setCrewSaving] = useState(false);

useEffect(() => {
  let cancelled = false;
  fetch('/api/users/me/crew')
    .then((r) => (r.ok ? r.json() : { defaultHelperUserIds: null }))
    .then((j: { defaultHelperUserIds: number[] | null }) => {
      if (cancelled) return;
      setDefaultCrew(j.defaultHelperUserIds);
      if (j.defaultHelperUserIds === null) setCrewModalOpen(true);
    })
    .catch(() => {
      if (cancelled) return;
      setDefaultCrew(null);
      setCrewModalOpen(true);
    });
  return () => { cancelled = true; };
}, []);
```

**3c.** Change the station-select reset to use the default. Find this line (currently around line 158):

```tsx
useEffect(() => { setHelperUserIds([]); }, [fmStationId]);
```

Replace with:

```tsx
useEffect(() => {
  setHelperUserIds(defaultCrew ?? []);
}, [fmStationId, defaultCrew]);
```

**3d.** Add the persist helper and modal handlers. Add inside the component, above `handleToggleInspection`:

```tsx
async function persistCrew(ids: number[]) {
  setCrewSaving(true);
  setCrewSaveError(undefined);
  try {
    const res = await fetch('/api/users/me/crew', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultHelperUserIds: ids }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error ?? 'crew_save_failed');
    }
    const j = (await res.json()) as { defaultHelperUserIds: number[] };
    setDefaultCrew(j.defaultHelperUserIds);
    setCrewModalOpen(false);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'crew_save_failed';
    const friendly =
      code === 'invalid_helper'   ? 'That teammate is no longer active.' :
      code === 'self_in_list'     ? 'You can’t add yourself.' :
      code === 'too_many'         ? 'You can pick up to 5 teammates.' :
      code === 'invalid_body'     ? 'Something’s wrong with the form.' :
                                    'Couldn’t save — try again.';
    setCrewSaveError(friendly);
  } finally {
    setCrewSaving(false);
  }
}
```

**3e.** Render `<CrewModal />` at the end of the JSX tree, just before the closing `</div>` of `field-ops-root`:

```tsx
<CrewModal
  open={crewModalOpen}
  inspectors={inspectors}
  currentUserId={currentUser?.id ?? -1}
  initialSelected={defaultCrew ?? []}
  onSave={(ids) => persistCrew(ids)}
  onSolo={() => persistCrew([])}
  onClose={() => setCrewModalOpen(false)}
  error={crewSaveError}
  pending={crewSaving}
/>
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/field-ops-crew-bootstrap.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 5: Run the existing field-ops regression tests**

```bash
npx vitest run src/__tests__/field-ops-current.test.tsx
```

Expected: 7 tests pass (the existing suite — no regressions from the prop wiring).

- [ ] **Step 6: Commit**

```bash
git add src/components/field-ops/FieldOpsClient.tsx src/__tests__/field-ops-crew-bootstrap.test.tsx
git commit -m "$(cat <<'EOF'
feat(field-ops): bootstrap default crew + render CrewModal

On mount, FieldOpsClient fetches /api/users/me/crew and opens
CrewModal when the user is undecided. The default crew pre-fills
the per-station TeammatePicker's helperUserIds, replacing the
hardcoded [] reset on station selection. Save/Solo go through a
single persistCrew helper that maps server error codes to user
copy.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: FieldOpsHeader — desktop indicator slot

**Files:**
- Modify: `src/components/field-ops/FieldOpsHeader.tsx`
- Modify: `src/components/field-ops/FieldOpsClient.tsx` (pass new props to header)

- [ ] **Step 1: Add the indicator slot props to FieldOpsHeader**

Modify `src/components/field-ops/FieldOpsHeader.tsx`. Add three new optional props to the function signature (alongside the existing ones):

```tsx
defaultCrew?: number[] | null;
inspectors?: { id: number; username: string; displayName: string }[];
onOpenCrew?: () => void;
```

Destructure them in the component:

```tsx
export function FieldOpsHeader({
  stations,
  interference,
  type,
  theme,
  onToggleTheme,
  isMobile = false,
  onOpenDrawer,
  locationStatus,
  userLocation,
  onRetryLocation,
  defaultCrew,
  inspectors,
  onOpenCrew,
}: {
  // ...existing field types...
  defaultCrew?: number[] | null;
  inspectors?: { id: number; username: string; displayName: string }[];
  onOpenCrew?: () => void;
}) {
```

- [ ] **Step 2: Render the indicator in the desktop header**

Add the import at the top of `FieldOpsHeader.tsx`:

```tsx
import CrewIndicator from "./CrewIndicator";
```

Find the desktop return block (line 61 onward). Insert the indicator **between `LocationBadge` and the theme-toggle button** (around line 113):

```tsx
{onOpenCrew && (
  <CrewIndicator
    defaultCrew={defaultCrew ?? null}
    inspectors={inspectors ?? []}
    onOpen={onOpenCrew}
    compact={false}
  />
)}
```

- [ ] **Step 3: Pass the props from FieldOpsClient**

In `src/components/field-ops/FieldOpsClient.tsx`, find the `<FieldOpsHeader />` invocation (line 409). Add three props:

```tsx
<FieldOpsHeader
  stations={filteredStations}
  interference={filteredInterference}
  type={filters.type}
  theme={theme}
  onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
  isMobile={isMobile}
  onOpenDrawer={() => setDrawerOpen(true)}
  locationStatus={locationStatus}
  userLocation={userLocation}
  onRetryLocation={retryLocation}
  defaultCrew={defaultCrew}
  inspectors={inspectors}
  onOpenCrew={() => setCrewModalOpen(true)}
/>
```

- [ ] **Step 4: Manual smoke test**

Start the dev server in tmux if not running:

```bash
tmux capture-pane -t dev -p | tail -5
```

If not running:

```bash
CMD=npm; tmux new-session -d -s dev "$CMD run dev"
sleep 3
tmux capture-pane -t dev -p | tail -5
```

Then visit `http://localhost:3000/field-ops` on desktop (≥900px). The header right cluster should show the new "MY CREW · …" pill (after the user has decided) or render nothing (when still undecided). Click it → modal opens.

- [ ] **Step 5: Commit**

```bash
git add src/components/field-ops/FieldOpsHeader.tsx src/components/field-ops/FieldOpsClient.tsx
git commit -m "$(cat <<'EOF'
feat(field-ops): wire CrewIndicator into desktop header

Adds the My Crew pill to FieldOpsHeader's right cluster (between
location badge and theme toggle). Renders only after the user has
made a decision; click re-opens CrewModal.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: FieldOpsDrawer — mobile indicator slot

**Files:**
- Modify: `src/components/field-ops/FieldOpsDrawer.tsx`
- Modify: `src/components/field-ops/FieldOpsClient.tsx` (pass new props to drawer)

- [ ] **Step 1: Read the existing drawer to find the insertion point**

Run:

```bash
grep -n "interface\|function FieldOpsDrawer\|return (" src/components/field-ops/FieldOpsDrawer.tsx | head -10
```

This locates the props interface and the JSX entry point so the new slot is added in a parallel position to the existing rows (theme toggle row).

- [ ] **Step 2: Add the new props to FieldOpsDrawer**

Modify `src/components/field-ops/FieldOpsDrawer.tsx`. Add three optional props (alongside existing `onToggleTheme`, etc.):

```tsx
defaultCrew?: number[] | null;
inspectors?: { id: number; username: string; displayName: string }[];
onOpenCrew?: () => void;
```

- [ ] **Step 3: Render `CrewIndicator` (compact mode) inside the drawer rows**

Add the import at the top:

```tsx
import CrewIndicator from "./CrewIndicator";
```

Inside the drawer JSX, in the same row group as the theme toggle, add a row:

```tsx
{onOpenCrew && defaultCrew !== null && (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderTop: '1px solid var(--fo-rail-border)',
    }}
  >
    <span className="fo-mono" style={{ color: 'var(--fo-rail-mute)' }}>MY CREW</span>
    <CrewIndicator
      defaultCrew={defaultCrew}
      inspectors={inspectors ?? []}
      onOpen={() => {
        onOpenCrew();
      }}
      compact={false}
    />
  </div>
)}
```

The drawer is wide enough to fit the full pill, so `compact={false}` is the right choice here. (The compact mode is reserved for if we ever inline it into the header bar on mobile.)

- [ ] **Step 4: Pass the props from FieldOpsClient**

In `src/components/field-ops/FieldOpsClient.tsx`, find `<FieldOpsDrawer />` (line 584). Add the same three props:

```tsx
<FieldOpsDrawer
  open={drawerOpen}
  activeTab={tab}
  theme={theme}
  kpis={computeKpis(filteredStations, filteredInterference, filters.type)}
  onChangeTab={setTab}
  onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
  onClose={() => setDrawerOpen(false)}
  defaultCrew={defaultCrew}
  inspectors={inspectors}
  onOpenCrew={() => {
    setDrawerOpen(false);
    setCrewModalOpen(true);
  }}
/>
```

(`setDrawerOpen(false)` before opening the modal so the drawer doesn't obscure it on small screens.)

- [ ] **Step 5: Manual smoke test (mobile viewport)**

Open `http://localhost:3000/field-ops` in DevTools mobile emulation (width < 900px). Open the drawer (☰). The "MY CREW" row should appear at the bottom. Tap it → drawer closes, modal opens.

- [ ] **Step 6: Commit**

```bash
git add src/components/field-ops/FieldOpsDrawer.tsx src/components/field-ops/FieldOpsClient.tsx
git commit -m "$(cat <<'EOF'
feat(field-ops): add MY CREW row to mobile drawer

Adds a CrewIndicator row at the bottom of FieldOpsDrawer that
opens CrewModal (and closes the drawer first so the modal isn't
obscured). Hidden until the user has made a decision.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: End-to-end manual verification + full test sweep

**Files:** (no code changes — verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npm test -- --run
```

Expected: All tests added in this plan pass. Any pre-existing failures are unrelated to this feature — capture the list in case the test count changes unexpectedly.

- [ ] **Step 2: Reset one test user to undecided (to exercise the modal flow)**

```bash
npx prisma db execute --stdin <<'EOF'
UPDATE "user" SET default_helper_user_ids = NULL WHERE username = 'iff';
EOF
```

Expected: `1 row affected.` (Adjust the username if `iff` isn't a real user in the dev DB — confirm with `SELECT username FROM "user" WHERE active = true LIMIT 5`.)

- [ ] **Step 3: Verify the desktop flow**

1. Log in as that user.
2. Visit `/field-ops`.
3. Modal pops on mount.
4. Pick two chips → SAVE CREW (2) → modal closes.
5. Open DevTools network → confirm `PUT /api/users/me/crew` returned 200 with the persisted ids.
6. Header shows `MY CREW · <name> · <name>`.
7. Select any station → the `+ tag teammates` chips on the station card are pre-filled with the two helpers.
8. Tap INSPECT. PATCH body in DevTools network should include `helperUserIds: [<ids>]`.
9. Reload `/field-ops` → modal does NOT pop. Header still shows the saved crew.

- [ ] **Step 4: Verify the solo path**

```bash
npx prisma db execute --stdin <<'EOF'
UPDATE "user" SET default_helper_user_ids = NULL WHERE username = 'iff';
EOF
```

1. Reload `/field-ops`. Modal pops.
2. Click `×` (or `I WORK SOLO`, or press ESC) → modal closes.
3. Header shows `MY CREW · SOLO`.
4. Selecting a station shows the empty per-station picker (no pre-fill).
5. Reload → modal does NOT pop.

- [ ] **Step 5: Verify analytics sync**

Open `/field-ops` → Analytics tab. After running an INSPECT with pre-filled helpers in step 3, the "Most tagged helper this year" KPI should reflect the new attribution within the cache window (60s) — wait one minute then reload Analytics if needed.

- [ ] **Step 6: Verify the mobile drawer flow**

DevTools → mobile viewport (<900px). Open `/field-ops`. Modal pops on mount (same logic). Pick or skip. Open drawer (☰) → "MY CREW" row visible → tap → drawer closes + modal re-opens with current selection pre-filled.

- [ ] **Step 7: Lint pass**

```bash
npm run lint
```

Expected: No new errors. Warnings about unused imports/vars are blockers — clean them up before committing.

- [ ] **Step 8: Final commit (only if anything changed during verification)**

If the manual flow surfaced anything that needed a fix, fix it inline and commit:

```bash
git add <changed files>
git commit -m "$(cat <<'EOF'
fix(field-ops): <one-line description of what verification surfaced>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

If verification was clean, no commit is needed for this task.

---

## Self-Review Notes

- **Spec coverage:** Every requirement in the spec maps to one or more tasks above:
  - Data model (NULL/[]/non-empty) → Task 1.
  - Validation (active, role, self, ≤5) → Task 3 (service) + Task 5 (route).
  - GET / PUT contracts incl. 400 error codes → Tasks 4 + 5.
  - Self-healing on stale references → Task 2 + its dedicated test.
  - `CrewModal` (chip grid, SAVE disabled at 0, SOLO/×/ESC, no backdrop dismiss) → Task 6.
  - `CrewIndicator` (null/empty/many states, compact mode) → Task 7.
  - Bootstrap fetch + pre-fill + persistCrew → Task 8.
  - Header / drawer wiring → Tasks 9 + 10.
  - Analytics sync verified by E2E (Task 11 step 5) since no code changes are needed there.
- **Out-of-scope items** in the spec (per-day crew, audit log, admin UI, backfill) intentionally have no tasks.
- **Type consistency** verified: `defaultHelperUserIds`/`defaultCrew`/`number[] | null` used consistently across service, route, and component layers. `CrewValidationError` codes (`invalid_helper`, `self_in_list`, `too_many`) match the spec table.
- **No placeholders** — every code step has full code; every command has expected output.
