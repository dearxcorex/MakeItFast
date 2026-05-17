# INT Teammate Tagging + Analytics Inclusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Interference (INT) inspections to feature parity with FM inspections for teammate tagging and analytics counting.

**Architecture:** Parallel-table refactor — new `interference_inspection` + `interference_inspection_member` tables mirror the existing FM tables exactly. Service / route / UI / analytics all mirror the FM patterns; nothing in the FM code path changes. Analytics route's per-user aggregations switch from Prisma `.groupBy` to raw `$queryRawUnsafe` with `UNION ALL` across both tables so per-inspector counts merge into one total.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma + PostgreSQL (Neon), Vitest + @testing-library/react, iron-session.

---

## File Structure

**Database / schema**
- Modify: `prisma/schema.prisma` (new `interference_inspection` + `interference_inspection_member` models + back-relations on `interference_site` and `user`)
- Create: `prisma/migrations/2026-05-17-add-interference-inspection/migration.sql` (hand-written)

**Service layer**
- Create: `src/types/interferenceInspection.ts` — `InterferenceInspection`, `InterferenceInspectionMember`, `CreateInterferenceInspectionInput`
- Create: `src/services/interferenceInspectionService.ts` — `createInterferenceInspection`, `recomputeInterferenceInspectionState`, `listInspectionsForInterferenceSite`
- Create: `src/__tests__/interference-inspection-service.test.ts`

**API route**
- Modify: `src/app/api/interference/[id]/route.ts` — add ON + OFF sidecars to PATCH
- Create: `src/__tests__/api-interference-toggle.test.ts`

**UI (field-ops)**
- Modify: `src/components/field-ops/FieldOpsClient.tsx` — generalize helper-reset effect; extend INT branch of `handleToggleInspection`; pass crew props to INT panels
- Modify: `src/components/field-ops/FieldOpsCurrent.tsx` — extend `FieldOpsCurrentINT` with crew props + render `<TeammatePicker>`
- Modify: `src/components/field-ops/FieldOpsBottomSheet.tsx` — extend the picker conditional so it fires on FM PENDING **or** INT PENDING
- Modify: `src/__tests__/field-ops-current.test.tsx` — add INT teammate picker visibility test

**Analytics**
- Modify: `src/app/api/analytics/inspectors/route.ts` — switch 8 aggregations to UNION ALL raw queries
- Modify: `src/__tests__/api-analytics-inspectors.test.ts` — update fixtures to match new query call order

**No changes to:** existing `inspectionService.ts`, existing FM PATCH route, existing `TeammatePicker.tsx` (already target-agnostic), analytics-invariants test (mathematical contracts hold regardless of data source).

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/2026-05-17-add-interference-inspection/migration.sql`

- [ ] **Step 1: Add the two new models + back-relations to `schema.prisma`**

Open `prisma/schema.prisma`. After the existing `station_inspection_member` model (around line 135), append:

```prisma
model interference_inspection {
  id                Int       @id @default(autoincrement())
  interference_id   Int
  inspected_on      DateTime  @db.Date
  lead_user_id      Int
  notes             String?
  source            String    @default("app")
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  site    interference_site               @relation(fields: [interference_id], references: [id])
  lead    user                             @relation("int_inspection_lead", fields: [lead_user_id], references: [id])
  members interference_inspection_member[]

  @@index([interference_id, inspected_on(sort: Desc)])
  @@index([lead_user_id])
  @@unique([interference_id, inspected_on, lead_user_id])
}

model interference_inspection_member {
  inspection_id Int
  user_id       Int
  role          String  @default("helper")

  inspection interference_inspection @relation(fields: [inspection_id], references: [id], onDelete: Cascade)
  member     user                     @relation("int_inspection_member", fields: [user_id], references: [id])

  @@id([inspection_id, user_id])
  @@index([user_id])
}
```

Then add the back-relation to `interference_site` (around line 67, just before the closing `}` of the model):

Find:
```prisma
  @@index([changwat])
  @@index([ranking])
  @@index([nbtc_area])
}
```

Replace with:
```prisma
  inspections interference_inspection[]

  @@index([changwat])
  @@index([ranking])
  @@index([nbtc_area])
}
```

Then add the back-relations to the `user` model. Find (around line 100-104):

```prisma
  inspections_led    station_inspection[]        @relation("inspection_lead")
  inspection_members station_inspection_member[]

  @@index([username])
}
```

Replace with:

```prisma
  inspections_led        station_inspection[]             @relation("inspection_lead")
  inspection_members     station_inspection_member[]
  int_inspections_led    interference_inspection[]        @relation("int_inspection_lead")
  int_inspection_members interference_inspection_member[] @relation("int_inspection_member")

  @@index([username])
}
```

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/2026-05-17-add-interference-inspection/migration.sql`:

```sql
CREATE TABLE "interference_inspection" (
  "id"              SERIAL PRIMARY KEY,
  "interference_id" INTEGER NOT NULL REFERENCES "interference_site"("id"),
  "inspected_on"    DATE NOT NULL,
  "lead_user_id"    INTEGER NOT NULL REFERENCES "user"("id"),
  "notes"           TEXT,
  "source"          TEXT NOT NULL DEFAULT 'app',
  "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMP NOT NULL,
  CONSTRAINT "interference_inspection_unique"
    UNIQUE ("interference_id", "inspected_on", "lead_user_id")
);
CREATE INDEX "interference_inspection_target_date_idx"
  ON "interference_inspection" ("interference_id", "inspected_on" DESC);
CREATE INDEX "interference_inspection_lead_idx"
  ON "interference_inspection" ("lead_user_id");

CREATE TABLE "interference_inspection_member" (
  "inspection_id" INTEGER NOT NULL REFERENCES "interference_inspection"("id") ON DELETE CASCADE,
  "user_id"       INTEGER NOT NULL REFERENCES "user"("id"),
  "role"          TEXT NOT NULL DEFAULT 'helper',
  PRIMARY KEY ("inspection_id", "user_id")
);
CREATE INDEX "interference_inspection_member_user_idx"
  ON "interference_inspection_member" ("user_id");
```

- [ ] **Step 3: Apply schema + regenerate Prisma client**

```bash
npx prisma db push
npx prisma generate
```

Expected: `Your database is now in sync with your Prisma schema.` and `Generated Prisma Client (v…)`.

- [ ] **Step 4: Verify the tables exist**

```bash
DB_URL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')
/opt/homebrew/Cellar/libpq/18.3/bin/psql "$DB_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'interference_inspection%' ORDER BY table_name;"
```

Expected: two rows — `interference_inspection` and `interference_inspection_member`.

- [ ] **Step 5: Commit (force-add SQL because *.sql is gitignored)**

```bash
git add prisma/schema.prisma
git add -f prisma/migrations/2026-05-17-add-interference-inspection/migration.sql
git commit -m "$(cat <<'EOF'
feat(schema): add interference_inspection + interference_inspection_member

Parallel tables mirroring station_inspection / station_inspection_member
for FM. Same shape: lead_user_id, inspected_on (DATE), source,
@@unique on (interference_id, inspected_on, lead_user_id), cascade
delete from members on inspection delete. Two new relations on the
user model (int_inspections_led, int_inspection_members) and one
back-relation on interference_site.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Types

**Files:**
- Create: `src/types/interferenceInspection.ts`

- [ ] **Step 1: Write the types**

Create `src/types/interferenceInspection.ts`:

```ts
// src/types/interferenceInspection.ts
//
// Mirrors src/types/inspection.ts (FM equivalent) — keeps the shapes
// parallel so service/test/route code reads identically across the two
// domains.

export interface InterferenceInspectionMember {
  userId: number;
  username: string;
  displayName: string;
}

export interface InterferenceInspection {
  id: number;
  interferenceId: number;
  inspectedOn: string;        // YYYY-MM-DD
  lead: InterferenceInspectionMember;
  helpers: InterferenceInspectionMember[];
  notes?: string;
  source: string;
  createdAt: string;
}

export interface CreateInterferenceInspectionInput {
  interferenceId: number;
  inspectedOn: string;        // YYYY-MM-DD
  leadUserId: number;
  helperUserIds: number[];
  notes?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/interferenceInspection.ts
git commit -m "$(cat <<'EOF'
feat(types): add InterferenceInspection + CreateInterferenceInspectionInput

Mirrors src/types/inspection.ts so the new service / route / tests
read identically to their FM equivalents. Backs the parallel-table
schema added in the previous commit.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `interferenceInspectionService` — implementation

**Files:**
- Create: `src/services/interferenceInspectionService.ts`

- [ ] **Step 1: Write the service**

Create `src/services/interferenceInspectionService.ts`:

```ts
// src/services/interferenceInspectionService.ts
//
// Mirrors src/services/inspectionService.ts for the INT domain.
// Same validation order, same idempotency, same recompute pattern.
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import type {
  CreateInterferenceInspectionInput,
  InterferenceInspection,
  InterferenceInspectionMember,
} from '@/types/interferenceInspection';

type Tx = Prisma.TransactionClient;
type DbLike = Tx | typeof prisma;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateOnlyISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseInspectedOn(input: string): Date {
  if (!DATE_RE.test(input)) throw new Error('inspectedOn must use YYYY-MM-DD format');
  const d = new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error('inspectedOn is not a real date');
  const todayMs = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  );
  if (d.getTime() > todayMs) throw new Error('inspectedOn cannot be in the future');
  return d;
}

function shape(row: Record<string, unknown>): InterferenceInspection {
  type Row = {
    id: number; interference_id: number; inspected_on: Date; lead_user_id: number;
    notes: string | null; source: string; created_at: Date;
    lead: { id: number; username: string; display_name: string };
    members: Array<{ user_id: number; member: { id: number; username: string; display_name: string } }>;
  };
  const r = row as unknown as Row;
  const lead: InterferenceInspectionMember = {
    userId: r.lead.id, username: r.lead.username, displayName: r.lead.display_name,
  };
  const helpers: InterferenceInspectionMember[] = r.members.map((m) => ({
    userId: m.member.id, username: m.member.username, displayName: m.member.display_name,
  }));
  return {
    id: r.id,
    interferenceId: r.interference_id,
    inspectedOn: toDateOnlyISO(r.inspected_on),
    lead,
    helpers,
    notes: r.notes ?? undefined,
    source: r.source,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listInspectionsForInterferenceSite(
  interferenceId: number,
): Promise<InterferenceInspection[]> {
  const rows = await prisma.interference_inspection.findMany({
    where: { interference_id: interferenceId },
    orderBy: [{ inspected_on: 'desc' }, { id: 'desc' }],
    include: {
      lead: { select: { id: true, username: true, display_name: true } },
      members: {
        include: { member: { select: { id: true, username: true, display_name: true } } },
      },
    },
  });
  return rows.map((row) => shape(row as unknown as Record<string, unknown>));
}

export async function recomputeInterferenceInspectionState(
  interferenceId: number,
  db: DbLike = prisma,
): Promise<void> {
  const count = await db.interference_inspection.count({
    where: { interference_id: interferenceId },
  });
  await db.interference_site.update({
    where: { id: interferenceId },
    data: { status: count > 0 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ' },
  });
}

export async function createInterferenceInspection(
  input: CreateInterferenceInspectionInput,
): Promise<InterferenceInspection> {
  if (input.helperUserIds.length > 5) throw new Error('At most 5 helpers allowed');
  const uniqueHelpers = new Set(input.helperUserIds);
  if (uniqueHelpers.size !== input.helperUserIds.length) {
    throw new Error('Duplicate helpers not allowed');
  }
  if (uniqueHelpers.has(input.leadUserId)) {
    throw new Error('Helpers must not include the lead');
  }
  const inspectedDate = parseInspectedOn(input.inspectedOn);

  const site = await prisma.interference_site.findUnique({ where: { id: input.interferenceId } });
  if (!site) throw new Error('Interference site not found');

  const allUserIds = [input.leadUserId, ...input.helperUserIds];
  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds }, active: true, role: { in: ['admin', 'inspector'] } },
  });
  if (users.length !== allUserIds.length) {
    throw new Error('One or more users are inactive, missing, or not inspectors');
  }

  const existing = await prisma.interference_inspection.findFirst({
    where: {
      interference_id: input.interferenceId,
      inspected_on: inspectedDate,
      lead_user_id: input.leadUserId,
    },
    include: {
      lead: { select: { id: true, username: true, display_name: true } },
      members: {
        include: { member: { select: { id: true, username: true, display_name: true } } },
      },
    },
  });
  if (existing) return shape(existing as unknown as Record<string, unknown>);

  const created = await prisma.$transaction(async (tx) => {
    const ins = await tx.interference_inspection.create({
      data: {
        interference_id: input.interferenceId,
        inspected_on: inspectedDate,
        lead_user_id: input.leadUserId,
        notes: input.notes ?? null,
        source: 'app',
      },
    });
    if (input.helperUserIds.length > 0) {
      await tx.interference_inspection_member.createMany({
        data: input.helperUserIds.map((uid) => ({
          inspection_id: ins.id, user_id: uid, role: 'helper',
        })),
      });
    }
    await recomputeInterferenceInspectionState(input.interferenceId, tx);
    return ins.id;
  });

  const full = await prisma.interference_inspection.findUnique({
    where: { id: created },
    include: {
      lead: { select: { id: true, username: true, display_name: true } },
      members: {
        include: { member: { select: { id: true, username: true, display_name: true } } },
      },
    },
  });
  return shape(full as unknown as Record<string, unknown>);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/interferenceInspectionService.ts
git commit -m "$(cat <<'EOF'
feat(service): add interferenceInspectionService

Mirrors src/services/inspectionService.ts for the INT domain:
createInterferenceInspection (validates: YYYY-MM-DD, max 5 helpers,
no duplicates, helpers⊄{lead}, site exists, users active+inspector;
idempotent on interference_id+inspected_on+lead_user_id);
listInspectionsForInterferenceSite; recomputeInterferenceInspectionState
(sets interference_site.status='ตรวจแล้ว' if any history row exists,
'ยังไม่ตรวจ' otherwise).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Service tests

**Files:**
- Create: `src/__tests__/interference-inspection-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/interference-inspection-service.test.ts`:

```ts
// src/__tests__/interference-inspection-service.test.ts
//
// Mirrors src/__tests__/inspection-service.test.ts for INT.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    interference_site: { findUnique: vi.fn(), update: vi.fn() },
    interference_inspection: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    interference_inspection_member: { createMany: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(async (cb) => cb({
      interference_inspection: {
        create: vi.fn(async () => ({ id: 100 })),
        count: vi.fn(async () => 1),
      },
      interference_inspection_member: { createMany: vi.fn(async () => ({ count: 1 })) },
      interference_site: { update: vi.fn(async () => ({ id: 1 })) },
    })),
  },
}));

import prisma from '@/lib/prisma';
import {
  createInterferenceInspection,
  recomputeInterferenceInspectionState,
} from '@/services/interferenceInspectionService';

beforeEach(() => {
  vi.clearAllMocks();
});

const baseInput = {
  interferenceId: 42,
  inspectedOn: '2026-05-17',
  leadUserId: 3,
  helperUserIds: [] as number[],
};

describe('createInterferenceInspection — validation', () => {
  it('rejects more than 5 helpers', async () => {
    await expect(
      createInterferenceInspection({ ...baseInput, helperUserIds: [4, 5, 6, 7, 8, 9] }),
    ).rejects.toThrow('At most 5 helpers allowed');
  });

  it('rejects duplicate helpers', async () => {
    await expect(
      createInterferenceInspection({ ...baseInput, helperUserIds: [4, 4] }),
    ).rejects.toThrow('Duplicate helpers not allowed');
  });

  it('rejects helpers that include the lead', async () => {
    await expect(
      createInterferenceInspection({ ...baseInput, helperUserIds: [3] }),
    ).rejects.toThrow('Helpers must not include the lead');
  });

  it('rejects bad date format', async () => {
    await expect(
      createInterferenceInspection({ ...baseInput, inspectedOn: '2026/05/17' }),
    ).rejects.toThrow('inspectedOn must use YYYY-MM-DD format');
  });

  it('rejects future date', async () => {
    await expect(
      createInterferenceInspection({ ...baseInput, inspectedOn: '2099-01-01' }),
    ).rejects.toThrow('inspectedOn cannot be in the future');
  });

  it('rejects when site does not exist', async () => {
    vi.mocked(prisma.interference_site.findUnique).mockResolvedValueOnce(null);
    await expect(createInterferenceInspection(baseInput)).rejects.toThrow('Interference site not found');
  });

  it('rejects when a user is inactive or wrong role', async () => {
    vi.mocked(prisma.interference_site.findUnique).mockResolvedValueOnce({ id: 42 } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as never);
    await expect(createInterferenceInspection(baseInput)).rejects.toThrow(
      'One or more users are inactive, missing, or not inspectors',
    );
  });
});

describe('createInterferenceInspection — idempotency', () => {
  it('returns existing row if (interference_id, date, lead) already exists', async () => {
    vi.mocked(prisma.interference_site.findUnique).mockResolvedValueOnce({ id: 42 } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: 3 }] as never);
    vi.mocked(prisma.interference_inspection.findFirst).mockResolvedValueOnce({
      id: 99,
      interference_id: 42,
      inspected_on: new Date('2026-05-17T00:00:00Z'),
      lead_user_id: 3,
      notes: null,
      source: 'app',
      created_at: new Date(),
      lead: { id: 3, username: 'iff', display_name: 'iff' },
      members: [],
    } as never);

    const result = await createInterferenceInspection(baseInput);
    expect(result.id).toBe(99);
    // Confirm we did NOT enter the create-transaction path.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('createInterferenceInspection — happy path', () => {
  it('creates inspection + members + recomputes state', async () => {
    vi.mocked(prisma.interference_site.findUnique).mockResolvedValueOnce({ id: 42 } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 3 }, { id: 6 },
    ] as never);
    vi.mocked(prisma.interference_inspection.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.interference_inspection.findUnique).mockResolvedValueOnce({
      id: 100,
      interference_id: 42,
      inspected_on: new Date('2026-05-17T00:00:00Z'),
      lead_user_id: 3,
      notes: null,
      source: 'app',
      created_at: new Date(),
      lead: { id: 3, username: 'iff', display_name: 'iff' },
      members: [
        { user_id: 6, member: { id: 6, username: 'daf', display_name: 'daf' } },
      ],
    } as never);

    const result = await createInterferenceInspection({
      ...baseInput,
      helperUserIds: [6],
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(result.lead.username).toBe('iff');
    expect(result.helpers).toHaveLength(1);
    expect(result.helpers[0].username).toBe('daf');
  });
});

describe('recomputeInterferenceInspectionState', () => {
  it('sets status="ตรวจแล้ว" when at least one row exists', async () => {
    vi.mocked(prisma.interference_inspection.count).mockResolvedValueOnce(2);
    vi.mocked(prisma.interference_site.update).mockResolvedValueOnce({ id: 42 } as never);
    await recomputeInterferenceInspectionState(42);
    expect(prisma.interference_site.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { status: 'ตรวจแล้ว' },
    });
  });

  it('sets status="ยังไม่ตรวจ" when zero rows exist', async () => {
    vi.mocked(prisma.interference_inspection.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.interference_site.update).mockResolvedValueOnce({ id: 42 } as never);
    await recomputeInterferenceInspectionState(42);
    expect(prisma.interference_site.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { status: 'ยังไม่ตรวจ' },
    });
  });
});
```

- [ ] **Step 2: Run the tests — expect all to pass**

```bash
npx vitest run src/__tests__/interference-inspection-service.test.ts
```

Expected: 12 pass (7 validation + 1 idempotency + 1 happy + 2 recompute = 11; the count is 11 cases). Adjust if your local count differs.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/interference-inspection-service.test.ts
git commit -m "$(cat <<'EOF'
test(service): cover createInterferenceInspection + recompute

Mirrors src/__tests__/inspection-service.test.ts: validation
(helpers count, dupes, self-as-helper, date format, future date,
missing site, inactive users), idempotency (returns existing row
without entering transaction), happy path (transaction creates
inspection + members + calls recompute), and recompute (status
flips between 'ตรวจแล้ว' and 'ยังไม่ตรวจ' based on row count).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: PATCH route — ON + OFF sidecars

**Files:**
- Modify: `src/app/api/interference/[id]/route.ts`
- Create: `src/__tests__/api-interference-toggle.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/api-interference-toggle.test.ts`:

```ts
// src/__tests__/api-interference-toggle.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mintCookie } from './helpers/session';

vi.mock('@/lib/prisma', () => ({
  default: {
    interference_site: { update: vi.fn(), findUnique: vi.fn() },
    interference_inspection: { deleteMany: vi.fn() },
  },
}));

vi.mock('@/services/interferenceService', () => ({
  fetchInterferenceSiteById: vi.fn(),
}));

import prisma from '@/lib/prisma';

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    process.env.SESSION_PASSWORD ?? 'test-session-password-32-chars-or-more!!!';
  vi.clearAllMocks();
});

async function makeReq(body: unknown, cookie?: string): Promise<NextRequest> {
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  headers.set('Content-Type', 'application/json');
  return new NextRequest('http://t/api/interference/42', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/interference/[id] — toggle ON sidecar', () => {
  it('forwards helperUserIds to createInterferenceInspection', async () => {
    vi.mocked(prisma.interference_site.update).mockResolvedValue({ id: 42 } as never);

    const service = await import('@/services/interferenceInspectionService');
    const createSpy = vi
      .spyOn(service, 'createInterferenceInspection')
      .mockResolvedValue({} as never);

    const sessionLib = await import('@/lib/session');
    const getSessionSpy = vi.spyOn(sessionLib, 'getSession').mockResolvedValue({
      userId: 3, username: 'iff', displayName: 'iff', role: 'inspector', issuedAt: Date.now(),
    } as never);

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const { PATCH } = await import('@/app/api/interference/[id]/route');
    const r = await PATCH(
      await makeReq({ status: 'ตรวจแล้ว', helperUserIds: [6, 2] }, c.header),
      { params: Promise.resolve({ id: '42' }) },
    );
    expect(r.status).toBe(200);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      interferenceId: 42,
      leadUserId: 3,
      helperUserIds: [6, 2],
    }));
    createSpy.mockRestore();
    getSessionSpy.mockRestore();
  });

  it('toggle ON still succeeds when createInterferenceInspection throws', async () => {
    vi.mocked(prisma.interference_site.update).mockResolvedValue({ id: 42 } as never);
    const service = await import('@/services/interferenceInspectionService');
    const createSpy = vi
      .spyOn(service, 'createInterferenceInspection')
      .mockRejectedValue(new Error('connection refused') as never);

    const sessionLib = await import('@/lib/session');
    const getSessionSpy = vi.spyOn(sessionLib, 'getSession').mockResolvedValue({
      userId: 3, username: 'iff', displayName: 'iff', role: 'inspector', issuedAt: Date.now(),
    } as never);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const { PATCH } = await import('@/app/api/interference/[id]/route');
    const r = await PATCH(
      await makeReq({ status: 'ตรวจแล้ว' }, c.header),
      { params: Promise.resolve({ id: '42' }) },
    );
    expect(r.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    createSpy.mockRestore();
    getSessionSpy.mockRestore();
  });
});

describe('PATCH /api/interference/[id] — toggle OFF sidecar', () => {
  it('deletes today\'s caller-owned interference_inspection row + recomputes', async () => {
    vi.mocked(prisma.interference_site.update).mockResolvedValue({ id: 42 } as never);
    vi.mocked(prisma.interference_inspection.deleteMany).mockResolvedValue({ count: 1 } as never);
    const service = await import('@/services/interferenceInspectionService');
    const recomputeSpy = vi
      .spyOn(service, 'recomputeInterferenceInspectionState')
      .mockResolvedValue(undefined as never);

    const sessionLib = await import('@/lib/session');
    const getSessionSpy = vi.spyOn(sessionLib, 'getSession').mockResolvedValue({
      userId: 3, username: 'iff', displayName: 'iff', role: 'inspector', issuedAt: Date.now(),
    } as never);

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const { PATCH } = await import('@/app/api/interference/[id]/route');
    const r = await PATCH(
      await makeReq({ status: 'ยังไม่ตรวจ' }, c.header),
      { params: Promise.resolve({ id: '42' }) },
    );
    expect(r.status).toBe(200);
    expect(prisma.interference_inspection.deleteMany).toHaveBeenCalledWith({
      where: {
        interference_id: 42,
        lead_user_id: 3,
        inspected_on: expect.any(Date),
      },
    });
    expect(recomputeSpy).toHaveBeenCalledWith(42);

    recomputeSpy.mockRestore();
    getSessionSpy.mockRestore();
  });

  it('toggle OFF still succeeds when deleteMany throws', async () => {
    vi.mocked(prisma.interference_site.update).mockResolvedValue({ id: 42 } as never);
    vi.mocked(prisma.interference_inspection.deleteMany).mockRejectedValue(
      new Error('connection refused') as never,
    );
    const service = await import('@/services/interferenceInspectionService');
    const recomputeSpy = vi
      .spyOn(service, 'recomputeInterferenceInspectionState')
      .mockResolvedValue(undefined as never);

    const sessionLib = await import('@/lib/session');
    const getSessionSpy = vi.spyOn(sessionLib, 'getSession').mockResolvedValue({
      userId: 3, username: 'iff', displayName: 'iff', role: 'inspector', issuedAt: Date.now(),
    } as never);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const { PATCH } = await import('@/app/api/interference/[id]/route');
    const r = await PATCH(
      await makeReq({ status: 'ยังไม่ตรวจ' }, c.header),
      { params: Promise.resolve({ id: '42' }) },
    );
    expect(r.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();
    expect(recomputeSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    recomputeSpy.mockRestore();
    getSessionSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests — expect 4 failures**

```bash
npx vitest run src/__tests__/api-interference-toggle.test.ts
```

Expected: 4 FAIL — sidecars don't exist yet.

- [ ] **Step 3: Add the ON + OFF sidecars to the route**

In `src/app/api/interference/[id]/route.ts`, at the top of the file (near the existing imports), add:

```ts
import { getSession } from '@/lib/session';
import {
  createInterferenceInspection,
  recomputeInterferenceInspectionState,
} from '@/services/interferenceInspectionService';
```

Then in the PATCH handler, find the existing `const updated = await prisma.interference_site.update(...)` block (around line 97-100). Immediately after the `update` call (before the `return NextResponse.json` at line 102), insert:

```ts
    // Sidecar: when status flips to 'ตรวจแล้ว', record a history row with
    // any tagged teammates. Idempotent on (interference_id, today, lead_user_id),
    // so repeated toggles in the same day are safe.
    if (updateData.status === 'ตรวจแล้ว') {
      try {
        const session = await getSession();
        if (session.userId) {
          await createInterferenceInspection({
            interferenceId: numId,
            inspectedOn: new Date().toISOString().split('T')[0],
            leadUserId: session.userId,
            helperUserIds: Array.isArray(body.helperUserIds)
              ? body.helperUserIds.filter((x: unknown): x is number =>
                  typeof x === 'number' && Number.isInteger(x))
              : [],
          });
        }
      } catch (err) {
        console.warn(`Failed to record interference inspection history for site ${numId}:`, err);
      }
    }

    // Sidecar: when status flips to 'ยังไม่ตรวจ', delete the caller's today
    // row + recompute. Semantic: the toggle is today's action; OFF can only
    // undo today's action.
    if (updateData.status === 'ยังไม่ตรวจ') {
      try {
        const session = await getSession();
        if (session.userId) {
          const today = new Date().toISOString().split('T')[0];
          await prisma.interference_inspection.deleteMany({
            where: {
              interference_id: numId,
              lead_user_id: session.userId,
              inspected_on: new Date(`${today}T00:00:00Z`),
            },
          });
          await recomputeInterferenceInspectionState(numId);
        }
      } catch (err) {
        console.warn(`Failed to delete interference inspection history for site ${numId}:`, err);
      }
    }
```

- [ ] **Step 4: Run the tests — expect 4 PASS**

```bash
npx vitest run src/__tests__/api-interference-toggle.test.ts
```

- [ ] **Step 5: Confirm no regression in any other interference route tests**

```bash
npx vitest run src/__tests__/api-routes.test.ts
```

Expected: same baseline as before (no regression introduced).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/interference/[id]/route.ts src/__tests__/api-interference-toggle.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add INT toggle ON/OFF sidecars to PATCH /api/interference/[id]

ON sidecar mirrors the FM PATCH pattern: calls createInterferenceInspection
with helperUserIds from the request body (idempotent on
interference_id+today+lead). OFF sidecar deletes the caller's today
row + recomputes status. Both sidecars are best-effort (failures log
via console.warn but don't fail the PATCH).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: FieldOpsClient — INT wiring

**Files:**
- Modify: `src/components/field-ops/FieldOpsClient.tsx`

- [ ] **Step 1: Generalize the helper-reset effect**

Find the existing effect (around line 157-158):

```tsx
const fmStationId = selection?.kind === "fm" && selectedStation ? selectedStation.id : null;
useEffect(() => {
  setHelperUserIds(defaultCrew ?? []);
}, [fmStationId, defaultCrew]);
```

Replace with a key that includes BOTH FM and INT selections so default-crew pre-fill fires on either:

```tsx
const selectedTargetKey = selection ? `${selection.kind}-${selection.id}` : null;
useEffect(() => {
  setHelperUserIds(defaultCrew ?? []);
}, [selectedTargetKey, defaultCrew]);
```

- [ ] **Step 2: Extend the INT branch of `handleToggleInspection`**

Find the INT branch inside `handleToggleInspection` (around line 242-253):

```tsx
} else if (selection.kind === "int" && selectedSite) {
  const next = selectedSite.status === "ตรวจแล้ว" ? "ยังไม่ตรวจ" : "ตรวจแล้ว";
  setInterference((all) =>
    all.map((s) => (s.id === selectedSite.id ? { ...s, status: next } : s))
  );
  const res = await fetch(`/api/interference/${selectedSite.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: next }),
  });
  if (!res.ok) throw new Error("Interference update failed");
}
```

Replace with:

```tsx
} else if (selection.kind === "int" && selectedSite) {
  const next = selectedSite.status === "ตรวจแล้ว" ? "ยังไม่ตรวจ" : "ตรวจแล้ว";
  setInterference((all) =>
    all.map((s) => (s.id === selectedSite.id ? { ...s, status: next } : s))
  );
  const res = await fetch(`/api/interference/${selectedSite.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: next,
      ...(next === "ตรวจแล้ว" ? { helperUserIds } : {}),
    }),
  });
  if (!res.ok) throw new Error("Interference update failed");
  if (next === "ตรวจแล้ว") setHelperUserIds(defaultCrew ?? []);
}
```

- [ ] **Step 3: Pass crew props to `<FieldOpsCurrentINT>`**

Find the `<FieldOpsCurrentINT ... />` render (look for the line `<FieldOpsCurrentINT`). Currently the props don't include the crew set. Add:

```tsx
inspectors={inspectors}
currentUser={currentUser}
helperUserIds={helperUserIds}
onHelperUserIdsChange={setHelperUserIds}
```

These four lines drop into the prop list alongside the existing INT-specific props (`onToggleInspection`, `onToggleLawPaper`, etc.).

- [ ] **Step 4: Pass crew props to `<FieldOpsBottomSheet>` (no change required if already passed)**

The bottom sheet already receives `inspectors / currentUser / helperUserIds / onHelperUserIdsChange` for the FM branch. The same instance is reused for INT — no extra prop wiring needed at the client level. The bottom sheet component itself is updated in Task 8.

- [ ] **Step 5: Run the field-ops regression suite**

```bash
npx vitest run src/__tests__/field-ops-current.test.tsx src/__tests__/field-ops-crew-bootstrap.test.tsx
```

Expected: existing pass counts hold (no regression).

- [ ] **Step 6: Commit**

```bash
git add src/components/field-ops/FieldOpsClient.tsx
git commit -m "$(cat <<'EOF'
feat(field-ops): forward helperUserIds + default crew on INT toggle

Three changes to FieldOpsClient:
- Generalize the helper-reset effect via a `${kind}-${id}` key so
  default-crew pre-fill fires on BOTH FM station and INT site
  selection (currently only fires on FM).
- INT branch of handleToggleInspection now forwards helperUserIds
  in the PATCH body on toggle-ON, and resets to defaultCrew on
  success (same pattern as the FM branch).
- Pass inspectors / currentUser / helperUserIds /
  onHelperUserIdsChange to <FieldOpsCurrentINT> so it can render
  its own TeammatePicker (component change in Task 7).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `FieldOpsCurrentINT` — render TeammatePicker

**Files:**
- Modify: `src/components/field-ops/FieldOpsCurrent.tsx`
- Modify: `src/__tests__/field-ops-current.test.tsx`

- [ ] **Step 1: Extend `FieldOpsCurrentINT` props**

In `src/components/field-ops/FieldOpsCurrent.tsx`, find the `FieldOpsCurrentINT` function signature (around line 228-252):

```tsx
export function FieldOpsCurrentINT({
  site,
  coLocated,
  onSelectSite,
  onToggleInspection,
  onToggleLawPaper,
  pending,
  marking = false,
  onStartMarkSource,
  onCancelMarkSource,
  onClearSource,
  onSubmitSourceCoords,
}: {
  site: InterferenceSite;
  coLocated?: InterferenceSite[];
  onSelectSite?: (id: number) => void;
  onToggleInspection: () => void;
  onToggleLawPaper: () => void;
  pending: boolean;
  marking?: boolean;
  onStartMarkSource?: () => void;
  onCancelMarkSource?: () => void;
  onClearSource?: () => void;
  onSubmitSourceCoords?: (lat: number, lng: number) => void;
}) {
```

Add four optional props (mirror `FieldOpsCurrentFM`):

```tsx
export function FieldOpsCurrentINT({
  site,
  coLocated,
  onSelectSite,
  onToggleInspection,
  onToggleLawPaper,
  pending,
  marking = false,
  onStartMarkSource,
  onCancelMarkSource,
  onClearSource,
  onSubmitSourceCoords,
  inspectors,
  currentUser,
  helperUserIds,
  onHelperUserIdsChange,
}: {
  site: InterferenceSite;
  coLocated?: InterferenceSite[];
  onSelectSite?: (id: number) => void;
  onToggleInspection: () => void;
  onToggleLawPaper: () => void;
  pending: boolean;
  marking?: boolean;
  onStartMarkSource?: () => void;
  onCancelMarkSource?: () => void;
  onClearSource?: () => void;
  onSubmitSourceCoords?: (lat: number, lng: number) => void;
  inspectors?: InspectorOption[];
  currentUser?: { id: number; displayName: string };
  helperUserIds?: number[];
  onHelperUserIdsChange?: (helperUserIds: number[]) => void;
}) {
```

- [ ] **Step 2: Render `<TeammatePicker>` under the INSPECT button**

Find the INSPECT `ButtonRow` block (around line 339-361). Immediately after the closing `/>` of the `ButtonRow`, insert the picker (mirrors the FM pattern at line 138-149):

```tsx
      {site.status !== 'ตรวจแล้ว'
        && onHelperUserIdsChange
        && inspectors
        && currentUser && (
        <TeammatePicker
          inspectors={inspectors}
          currentUserId={currentUser.id}
          value={helperUserIds ?? []}
          onChange={onHelperUserIdsChange}
          disabled={pending}
        />
      )}
```

- [ ] **Step 3: Write the failing test**

In `src/__tests__/field-ops-current.test.tsx`, find the existing FM teammate-picker describe block. Append a new describe for INT (mirroring the FM pattern):

```tsx
import { FieldOpsCurrentINT } from '@/components/field-ops/FieldOpsCurrent';
import type { InterferenceSite } from '@/types/interference';

const baseSite: InterferenceSite = {
  id: 42,
  siteCode: 'X-42',
  siteName: 'Test site',
  lat: 14.0,
  long: 100.0,
  mcZone: null,
  changwat: 'นครราชสีมา',
  cellName: null,
  sectorName: null,
  direction: null,
  avgNiCarrier: null,
  dayTime: null,
  nightTime: null,
  sourceLat: null,
  sourceLong: null,
  estimateDistance: null,
  ranking: 'Minor',
  status: 'ยังไม่ตรวจ',
  nbtcArea: null,
  awnContact: null,
  lot: null,
  onSiteScanBy: null,
  onSiteScanDate: null,
  checkRealtime: null,
  sourceLocation1: null,
  sourceLocation2: null,
  cameraModel1: null,
  cameraModel2: null,
  notes: null,
  lawPaperSent: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('FieldOpsCurrentINT — teammate picker', () => {
  it('renders the teammate picker when site is PENDING and all picker props are provided', () => {
    const site: InterferenceSite = { ...baseSite, status: 'ยังไม่ตรวจ' };
    const { getByRole } = render(
      <FieldOpsCurrentINT
        site={site}
        onToggleInspection={vi.fn()}
        onToggleLawPaper={vi.fn()}
        pending={false}
        inspectors={[
          { id: 3, username: 'iff', displayName: 'iff' },
          { id: 6, username: 'daf', displayName: 'daf' },
        ]}
        currentUser={{ id: 3, displayName: 'iff' }}
        helperUserIds={[]}
        onHelperUserIdsChange={vi.fn()}
      />,
    );
    expect(getByRole('button', { name: /\+ tag teammates/i })).toBeTruthy();
  });

  it('does NOT render the teammate picker when site is INSPECTED', () => {
    const site: InterferenceSite = { ...baseSite, status: 'ตรวจแล้ว' };
    const { queryByRole } = render(
      <FieldOpsCurrentINT
        site={site}
        onToggleInspection={vi.fn()}
        onToggleLawPaper={vi.fn()}
        pending={false}
        inspectors={[
          { id: 3, username: 'iff', displayName: 'iff' },
          { id: 6, username: 'daf', displayName: 'daf' },
        ]}
        currentUser={{ id: 3, displayName: 'iff' }}
        helperUserIds={[]}
        onHelperUserIdsChange={vi.fn()}
      />,
    );
    expect(queryByRole('button', { name: /\+ tag teammates/i })).toBeNull();
  });
});
```

If you encounter type errors due to `InterferenceSite` shape mismatches, adjust the `baseSite` fields to match the live type at `src/types/interference.ts` (cast to `never` if fields drift).

- [ ] **Step 4: Run the INT picker tests — expect 2 PASS**

```bash
npx vitest run src/__tests__/field-ops-current.test.tsx -t "FieldOpsCurrentINT — teammate picker"
```

- [ ] **Step 5: Run the whole field-ops-current test file**

```bash
npx vitest run src/__tests__/field-ops-current.test.tsx
```

Expected: existing tests still pass + 2 new = 9 total.

- [ ] **Step 6: Commit**

```bash
git add src/components/field-ops/FieldOpsCurrent.tsx src/__tests__/field-ops-current.test.tsx
git commit -m "$(cat <<'EOF'
feat(field-ops): render TeammatePicker on FieldOpsCurrentINT

Mirrors the FM panel: when the site is PENDING (status !==
'ตรวจแล้ว') and the four crew-related props are provided, render
<TeammatePicker> below the INSPECT button. Two new tests pin the
visibility contract: shown on PENDING, hidden on INSPECTED.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `FieldOpsBottomSheet` — extend picker gate for INT

**Files:**
- Modify: `src/components/field-ops/FieldOpsBottomSheet.tsx`

- [ ] **Step 1: Extend the picker conditional**

Find the existing TeammatePicker conditional (around line 347-360):

```tsx
{isFM && station!.inspection69 !== 'ตรวจแล้ว'
  && onHelperUserIdsChange
  && inspectors
  && currentUser && (
  <div style={{ padding: '0 16px' }}>
    <TeammatePicker
      inspectors={inspectors}
      currentUserId={currentUser.id}
      value={helperUserIds ?? []}
      onChange={onHelperUserIdsChange}
      disabled={pending}
    />
  </div>
)}
```

Replace with a conditional that fires on FM PENDING **or** INT PENDING:

```tsx
{((isFM && station!.inspection69 !== 'ตรวจแล้ว')
  || (isINT && site!.status !== 'ตรวจแล้ว'))
  && onHelperUserIdsChange
  && inspectors
  && currentUser && (
  <div style={{ padding: '0 16px' }}>
    <TeammatePicker
      inspectors={inspectors}
      currentUserId={currentUser.id}
      value={helperUserIds ?? []}
      onChange={onHelperUserIdsChange}
      disabled={pending}
    />
  </div>
)}
```

- [ ] **Step 2: Confirm no regression**

```bash
npx vitest run src/__tests__/field-ops-current.test.tsx src/__tests__/field-ops-crew-bootstrap.test.tsx
```

Expected: same pass counts.

- [ ] **Step 3: Commit**

```bash
git add src/components/field-ops/FieldOpsBottomSheet.tsx
git commit -m "$(cat <<'EOF'
feat(field-ops): show TeammatePicker on INT site in bottom sheet

Extend the picker conditional in FieldOpsBottomSheet so it fires on
INT PENDING (status !== 'ตรวจแล้ว') in addition to the existing
FM PENDING branch. Same picker component, same props, just a wider
trigger condition.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Analytics — UNION ALL aggregations

**Files:**
- Modify: `src/app/api/analytics/inspectors/route.ts`
- Modify: `src/__tests__/api-analytics-inspectors.test.ts`

- [ ] **Step 1: Rewrite the 8 aggregations as raw UNION ALL queries**

In `src/app/api/analytics/inspectors/route.ts`, find the `buildPayload` function's `Promise.all` block (around lines 47-122). Replace the 6 Prisma `.groupBy` calls and 4 `$queryRawUnsafe` calls with 9 raw queries:

```ts
  const [
    users,
    leadYtd,
    leadMonth,
    leadMax,
    memberYtd,
    memberMonth,
    leadMonthly,
    helperMonthly,
    helperMax,
    largestTeamRows,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, role: { in: ['admin', 'inspector'] } },
      select: { id: true, username: true, display_name: true },
      orderBy: { display_name: 'asc' },
    }),
    prisma.$queryRawUnsafe<Array<{ lead_user_id: number; n: number }>>(
      `SELECT lead_user_id, COUNT(*)::int AS n FROM (
         SELECT lead_user_id FROM station_inspection      WHERE inspected_on >= $1
         UNION ALL
         SELECT lead_user_id FROM interference_inspection WHERE inspected_on >= $1
       ) x GROUP BY lead_user_id`,
      yearStart,
    ),
    prisma.$queryRawUnsafe<Array<{ lead_user_id: number; n: number }>>(
      `SELECT lead_user_id, COUNT(*)::int AS n FROM (
         SELECT lead_user_id FROM station_inspection      WHERE inspected_on >= $1
         UNION ALL
         SELECT lead_user_id FROM interference_inspection WHERE inspected_on >= $1
       ) x GROUP BY lead_user_id`,
      monthStart,
    ),
    prisma.$queryRawUnsafe<Array<{ lead_user_id: number; last: Date }>>(
      `SELECT lead_user_id, MAX(inspected_on) AS last FROM (
         SELECT lead_user_id, inspected_on FROM station_inspection
         UNION ALL
         SELECT lead_user_id, inspected_on FROM interference_inspection
       ) x GROUP BY lead_user_id`,
    ),
    prisma.$queryRawUnsafe<Array<{ user_id: number; n: number }>>(
      `SELECT user_id, COUNT(*)::int AS n FROM (
         SELECT m.user_id FROM station_inspection_member m
           JOIN station_inspection i ON i.id = m.inspection_id
          WHERE i.inspected_on >= $1
         UNION ALL
         SELECT m.user_id FROM interference_inspection_member m
           JOIN interference_inspection i ON i.id = m.inspection_id
          WHERE i.inspected_on >= $1
       ) x GROUP BY user_id`,
      yearStart,
    ),
    prisma.$queryRawUnsafe<Array<{ user_id: number; n: number }>>(
      `SELECT user_id, COUNT(*)::int AS n FROM (
         SELECT m.user_id FROM station_inspection_member m
           JOIN station_inspection i ON i.id = m.inspection_id
          WHERE i.inspected_on >= $1
         UNION ALL
         SELECT m.user_id FROM interference_inspection_member m
           JOIN interference_inspection i ON i.id = m.inspection_id
          WHERE i.inspected_on >= $1
       ) x GROUP BY user_id`,
      monthStart,
    ),
    prisma.$queryRawUnsafe<Array<{ month: string; lead_user_id: number; n: number }>>(
      `SELECT to_char(date_trunc('month', inspected_on), 'YYYY-MM') AS month,
              lead_user_id, COUNT(*)::int AS n
         FROM (
           SELECT lead_user_id, inspected_on FROM station_inspection
            WHERE inspected_on >= $1
           UNION ALL
           SELECT lead_user_id, inspected_on FROM interference_inspection
            WHERE inspected_on >= $1
         ) x
        GROUP BY month, lead_user_id`,
      monthGridStart,
    ),
    prisma.$queryRawUnsafe<Array<{ month: string; user_id: number; n: number }>>(
      `SELECT to_char(date_trunc('month', inspected_on), 'YYYY-MM') AS month,
              user_id, COUNT(*)::int AS n
         FROM (
           SELECT m.user_id, i.inspected_on
             FROM station_inspection_member m
             JOIN station_inspection i ON i.id = m.inspection_id
            WHERE i.inspected_on >= $1
           UNION ALL
           SELECT m.user_id, i.inspected_on
             FROM interference_inspection_member m
             JOIN interference_inspection i ON i.id = m.inspection_id
            WHERE i.inspected_on >= $1
         ) x
        GROUP BY month, user_id`,
      monthGridStart,
    ),
    prisma.$queryRawUnsafe<Array<{ user_id: number; last: Date }>>(
      `SELECT user_id, MAX(inspected_on) AS last FROM (
         SELECT m.user_id, i.inspected_on FROM station_inspection_member m
           JOIN station_inspection i ON i.id = m.inspection_id
         UNION ALL
         SELECT m.user_id, i.inspected_on FROM interference_inspection_member m
           JOIN interference_inspection i ON i.id = m.inspection_id
       ) x GROUP BY user_id`,
    ),
    prisma.$queryRawUnsafe<Array<{ id: number; target_type: string; target_id: number; inspected_on: Date; member_count: number }>>(
      `SELECT id, target_type, target_id, inspected_on, member_count FROM (
         SELECT i.id, 'fm' AS target_type, i.station_id AS target_id,
                i.inspected_on,
                (1 + COUNT(m.user_id))::int AS member_count
           FROM station_inspection i
           LEFT JOIN station_inspection_member m ON m.inspection_id = i.id
          WHERE i.inspected_on >= $1
          GROUP BY i.id
         UNION ALL
         SELECT i.id, 'int' AS target_type, i.interference_id AS target_id,
                i.inspected_on,
                (1 + COUNT(m.user_id))::int AS member_count
           FROM interference_inspection i
           LEFT JOIN interference_inspection_member m ON m.inspection_id = i.id
          WHERE i.inspected_on >= $1
          GROUP BY i.id
       ) x
        ORDER BY member_count DESC, inspected_on DESC
        LIMIT 1`,
      yearStart,
    ),
  ]);
```

- [ ] **Step 2: Update the post-aggregation reducers to use the new raw-row shapes**

The `leadYtd` / `leadMonth` / `memberYtd` / `memberMonth` aggregates now come back as `{ lead_user_id, n }` (or `{ user_id, n }`) instead of Prisma's `{ lead_user_id, _count: { _all } }`. Find these lines (around lines 124-130):

```ts
  const leadYtdMap = new Map(leadYtd.map((r) => [r.lead_user_id, r._count._all]));
  const leadMonthMap = new Map(leadMonth.map((r) => [r.lead_user_id, r._count._all]));
  const leadMaxMap = new Map(leadMax.map((r) => [r.lead_user_id, r._max.inspected_on]));
  const memberYtdMap = new Map(memberYtd.map((r) => [r.user_id, r._count._all]));
  const memberMonthMap = new Map(memberMonth.map((r) => [r.user_id, r._count._all]));
  const helperMaxMap = new Map(helperMax.map((r) => [r.user_id, r.last]));
```

Replace with:

```ts
  const leadYtdMap = new Map(leadYtd.map((r) => [r.lead_user_id, Number(r.n)]));
  const leadMonthMap = new Map(leadMonth.map((r) => [r.lead_user_id, Number(r.n)]));
  const leadMaxMap = new Map(leadMax.map((r) => [r.lead_user_id, r.last]));
  const memberYtdMap = new Map(memberYtd.map((r) => [r.user_id, Number(r.n)]));
  const memberMonthMap = new Map(memberMonth.map((r) => [r.user_id, Number(r.n)]));
  const helperMaxMap = new Map(helperMax.map((r) => [r.user_id, r.last]));
```

- [ ] **Step 3: Update the `largestTeamRows` consumer**

The new raw query returns `target_type` + `target_id` instead of the FM-only `station_id`. Find the largestTeam handling (around lines 188-202):

```ts
  let largestTeam: InspectorsAnalytics['kpis']['largestTeam'] = null;
  const top = largestTeamRows[0];
  if (top) {
    const station = await prisma.fm_station.findUnique({
      where: { id_fm: top.station_id },
      select: { name: true },
    });
    largestTeam = {
      inspectionId: top.id,
      stationId: top.station_id,
      stationName: station?.name ?? '(unknown station)',
      inspectedOn: isoDate(top.inspected_on),
      memberCount: Number(top.member_count),
    };
  }
```

Replace with:

```ts
  let largestTeam: InspectorsAnalytics['kpis']['largestTeam'] = null;
  const top = largestTeamRows[0];
  if (top) {
    let stationName = '(unknown)';
    if (top.target_type === 'fm') {
      const fm = await prisma.fm_station.findUnique({
        where: { id_fm: top.target_id },
        select: { name: true },
      });
      stationName = fm?.name ?? '(unknown FM station)';
    } else if (top.target_type === 'int') {
      const intSite = await prisma.interference_site.findUnique({
        where: { id: top.target_id },
        select: { site_name: true, site_code: true },
      });
      stationName = intSite?.site_name ?? intSite?.site_code ?? `(INT site #${top.target_id})`;
    }
    largestTeam = {
      inspectionId: top.id,
      stationId: top.target_id,
      stationName,
      inspectedOn: isoDate(top.inspected_on),
      memberCount: Number(top.member_count),
    };
  }
```

- [ ] **Step 4: Update `mostTaggedHelperThisYear` to use Number(r.n)**

Find the helperTop sort/loop (around lines 204-216):

```ts
  const sortedHelpers = memberYtd.slice().sort((a, b) => b._count._all - a._count._all);
  for (const helperTop of sortedHelpers) {
    const u = userById.get(helperTop.user_id);
    if (u) {
      mostTaggedHelperThisYear = {
        username: u.username,
        displayName: u.display_name,
        count: helperTop._count._all,
      };
      break;
    }
  }
```

Replace with:

```ts
  const sortedHelpers = memberYtd.slice().sort((a, b) => Number(b.n) - Number(a.n));
  for (const helperTop of sortedHelpers) {
    const u = userById.get(helperTop.user_id);
    if (u) {
      mostTaggedHelperThisYear = {
        username: u.username,
        displayName: u.display_name,
        count: Number(helperTop.n),
      };
      break;
    }
  }
```

- [ ] **Step 5: Run the existing analytics tests to see what fixtures break**

```bash
npx vitest run src/__tests__/api-analytics-inspectors.test.ts
```

Expected: the existing tests will FAIL because their `prisma.station_inspection.groupBy` / `prisma.station_inspection_member.groupBy` mocks no longer correspond to actual calls (the route now uses `$queryRawUnsafe` exclusively). The next task fixes those fixtures.

- [ ] **Step 6: Commit (route only)**

```bash
git add src/app/api/analytics/inspectors/route.ts
git commit -m "$(cat <<'EOF'
refactor(analytics): union FM + INT inspections in per-user aggregations

Switch 8 aggregations from Prisma .groupBy to raw $queryRawUnsafe
with UNION ALL across station_inspection and interference_inspection
(plus their member tables). Per-inspector counts now merge FM + INT
into one total. Result payload shape (InspectorsAnalytics) unchanged.

largestTeam handling extends to look up the station/site name from
the right table based on target_type (added to the union output).

Existing tests in api-analytics-inspectors.test.ts will fail until
their mock fixtures are updated to match the new query call shape
(next commit).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Analytics tests — refit fixtures

**Files:**
- Modify: `src/__tests__/api-analytics-inspectors.test.ts`

- [ ] **Step 1: Update the prisma mock surface**

In `src/__tests__/api-analytics-inspectors.test.ts`, find the existing `vi.mock('@/lib/prisma', ...)` block. The route no longer calls `prisma.station_inspection.groupBy` or `prisma.station_inspection_member.groupBy` — both are removed. Add `interference_site.findUnique` since the largestTeam handler now also looks up INT sites. The mock becomes:

```ts
vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findMany: vi.fn() },
    fm_station: { findUnique: vi.fn() },
    interference_site: { findUnique: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  },
}));
```

You can drop the `station_inspection.groupBy` and `station_inspection_member.groupBy` entries.

- [ ] **Step 2: Update each test's mock setup**

The route now calls `$queryRawUnsafe` 9 times in this order:
1. `leadYtd` (returns `{lead_user_id, n}`)
2. `leadMonth` (returns `{lead_user_id, n}`)
3. `leadMax` (returns `{lead_user_id, last}`)
4. `memberYtd` (returns `{user_id, n}`)
5. `memberMonth` (returns `{user_id, n}`)
6. `leadMonthly` (returns `{month, lead_user_id, n}`)
7. `helperMonthly` (returns `{month, user_id, n}`)
8. `helperMax` (returns `{user_id, last}`)
9. `largestTeamRows` (returns `{id, target_type, target_id, inspected_on, member_count}`)

For the existing "aggregates ytdAsLead + ytdAsHelper + monthTotal + lastActive per user" test, the new mock setup becomes:

```ts
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
    ] as never);

    vi.mocked(prisma.$queryRawUnsafe)
      // 1. leadYtd
      .mockResolvedValueOnce([
        { lead_user_id: 3, n: 11 },
        { lead_user_id: 6, n: 4 },
      ] as never)
      // 2. leadMonth
      .mockResolvedValueOnce([
        { lead_user_id: 3, n: 2 },
      ] as never)
      // 3. leadMax
      .mockResolvedValueOnce([
        { lead_user_id: 3, last: new Date('2026-05-10T00:00:00Z') },
        { lead_user_id: 6, last: new Date('2026-04-21T00:00:00Z') },
      ] as never)
      // 4. memberYtd
      .mockResolvedValueOnce([
        { user_id: 3, n: 3 },
        { user_id: 6, n: 5 },
      ] as never)
      // 5. memberMonth (kept empty so chart agrees with groupBy contract from audit Fix 2)
      .mockResolvedValueOnce([] as never)
      // 6. leadMonthly
      .mockResolvedValueOnce([
        { month: '2026-05', lead_user_id: 3, n: 2 },
        { month: '2026-04', lead_user_id: 3, n: 5 },
        { month: '2026-04', lead_user_id: 6, n: 3 },
      ] as never)
      // 7. helperMonthly
      .mockResolvedValueOnce([
        { month: '2026-04', user_id: 6, n: 4 },
        { month: '2026-05', user_id: 3, n: 1 },
      ] as never)
      // 8. helperMax
      .mockResolvedValueOnce([
        { user_id: 3, last: new Date('2026-05-12T00:00:00Z') },
        { user_id: 6, last: new Date('2026-04-25T00:00:00Z') },
      ] as never)
      // 9. largestTeamRows (FM site)
      .mockResolvedValueOnce([
        { id: 42, target_type: 'fm', target_id: 5520014, inspected_on: new Date('2026-04-21T00:00:00Z'), member_count: 3 },
      ] as never);

    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({
      id_fm: 5520014, name: 'กว้างไกล ฟ้าใส',
    } as never);
```

- [ ] **Step 3: Apply analogous fixture updates to the other tests in the file**

There are at least 6 tests in `api-analytics-inspectors.test.ts` (the original audit added cases too). Each needs:
- All `prisma.station_inspection.groupBy` and `prisma.station_inspection_member.groupBy` mocks REMOVED.
- Their data redistributed across the 9 `$queryRawUnsafe` calls in the order above.
- Empty-state tests can use a helper:

```ts
function mockEmpty() {
  vi.mocked(prisma.$queryRawUnsafe)
    .mockResolvedValueOnce([] as never) // 1
    .mockResolvedValueOnce([] as never) // 2
    .mockResolvedValueOnce([] as never) // 3
    .mockResolvedValueOnce([] as never) // 4
    .mockResolvedValueOnce([] as never) // 5
    .mockResolvedValueOnce([] as never) // 6
    .mockResolvedValueOnce([] as never) // 7
    .mockResolvedValueOnce([] as never) // 8
    .mockResolvedValueOnce([] as never); // 9
}
```

Replace any `mockEmptyAggregates()` calls with `mockEmpty()` (or equivalent).

- [ ] **Step 4: Run the analytics tests — expect all to pass**

```bash
npx vitest run src/__tests__/api-analytics-inspectors.test.ts
```

Expected: all tests pass. If any specific test fails, the fixture data may need rebalancing (e.g., `leadMonthly` and `leadMonth` aggregates should be consistent — total `leadMonthly` rows for `month=thisMonth` should sum to the same number as `leadMonth` for the same user).

- [ ] **Step 5: Run the invariant suite + full sweep**

```bash
npx vitest run src/__tests__/analytics-invariants.test.ts
npm test -- --run 2>&1 | tail -8
```

Expected: invariants still pass (mathematical contracts unchanged). Full suite baseline: pre-existing 25 failures only (no new failures from this work).

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/api-analytics-inspectors.test.ts
git commit -m "$(cat <<'EOF'
test(analytics): refit fixtures for UNION ALL aggregation route

The previous commit switched 8 aggregations from prisma.groupBy to
raw $queryRawUnsafe with UNION ALL. The existing test fixtures
mocked the wrong methods and the wrong row shapes.

Drop the station_inspection.groupBy / station_inspection_member.groupBy
mocks (no longer called by the route). Add interference_site.findUnique
to the mock surface. Reorder each test's $queryRawUnsafe mock calls
to match the new 9-query call order. Replace _count._all with plain
{n} fields. Add target_type to largestTeamRows mocks. Keep the
divergence-warn quiet by ensuring chart and groupBy fixtures agree
where they didn't already (audit Fix 2 contract).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Final sweep + manual smoke test

**Files:** (no code changes — verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npm test -- --run 2>&1 | tail -10
```

Expected: pass count covers all newly added tests; failure count stays at the pre-session baseline (the 25-ish failures in components-batch4, intermod-calculator-deep, field-ops-drawer, analytics.test.tsx). Confirm no new failures.

- [ ] **Step 2: Lint pass**

```bash
npm run lint 2>&1 | tail -20
```

Expected: 0 errors. Warnings only in pre-existing files (no new warnings on the INT files).

- [ ] **Step 3: Confirm the dev server still compiles**

```bash
tmux capture-pane -t dev -p | tail -10
```

Expected: `✓ Compiled` line. If a Prisma type error or import error appears, fix it before proceeding.

- [ ] **Step 4: API smoke test — endpoints return correct shape**

With the dev server running, hit the analytics endpoint (the route is session-gated; this confirms it doesn't crash):

```bash
curl -s -o /dev/null -w "GET /api/analytics/inspectors no-cookie: %{http_code}\n" http://localhost:3000/api/analytics/inspectors
```

Expected: 401 (no session). Then log into the dev field-ops in a browser and re-hit with the cookie — confirm 200 + JSON shape matches `InspectorsAnalytics`.

- [ ] **Step 5: Manual UI verification**

Open `http://localhost:3000/field-ops` in the browser:
1. Tap an INT pin → the right rail or bottom sheet shows the INT panel.
2. If the site is PENDING, the `+ tag teammates` chip appears under INSPECT (default crew pre-fills if you have one set).
3. Tap INSPECT. The site flips to INSPECTED; helpers from the picker are attached via the sidecar.
4. Tap INSPECT again (toggle OFF). The site flips back to PENDING; the today row is deleted.
5. Switch to the Analytics tab. The TopPerformer hero card should now reflect the new INT inspection in the YTD total.

- [ ] **Step 6: Optional fix commit (only if verification surfaced anything)**

If a bug surfaces during manual verification, fix inline and commit with a short message:

```bash
git add <files>
git commit -m "$(cat <<'EOF'
fix(int): <one-line description of what verification surfaced>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

If verification was clean, no commit is needed for this task.

---

## Self-Review Notes

- **Spec coverage:** Every spec section maps to one or more tasks:
  - Schema + migration → Task 1.
  - Service layer → Tasks 2-4.
  - PATCH route sidecars → Task 5.
  - UI: FieldOpsClient → Task 6.
  - UI: FieldOpsCurrentINT → Task 7.
  - UI: FieldOpsBottomSheet → Task 8.
  - Analytics UNION refactor → Task 9.
  - Analytics test fixture refit → Task 10.
  - Verification → Task 11.
- **Placeholder scan:** Every code block is complete. Every command has expected output.
- **Type consistency:**
  - `interference_inspection.interference_id` field name is consistent across schema, SQL, service (`interferenceId` in TS), and route (`interferenceId` in createInterferenceInspection input).
  - `interference_inspection_member.user_id` matches the FM equivalent and the raw query column references.
  - `target_type` / `target_id` are used consistently in the largestTeamRows union and its consumer (Step 3 of Task 9).
  - `Number(r.n)` cast applied uniformly to all union-query counts (avoids BigInt issues from PostgreSQL COUNT(*) results).
- **Test ordering matters in Task 10**: the `mockResolvedValueOnce` chain is positional — the 9 queries must be mocked in the exact order the route calls them. Step 2 documents the order explicitly.
- **No schema migration risk:** All new tables; existing FM data untouched. Migration is purely additive.
