# Inspector Tagging + Inspection History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every inspection as a history row with a lead user and tagged helpers, expose it in the station modal, and seed history from the team's Excel report.

**Architecture:** Two new tables (`station_inspection` + `station_inspection_member`) hold the canonical history. The existing `fm_station.date_inspected` and `inspection_69` become derived values, recomputed on every insert/delete via a service-layer helper inside a Prisma transaction. A one-shot Node script seeds 29 rows from `report.xlsx`. UI moves from a single Inspect toggle to a structured "Record inspection" form with date picker and helper checkboxes, plus a collapsible history list.

**Tech Stack:** Next.js 15 App Router (TypeScript), Prisma + PostgreSQL (Neon), iron-session auth, Vitest + Testing Library, `xlsx` for the importer, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-05-13-inspector-tagging-design.md`

---

## File map

**Create:**
- `prisma/migrations/2026-05-13-add-station-inspection/migration.sql`
- `src/types/inspection.ts`
- `src/services/inspectionService.ts`
- `src/app/api/stations/[id]/inspections/route.ts`
- `src/app/api/inspections/[id]/route.ts`
- `src/app/api/users/inspectors/route.ts`
- `scripts/inspector-map.ts`
- `scripts/import-inspections-xlsx.ts`
- `src/components/inspection/InspectorChips.tsx`
- `src/components/inspection/InspectionLatest.tsx`
- `src/components/inspection/InspectionHistoryList.tsx`
- `src/components/inspection/NewInspectionForm.tsx`
- `src/components/inspection/InspectionPanel.tsx`
- `src/__tests__/inspection-service.test.ts`
- `src/__tests__/api-inspections.test.ts`
- `src/__tests__/inspection-import-xlsx.test.ts`
- `src/__tests__/inspection-panel.test.tsx`
- `src/__tests__/new-inspection-form.test.tsx`
- `src/__tests__/field-ops-inspection.test.tsx`

**Modify:**
- `prisma/schema.prisma` — add models + back-relations
- `src/app/api/stations/[id]/route.ts` — drop the auto-stamp of `date_inspected`
- `src/components/map/StationCard.tsx` — replace Inspect toggle with `<InspectionPanel />`
- `src/components/field-ops/FieldOpsBottomSheet.tsx` — render `<InspectionPanel />`
- `src/components/OptimizedFMStationClient.tsx` — add `handleCreateInspection`, fetch `/api/users/inspectors`
- `src/__tests__/api-routes.test.ts` — drop the "auto-stamp date" assertion

**Conventions used (verified against the codebase):**
- Schema changes are applied via `npx prisma db push` (not `prisma migrate dev`). The hand-written migration SQL lives under `prisma/migrations/<date>-<name>/migration.sql` as a record only.
- API routes read the session via `await getSession()` from `@/lib/session`; tests mint cookies with `mintCookie` / `mintAdminCookie` from `src/__tests__/helpers/session`.
- Prisma is mocked in tests via `vi.mock('@/lib/prisma', () => ({ default: { ... } }))`.
- API tests pass `NextRequest` (not `Request`) when handlers use `request.nextUrl`.

---

## Task 1: Schema changes + deactivate `aom`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/2026-05-13-add-station-inspection/migration.sql`

- [ ] **Step 1: Add models and back-relations to `prisma/schema.prisma`**

Add inside the existing schema, after the `user` model:

```prisma
model station_inspection {
  id            Int       @id @default(autoincrement())
  station_id    Int
  inspected_on  DateTime  @db.Date
  lead_user_id  Int
  notes         String?
  source        String    @default("app")
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt

  station fm_station @relation(fields: [station_id], references: [id_fm])
  lead    user       @relation("inspection_lead", fields: [lead_user_id], references: [id])
  members station_inspection_member[]

  @@index([station_id, inspected_on(sort: Desc)])
  @@index([lead_user_id])
  @@unique([station_id, inspected_on, lead_user_id])
}

model station_inspection_member {
  inspection_id Int
  user_id       Int
  role          String  @default("helper")

  inspection station_inspection @relation(fields: [inspection_id], references: [id], onDelete: Cascade)
  member     user               @relation(fields: [user_id], references: [id])

  @@id([inspection_id, user_id])
  @@index([user_id])
}
```

Update `fm_station` — add this single line inside the model:

```prisma
  inspections   station_inspection[]
```

Update `user` — add these two lines inside the model:

```prisma
  inspections_led    station_inspection[]        @relation("inspection_lead")
  inspection_members station_inspection_member[]
```

- [ ] **Step 2: Write the matching migration SQL**

Create `prisma/migrations/2026-05-13-add-station-inspection/migration.sql`:

```sql
-- Adds per-inspection history with lead + helper tagging.
-- fm_station.date_inspected and inspection_69 stay (derived from this table by the app).

CREATE TABLE "station_inspection" (
  "id"            SERIAL PRIMARY KEY,
  "station_id"    INTEGER NOT NULL REFERENCES "fm_station"("id_fm"),
  "inspected_on"  DATE    NOT NULL,
  "lead_user_id"  INTEGER NOT NULL REFERENCES "user"("id"),
  "notes"         TEXT,
  "source"        TEXT    NOT NULL DEFAULT 'app',
  "created_at"    TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "station_inspection_unique"
    UNIQUE ("station_id", "inspected_on", "lead_user_id")
);
CREATE INDEX "station_inspection_station_inspected_on_idx"
  ON "station_inspection" ("station_id", "inspected_on" DESC);
CREATE INDEX "station_inspection_lead_user_id_idx"
  ON "station_inspection" ("lead_user_id");

CREATE TABLE "station_inspection_member" (
  "inspection_id" INTEGER NOT NULL
    REFERENCES "station_inspection"("id") ON DELETE CASCADE,
  "user_id"       INTEGER NOT NULL REFERENCES "user"("id"),
  "role"          TEXT    NOT NULL DEFAULT 'helper',
  PRIMARY KEY ("inspection_id", "user_id")
);
CREATE INDEX "station_inspection_member_user_id_idx"
  ON "station_inspection_member" ("user_id");

-- Deactivate the `aom` placeholder user (no xlsx mapping, never used).
UPDATE "user" SET active = false WHERE username = 'aom';
```

- [ ] **Step 3: Push schema, generate client**

Run:

```bash
npx prisma db push && npx prisma generate
```

Expected: "Your database is now in sync with your Prisma schema." and "Generated Prisma Client".

- [ ] **Step 4: Verify in DB**

Run:

```bash
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{console.log('aom active:', (await p.user.findUnique({where:{username:'aom'}}))?.active);console.log('inspection count:', await p.station_inspection.count());await p.\$disconnect();})()"
```

Expected: `aom active: false` and `inspection count: 0`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/2026-05-13-add-station-inspection
git commit -m "feat(db): add station_inspection + member tables; deactivate aom"
```

---

## Task 2: Types module

**Files:**
- Create: `src/types/inspection.ts`

- [ ] **Step 1: Write the file**

```ts
// src/types/inspection.ts
export interface InspectionMember {
  userId: number;
  username: string;
  displayName: string;
}

export interface StationInspection {
  id: number;
  stationId: number;
  inspectedOn: string;      // YYYY-MM-DD
  lead: InspectionMember;
  helpers: InspectionMember[];
  notes?: string;
  source: string;
  createdAt: string;        // ISO 8601
}

export interface CreateInspectionInput {
  stationId: number;
  inspectedOn: string;      // YYYY-MM-DD
  leadUserId: number;
  helperUserIds: number[];
  notes?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/inspection.ts
git commit -m "feat(types): add StationInspection + CreateInspectionInput"
```

---

## Task 3: Inspection service — failing tests

**Files:**
- Create: `src/__tests__/inspection-service.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/inspection-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    fm_station: { findUnique: vi.fn(), update: vi.fn() },
    user: { findMany: vi.fn() },
    station_inspection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    station_inspection_member: { createMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(async (cb) => cb({
      fm_station: { update: vi.fn() },
      station_inspection: { create: vi.fn(), findFirst: vi.fn(), aggregate: vi.fn(), count: vi.fn(), delete: vi.fn() },
      station_inspection_member: { createMany: vi.fn() },
    })),
  },
}));

import prisma from '@/lib/prisma';
import {
  listInspectionsForStation,
  createInspection,
  deleteInspection,
  recomputeStationInspectionState,
} from '@/services/inspectionService';

beforeEach(() => { vi.clearAllMocks(); });

describe('listInspectionsForStation', () => {
  it('returns inspections newest-first with lead + helpers shaped for the UI', async () => {
    vi.mocked(prisma.station_inspection.findMany).mockResolvedValue([
      {
        id: 10,
        station_id: 5520014,
        inspected_on: new Date('2026-04-03T00:00:00Z'),
        lead_user_id: 3,
        notes: null,
        source: 'xlsx_import_2026_05',
        created_at: new Date('2026-04-03T00:00:00Z'),
        updated_at: new Date('2026-04-03T00:00:00Z'),
        lead: { id: 3, username: 'iff', display_name: 'iff' },
        members: [
          { user_id: 6, role: 'helper', member: { id: 6, username: 'daf', display_name: 'daf' } },
        ],
      },
    ] as never);

    const out = await listInspectionsForStation(5520014);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 10,
      stationId: 5520014,
      inspectedOn: '2026-04-03',
      lead: { userId: 3, username: 'iff', displayName: 'iff' },
      helpers: [{ userId: 6, username: 'daf', displayName: 'daf' }],
      source: 'xlsx_import_2026_05',
    });
    expect(vi.mocked(prisma.station_inspection.findMany).mock.calls[0][0]).toMatchObject({
      where: { station_id: 5520014 },
      orderBy: [{ inspected_on: 'desc' }, { id: 'desc' }],
    });
  });
});

describe('createInspection', () => {
  it('rejects future dates', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await expect(createInspection({
      stationId: 1, inspectedOn: future, leadUserId: 3, helperUserIds: [],
    })).rejects.toThrow(/future/i);
  });

  it('rejects malformed dates', async () => {
    await expect(createInspection({
      stationId: 1, inspectedOn: '2026/04/03', leadUserId: 3, helperUserIds: [],
    })).rejects.toThrow(/format/i);
  });

  it('rejects duplicate helpers and helpers that include the lead', async () => {
    await expect(createInspection({
      stationId: 1, inspectedOn: '2026-04-03', leadUserId: 3, helperUserIds: [6, 6],
    })).rejects.toThrow(/duplicate/i);
    await expect(createInspection({
      stationId: 1, inspectedOn: '2026-04-03', leadUserId: 3, helperUserIds: [3],
    })).rejects.toThrow(/lead/i);
  });

  it('returns existing inspection (idempotent) when one matches station+date+lead', async () => {
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({ id_fm: 1 } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff', active: true, role: 'inspector' },
    ] as never);
    vi.mocked(prisma.station_inspection.findFirst).mockResolvedValue({
      id: 42,
      station_id: 1,
      inspected_on: new Date('2026-04-03T00:00:00Z'),
      lead_user_id: 3,
      notes: null,
      source: 'app',
      created_at: new Date('2026-04-03T00:00:00Z'),
      updated_at: new Date('2026-04-03T00:00:00Z'),
      lead: { id: 3, username: 'iff', display_name: 'iff' },
      members: [],
    } as never);

    const out = await createInspection({
      stationId: 1, inspectedOn: '2026-04-03', leadUserId: 3, helperUserIds: [],
    });
    expect(out.id).toBe(42);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('recomputeStationInspectionState', () => {
  it('sets date_inspected to MAX(inspected_on) and inspection_69 true when rows exist', async () => {
    vi.mocked(prisma.station_inspection.aggregate).mockResolvedValue({
      _max: { inspected_on: new Date('2026-04-21T00:00:00Z') },
    } as never);
    vi.mocked(prisma.station_inspection.count).mockResolvedValue(3 as never);

    await recomputeStationInspectionState(5520014);

    expect(prisma.fm_station.update).toHaveBeenCalledWith({
      where: { id_fm: 5520014 },
      data: { date_inspected: '2026-04-21', inspection_69: true },
    });
  });

  it('clears date_inspected and flips inspection_69 false when no rows remain', async () => {
    vi.mocked(prisma.station_inspection.aggregate).mockResolvedValue({
      _max: { inspected_on: null },
    } as never);
    vi.mocked(prisma.station_inspection.count).mockResolvedValue(0 as never);

    await recomputeStationInspectionState(5520014);

    expect(prisma.fm_station.update).toHaveBeenCalledWith({
      where: { id_fm: 5520014 },
      data: { date_inspected: null, inspection_69: false },
    });
  });
});

describe('deleteInspection', () => {
  it('lets admins delete any inspection and recomputes state', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 7, station_id: 1, lead_user_id: 999,
    } as never);
    vi.mocked(prisma.station_inspection.aggregate).mockResolvedValue({ _max: { inspected_on: null } } as never);
    vi.mocked(prisma.station_inspection.count).mockResolvedValue(0 as never);

    await deleteInspection(7, { userId: 1, username: 'admin', displayName: 'Admin', role: 'admin', issuedAt: 0 });

    expect(prisma.station_inspection.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it('rejects non-admin who is not the lead', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 7, station_id: 1, lead_user_id: 999,
    } as never);

    await expect(deleteInspection(7, {
      userId: 2, username: 'ice', displayName: 'ice', role: 'inspector', issuedAt: 0,
    })).rejects.toThrow(/forbidden/i);
  });
});
```

- [ ] **Step 2: Run tests — must fail (module doesn't exist yet)**

Run:

```bash
npx vitest run src/__tests__/inspection-service.test.ts
```

Expected: failure with "Cannot find module '@/services/inspectionService'".

---

## Task 4: Inspection service — implementation

**Files:**
- Create: `src/services/inspectionService.ts`

- [ ] **Step 1: Write the service**

```ts
// src/services/inspectionService.ts
import prisma from '@/lib/prisma';
import type { SessionData } from '@/lib/session';
import type {
  CreateInspectionInput,
  InspectionMember,
  StationInspection,
} from '@/types/inspection';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateOnlyISO(date: Date): string {
  // The DB column is `DATE` so the JS Date is at 00:00:00Z. Slice first 10 chars.
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

function shape(row: Record<string, unknown>): StationInspection {
  type Row = {
    id: number; station_id: number; inspected_on: Date; lead_user_id: number;
    notes: string | null; source: string; created_at: Date;
    lead: { id: number; username: string; display_name: string };
    members: Array<{ user_id: number; member: { id: number; username: string; display_name: string } }>;
  };
  const r = row as unknown as Row;
  const lead: InspectionMember = {
    userId: r.lead.id, username: r.lead.username, displayName: r.lead.display_name,
  };
  const helpers: InspectionMember[] = r.members.map((m) => ({
    userId: m.member.id, username: m.member.username, displayName: m.member.display_name,
  }));
  return {
    id: r.id,
    stationId: r.station_id,
    inspectedOn: toDateOnlyISO(r.inspected_on),
    lead,
    helpers,
    notes: r.notes ?? undefined,
    source: r.source,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listInspectionsForStation(stationId: number): Promise<StationInspection[]> {
  const rows = await prisma.station_inspection.findMany({
    where: { station_id: stationId },
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

export async function recomputeStationInspectionState(stationId: number): Promise<void> {
  const agg = await prisma.station_inspection.aggregate({
    where: { station_id: stationId },
    _max: { inspected_on: true },
  });
  const count = await prisma.station_inspection.count({ where: { station_id: stationId } });
  const date = agg._max.inspected_on ? toDateOnlyISO(agg._max.inspected_on) : null;
  await prisma.fm_station.update({
    where: { id_fm: stationId },
    data: { date_inspected: date, inspection_69: count > 0 },
  });
}

export async function createInspection(input: CreateInspectionInput): Promise<StationInspection> {
  if (input.helperUserIds.length > 5) throw new Error('At most 5 helpers allowed');
  const uniqueHelpers = new Set(input.helperUserIds);
  if (uniqueHelpers.size !== input.helperUserIds.length) {
    throw new Error('Duplicate helpers not allowed');
  }
  if (uniqueHelpers.has(input.leadUserId)) {
    throw new Error('Helpers must not include the lead');
  }
  const inspectedDate = parseInspectedOn(input.inspectedOn);

  const station = await prisma.fm_station.findUnique({ where: { id_fm: input.stationId } });
  if (!station) throw new Error('Station not found');

  const allUserIds = [input.leadUserId, ...input.helperUserIds];
  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds }, active: true, role: { in: ['admin', 'inspector'] } },
  });
  if (users.length !== allUserIds.length) {
    throw new Error('One or more users are inactive, missing, or not inspectors');
  }

  const existing = await prisma.station_inspection.findFirst({
    where: {
      station_id: input.stationId,
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
    const ins = await tx.station_inspection.create({
      data: {
        station_id: input.stationId,
        inspected_on: inspectedDate,
        lead_user_id: input.leadUserId,
        notes: input.notes ?? null,
        source: 'app',
      },
    });
    if (input.helperUserIds.length > 0) {
      await tx.station_inspection_member.createMany({
        data: input.helperUserIds.map((uid) => ({
          inspection_id: ins.id, user_id: uid, role: 'helper',
        })),
      });
    }
    const agg = await tx.station_inspection.aggregate({
      where: { station_id: input.stationId },
      _max: { inspected_on: true },
    });
    const count = await tx.station_inspection.count({ where: { station_id: input.stationId } });
    await tx.fm_station.update({
      where: { id_fm: input.stationId },
      data: {
        date_inspected: agg._max.inspected_on ? toDateOnlyISO(agg._max.inspected_on) : null,
        inspection_69: count > 0,
      },
    });
    return ins.id;
  });

  const full = await prisma.station_inspection.findUnique({
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

export async function deleteInspection(id: number, actor: SessionData): Promise<number> {
  const row = await prisma.station_inspection.findUnique({ where: { id } });
  if (!row) throw new Error('Inspection not found');
  if (actor.role !== 'admin' && actor.userId !== row.lead_user_id) {
    throw new Error('forbidden');
  }
  await prisma.station_inspection.delete({ where: { id } });
  await recomputeStationInspectionState(row.station_id);
  return row.station_id;
}
```

- [ ] **Step 2: Run tests — must pass**

```bash
npx vitest run src/__tests__/inspection-service.test.ts
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/services/inspectionService.ts src/__tests__/inspection-service.test.ts
git commit -m "feat(service): add inspection service with validation + state recompute"
```

---

## Task 5: API routes — failing tests

**Files:**
- Create: `src/__tests__/api-inspections.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/api-inspections.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mintCookie, mintAdminCookie } from './helpers/session';

vi.mock('@/lib/prisma', () => ({
  default: {
    fm_station: { findUnique: vi.fn(), update: vi.fn() },
    user: { findMany: vi.fn() },
    station_inspection: {
      findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(),
      create: vi.fn(), delete: vi.fn(), aggregate: vi.fn(), count: vi.fn(),
    },
    station_inspection_member: { createMany: vi.fn() },
    $transaction: vi.fn(async (cb) => cb({
      fm_station: { update: vi.fn() },
      station_inspection: { create: vi.fn(async () => ({ id: 100 })), aggregate: vi.fn(), count: vi.fn() },
      station_inspection_member: { createMany: vi.fn() },
    })),
  },
}));

import prisma from '@/lib/prisma';
import { GET as listInspections, POST as createInspectionRoute } from '@/app/api/stations/[id]/inspections/route';
import { DELETE as deleteInspectionRoute } from '@/app/api/inspections/[id]/route';
import { GET as listInspectors } from '@/app/api/users/inspectors/route';

beforeEach(() => { vi.clearAllMocks(); });

async function req(url: string, init?: { method?: string; cookie?: string; body?: unknown }): Promise<NextRequest> {
  const headers = new Headers();
  if (init?.cookie) headers.set('Cookie', init.cookie);
  if (init?.body) headers.set('Content-Type', 'application/json');
  return new NextRequest(url, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
}

const IFF = { userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' as const };

describe('GET /api/stations/:id/inspections', () => {
  it('returns inspections for the station', async () => {
    vi.mocked(prisma.station_inspection.findMany).mockResolvedValue([] as never);
    const c = await mintCookie(IFF);
    const r = await listInspections(
      await req('http://t/api/stations/1/inspections', { cookie: c.header }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json).toEqual({ inspections: [] });
  });
});

describe('POST /api/stations/:id/inspections', () => {
  it('creates an inspection with lead=session user and returns updated station', async () => {
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({ id_fm: 1 } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff', active: true, role: 'inspector' },
      { id: 6, username: 'daf', display_name: 'daf', active: true, role: 'inspector' },
    ] as never);
    vi.mocked(prisma.station_inspection.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 100,
      station_id: 1,
      inspected_on: new Date('2026-05-13T00:00:00Z'),
      lead_user_id: 3, notes: null, source: 'app',
      created_at: new Date('2026-05-13T00:00:00Z'),
      lead: { id: 3, username: 'iff', display_name: 'iff' },
      members: [{ user_id: 6, member: { id: 6, username: 'daf', display_name: 'daf' } }],
    } as never);
    // Final fm_station read for the response payload.
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValueOnce({ id_fm: 1 } as never).mockResolvedValueOnce({
      id_fm: 1, name: 'X', freq: 95.5, lat: 0, long: 0, district: 'A', province: 'B',
      type: '', inspection_68: false, inspection_69: true, on_air: false,
      submit_a_request: true, date_inspected: '2026-05-13', note: null, revoked: false, revoked_note: null, permit: null,
    } as never);

    const c = await mintCookie(IFF);
    const r = await createInspectionRoute(
      await req('http://t/api/stations/1/inspections', {
        method: 'POST', cookie: c.header,
        body: { inspectedOn: '2026-05-13', helperUserIds: [6] },
      }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(r.status).toBe(201);
    const json = await r.json();
    expect(json.inspection).toMatchObject({ id: 100, lead: { userId: 3 } });
    expect(json.station).toMatchObject({ id: 1, dateInspected: '2026-05-13', inspection69: 'ตรวจแล้ว' });
  });

  it('rejects logged-out callers with 401', async () => {
    const r = await createInspectionRoute(
      await req('http://t/api/stations/1/inspections', {
        method: 'POST', body: { inspectedOn: '2026-05-13', helperUserIds: [] },
      }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(r.status).toBe(401);
  });

  it('returns 400 on bad date', async () => {
    const c = await mintCookie(IFF);
    const r = await createInspectionRoute(
      await req('http://t/api/stations/1/inspections', {
        method: 'POST', cookie: c.header,
        body: { inspectedOn: '13-05-2026', helperUserIds: [] },
      }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(r.status).toBe(400);
  });
});

describe('DELETE /api/inspections/:id', () => {
  it('lets the lead delete their own inspection', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 7, station_id: 1, lead_user_id: 3,
    } as never);
    vi.mocked(prisma.station_inspection.aggregate).mockResolvedValue({ _max: { inspected_on: null } } as never);
    vi.mocked(prisma.station_inspection.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({
      id_fm: 1, name: 'X', freq: 95.5, lat: 0, long: 0, district: 'A', province: 'B',
      type: '', inspection_68: false, inspection_69: false, on_air: false,
      submit_a_request: true, date_inspected: null, note: null, revoked: false, revoked_note: null, permit: null,
    } as never);

    const c = await mintCookie(IFF);
    const r = await deleteInspectionRoute(
      await req('http://t/api/inspections/7', { method: 'DELETE', cookie: c.header }),
      { params: Promise.resolve({ id: '7' }) },
    );
    expect(r.status).toBe(200);
  });

  it('returns 403 if not admin and not lead', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 7, station_id: 1, lead_user_id: 999,
    } as never);
    const c = await mintCookie(IFF);
    const r = await deleteInspectionRoute(
      await req('http://t/api/inspections/7', { method: 'DELETE', cookie: c.header }),
      { params: Promise.resolve({ id: '7' }) },
    );
    expect(r.status).toBe(403);
  });

  it('admin can delete any inspection', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 7, station_id: 1, lead_user_id: 999,
    } as never);
    vi.mocked(prisma.station_inspection.aggregate).mockResolvedValue({ _max: { inspected_on: null } } as never);
    vi.mocked(prisma.station_inspection.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({
      id_fm: 1, name: 'X', freq: 95.5, lat: 0, long: 0, district: 'A', province: 'B',
      type: '', inspection_68: false, inspection_69: false, on_air: false,
      submit_a_request: true, date_inspected: null, note: null, revoked: false, revoked_note: null, permit: null,
    } as never);

    const c = await mintAdminCookie();
    const r = await deleteInspectionRoute(
      await req('http://t/api/inspections/7', { method: 'DELETE', cookie: c.header }),
      { params: Promise.resolve({ id: '7' }) },
    );
    expect(r.status).toBe(200);
  });
});

describe('GET /api/users/inspectors', () => {
  it('lists active inspectors + admins sorted by displayName, hides aom (inactive)', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 1, username: 'admin', display_name: 'Admin' },
      { id: 6, username: 'daf', display_name: 'daf' },
      { id: 4, username: 'dao', display_name: 'dao' },
      { id: 2, username: 'ice', display_name: 'ice' },
      { id: 3, username: 'iff', display_name: 'iff' },
    ] as never);

    const c = await mintCookie(IFF);
    const r = await listInspectors(await req('http://t/api/users/inspectors', { cookie: c.header }));
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json.users.map((u: { username: string }) => u.username)).toEqual([
      'admin', 'daf', 'dao', 'ice', 'iff',
    ]);
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]).toMatchObject({
      where: { active: true, role: { in: ['admin', 'inspector'] } },
    });
  });
});
```

- [ ] **Step 2: Run — expect failures (routes don't exist yet)**

```bash
npx vitest run src/__tests__/api-inspections.test.ts
```

Expected: failures with "Cannot find module" for each route.

---

## Task 6: API route — `GET /api/users/inspectors`

**Files:**
- Create: `src/app/api/users/inspectors/route.ts`

- [ ] **Step 1: Write the handler**

```ts
// src/app/api/users/inspectors/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const rows = await prisma.user.findMany({
    where: { active: true, role: { in: ['admin', 'inspector'] } },
    select: { id: true, username: true, display_name: true },
    orderBy: { display_name: 'asc' },
  });
  return NextResponse.json({
    users: rows.map((r) => ({ id: r.id, username: r.username, displayName: r.display_name })),
  });
}
```

- [ ] **Step 2: Run inspector subset of tests**

```bash
npx vitest run src/__tests__/api-inspections.test.ts -t inspectors
```

Expected: 1 passing.

---

## Task 7: API route — `GET/POST /api/stations/:id/inspections`

**Files:**
- Create: `src/app/api/stations/[id]/inspections/route.ts`

- [ ] **Step 1: Write the handler**

```ts
// src/app/api/stations/[id]/inspections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  createInspection,
  listInspectionsForStation,
} from '@/services/inspectionService';
import { fetchFMStationById } from '@/services/stationService';

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { id } = await params;
  const stationId = parseInt(id, 10);
  if (Number.isNaN(stationId)) return badRequest('Invalid station ID');

  const inspections = await listInspectionsForStation(stationId);
  return NextResponse.json({ inspections });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { id } = await params;
  const stationId = parseInt(id, 10);
  if (Number.isNaN(stationId)) return badRequest('Invalid station ID');

  let body: { inspectedOn?: string; helperUserIds?: unknown; notes?: string };
  try { body = await req.json(); } catch { return badRequest('Invalid JSON'); }

  if (typeof body.inspectedOn !== 'string') return badRequest('inspectedOn is required');
  const helpers = Array.isArray(body.helperUserIds) ? body.helperUserIds : [];
  if (!helpers.every((x) => typeof x === 'number' && Number.isInteger(x))) {
    return badRequest('helperUserIds must be an array of integers');
  }

  try {
    const inspection = await createInspection({
      stationId,
      inspectedOn: body.inspectedOn,
      leadUserId: session.userId,
      helperUserIds: helpers as number[],
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });
    const station = await fetchFMStationById(stationId);
    return NextResponse.json({ inspection, station }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return badRequest(msg);
  }
}
```

- [ ] **Step 2: Run station-inspection tests**

```bash
npx vitest run src/__tests__/api-inspections.test.ts -t "POST /api/stations"
```

Expected: 3 passing.

---

## Task 8: API route — `DELETE /api/inspections/:id`

**Files:**
- Create: `src/app/api/inspections/[id]/route.ts`

- [ ] **Step 1: Write the handler**

```ts
// src/app/api/inspections/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { deleteInspection } from '@/services/inspectionService';
import { fetchFMStationById } from '@/services/stationService';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { id } = await params;
  const inspectionId = parseInt(id, 10);
  if (Number.isNaN(inspectionId)) {
    return NextResponse.json({ error: 'Invalid inspection ID' }, { status: 400 });
  }

  try {
    const stationId = await deleteInspection(inspectionId, session);
    const station = await fetchFMStationById(stationId);
    return NextResponse.json({ ok: true, station });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'forbidden') {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
```

- [ ] **Step 2: Run DELETE tests**

```bash
npx vitest run src/__tests__/api-inspections.test.ts -t "DELETE"
```

Expected: 3 passing.

- [ ] **Step 3: Run the entire api-inspections suite**

```bash
npx vitest run src/__tests__/api-inspections.test.ts
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/users/inspectors/route.ts \
        src/app/api/stations/\[id\]/inspections/route.ts \
        src/app/api/inspections/\[id\]/route.ts \
        src/__tests__/api-inspections.test.ts
git commit -m "feat(api): inspection CRUD + inspector list endpoint"
```

---

## Task 9: Strip auto-stamp from `PATCH /api/stations/:id`

**Files:**
- Modify: `src/app/api/stations/[id]/route.ts`
- Modify: `src/__tests__/api-routes.test.ts`

- [ ] **Step 1: Edit the route**

Replace the `inspection_69` branch (currently lines 41–50 in `src/app/api/stations/[id]/route.ts`) with the version below. The new behavior: PATCH still toggles `inspection_69` for back-compat callers, but it does not touch `date_inspected`. A code comment points future readers at the new flow.

```ts
    if (inspection69 !== undefined) {
      // NOTE: date_inspected is now derived from station_inspection rows.
      // PATCH only toggles the legacy boolean for back-compat tooling; UI uses
      // POST /api/stations/:id/inspections to record new inspections.
      updates.inspection_69 = inspection69 === 'ตรวจแล้ว' || inspection69 === true;
    }
```

(Delete the trailing `if (updates.inspection_69) { … } else { … }` block that set `date_inspected`.)

- [ ] **Step 2: Drop the now-stale assertion in `api-routes.test.ts`**

In `src/__tests__/api-routes.test.ts`, find the test block that asserts `date_inspected` is auto-stamped when `inspection_69` flips true (it sets `inspection69: 'ตรวจแล้ว'` and checks that `update` was called with `date_inspected: <today>`). Replace its assertion to verify `date_inspected` is **not** in the update payload.

Search the file:

```bash
grep -n "date_inspected" src/__tests__/api-routes.test.ts
```

For each remaining match in the `PATCH` station tests, change:

```ts
expect.objectContaining({ data: expect.objectContaining({ date_inspected: expect.any(String) }) })
```

to:

```ts
expect.objectContaining({ data: expect.not.objectContaining({ date_inspected: expect.anything() }) })
```

- [ ] **Step 3: Run affected tests**

```bash
npx vitest run src/__tests__/api-routes.test.ts
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stations/\[id\]/route.ts src/__tests__/api-routes.test.ts
git commit -m "refactor(api): stop auto-stamping date_inspected from PATCH"
```

---

## Task 10: Inspector map module

**Files:**
- Create: `scripts/inspector-map.ts`

- [ ] **Step 1: Write the map**

```ts
// scripts/inspector-map.ts
// xlsx ชื่อผู้ตรวจ string (raw, as it appears in cells) → DB username.
// Names with internal whitespace are normalized (\s+ → single space) before lookup.
export const INSPECTOR_MAP: Record<string, string> = {
  'นางสาว ปิยาพัชร เกิดไพบูลย์(เจ้าหน้าที่ตรวจสอบและปฏิบัติการ)': 'iff',
  'พรคุณพระ กิตติวราพล': 'dao',
  'นายภูวกฤต พลชิงชัย (นตป. ก2)': 'admin',
  'นายภควัต ทะสังขา(วก. ก1)': 'ice',
  'นาย ธีราทร ภิรมย์ไกรภักดิ์(ลูกจ้างประจำ)': 'daf',
};

export function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function mapInspectorName(raw: string): string | null {
  const key = normalizeName(raw);
  return INSPECTOR_MAP[key] ?? null;
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/inspector-map.ts
git commit -m "feat(scripts): xlsx inspector name to username mapping"
```

---

## Task 11: xlsx importer — failing tests

**Files:**
- Create: `src/__tests__/inspection-import-xlsx.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/inspection-import-xlsx.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseXlsxRows,
  validateRows,
  type XlsxInspectorRow,
} from '../../scripts/import-inspections-xlsx';

const sampleRow: XlsxInspectorRow = {
  ChkID: '52390',
  'วันที่บันทึก': '02/02/2569',
  'วันที่ตรวจสอบ': '28/01/2569',
  'รหัสสถานี': '05520458',
  'ชื่อสถานี': 'แฟมิลี่ เรดิโอ',
  'ความถี่': '93.2500',
  'จังหวัด': 'จ.ชัยภูมิ',
  'อำเภอ': 'อ.เมืองชัยภูมิ',
  'ตำบล': 'ต.ในเมือง',
  'ชื่อผู้ตรวจ (กสทช.) 1': 'นางสาว ปิยาพัชร  เกิดไพบูลย์(เจ้าหน้าที่ตรวจสอบและปฏิบัติการ)',
  'ชื่อผู้ตรวจ (กสทช.) 2': 'นาย ธีราทร  ภิรมย์ไกรภักดิ์(ลูกจ้างประจำ)',
  'ชื่อผู้ตรวจ (กสทช.) 3': '',
  'ชื่อผู้ตรวจ (กสทช.) 4': '',
};

describe('parseXlsxRows', () => {
  it('converts B.E. dates to C.E. and pulls lead + helpers', () => {
    const parsed = parseXlsxRows([sampleRow]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      chkId: '52390',
      stationId: 5520458,
      inspectedOn: '2026-01-28',
      leadName: 'นางสาว ปิยาพัชร เกิดไพบูลย์(เจ้าหน้าที่ตรวจสอบและปฏิบัติการ)',
      helperNames: ['นาย ธีราทร ภิรมย์ไกรภักดิ์(ลูกจ้างประจำ)'],
    });
  });

  it('emits null stationId when รหัสสถานี is blank (state stations)', () => {
    const blank = { ...sampleRow, 'รหัสสถานี': '' };
    const parsed = parseXlsxRows([blank]);
    expect(parsed[0].stationId).toBeNull();
  });
});

describe('validateRows', () => {
  it('reports unmapped inspector names', () => {
    const row = { ...sampleRow, 'ชื่อผู้ตรวจ (กสทช.) 1': 'นาย ลึกลับ' };
    const parsed = parseXlsxRows([row]);
    const result = validateRows(parsed, {
      existingStationIds: new Set([5520458]),
      mappedUsers: new Map([['daf', 6]]),
    });
    expect(result.unmappedNames).toEqual(['นาย ลึกลับ']);
  });

  it('reports missing stationIds', () => {
    const parsed = parseXlsxRows([sampleRow]);
    const result = validateRows(parsed, {
      existingStationIds: new Set(),
      mappedUsers: new Map([['iff', 3], ['daf', 6]]),
    });
    expect(result.missingStationIds).toEqual([5520458]);
  });

  it('returns no issues when everything maps', () => {
    const parsed = parseXlsxRows([sampleRow]);
    const result = validateRows(parsed, {
      existingStationIds: new Set([5520458]),
      mappedUsers: new Map([['iff', 3], ['daf', 6]]),
    });
    expect(result.unmappedNames).toEqual([]);
    expect(result.missingStationIds).toEqual([]);
    expect(result.rowsToInsert).toHaveLength(1);
    expect(result.rowsToInsert[0]).toMatchObject({
      stationId: 5520458,
      inspectedOn: '2026-01-28',
      leadUserId: 3,
      helperUserIds: [6],
    });
  });

  it('skips rows whose stationId is null (state stations) and reports them', () => {
    const blank = { ...sampleRow, 'รหัสสถานี': '' };
    const parsed = parseXlsxRows([blank]);
    const result = validateRows(parsed, {
      existingStationIds: new Set(),
      mappedUsers: new Map([['iff', 3], ['daf', 6]]),
    });
    expect(result.rowsToInsert).toEqual([]);
    expect(result.skippedNoStationId).toHaveLength(1);
    expect(result.skippedNoStationId[0].chkId).toBe('52390');
  });
});
```

- [ ] **Step 2: Run — expect failure (script doesn't export yet)**

```bash
npx vitest run src/__tests__/inspection-import-xlsx.test.ts
```

Expected: failure.

---

## Task 12: xlsx importer — implementation

**Files:**
- Create: `scripts/import-inspections-xlsx.ts`

- [ ] **Step 1: Write the script**

```ts
// scripts/import-inspections-xlsx.ts
/* eslint-disable no-console */
/**
 * One-shot importer: seeds station_inspection + station_inspection_member from
 * an xlsx report that lists ChkID, inspection date (B.E.), station code, and
 * up to 4 inspector names.
 *
 *   npx tsx scripts/import-inspections-xlsx.ts <path-to.xlsx>           # dry-run
 *   npx tsx scripts/import-inspections-xlsx.ts <path-to.xlsx> --apply   # write
 *
 * Re-runnable: rows are deduped by (station_id, inspected_on, lead_user_id).
 */
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { INSPECTOR_MAP, normalizeName } from './inspector-map';

const IMPORT_SOURCE = 'xlsx_import_2026_05';

export interface XlsxInspectorRow {
  ChkID: string;
  'วันที่บันทึก': string;
  'วันที่ตรวจสอบ': string;
  'รหัสสถานี': string;
  'ชื่อสถานี': string;
  'ความถี่': string;
  'จังหวัด': string;
  'อำเภอ': string;
  'ตำบล': string;
  'ชื่อผู้ตรวจ (กสทช.) 1': string;
  'ชื่อผู้ตรวจ (กสทช.) 2': string;
  'ชื่อผู้ตรวจ (กสทช.) 3': string;
  'ชื่อผู้ตรวจ (กสทช.) 4': string;
}

export interface ParsedRow {
  chkId: string;
  stationId: number | null;
  stationName: string;
  inspectedOn: string;     // YYYY-MM-DD (C.E.)
  leadName: string;
  helperNames: string[];
}

function beToCe(ddmmYYYY: string): string | null {
  const m = ddmmYYYY?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyyBE] = m;
  const ce = parseInt(yyyyBE, 10) - 543;
  return `${ce}-${mm}-${dd}`;
}

export function parseXlsxRows(rows: XlsxInspectorRow[]): ParsedRow[] {
  return rows.map((r) => {
    const stationIdRaw = (r['รหัสสถานี'] ?? '').toString().trim();
    const stationId = stationIdRaw ? parseInt(stationIdRaw, 10) : null;
    const leadName = normalizeName(r['ชื่อผู้ตรวจ (กสทช.) 1'] ?? '');
    const helperNames = [
      r['ชื่อผู้ตรวจ (กสทช.) 2'],
      r['ชื่อผู้ตรวจ (กสทช.) 3'],
      r['ชื่อผู้ตรวจ (กสทช.) 4'],
    ]
      .map((x) => normalizeName(x ?? ''))
      .filter((x) => x.length > 0);
    return {
      chkId: r.ChkID,
      stationId: Number.isFinite(stationId as number) ? (stationId as number) : null,
      stationName: r['ชื่อสถานี'] ?? '',
      inspectedOn: beToCe(r['วันที่ตรวจสอบ']) ?? '',
      leadName,
      helperNames,
    };
  });
}

export interface ValidateContext {
  existingStationIds: Set<number>;
  mappedUsers: Map<string, number>;  // username → user_id
}

export interface RowToInsert {
  chkId: string;
  stationId: number;
  inspectedOn: string;
  leadUserId: number;
  helperUserIds: number[];
}

export interface ValidationResult {
  unmappedNames: string[];
  missingStationIds: number[];
  skippedNoStationId: ParsedRow[];
  rowsToInsert: RowToInsert[];
}

export function validateRows(rows: ParsedRow[], ctx: ValidateContext): ValidationResult {
  const unmapped = new Set<string>();
  const missingIds = new Set<number>();
  const skippedNoStationId: ParsedRow[] = [];
  const rowsToInsert: RowToInsert[] = [];

  for (const row of rows) {
    if (row.stationId === null) { skippedNoStationId.push(row); continue; }
    if (!ctx.existingStationIds.has(row.stationId)) {
      missingIds.add(row.stationId);
      continue;
    }
    const leadUsername = INSPECTOR_MAP[row.leadName];
    if (!leadUsername) { unmapped.add(row.leadName); continue; }
    let allHelpersMapped = true;
    const helperUserIds: number[] = [];
    for (const h of row.helperNames) {
      const u = INSPECTOR_MAP[h];
      if (!u) { unmapped.add(h); allHelpersMapped = false; continue; }
      const uid = ctx.mappedUsers.get(u);
      if (uid === undefined) { unmapped.add(h); allHelpersMapped = false; continue; }
      if (helperUserIds.includes(uid)) continue;
      helperUserIds.push(uid);
    }
    if (!allHelpersMapped) continue;
    const leadUserId = ctx.mappedUsers.get(leadUsername);
    if (leadUserId === undefined) { unmapped.add(row.leadName); continue; }
    rowsToInsert.push({
      chkId: row.chkId,
      stationId: row.stationId,
      inspectedOn: row.inspectedOn,
      leadUserId,
      helperUserIds: helperUserIds.filter((id) => id !== leadUserId),
    });
  }

  return {
    unmappedNames: [...unmapped],
    missingStationIds: [...missingIds],
    skippedNoStationId,
    rowsToInsert,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const xlsxPath = args.find((a) => !a.startsWith('--')) ?? '';
  if (!xlsxPath) {
    console.error('Usage: import-inspections-xlsx.ts <path-to.xlsx> [--apply]');
    process.exit(2);
  }

  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<XlsxInspectorRow>(ws, { defval: '', raw: false });
  const parsed = parseXlsxRows(raw);

  const prisma = new PrismaClient();

  const ids = parsed.map((p) => p.stationId).filter((x): x is number => x !== null);
  const existingStations = await prisma.fm_station.findMany({
    where: { id_fm: { in: ids } },
    select: { id_fm: true },
  });
  const existingStationIds = new Set(existingStations.map((r) => r.id_fm));

  const mappedUsernames = [...new Set(Object.values(INSPECTOR_MAP))];
  const users = await prisma.user.findMany({
    where: { username: { in: mappedUsernames } },
    select: { id: true, username: true },
  });
  const mappedUsers = new Map(users.map((u) => [u.username, u.id]));

  const v = validateRows(parsed, { existingStationIds, mappedUsers });

  console.log(`xlsx rows: ${parsed.length}`);
  console.log(`rowsToInsert: ${v.rowsToInsert.length}`);
  console.log(`unmapped inspector names: ${v.unmappedNames.length}`);
  if (v.unmappedNames.length) console.log(' ', v.unmappedNames);
  console.log(`missing fm_station ids: ${v.missingStationIds.length}`);
  if (v.missingStationIds.length) console.log(' ', v.missingStationIds);
  console.log(`skipped (no station code in xlsx): ${v.skippedNoStationId.length}`);
  for (const r of v.skippedNoStationId) console.log(`  - ChkID ${r.chkId}: ${r.stationName}`);

  if (v.unmappedNames.length > 0) {
    console.error('Aborting: add the unmapped name(s) to scripts/inspector-map.ts then re-run.');
    await prisma.$disconnect();
    process.exit(1);
  }

  if (!apply) {
    console.log('Dry run. Re-run with --apply to write.');
    await prisma.$disconnect();
    return;
  }

  let inserted = 0;
  let skippedDuplicate = 0;
  const affectedStationIds = new Set<number>();

  for (const row of v.rowsToInsert) {
    const existing = await prisma.station_inspection.findFirst({
      where: {
        station_id: row.stationId,
        inspected_on: new Date(`${row.inspectedOn}T00:00:00Z`),
        lead_user_id: row.leadUserId,
      },
    });
    if (existing) { skippedDuplicate++; continue; }
    await prisma.$transaction(async (tx) => {
      const ins = await tx.station_inspection.create({
        data: {
          station_id: row.stationId,
          inspected_on: new Date(`${row.inspectedOn}T00:00:00Z`),
          lead_user_id: row.leadUserId,
          source: IMPORT_SOURCE,
        },
      });
      if (row.helperUserIds.length > 0) {
        await tx.station_inspection_member.createMany({
          data: row.helperUserIds.map((uid) => ({
            inspection_id: ins.id, user_id: uid, role: 'helper',
          })),
        });
      }
    });
    inserted++;
    affectedStationIds.add(row.stationId);
  }

  for (const stationId of affectedStationIds) {
    const agg = await prisma.station_inspection.aggregate({
      where: { station_id: stationId },
      _max: { inspected_on: true },
    });
    const count = await prisma.station_inspection.count({ where: { station_id: stationId } });
    await prisma.fm_station.update({
      where: { id_fm: stationId },
      data: {
        date_inspected: agg._max.inspected_on
          ? agg._max.inspected_on.toISOString().slice(0, 10)
          : null,
        inspection_69: count > 0,
      },
    });
  }

  console.log(`inserted: ${inserted}`);
  console.log(`skipped (duplicate): ${skippedDuplicate}`);
  console.log(`stations whose date_inspected was recomputed: ${affectedStationIds.size}`);
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Run importer tests**

```bash
npx vitest run src/__tests__/inspection-import-xlsx.test.ts
```

Expected: all green.

- [ ] **Step 3: Dry-run against the real xlsx**

```bash
npx tsx scripts/import-inspections-xlsx.ts /Users/deardevx/Downloads/report.xlsx
```

Expected: prints `xlsx rows: 29`, `rowsToInsert: 26`, `skipped (no station code in xlsx): 3`, `unmapped inspector names: 0`, `missing fm_station ids: 0`. (Do **not** pass `--apply` yet — that happens in Task 22 after a Neon branch test.)

- [ ] **Step 4: Commit**

```bash
git add scripts/import-inspections-xlsx.ts src/__tests__/inspection-import-xlsx.test.ts
git commit -m "feat(scripts): xlsx importer for inspection history with dry-run"
```

---

## Task 13: `InspectorChips` component

**Files:**
- Create: `src/components/inspection/InspectorChips.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/inspection/InspectorChips.tsx
import type { InspectionMember } from '@/types/inspection';

interface Props {
  lead: InspectionMember;
  helpers: InspectionMember[];
}

export default function InspectorChips({ lead, helpers }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary"
        title={`Lead inspector: ${lead.displayName}`}
      >
        <span aria-hidden>★</span>{lead.displayName}
      </span>
      {helpers.map((h) => (
        <span
          key={h.userId}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground"
          title={`Helper: ${h.displayName}`}
        >
          {h.displayName}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/inspection/InspectorChips.tsx
git commit -m "feat(ui): InspectorChips display component"
```

---

## Task 14: `InspectionLatest` component

**Files:**
- Create: `src/components/inspection/InspectionLatest.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/inspection/InspectionLatest.tsx
import type { StationInspection } from '@/types/inspection';
import { formatInspectionDate } from '@/utils/mapHelpers';
import InspectorChips from './InspectorChips';

export default function InspectionLatest({ latest }: { latest: StationInspection | null }) {
  if (!latest) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium badge-warning">
        ⏳ <span>ยังไม่ตรวจ</span>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium badge-success">
        ✅ <span>ตรวจแล้ว · {formatInspectionDate(latest.inspectedOn)}</span>
      </div>
      <InspectorChips lead={latest.lead} helpers={latest.helpers} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/inspection/InspectionLatest.tsx
git commit -m "feat(ui): InspectionLatest banner"
```

---

## Task 15: `InspectionHistoryList` component

**Files:**
- Create: `src/components/inspection/InspectionHistoryList.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/inspection/InspectionHistoryList.tsx
'use client';
import { useState } from 'react';
import type { StationInspection } from '@/types/inspection';
import { formatInspectionDate } from '@/utils/mapHelpers';
import InspectorChips from './InspectorChips';

export default function InspectionHistoryList({ history }: { history: StationInspection[] }) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
        aria-expanded={open}
      >
        <span aria-hidden>{open ? '▾' : '▸'}</span>
        History ({history.length})
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1.5">
          {history.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-1 px-2 py-1.5 rounded border border-border/40 bg-muted/20"
            >
              <span className="text-xs text-muted-foreground">
                {formatInspectionDate(row.inspectedOn)}
              </span>
              <InspectorChips lead={row.lead} helpers={row.helpers} />
              {row.notes && (
                <span className="text-xs text-muted-foreground italic">{row.notes}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/inspection/InspectionHistoryList.tsx
git commit -m "feat(ui): InspectionHistoryList collapsible list"
```

---

## Task 16: `NewInspectionForm` — failing test

**Files:**
- Create: `src/__tests__/new-inspection-form.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/new-inspection-form.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NewInspectionForm from '@/components/inspection/NewInspectionForm';

const TODAY = new Date().toISOString().slice(0, 10);

describe('NewInspectionForm', () => {
  it('defaults the date to today and excludes self from helpers', () => {
    render(
      <NewInspectionForm
        currentUserId={3}
        currentUserDisplayName="iff"
        inspectors={[
          { id: 1, username: 'admin', displayName: 'Admin' },
          { id: 3, username: 'iff', displayName: 'iff' },
          { id: 6, username: 'daf', displayName: 'daf' },
        ]}
        onCancel={() => {}}
        onSubmit={vi.fn()}
      />,
    );

    const dateInput = screen.getByLabelText(/วันที่ตรวจ/i) as HTMLInputElement;
    expect(dateInput.value).toBe(TODAY);
    expect(dateInput.max).toBe(TODAY);

    expect(screen.queryByLabelText('iff')).toBeNull();
    expect(screen.getByLabelText('Admin')).toBeTruthy();
    expect(screen.getByLabelText('daf')).toBeTruthy();
  });

  it('submits selected helpers, notes, and date', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <NewInspectionForm
        currentUserId={3}
        currentUserDisplayName="iff"
        inspectors={[
          { id: 6, username: 'daf', displayName: 'daf' },
          { id: 3, username: 'iff', displayName: 'iff' },
        ]}
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByLabelText('daf'));
    fireEvent.change(screen.getByLabelText(/วันที่ตรวจ/i), { target: { value: '2026-04-21' } });
    fireEvent.change(screen.getByLabelText(/หมายเหตุ/i), { target: { value: 'OK' } });
    fireEvent.click(screen.getByRole('button', { name: /บันทึก/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      inspectedOn: '2026-04-21',
      helperUserIds: [6],
      notes: 'OK',
    });
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/__tests__/new-inspection-form.test.tsx
```

Expected: failure (component does not exist).

---

## Task 17: `NewInspectionForm` — implementation

**Files:**
- Create: `src/components/inspection/NewInspectionForm.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/inspection/NewInspectionForm.tsx
'use client';
import { useMemo, useState } from 'react';

export interface InspectorOption {
  id: number;
  username: string;
  displayName: string;
}

interface Props {
  currentUserId: number;
  currentUserDisplayName: string;
  inspectors: InspectorOption[];
  onCancel: () => void;
  onSubmit: (input: {
    inspectedOn: string;
    helperUserIds: number[];
    notes?: string;
  }) => Promise<void>;
}

export default function NewInspectionForm({
  currentUserId,
  currentUserDisplayName,
  inspectors,
  onCancel,
  onSubmit,
}: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [inspectedOn, setInspectedOn] = useState(today);
  const [helperIds, setHelperIds] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const helperOptions = inspectors.filter((u) => u.id !== currentUserId);

  function toggleHelper(id: number) {
    setHelperIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        inspectedOn,
        helperUserIds: [...helperIds],
        notes: notes.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 p-2 rounded border border-border bg-muted/10 space-y-2">
      <label className="block">
        <span className="text-xs font-medium text-foreground">วันที่ตรวจ</span>
        <input
          type="date"
          value={inspectedOn}
          max={today}
          onChange={(e) => setInspectedOn(e.target.value)}
          required
          className="mt-1 block w-full text-sm rounded border border-border bg-background px-2 py-1"
          aria-label="วันที่ตรวจ"
        />
      </label>

      <div>
        <span className="text-xs font-medium text-foreground">หัวหน้าทีม</span>
        <p className="text-xs text-muted-foreground mt-0.5">
          {currentUserDisplayName} (คุณ)
        </p>
      </div>

      {helperOptions.length > 0 && (
        <fieldset>
          <legend className="text-xs font-medium text-foreground">ผู้ร่วมตรวจ</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {helperOptions.map((u) => (
              <label key={u.id} className="inline-flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={helperIds.has(u.id)}
                  onChange={() => toggleHelper(u.id)}
                  aria-label={u.displayName}
                />
                <span>{u.displayName}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="block">
        <span className="text-xs font-medium text-foreground">หมายเหตุ</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full text-xs rounded border border-border bg-background px-2 py-1"
          aria-label="หมายเหตุ"
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-3 py-1.5 text-xs rounded-md bg-muted text-muted-foreground hover:bg-accent"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {submitting ? '...' : 'บันทึก'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/__tests__/new-inspection-form.test.tsx
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/components/inspection/NewInspectionForm.tsx src/__tests__/new-inspection-form.test.tsx
git commit -m "feat(ui): NewInspectionForm with date + helpers + notes"
```

---

## Task 18: `InspectionPanel` — failing test

**Files:**
- Create: `src/__tests__/inspection-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/inspection-panel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InspectionPanel from '@/components/inspection/InspectionPanel';
import type { StationInspection } from '@/types/inspection';

const HISTORY: StationInspection[] = [
  {
    id: 10, stationId: 1, inspectedOn: '2026-04-21', source: 'app',
    lead: { userId: 3, username: 'iff', displayName: 'iff' },
    helpers: [{ userId: 6, username: 'daf', displayName: 'daf' }],
    createdAt: '2026-04-21T00:00:00Z',
  },
  {
    id: 9, stationId: 1, inspectedOn: '2026-02-12', source: 'app',
    lead: { userId: 2, username: 'ice', displayName: 'ice' },
    helpers: [],
    createdAt: '2026-02-12T00:00:00Z',
  },
];

describe('InspectionPanel', () => {
  it('shows latest + collapsed history toggle and opens form on click', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <InspectionPanel
        stationId={1}
        history={HISTORY}
        currentUser={{ id: 3, displayName: 'iff' }}
        inspectors={[
          { id: 3, username: 'iff', displayName: 'iff' },
          { id: 6, username: 'daf', displayName: 'daf' },
        ]}
        onCreate={onCreate}
      />,
    );

    expect(screen.getByText(/ตรวจแล้ว/)).toBeTruthy();
    // Latest helpers visible
    expect(screen.getAllByText('iff').length).toBeGreaterThan(0);
    expect(screen.getAllByText('daf').length).toBeGreaterThan(0);

    // History toggle present
    const toggle = screen.getByRole('button', { name: /History/i });
    fireEvent.click(toggle);
    expect(screen.getByText(/2026-02-12|2026|ก\.พ\./).textContent).toBeTruthy();

    // Open record form
    fireEvent.click(screen.getByRole('button', { name: /Record/i }));
    expect(screen.getByLabelText(/วันที่ตรวจ/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /บันทึก/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/__tests__/inspection-panel.test.tsx
```

Expected: failure (component missing).

---

## Task 19: `InspectionPanel` — implementation

**Files:**
- Create: `src/components/inspection/InspectionPanel.tsx`

- [ ] **Step 1: Write the orchestrator**

```tsx
// src/components/inspection/InspectionPanel.tsx
'use client';
import { useState } from 'react';
import type { StationInspection } from '@/types/inspection';
import InspectionHistoryList from './InspectionHistoryList';
import InspectionLatest from './InspectionLatest';
import NewInspectionForm, { type InspectorOption } from './NewInspectionForm';

interface Props {
  stationId: number;
  history: StationInspection[];
  currentUser: { id: number; displayName: string };
  inspectors: InspectorOption[];
  onCreate: (input: {
    stationId: number;
    inspectedOn: string;
    helperUserIds: number[];
    notes?: string;
  }) => Promise<void>;
}

export default function InspectionPanel({
  stationId, history, currentUser, inspectors, onCreate,
}: Props) {
  const [recording, setRecording] = useState(false);
  const latest = history[0] ?? null;
  const rest = history.slice(1);

  return (
    <div className="mt-2 p-2 rounded-lg border border-border/50 bg-muted/10 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Inspection</span>
        {!recording && (
          <button
            type="button"
            onClick={() => setRecording(true)}
            className="px-3 py-1.5 text-xs rounded-md font-medium bg-secondary text-secondary-foreground hover:bg-accent"
          >
            + Record inspection
          </button>
        )}
      </div>

      <InspectionLatest latest={latest} />

      {rest.length > 0 && <InspectionHistoryList history={rest} />}

      {recording && (
        <NewInspectionForm
          currentUserId={currentUser.id}
          currentUserDisplayName={currentUser.displayName}
          inspectors={inspectors}
          onCancel={() => setRecording(false)}
          onSubmit={async (input) => {
            await onCreate({ stationId, ...input });
            setRecording(false);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run panel tests**

```bash
npx vitest run src/__tests__/inspection-panel.test.tsx
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/components/inspection/InspectionPanel.tsx src/__tests__/inspection-panel.test.tsx
git commit -m "feat(ui): InspectionPanel orchestrator"
```

---

## Task 20: Wire panel into `OptimizedFMStationClient`

**Files:**
- Modify: `src/components/OptimizedFMStationClient.tsx`

- [ ] **Step 1: Add inspector/history fetch state**

Open `src/components/OptimizedFMStationClient.tsx`. Near the other `useState`/`useEffect` blocks at the top of the component, add:

```ts
const [inspectors, setInspectors] = useState<{ id: number; username: string; displayName: string }[]>([]);
const [inspectionHistory, setInspectionHistory] = useState<Record<number, StationInspection[]>>({});

useEffect(() => {
  fetch('/api/users/inspectors')
    .then((r) => (r.ok ? r.json() : { users: [] }))
    .then((j) => setInspectors(j.users ?? []))
    .catch(() => setInspectors([]));
}, []);

async function loadInspectionsFor(stationId: number) {
  const r = await fetch(`/api/stations/${stationId}/inspections`);
  if (!r.ok) return;
  const j = await r.json();
  setInspectionHistory((prev) => ({ ...prev, [stationId]: j.inspections ?? [] }));
}

async function handleCreateInspection(input: {
  stationId: number;
  inspectedOn: string;
  helperUserIds: number[];
  notes?: string;
}) {
  const r = await fetch(`/api/stations/${input.stationId}/inspections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inspectedOn: input.inspectedOn,
      helperUserIds: input.helperUserIds,
      notes: input.notes,
    }),
  });
  if (!r.ok) throw new Error('Failed to record inspection');
  const j = await r.json();
  // Optimistically merge updated FMStation back into stationsRef.
  if (j.station) {
    handleUpdateStation(input.stationId, j.station);
  }
  // Refresh history for this station.
  await loadInspectionsFor(input.stationId);
}
```

Add imports at the top of the file:

```ts
import type { StationInspection } from '@/types/inspection';
```

- [ ] **Step 2: Pass props through to StationCard / FieldOpsBottomSheet**

Find where `StationCard` is rendered and pass:

```tsx
<StationCard
  station={station}
  onUpdateStation={handleUpdateStation}
  inspectors={inspectors}
  inspectionHistory={inspectionHistory[Number(station.id)] ?? []}
  onLoadInspections={() => loadInspectionsFor(Number(station.id))}
  onCreateInspection={handleCreateInspection}
  currentUser={{ id: session.userId, displayName: session.displayName }}
  /* other existing props */
/>
```

If `session` isn't already in scope, read it from the existing session-aware parent (it is already passed in via props from `FMStationsFetcher`). If not, accept new props on `OptimizedFMStationClient` for `currentUser` and pass them through from the server fetcher.

- [ ] **Step 3: Commit**

```bash
git add src/components/OptimizedFMStationClient.tsx
git commit -m "feat(client): fetch inspectors + history, expose create handler"
```

---

## Task 21: Replace Inspect block in `StationCard`

**Files:**
- Modify: `src/components/map/StationCard.tsx`

- [ ] **Step 1: Update props**

Replace the `StationCardProps` interface (around line 8) with:

```ts
interface StationCardProps {
  station: FMStation;
  onUpdateStation?: (stationId: string | number, updates: Partial<FMStation>) => void;
  inspectionHistory?: StationInspection[];
  inspectors?: { id: number; username: string; displayName: string }[];
  currentUser?: { id: number; displayName: string };
  onLoadInspections?: () => void;
  onCreateInspection?: (input: {
    stationId: number; inspectedOn: string; helperUserIds: number[]; notes?: string;
  }) => Promise<void>;
  isMobile?: boolean;
  showStationIndex?: { current: number; total: number };
}
```

Add imports:

```ts
import InspectionPanel from '@/components/inspection/InspectionPanel';
import type { StationInspection } from '@/types/inspection';
import { useEffect } from 'react';
```

- [ ] **Step 2: Delete the legacy Inspect block**

Remove the JSX block that renders the "Inspection Status Row" and "Inspection Date" (lines 150–186 in the current file). Also remove the `loadingInspection69` state and the `handleInspection69Toggle` function (lines 22, 38–50).

- [ ] **Step 3: Render `InspectionPanel`**

After the "On Air Status Row" block, render:

```tsx
{onCreateInspection && currentUser && inspectors && (
  <InspectionPanel
    stationId={Number(station.id)}
    history={inspectionHistory ?? []}
    currentUser={currentUser}
    inspectors={inspectors}
    onCreate={onCreateInspection}
  />
)}
```

Also load history when the card mounts:

```tsx
useEffect(() => {
  onLoadInspections?.();
}, [station.id, onLoadInspections]);
```

- [ ] **Step 4: Run StationCard-related tests**

```bash
npx vitest run src/__tests__/fm-station-client-deep.test.tsx src/__tests__/optimized-client-deep.test.tsx
```

Expected: tests pass. If a test was asserting on the removed Inspect button, edit it to assert on the new `+ Record inspection` button (find by role "button" name `/Record inspection/i`).

- [ ] **Step 5: Commit**

```bash
git add src/components/map/StationCard.tsx \
        src/__tests__/fm-station-client-deep.test.tsx \
        src/__tests__/optimized-client-deep.test.tsx
git commit -m "feat(ui): StationCard renders InspectionPanel instead of toggle"
```

---

## Task 22: Wire into `FieldOpsBottomSheet`

**Files:**
- Modify: `src/components/field-ops/FieldOpsBottomSheet.tsx`
- Create: `src/__tests__/field-ops-inspection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/field-ops-inspection.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FieldOpsBottomSheet from '@/components/field-ops/FieldOpsBottomSheet';

vi.mock('leaflet', () => ({ default: { Icon: vi.fn(), divIcon: vi.fn() } }));
vi.mock('react-leaflet', () => ({}));

describe('FieldOpsBottomSheet — inspection panel', () => {
  it('renders the InspectionPanel for the open station', () => {
    render(
      <FieldOpsBottomSheet
        station={{
          id: 1, name: 'X', frequency: 95.5, latitude: 0, longitude: 0,
          city: 'A', state: 'B', genre: '', inspection69: 'ตรวจแล้ว',
          dateInspected: '2026-04-21', onAir: true,
        } as never}
        inspectionHistory={[]}
        inspectors={[]}
        currentUser={{ id: 3, displayName: 'iff' }}
        onCreateInspection={vi.fn()}
        onLoadInspections={vi.fn()}
        onClose={vi.fn()}
        /* any other props the sheet currently requires */
      />,
    );
    expect(screen.getByRole('button', { name: /Record inspection/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run src/__tests__/field-ops-inspection.test.tsx
```

Expected: failure (props not wired yet).

- [ ] **Step 3: Add props + render to `FieldOpsBottomSheet`**

In `src/components/field-ops/FieldOpsBottomSheet.tsx`, extend the props interface with the same five fields used in `StationCard` (`inspectionHistory`, `inspectors`, `currentUser`, `onLoadInspections`, `onCreateInspection`), import `InspectionPanel`, and render `<InspectionPanel ... />` immediately below the existing `Inspected` `Cell` (the one near line 543). Remove the old `Cell` for `INSPECTED` since the panel now shows the date.

- [ ] **Step 4: Run tests + commit**

```bash
npx vitest run src/__tests__/field-ops-inspection.test.tsx
```

Expected: pass.

```bash
git add src/components/field-ops/FieldOpsBottomSheet.tsx src/__tests__/field-ops-inspection.test.tsx
git commit -m "feat(field-ops): render InspectionPanel in bottom sheet"
```

---

## Task 23: Full test sweep + lint + build

- [ ] **Step 1: Run the whole suite**

```bash
npm test
```

Expected: all green. Fix any newly failing tests by adjusting assertions to the new flow (no `inspection_69` auto-stamp, history-driven date, etc.).

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Coverage check (must stay ≥81%)**

```bash
npm run test:coverage
```

Verify the global summary shows ≥81% statements. If a new file is dragging it down, add a focused unit test for the missing branches.

- [ ] **Step 5: Commit any test/coverage tweaks**

```bash
git add -p
git commit -m "test: cover edge cases revealed by full sweep"
```

(Skip if there's nothing to commit.)

---

## Task 24: Neon branch dry-run, then real import

(This task only runs the importer — no code commit is expected.)

- [ ] **Step 1: Create a Neon branch and point `.env` at it**

Use the team's existing Neon workflow (see `wiki/index.md` if unsure). Note the temporary `DATABASE_URL` for the branch.

- [ ] **Step 2: Apply schema to the branch**

```bash
DATABASE_URL=<branch-url> npx prisma db push
```

Expected: success.

- [ ] **Step 3: Dry-run importer**

```bash
DATABASE_URL=<branch-url> npx tsx scripts/import-inspections-xlsx.ts /Users/deardevx/Downloads/report.xlsx
```

Expected: dry-run output shows 26 rows to insert, 3 skipped (state stations), 0 unmapped, 0 missing.

- [ ] **Step 4: Apply on the branch**

```bash
DATABASE_URL=<branch-url> npx tsx scripts/import-inspections-xlsx.ts /Users/deardevx/Downloads/report.xlsx --apply
```

Expected: `inserted: 26 / skipped (duplicate): 0 / stations whose date_inspected was recomputed: <≤26>`.

- [ ] **Step 5: Sanity-check the branch**

```bash
DATABASE_URL=<branch-url> node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const n=await p.station_inspection.count();const s=await p.fm_station.findUnique({where:{id_fm:5520014}});console.log('count', n);console.log('5520014 date_inspected', s?.date_inspected);await p.\$disconnect();})()"
```

Expected: `count 26`, `5520014 date_inspected 2026-04-03`.

- [ ] **Step 6: Apply on main DB**

Point `.env` back to the production URL.

```bash
npx prisma db push
npx tsx scripts/import-inspections-xlsx.ts /Users/deardevx/Downloads/report.xlsx          # dry-run on prod
npx tsx scripts/import-inspections-xlsx.ts /Users/deardevx/Downloads/report.xlsx --apply  # write to prod
```

Expected: same counts. Re-running the apply step is safe (`skippedDuplicate` will jump to 26).

- [ ] **Step 7: Spot-check via the UI**

Start the dev server:

```bash
npm run dev
```

Visit `http://localhost:3000`, log in, open station `5520014 (กว้างไกล ฟ้าใส)`, confirm the panel shows `Inspected 2026-04-03 · iff + ...` and the history toggle opens. Click **+ Record inspection**, save a new test entry, confirm the panel updates and the new row is in DB.

---

## Self-review notes (run after writing the plan)

- **Spec coverage:** §3 data model → Task 1. §3.3 deactivate `aom` → Task 1 step 2. §4 importer → Tasks 10–12, 24. §5 service + API → Tasks 3–9. §6 UI → Tasks 13–22. §7 testing → tests are colocated with each task; §8 rollout → Tasks 23–24.
- **Placeholders:** none.
- **Type consistency:** `StationInspection` shape matches across `src/types/inspection.ts`, service layer, API responses, and components. `recomputeStationInspectionState` is consistently named in service, importer, and tests. `formatInspectionDate` is reused from existing `src/utils/mapHelpers.ts` (already in the codebase per `src/components/map/StationCard.tsx:5`).
- **YAGNI / scope:** no admin UI for managing inspectors, no per-inspector analytics, no notification system — all explicitly deferred in §2 of the spec.
