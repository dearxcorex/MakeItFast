# Inspector Performance Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Inspectors" section to the existing Analytics tab that surfaces per-user YTD/this-month participation counts (lead + helper), a 12-month total-participation bar chart, per-user lead-vs-helper donuts, and three team KPIs.

**Architecture:** New `GET /api/analytics/inspectors` route aggregates `station_inspection` + `station_inspection_member` rows in a single `Promise.all` and returns a self-contained JSON payload (60-second in-memory cache). A new `<InspectorsSection />` self-fetches that payload, renders three sub-blocks plus a KPI strip with the existing `FoKPI`, `FoBarChart`, `FoDonut` primitives, and is appended once at the bottom of `AnalyticsDashboard.tsx`.

**Tech Stack:** Next.js 15 App Router, Prisma + PostgreSQL (Neon), TypeScript, Vitest + @testing-library/react. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-16-inspector-performance-dashboard-design.md`

**Notable adaptation from spec:** The spec describes a "12-month stacked bar chart per inspector". The existing `FoBarChart` (see `src/components/analytics/charts/FoBarChart.tsx`) renders a simple single-value bar per label and does not support stacking. To avoid scope creep into chart-primitive work, the monthly chart in this plan renders **total participations per month** (one bar per month, sum across all inspectors). Per-user breakdown is already conveyed by the leaderboard table (YTD/month/lead/helper) and the per-user role donuts. The `monthlySeries.perUser` field still ships in the API response so a future PR can swap in a stacked chart without API churn.

---

## File map

**Create:**
- `src/app/api/analytics/inspectors/route.ts` — GET handler with `Promise.all` aggregations + 60s cache.
- `src/components/analytics/InspectorsSection.tsx` — self-fetching section with 4 inline sub-components.
- `src/__tests__/api-analytics-inspectors.test.ts` — route unit tests.
- `src/__tests__/inspectors-section.test.tsx` — component unit tests.

**Modify:**
- `src/types/analytics.ts` — add `InspectorsAnalytics` export.
- `src/components/analytics/AnalyticsDashboard.tsx` — import + render `<InspectorsSection />` once at the end.

**Reuse, no changes:**
- `src/components/analytics/FoKPI.tsx` (props: `label`, `value`, optional `sub`, `accent`, `tone`).
- `src/components/analytics/charts/FoBarChart.tsx` (props: `data: BarDatum[]`, `title`, optional `height`; `BarDatum = { label, v, color?, dim? }`).
- `src/components/analytics/charts/FoDonut.tsx` (props: `segments: DonutSegment[]`, `title`, `centerLabel`, `centerSub`; `DonutSegment = { label, v, c }`).
- `src/lib/session.ts` — `getSession()` used by the route's auth gate.
- `src/lib/prisma.ts` — singleton client used by the route.

**Conventions verified in the codebase:**
- API route tests live in `src/__tests__/`, mock prisma via `vi.mock('@/lib/prisma', () => ({ default: { ... } }))`, mint cookies via `mintCookie` from `src/__tests__/helpers/session.ts`, and pass `NextRequest` (not `Request`) to handlers that read `nextUrl`. See `src/__tests__/api-routes.test.ts` for the pattern.
- Component tests render with `@testing-library/react`, use explicit `afterEach(() => cleanup())`, and mock `fetch` globally via `vi.stubGlobal('fetch', vi.fn())`.
- The existing dashboard reads its data with `useEffect(() => { fetch(...); }, [])` and a `loading`/`error`/`data` triad in state — `InspectorsSection` mirrors that triad.

---

## Task 1: Add `InspectorsAnalytics` type

**Files:**
- Modify: `src/types/analytics.ts`

- [ ] **Step 1: Append the new type**

Open `src/types/analytics.ts`. After the existing `AnalyticsSummary` interface (and any other exports already in the file), append exactly:

```ts
export interface InspectorsAnalytics {
  generatedAt: string;
  thisYear: number;
  thisMonth: string;
  inspectors: Array<{
    userId: number;
    username: string;
    displayName: string;
    ytdTotal: number;
    monthTotal: number;
    ytdAsLead: number;
    ytdAsHelper: number;
    lastActive: string | null;
  }>;
  monthlySeries: Array<{
    month: string;
    perUser: Record<string, number>;
  }>;
  kpis: {
    activeThisMonth: number;
    largestTeam: {
      inspectionId: number;
      stationId: number;
      stationName: string;
      inspectedOn: string;
      memberCount: number;
    } | null;
    mostTaggedHelperThisYear: {
      username: string;
      displayName: string;
      count: number;
    } | null;
  };
}
```

- [ ] **Step 2: Verify build still compiles**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/types/analytics.ts
git commit -m "feat(types): add InspectorsAnalytics type"
```

---

## Task 2: Failing test for `/api/analytics/inspectors`

**Files:**
- Create: `src/__tests__/api-analytics-inspectors.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/api-analytics-inspectors.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mintCookie } from './helpers/session';

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findMany: vi.fn() },
    fm_station: { findUnique: vi.fn() },
    station_inspection: {
      groupBy: vi.fn(),
    },
    station_inspection_member: {
      groupBy: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
  },
}));

import prisma from '@/lib/prisma';
import { GET as getInspectors } from '@/app/api/analytics/inspectors/route';

beforeEach(() => { vi.clearAllMocks(); });

async function req(cookie?: string): Promise<NextRequest> {
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  return new NextRequest('http://t/api/analytics/inspectors', { method: 'GET', headers });
}

function mockEmptyAggregates() {
  vi.mocked(prisma.station_inspection.groupBy).mockResolvedValue([] as never);
  vi.mocked(prisma.station_inspection_member.groupBy).mockResolvedValue([] as never);
  vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([] as never);
  vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);
}

describe('GET /api/analytics/inspectors', () => {
  it('returns 401 without a session', async () => {
    mockEmptyAggregates();
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const r = await getInspectors(await req());
    expect(r.status).toBe(401);
  });

  it('excludes inactive users (aom) from the inspectors list', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
    ] as never);
    mockEmptyAggregates();

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const r = await getInspectors(await req(c.header));
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json.inspectors.map((u: { username: string }) => u.username)).toEqual(['iff', 'daf']);
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]).toMatchObject({
      where: { active: true, role: { in: ['admin', 'inspector'] } },
    });
  });

  it('aggregates ytdAsLead + ytdAsHelper + monthTotal + lastActive per user', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
    ] as never);

    // groupBy calls fire in declared order in the route: ytd-lead, month-lead, ytd-lead-last, then helper queries via $queryRawUnsafe + helper groupBy.
    // The route uses prisma.station_inspection.groupBy twice (ytd-lead count, month-lead count, max-lead-date).
    // We return the three result sets in order via mockResolvedValueOnce.
    vi.mocked(prisma.station_inspection.groupBy)
      .mockResolvedValueOnce([
        { lead_user_id: 3, _count: { _all: 11 } },
        { lead_user_id: 6, _count: { _all: 4 } },
      ] as never)
      .mockResolvedValueOnce([
        { lead_user_id: 3, _count: { _all: 2 } },
      ] as never)
      .mockResolvedValueOnce([
        { lead_user_id: 3, _max: { inspected_on: new Date('2026-05-10T00:00:00Z') } },
        { lead_user_id: 6, _max: { inspected_on: new Date('2026-04-21T00:00:00Z') } },
      ] as never);

    vi.mocked(prisma.station_inspection_member.groupBy)
      .mockResolvedValueOnce([
        { user_id: 3, _count: { _all: 3 } },
        { user_id: 6, _count: { _all: 5 } },
      ] as never)
      .mockResolvedValueOnce([
        { user_id: 6, _count: { _all: 1 } },
      ] as never);

    // $queryRawUnsafe is used for: monthlySeries lead bucket, monthlySeries helper bucket, helper max date, largestTeam.
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([
        { month: '2026-05', lead_user_id: 3, n: 2 },
        { month: '2026-04', lead_user_id: 3, n: 5 },
        { month: '2026-04', lead_user_id: 6, n: 3 },
      ] as never)
      .mockResolvedValueOnce([
        { month: '2026-04', user_id: 6, n: 4 },
        { month: '2026-05', user_id: 3, n: 1 },
      ] as never)
      .mockResolvedValueOnce([
        { user_id: 3, last: new Date('2026-05-12T00:00:00Z') },
        { user_id: 6, last: new Date('2026-04-25T00:00:00Z') },
      ] as never)
      .mockResolvedValueOnce([
        { id: 42, station_id: 5520014, inspected_on: new Date('2026-04-21T00:00:00Z'), member_count: 3 },
      ] as never);

    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({
      id_fm: 5520014, name: 'กว้างไกล ฟ้าใส',
    } as never);

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const r = await getInspectors(await req(c.header));
    expect(r.status).toBe(200);
    const json = await r.json();

    const iff = json.inspectors.find((u: { username: string }) => u.username === 'iff');
    const daf = json.inspectors.find((u: { username: string }) => u.username === 'daf');
    expect(iff).toMatchObject({
      ytdAsLead: 11, ytdAsHelper: 3, ytdTotal: 14, monthTotal: 3, lastActive: '2026-05-12',
    });
    expect(daf).toMatchObject({
      ytdAsLead: 4, ytdAsHelper: 5, ytdTotal: 9, monthTotal: 1, lastActive: '2026-04-25',
    });

    expect(json.monthlySeries).toHaveLength(12);
    expect(json.monthlySeries[11].month).toBe(json.thisMonth);
    expect(json.monthlySeries[11].perUser).toMatchObject({ iff: 3 /* 2 lead + 1 helper */ });

    expect(json.kpis.largestTeam).toMatchObject({
      inspectionId: 42,
      stationId: 5520014,
      stationName: 'กว้างไกล ฟ้าใส',
      inspectedOn: '2026-04-21',
      memberCount: 3,
    });
    expect(json.kpis.activeThisMonth).toBe(1); // only iff had any participation this month
    expect(json.kpis.mostTaggedHelperThisYear).toMatchObject({ username: 'daf', count: 5 });
  });

  it('returns null kpi fields when no data', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
    ] as never);
    mockEmptyAggregates();

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const r = await getInspectors(await req(c.header));
    const json = await r.json();
    expect(json.kpis.largestTeam).toBeNull();
    expect(json.kpis.mostTaggedHelperThisYear).toBeNull();
    expect(json.kpis.activeThisMonth).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect failure (route missing)**

Run: `npx vitest run src/__tests__/api-analytics-inspectors.test.ts`
Expected: `Failed to resolve import "@/app/api/analytics/inspectors/route"`.

Do NOT commit yet.

---

## Task 3: Implement `/api/analytics/inspectors`

**Files:**
- Create: `src/app/api/analytics/inspectors/route.ts`

- [ ] **Step 1: Write the handler**

```ts
// src/app/api/analytics/inspectors/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import type { InspectorsAnalytics } from '@/types/analytics';

// 60-second in-memory cache (singleton). Resets on dev hot-reload and prod redeploy.
let cached: { at: number; payload: InspectorsAnalytics } | null = null;
const CACHE_TTL_MS = 60_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function firstOfYear(year: number): Date {
  return new Date(`${year}-01-01T00:00:00Z`);
}

function firstOfMonth(year: number, monthIndex0: number): Date {
  const mm = String(monthIndex0 + 1).padStart(2, '0');
  return new Date(`${year}-${mm}-01T00:00:00Z`);
}

function ymKey(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}`;
}

function buildMonthGrid(now: Date): string[] {
  // Last 12 months oldest → newest, ending in current month.
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(ymKey(d));
  }
  return out;
}

async function buildPayload(): Promise<InspectorsAnalytics> {
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const yearStart = firstOfYear(thisYear);
  const monthStart = firstOfMonth(thisYear, now.getUTCMonth());
  const monthGrid = buildMonthGrid(now);
  const monthGridStart = new Date(`${monthGrid[0]}-01T00:00:00Z`);

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
    prisma.station_inspection.groupBy({
      by: ['lead_user_id'],
      _count: { _all: true },
      where: { inspected_on: { gte: yearStart } },
    }),
    prisma.station_inspection.groupBy({
      by: ['lead_user_id'],
      _count: { _all: true },
      where: { inspected_on: { gte: monthStart } },
    }),
    prisma.station_inspection.groupBy({
      by: ['lead_user_id'],
      _max: { inspected_on: true },
    }),
    prisma.station_inspection_member.groupBy({
      by: ['user_id'],
      _count: { _all: true },
      where: { inspection: { inspected_on: { gte: yearStart } } },
    }),
    prisma.station_inspection_member.groupBy({
      by: ['user_id'],
      _count: { _all: true },
      where: { inspection: { inspected_on: { gte: monthStart } } },
    }),
    prisma.$queryRawUnsafe<Array<{ month: string; lead_user_id: number; n: number }>>(
      `SELECT to_char(date_trunc('month', inspected_on), 'YYYY-MM') AS month,
              lead_user_id, COUNT(*)::int AS n
         FROM station_inspection
        WHERE inspected_on >= $1
        GROUP BY month, lead_user_id`,
      monthGridStart,
    ),
    prisma.$queryRawUnsafe<Array<{ month: string; user_id: number; n: number }>>(
      `SELECT to_char(date_trunc('month', i.inspected_on), 'YYYY-MM') AS month,
              m.user_id, COUNT(*)::int AS n
         FROM station_inspection_member m
         JOIN station_inspection i ON i.id = m.inspection_id
        WHERE i.inspected_on >= $1
        GROUP BY month, m.user_id`,
      monthGridStart,
    ),
    prisma.$queryRawUnsafe<Array<{ user_id: number; last: Date }>>(
      `SELECT m.user_id, MAX(i.inspected_on) AS last
         FROM station_inspection_member m
         JOIN station_inspection i ON i.id = m.inspection_id
        GROUP BY m.user_id`,
    ),
    prisma.$queryRawUnsafe<Array<{ id: number; station_id: number; inspected_on: Date; member_count: number }>>(
      `SELECT i.id, i.station_id, i.inspected_on,
              (1 + COUNT(m.user_id))::int AS member_count
         FROM station_inspection i
         LEFT JOIN station_inspection_member m ON m.inspection_id = i.id
        WHERE i.inspected_on >= $1
        GROUP BY i.id
        ORDER BY member_count DESC, i.inspected_on DESC
        LIMIT 1`,
      yearStart,
    ),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const leadYtdMap = new Map(leadYtd.map((r) => [r.lead_user_id, r._count._all]));
  const leadMonthMap = new Map(leadMonth.map((r) => [r.lead_user_id, r._count._all]));
  const leadMaxMap = new Map(leadMax.map((r) => [r.lead_user_id, r._max.inspected_on]));
  const memberYtdMap = new Map(memberYtd.map((r) => [r.user_id, r._count._all]));
  const memberMonthMap = new Map(memberMonth.map((r) => [r.user_id, r._count._all]));
  const helperMaxMap = new Map(helperMax.map((r) => [r.user_id, r.last]));

  const inspectors = users.map((u) => {
    const ytdAsLead = leadYtdMap.get(u.id) ?? 0;
    const ytdAsHelper = memberYtdMap.get(u.id) ?? 0;
    const monthAsLead = leadMonthMap.get(u.id) ?? 0;
    const monthAsHelper = memberMonthMap.get(u.id) ?? 0;
    const leadMaxDate = leadMaxMap.get(u.id) ?? null;
    const helperMaxDate = helperMaxMap.get(u.id) ?? null;
    let lastActive: Date | null = null;
    if (leadMaxDate && helperMaxDate) {
      lastActive = leadMaxDate > helperMaxDate ? leadMaxDate : helperMaxDate;
    } else {
      lastActive = leadMaxDate ?? helperMaxDate;
    }
    return {
      userId: u.id,
      username: u.username,
      displayName: u.display_name,
      ytdTotal: ytdAsLead + ytdAsHelper,
      monthTotal: monthAsLead + monthAsHelper,
      ytdAsLead,
      ytdAsHelper,
      lastActive: lastActive ? isoDate(lastActive) : null,
    };
  });
  inspectors.sort((a, b) => b.ytdTotal - a.ytdTotal);

  const monthlySeries = monthGrid.map((month) => {
    const perUser: Record<string, number> = {};
    for (const row of leadMonthly) {
      if (row.month !== month) continue;
      const u = userById.get(row.lead_user_id);
      if (!u) continue;
      perUser[u.username] = (perUser[u.username] ?? 0) + Number(row.n);
    }
    for (const row of helperMonthly) {
      if (row.month !== month) continue;
      const u = userById.get(row.user_id);
      if (!u) continue;
      perUser[u.username] = (perUser[u.username] ?? 0) + Number(row.n);
    }
    return { month, perUser };
  });

  const activeThisMonth = inspectors.filter((i) => i.monthTotal > 0).length;

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

  let mostTaggedHelperThisYear: InspectorsAnalytics['kpis']['mostTaggedHelperThisYear'] = null;
  const helperTop = memberYtd
    .slice()
    .sort((a, b) => b._count._all - a._count._all)[0];
  if (helperTop) {
    const u = userById.get(helperTop.user_id);
    if (u) {
      mostTaggedHelperThisYear = {
        username: u.username,
        displayName: u.display_name,
        count: helperTop._count._all,
      };
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    thisYear,
    thisMonth: ymKey(now),
    inspectors,
    monthlySeries,
    kpis: { activeThisMonth, largestTeam, mostTaggedHelperThisYear },
  };
}

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }
  const payload = await buildPayload();
  cached = { at: Date.now(), payload };
  return NextResponse.json(payload);
}
```

- [ ] **Step 2: Run the new tests — must pass**

Run: `npx vitest run src/__tests__/api-analytics-inspectors.test.ts`
Expected: 4 passing.

If the second test (`aggregates ...`) fails because the cache returns stale data from the first test, reset the cache between tests by re-importing the route. The simplest fix: in `beforeEach`, also `vi.resetModules()` and re-import the GET handler. (Only do this if the test actually fails for that reason.)

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/analytics/inspectors/route.ts src/__tests__/api-analytics-inspectors.test.ts
git commit -m "feat(api): /api/analytics/inspectors aggregation route"
```

---

## Task 4: Failing test for `InspectorsSection`

**Files:**
- Create: `src/__tests__/inspectors-section.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/__tests__/inspectors-section.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import InspectorsSection from '@/components/analytics/InspectorsSection';
import type { InspectorsAnalytics } from '@/types/analytics';

afterEach(() => cleanup());

const SAMPLE: InspectorsAnalytics = {
  generatedAt: '2026-05-16T12:00:00.000Z',
  thisYear: 2026,
  thisMonth: '2026-05',
  inspectors: [
    { userId: 3, username: 'iff', displayName: 'iff', ytdTotal: 14, monthTotal: 3, ytdAsLead: 11, ytdAsHelper: 3, lastActive: '2026-05-12' },
    { userId: 6, username: 'daf', displayName: 'daf', ytdTotal: 9, monthTotal: 1, ytdAsLead: 4, ytdAsHelper: 5, lastActive: '2026-04-25' },
    { userId: 2, username: 'ice', displayName: 'ice', ytdTotal: 7, monthTotal: 0, ytdAsLead: 6, ytdAsHelper: 1, lastActive: '2026-04-21' },
  ],
  monthlySeries: Array.from({ length: 12 }, (_, i) => ({ month: `2025-${String(i + 1).padStart(2, '0')}`, perUser: {} })),
  kpis: {
    activeThisMonth: 2,
    largestTeam: { inspectionId: 42, stationId: 5520014, stationName: 'กว้างไกล ฟ้าใส', inspectedOn: '2026-04-21', memberCount: 3 },
    mostTaggedHelperThisYear: { username: 'daf', displayName: 'daf', count: 5 },
  },
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InspectorsSection', () => {
  it('shows a skeleton while fetching', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {})); // never resolves
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<InspectorsSection />);
    expect(container.textContent).toMatch(/loading|skeleton|\.\.\./i);
  });

  it('renders leaderboard rows in DESC ytdTotal order with KPI strip and donuts', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<InspectorsSection />);

    await waitFor(() => expect(screen.getByText('iff')).toBeTruthy());

    // KPIs
    expect(screen.getByText(/Active inspectors/i)).toBeTruthy();
    expect(screen.getByText(/Largest team/i)).toBeTruthy();
    expect(screen.getByText(/Most-tagged helper/i)).toBeTruthy();

    // Leaderboard: rows in order iff, daf, ice (sorted DESC by ytdTotal)
    const rows = screen.getAllByRole('row');
    // first row is header; data rows follow
    expect(rows[1].textContent).toContain('iff');
    expect(rows[2].textContent).toContain('daf');
    expect(rows[3].textContent).toContain('ice');

    // largestTeam KPI value
    expect(screen.getByText(/กว้างไกล ฟ้าใส/)).toBeTruthy();
  });

  it('shows error banner when fetch fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    render(<InspectorsSection />);
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeTruthy());
  });

  it('shows empty-state when there is no inspection data', async () => {
    const empty: InspectorsAnalytics = {
      ...SAMPLE,
      inspectors: [],
      monthlySeries: SAMPLE.monthlySeries.map((m) => ({ ...m, perUser: {} })),
      kpis: { activeThisMonth: 0, largestTeam: null, mostTaggedHelperThisYear: null },
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => empty });
    vi.stubGlobal('fetch', fetchMock);

    render(<InspectorsSection />);
    await waitFor(() => expect(screen.getByText(/no inspection activity yet/i)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npx vitest run src/__tests__/inspectors-section.test.tsx`
Expected: `Failed to resolve import "@/components/analytics/InspectorsSection"`.

Do NOT commit yet.

---

## Task 5: Implement `InspectorsSection`

**Files:**
- Create: `src/components/analytics/InspectorsSection.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/analytics/InspectorsSection.tsx
'use client';

import { useEffect, useState } from 'react';
import type { InspectorsAnalytics } from '@/types/analytics';
import FoKPI from './FoKPI';
import FoBarChart from './charts/FoBarChart';
import FoDonut from './charts/FoDonut';

// Stable palette for usernames. Falls back to ink for unknown names.
const USER_COLORS: Record<string, string> = {
  admin: '#5d4fff',
  ice: '#1da1c4',
  iff: '#e07b00',
  dao: '#7b5cff',
  daf: '#22a06b',
};
function colorFor(username: string): string {
  return USER_COLORS[username] ?? 'var(--fo-ink)';
}

function daysAgo(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(`${iso}T00:00:00Z`);
  const now = new Date();
  const ms = now.getTime() - then.getTime();
  const days = Math.max(0, Math.floor(ms / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function SectionHeader() {
  return (
    <div style={{ marginTop: 32, marginBottom: 12 }}>
      <div className="fo-mono" style={{ color: 'var(--fo-accent)', letterSpacing: 0.6 }}>
        INSPECTORS
      </div>
      <div className="fo-serif" style={{ fontSize: 22, color: 'var(--fo-ink)' }}>
        Year-to-date team performance
      </div>
    </div>
  );
}

function KpiStrip({ kpis }: { kpis: InspectorsAnalytics['kpis'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
      <FoKPI label="Active inspectors this month" value={kpis.activeThisMonth} />
      <FoKPI
        label="Largest team"
        value={kpis.largestTeam ? `${kpis.largestTeam.memberCount}` : '—'}
        sub={kpis.largestTeam ? `${kpis.largestTeam.stationName} · ${kpis.largestTeam.inspectedOn}` : 'no data'}
      />
      <FoKPI
        label="Most-tagged helper"
        value={kpis.mostTaggedHelperThisYear ? kpis.mostTaggedHelperThisYear.displayName : '—'}
        sub={kpis.mostTaggedHelperThisYear ? `${kpis.mostTaggedHelperThisYear.count} helper assists this year` : 'no data'}
      />
    </div>
  );
}

function LeaderboardTable({ inspectors }: { inspectors: InspectorsAnalytics['inspectors'] }) {
  const top = inspectors[0];
  return (
    <div style={{ overflowX: 'auto', marginBottom: 24 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--fo-body)' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--fo-line)' }}>
            <th style={{ padding: '8px 12px' }}>Inspector</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>YTD total</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>This month</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>As lead</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>As helper</th>
            <th style={{ padding: '8px 12px' }}>Last active</th>
          </tr>
        </thead>
        <tbody>
          {inspectors.map((u) => (
            <tr key={u.userId} style={{ borderBottom: '1px solid var(--fo-line)' }}>
              <td style={{ padding: '8px 12px' }}>
                {top && u.userId === top.userId && u.ytdTotal > 0 && (
                  <span style={{ color: '#ffd24a', marginRight: 4 }} aria-hidden>★</span>
                )}
                {u.displayName}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{u.ytdTotal}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{u.monthTotal}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{u.ytdAsLead}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>{u.ytdAsHelper}</td>
              <td style={{ padding: '8px 12px' }}>{daysAgo(u.lastActive)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyParticipationChart({ series }: { series: InspectorsAnalytics['monthlySeries'] }) {
  const data = series.map((m) => ({
    label: m.month.slice(2), // "25-06" style — compact
    v: Object.values(m.perUser).reduce((s, n) => s + n, 0),
    color: 'var(--fo-accent)',
  }));
  return (
    <div style={{ marginBottom: 24 }}>
      <FoBarChart data={data} title="Participations per month (last 12)" />
    </div>
  );
}

function PerUserRoleDonuts({ inspectors }: { inspectors: InspectorsAnalytics['inspectors'] }) {
  const withActivity = inspectors.filter((u) => u.ytdTotal > 0);
  if (withActivity.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {withActivity.map((u) => (
        <FoDonut
          key={u.userId}
          title={u.displayName}
          segments={[
            { label: 'Lead', v: u.ytdAsLead, c: colorFor(u.username) },
            { label: 'Helper', v: u.ytdAsHelper, c: 'var(--fo-line)' },
          ]}
          centerLabel={`${u.ytdTotal}`}
          centerSub="YTD"
        />
      ))}
    </div>
  );
}

export default function InspectorsSection() {
  const [data, setData] = useState<InspectorsAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/analytics/inspectors');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as InspectorsAnalytics;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'unknown');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <section>
        <SectionHeader />
        <div className="fo-mono" style={{ padding: 12, border: '1px solid var(--fo-crit)', color: 'var(--fo-crit)', borderRadius: 8 }}>
          Failed to load inspector analytics ({error}).
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section>
        <SectionHeader />
        <div className="fo-mono" style={{ padding: 12, color: 'var(--fo-rail-mute)' }}>
          Loading...
        </div>
      </section>
    );
  }

  const hasAnyActivity = data.inspectors.some((u) => u.ytdTotal > 0)
    || data.monthlySeries.some((m) => Object.keys(m.perUser).length > 0);

  if (!hasAnyActivity) {
    return (
      <section>
        <SectionHeader />
        <div className="fo-mono" style={{ padding: 12, color: 'var(--fo-rail-mute)' }}>
          No inspection activity yet.
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader />
      <KpiStrip kpis={data.kpis} />
      <LeaderboardTable inspectors={data.inspectors} />
      <MonthlyParticipationChart series={data.monthlySeries} />
      <PerUserRoleDonuts inspectors={data.inspectors} />
    </section>
  );
}
```

- [ ] **Step 2: Run the component tests — must pass**

Run: `npx vitest run src/__tests__/inspectors-section.test.tsx`
Expected: 4 passing.

If a test fails because the `FoBarChart` or `FoDonut` requires a DOM-measured width that returns 0 in jsdom, the chart still renders its SVG and the section's textual content remains the assertion target — the tests above only check text content, not chart geometry. If a chart import crashes in jsdom, add `vi.mock('@/components/analytics/charts/FoBarChart', () => ({ default: () => null }))` and `vi.mock('@/components/analytics/charts/FoDonut', () => ({ default: () => null }))` at the top of the test file (mirroring existing leaflet mocks elsewhere in the project).

- [ ] **Step 3: Commit**

```bash
git add src/components/analytics/InspectorsSection.tsx src/__tests__/inspectors-section.test.tsx
git commit -m "feat(analytics): InspectorsSection with leaderboard, chart, donuts"
```

---

## Task 6: Wire `InspectorsSection` into `AnalyticsDashboard`

**Files:**
- Modify: `src/components/analytics/AnalyticsDashboard.tsx`

- [ ] **Step 1: Add the import**

At the top of `src/components/analytics/AnalyticsDashboard.tsx`, after the existing import block, add:

```ts
import InspectorsSection from './InspectorsSection';
```

- [ ] **Step 2: Render `<InspectorsSection />` at the end of the dashboard's output**

Find the closing JSX tag of the outermost wrapper of `AnalyticsDashboard` (the root `<div>` or `<section>` that wraps every existing chart). Immediately before that closing tag, add:

```tsx
        <InspectorsSection />
```

Match the indentation of the existing sibling sections in that wrapper.

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Run the full vitest suite**

Run: `npx vitest run 2>&1 | tail -10`
Expected: no NEW failures compared to the baseline. (Baseline failures live in `components-batch4`, `intermod-calculator-deep`, `field-ops-drawer`, `analytics`.)

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/AnalyticsDashboard.tsx
git commit -m "feat(analytics): mount InspectorsSection inside Analytics tab"
```

---

## Task 7: Lint + smoke notes (no commit unless lint changes)

- [ ] **Step 1: Lint**

Run: `npm run lint 2>&1 | tail -10`
Expected: 0 errors. New files contribute 0 new warnings.

- [ ] **Step 2: Manual smoke (recorded as a note, not executed in CI)**

Start dev server: `npm run dev`. Visit the app, open the Analytics tab, scroll to the bottom. Confirm:

1. The "INSPECTORS / Year-to-date team performance" header appears.
2. KPI strip shows 3 cards with correct numbers ("Active inspectors this month", "Largest team", "Most-tagged helper").
3. Leaderboard table lists active inspectors sorted DESC by YTD total, with `★` next to the top inspector when their total > 0.
4. Monthly participation bar chart renders 12 bars.
5. Per-user donuts render only for inspectors with YTD activity.
6. With a fresh DB (no inspections), the section gracefully shows the "No inspection activity yet" message.

- [ ] **Step 3: No commit if lint and smoke are clean.**

---

## Self-review notes (run after writing the plan)

- **Spec coverage:**
  - §3.1 KPI strip → Task 5 (`KpiStrip` sub-component).
  - §3.2 Leaderboard → Task 5 (`LeaderboardTable`).
  - §3.3 Monthly chart → Task 5 (`MonthlyParticipationChart`) — **deviation noted in the plan header**: shows team total per month rather than stacked-by-user, because `FoBarChart` doesn't support stacking. Per-user data still ships in the API for a future stacked variant.
  - §3.4 Per-user donuts → Task 5 (`PerUserRoleDonuts`).
  - §4 Backend (route, response shape, queries, cache, no source filter) → Tasks 2-3.
  - §5 Frontend (self-fetching section, file-local sub-components, loading/error/empty states) → Tasks 4-5.
  - §6 Testing → Tasks 2 + 4 (failing tests) and Tasks 3 + 5 (greens).
  - §7 Rollout → Task ordering matches; Task 7 covers lint + smoke.
- **Placeholders:** none.
- **Type consistency:** `InspectorsAnalytics` shape defined in Task 1 matches every later usage (route response in Task 3, fixture in Task 4, component prop reads in Task 5). `FoKPI` props (`label`, `value`, `sub`) match the existing component signature verified in `src/components/analytics/FoKPI.tsx`. `BarDatum` and `DonutSegment` shapes match the existing chart primitives.
- **YAGNI:** no per-user drill-down, no date-range selector, no CSV export, no inactive-user toggle, no targets/goals, no province heatmap, no admin gate — every one of these is in §2 of the spec as out-of-scope and stays out of this plan.
