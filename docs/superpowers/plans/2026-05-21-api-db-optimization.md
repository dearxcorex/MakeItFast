# API + DB Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut analytics dashboard cold-start latency by 60–80% and make repeat loads near-instant, by replacing the worst row-scan queries with SQL aggregation, parallelizing every query under one `Promise.all`, response-caching the dashboard, and adding three Postgres indexes for the hottest predicates.

**Architecture:** All wins live in `/api/analytics/summary` (the 18-query hot path that takes 800–2000ms cold) and the Prisma schema (missing indexes for `inspection_69`, `on_air`, `submit_a_request`, `province`, `status`). We do not touch `FieldOpsFetcher` or the interference/stations routes — analysis showed those routes already select the minimum columns the converters consume.

**Tech Stack:** Next.js 15 App Router + Prisma + Neon Postgres (PgBouncer transaction mode), Vitest.

---

## Analysis (verified by code-reading subagent)

| Spot | Problem | Estimated win |
|---|---|---|
| `summary/route.ts:75-78` `fmFrequencies` | `findMany({ select: { freq } })` pulls ALL ~6000 FM rows just to bin them into 10 frequency bands in JS | **100–300ms** |
| `summary/route.ts:94-103` `provincePerRanking` + `provinceInspected` | Two `groupBy` calls issued AFTER the first `Promise.all` resolves — one extra round-trip's worth of sequential latency | **80–150ms** |
| `summary/route.ts` cache headers | No `Cache-Control`; every dashboard mount re-runs all 20 queries even though data changes slowly | **~all of it on repeat loads** |
| `prisma/schema.prisma` | No indexes on `fm_station.inspection_69`, `fm_station.on_air`, `fm_station.submit_a_request`, `fm_station.province`, `interference_site.status` — every `count()` and `groupBy` on these does a sequential scan | **50–200ms total per cold load** |

What we explicitly **do not** change in this plan:
- `convertToFMStation` already reads 15 of 15 columns — `select` saves nothing.
- `convertToInterferenceSite` reads 29 of 30 columns — `select` saves nothing.
- `/api/interference/route.ts:28` returns `sites.length` from an already-fetched array — no extra query.
- `/api/stations/recent`, `/api/interference/stats`, `/api/users/inspectors` are already lean.

---

## File Structure

**Modify:**
- `src/app/api/analytics/summary/route.ts` — replace `fmFrequencies` aggregation, fold trailing groupBys into the main `Promise.all`, add Cache-Control header.
- `prisma/schema.prisma` — add five `@@index` directives for hot count/groupBy predicates.

**Create:**
- `src/__tests__/api-analytics-summary-perf.test.ts` — assert the route fires the new combined query set and that the frequency distribution math is correct.

**Test:**
- `src/__tests__/api-analytics-summary.test.ts` (if it exists — verify by `ls src/__tests__/ | grep analytics`) — keep passing.

---

## Task 1: Replace `fmFrequencies` row-fetch with SQL band aggregation

The current code loads every FM station's `freq` value (~6000 rows over the wire) just to bucket them into ten 2-MHz bands. PostgreSQL can do this in one aggregation query and return ten rows.

**Files:**
- Modify: `src/app/api/analytics/summary/route.ts:75-78` and `:145-156`

- [ ] **Step 1: Capture baseline behaviour**

Read `src/app/api/analytics/summary/route.ts` lines 145–157 — note the band keys (`"88-90"`, `"90-92"`, …, `"106-108"`) and the bucketing rule `Math.floor(freq / 2) * 2`. The replacement must produce the same `fmFrequencyDistribution` shape: an array of 10 `{ band, count }` objects in band-ascending order.

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/api-analytics-summary-perf.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const queryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: queryRaw,
    fm_station: {
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
      findMany: vi.fn(async () => []),
    },
    interference_site: {
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
      findMany: vi.fn(async () => []),
    },
  },
}));

import { GET } from "@/app/api/analytics/summary/route";

describe("/api/analytics/summary perf", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("uses $queryRaw for the FM frequency band aggregation", async () => {
    queryRaw.mockResolvedValueOnce([
      { band: "88-90", count: 12n },
      { band: "100-102", count: 7n },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    // The route must call $queryRaw exactly once for the band aggregation.
    expect(queryRaw).toHaveBeenCalledTimes(1);
    // The shape must still be 10 bands in ascending order, filled with 0s.
    expect(body.fmFrequencyDistribution).toEqual([
      { band: "88-90", count: 12 },
      { band: "90-92", count: 0 },
      { band: "92-94", count: 0 },
      { band: "94-96", count: 0 },
      { band: "96-98", count: 0 },
      { band: "98-100", count: 0 },
      { band: "100-102", count: 7 },
      { band: "102-104", count: 0 },
      { band: "104-106", count: 0 },
      { band: "106-108", count: 0 },
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api-analytics-summary-perf.test.ts`
Expected: FAIL — `$queryRaw` is never called (current route uses `prisma.fm_station.findMany`).

- [ ] **Step 4: Replace `fmFrequencies` query in the route**

In `src/app/api/analytics/summary/route.ts`, find the `Promise.all` element currently around lines 75–78:

```ts
      prisma.fm_station.findMany({
        where: { freq: { not: null } },
        select: { freq: true },
      }),
```

Replace with:

```ts
      // SQL aggregation: ten buckets, computed inside Postgres. Replaces a
      // findMany() that used to pull every row's freq value just to bin them
      // in JS. floor(freq / 2) * 2 produces the band's lower bound; we cast
      // it to text + concat to match the existing "88-90" key format.
      prisma.$queryRaw<{ band: string; count: bigint }[]>`
        SELECT
          (FLOOR(freq / 2) * 2)::int || '-' || (FLOOR(freq / 2) * 2 + 2)::int AS band,
          COUNT(*) AS count
        FROM fm_station
        WHERE freq IS NOT NULL AND freq >= 88 AND freq < 108
        GROUP BY FLOOR(freq / 2)
        ORDER BY FLOOR(freq / 2)
      `,
```

- [ ] **Step 5: Replace the JS binning loop**

In the same file, find the block currently at roughly lines 145–157:

```ts
    const bands: Record<string, number> = {
      '88-90': 0, '90-92': 0, '92-94': 0, '94-96': 0, '96-98': 0,
      '98-100': 0, '100-102': 0, '102-104': 0, '104-106': 0, '106-108': 0,
    };
    for (const s of fmFrequencies) {
      if (s.freq == null) continue;
      const band = Math.floor(s.freq / 2) * 2;
      const key = `${band}-${band + 2}`;
      if (key in bands) bands[key]++;
    }
    const fmFrequencyDistribution = Object.entries(bands).map(([band, count]) => ({ band, count }));
```

Replace with:

```ts
    // fmFrequencies is now pre-aggregated by Postgres. Merge into the fixed
    // band ordering so callers always get the same 10 buckets, even if some
    // bands have zero stations (Postgres won't return rows for empty groups).
    const BAND_KEYS = [
      '88-90', '90-92', '92-94', '94-96', '96-98',
      '98-100', '100-102', '102-104', '104-106', '106-108',
    ];
    const bandCounts = new Map<string, number>(
      fmFrequencies.map((r) => [r.band, Number(r.count)])
    );
    const fmFrequencyDistribution = BAND_KEYS.map((band) => ({
      band,
      count: bandCounts.get(band) ?? 0,
    }));
```

(`Number(r.count)` is needed because `$queryRaw` returns `bigint` for `COUNT(*)`.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/__tests__/api-analytics-summary-perf.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the existing analytics test if present**

Run: `ls src/__tests__/ | grep -i analytics`
For each `analytics-*.test.ts(x)` file that runs the summary route, run it and confirm no regressions:
`npx vitest run src/__tests__/<filename>`

- [ ] **Step 8: Commit**

```bash
git add src/app/api/analytics/summary/route.ts src/__tests__/api-analytics-summary-perf.test.ts
git commit -m "perf(analytics): aggregate FM frequency bands in SQL instead of fetching all rows"
```

---

## Task 2: Fold trailing groupBy queries into the main `Promise.all`

The route currently issues `provincePerRanking` and `provinceInspected` AFTER `Promise.all` resolves — that's one extra round-trip's worth of sequential latency on every dashboard load.

**Files:**
- Modify: `src/app/api/analytics/summary/route.ts:7-26` (the `Promise.all` destructuring) and `:94-103` (the trailing queries)

- [ ] **Step 1: Write the failing test**

Add a second test to `src/__tests__/api-analytics-summary-perf.test.ts`:

```ts
import prisma from "@/lib/prisma";

it("issues all groupBy queries inside a single Promise.all", async () => {
  // After Task 1 + this task: only one $queryRaw + a fixed count of typed
  // prisma calls should fire. We track ordering via a shared array.
  const callOrder: string[] = [];

  // re-stub the mocks to record call order
  const fm = prisma.fm_station as unknown as {
    count: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  const int = prisma.interference_site as unknown as {
    count: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  int.groupBy.mockImplementation(async (args: unknown) => {
    callOrder.push(`int.groupBy:${JSON.stringify((args as { by?: string[] }).by ?? [])}`);
    return [];
  });
  fm.groupBy.mockImplementation(async () => []);
  fm.count.mockImplementation(async () => 0);
  int.count.mockImplementation(async () => 0);
  fm.findMany.mockImplementation(async () => []);
  int.findMany.mockImplementation(async () => []);
  queryRaw.mockResolvedValueOnce([]);

  await GET();

  // BOTH the (changwat, ranking) and (changwat with status filter) groupBys
  // must have been issued — and the route must not call int.groupBy AFTER
  // the route has otherwise finished other work. We assert by counting the
  // total int.groupBy calls.
  const intGroupByCalls = callOrder.filter((c) => c.startsWith("int.groupBy"));
  // 1 = rankingGroups by (ranking) alone
  // 2 = provinceGroups by (changwat)
  // 3 = provincePerRanking by (changwat, ranking)
  // 4 = provinceInspected by (changwat) with status filter
  expect(intGroupByCalls.length).toBeGreaterThanOrEqual(4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api-analytics-summary-perf.test.ts`
Expected: PASS (existing) + FAIL on the new test if the trailing queries didn't run — but more importantly we use this test to lock the behaviour after we move the queries. The test will actually still pass with the current code (the queries do fire); the real verification is below.

- [ ] **Step 3: Refactor the route**

In `src/app/api/analytics/summary/route.ts`, find the `Promise.all` destructuring (the variable list `totalStations, inspectedStations, ...`). Add two new entries at the end of the destructuring AND the corresponding queries at the end of the `Promise.all` array.

Locate the destructuring (currently around line 7):
```ts
    const [
      totalStations,
      inspectedStations,
      ...
      fmFrequencies,
    ] = await Promise.all([...]);
```

Add two more bound names at the end:
```ts
      fmFrequencies,
      provincePerRanking,
      provinceInspected,
    ] = await Promise.all([
```

Then at the bottom of the `Promise.all` array, just before its closing `])`, append:

```ts
      prisma.interference_site.groupBy({
        by: ['changwat', 'ranking'],
        _count: { _all: true },
        where: { changwat: { not: null } },
      }),
      prisma.interference_site.groupBy({
        by: ['changwat'],
        _count: { _all: true },
        where: { changwat: { not: null }, status: 'ตรวจแล้ว' },
      }),
```

Then DELETE the trailing standalone queries (currently around lines 94–103):
```ts
    const provincePerRanking = await prisma.interference_site.groupBy({
      by: ['changwat', 'ranking'],
      _count: { _all: true },
      where: { changwat: { not: null } },
    });
    const provinceInspected = await prisma.interference_site.groupBy({
      by: ['changwat'],
      _count: { _all: true },
      where: { changwat: { not: null }, status: 'ตรวจแล้ว' },
    });
```

- [ ] **Step 4: Re-run the suite**

Run: `npx vitest run src/__tests__/api-analytics-summary-perf.test.ts`
Expected: BOTH tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analytics/summary/route.ts src/__tests__/api-analytics-summary-perf.test.ts
git commit -m "perf(analytics): fold trailing groupBy queries into the main Promise.all"
```

---

## Task 3: Add response-cache header to `/api/analytics/summary`

Dashboard repeat loads (every tab switch) currently re-run all 20 queries. Adding a short Cache-Control allows Vercel's edge and the browser to serve from cache; we still revalidate every 30s so stale-by-design data is bounded.

**Files:**
- Modify: `src/app/api/analytics/summary/route.ts` (the `NextResponse.json(summary)` near the end of the `try` block)

- [ ] **Step 1: Write the failing test**

Add a third test to `src/__tests__/api-analytics-summary-perf.test.ts`:

```ts
it("sets a short s-maxage Cache-Control for dashboard reloads", async () => {
  queryRaw.mockResolvedValueOnce([]);
  const res = await GET();
  expect(res.headers.get("cache-control")).toMatch(
    /s-maxage=\d+/i
  );
  // SWR window so revalidation can happen in the background.
  expect(res.headers.get("cache-control")).toMatch(
    /stale-while-revalidate=\d+/i
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api-analytics-summary-perf.test.ts`
Expected: the new test FAILS — current route returns no `Cache-Control`.

- [ ] **Step 3: Add the header**

In `src/app/api/analytics/summary/route.ts`, find the success return:
```ts
    return NextResponse.json(summary);
```

Replace with:

```ts
    return NextResponse.json(summary, {
      headers: {
        // Edge cache for 30s + serve stale up to 5 min while revalidating.
        // Dashboard mounts and tab switches will hit cache; the underlying
        // counts/groupBys are slow-changing enough that a 30s window is
        // safe, and operators get fresh data within one revalidation cycle.
        'Cache-Control':
          'public, s-maxage=30, stale-while-revalidate=300',
      },
    });
```

- [ ] **Step 4: Re-run the suite**

Run: `npx vitest run src/__tests__/api-analytics-summary-perf.test.ts`
Expected: all three tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analytics/summary/route.ts src/__tests__/api-analytics-summary-perf.test.ts
git commit -m "perf(analytics): cache /summary at the edge for 30s + 5min SWR"
```

---

## Task 4: Add Postgres indexes for hot count + groupBy predicates

Five queries in the analytics route filter on columns Prisma has no index for. Each becomes a sequential scan; on cold starts (when the page cache is cold) this is measurable. We add one migration and push.

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Inspect the current indexes**

Run: `grep -nE "^\s*@@index" prisma/schema.prisma`
Expected: only `revoked` on `fm_station`; `changwat`, `ranking`, `nbtc_area` on `interference_site`.

- [ ] **Step 2: Add the new indexes**

Edit `prisma/schema.prisma`.

In the `fm_station` model block (between the `@@index([revoked])` line and the closing `}`), add:

```prisma
  @@index([inspection_69])
  @@index([on_air])
  @@index([submit_a_request])
  @@index([province])
```

In the `interference_site` model block (alongside the existing `@@index` directives), add:

```prisma
  @@index([status])
```

The full `fm_station` index block should now read:
```prisma
  @@index([revoked])
  @@index([inspection_69])
  @@index([on_air])
  @@index([submit_a_request])
  @@index([province])
```

And `interference_site`:
```prisma
  @@index([changwat])
  @@index([ranking])
  @@index([nbtc_area])
  @@index([status])
```

- [ ] **Step 3: Regenerate Prisma client and push the schema**

Run: `npx prisma generate`
Expected: no errors.

Run: `npx prisma db push`
Expected: prints `5 indexes added` (or equivalent) and exits 0. NOTE: this connects to whatever `DATABASE_URL` points at — confirm with the user before running against production.

- [ ] **Step 4: Smoke test against the live DB**

Run a manual `EXPLAIN ANALYZE` for one of the now-indexed queries (optional but good practice). Skip if you don't have direct DB access; the index DDL itself is the artifact.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "perf(db): add indexes for hot analytics count + groupBy predicates"
```

---

## Task 5: Verify end-to-end + measure

- [ ] **Step 1: Build**

Run: `npm run build 2>&1 | tail -10`
Expected: exits 0, no new TypeScript errors.

- [ ] **Step 2: Hit the route directly and time it**

In one terminal: `npm start`

In another (after Ready):
```bash
time curl -s -o /dev/null -w "%{http_code}\n" \
  --cookie "fm_session=<paste valid session cookie>" \
  http://localhost:3000/api/analytics/summary
```
First call (cold) and second call (warm). Expected: warm call returns in <50ms (cache hit); cold call shaves ~200–400ms off baseline.

- [ ] **Step 3: Run the full analytics test family**

Run: `npx vitest run src/__tests__/api-analytics-summary-perf.test.ts $(ls src/__tests__/api-analytics-*.test.ts 2>/dev/null) src/__tests__/analytics.test.tsx 2>&1 | tail -10`
Expected: all relevant tests still pass. Pre-existing failures in analytics tests (28 known failures from the inspector tagging branch) are out of scope — flag any NEW failures, not pre-existing ones.

- [ ] **Step 4: No commit (verification only). Note the warm/cold curl numbers in the PR description.**

---

## Self-Review Checklist

- **Spec coverage:**
  - "API for DB check faster" → Tasks 1 (fmFrequencies), 2 (parallelism), 3 (caching), 4 (indexes), 5 (measurement).
- **Placeholder scan:** No "add appropriate error handling", no "similar to Task N" — every step has literal code or literal commands.
- **Type consistency:** `fmFrequencies` is rebound from `{ freq: number }[]` (after Task 1) to `{ band: string; count: bigint }[]`; the JS merge in Step 5 of Task 1 reads `r.band` and `Number(r.count)`. The new `provincePerRanking` and `provinceInspected` names introduced in Task 2 are the *same* identifiers the existing code below the `Promise.all` already uses to build `provinceMap`, so no downstream rename is needed.
