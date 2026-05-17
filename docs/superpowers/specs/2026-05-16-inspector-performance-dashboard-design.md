# Inspector Performance Dashboard — Design

**Date:** 2026-05-16
**Status:** Draft, pending user review
**Author:** brainstormed with deardevx@gmail.com
**Builds on:** `docs/superpowers/specs/2026-05-13-inspector-tagging-design.md` (the `station_inspection` + `station_inspection_member` tables now silently populated by every PATCH-toggle).

---

## 1. Problem

Every inspection toggle now writes a `station_inspection` row tagged with the current user (lead) and optional helpers, but nothing surfaces this in the UI. We want a "How well is each inspector doing?" view so the team can see who's putting in the work this year/month and how much teamwork is happening, without adding any new feature to field-ops itself.

## 2. Non-goals

- No new feature on field-ops pages (per user request — backend tracking only, plus a viewing surface elsewhere).
- No per-user drill-down page (list of a single inspector's inspections).
- No date-range selector — fixed YTD + this-month + 12-month rolling chart.
- No CSV/PDF export.
- No target tracking ("vs annual goal of N").
- No province-level inspector heatmap.
- No inactive-user toggle (the inactive `aom` user is always excluded).
- No coverage/recency-specific metrics (per Q1 — only Volume + Teamwork).
- No quality/notes-based scoring.

## 3. What you'll see

A new "Inspectors" section appended to the bottom of the existing `AnalyticsDashboard.tsx`. Three rows + a KPI strip.

### 3.1 KPI strip (3 `FoKPI` cards)
- **Active inspectors this month** — count of users with ≥1 participation in the current month.
- **Largest team** — single inspection with the most members (1 lead + N helpers) this year. Caption: `<station name> · <date> · N people`.
- **Most-tagged helper this year** — username + count of times they joined as helper in 2026.

### 3.2 Row A — Year-to-date leaderboard

Plain HTML table, sortable by total participation (default sort DESC).

| Inspector | YTD total | This month | As lead | As helper | Last active |
|---|---|---|---|---|---|
| ★ iff | 14 | 2 | 11 | 3 | 2 days ago |
| daf | 9 | 1 | 4 | 5 | 5 days ago |
| ice | 7 | 0 | 6 | 1 | 18 days ago |
| dao | 5 | 0 | 5 | 0 | 28 days ago |
| admin | 3 | 0 | 3 | 0 | 35 days ago |

- "YTD total" = `ytdAsLead + ytdAsHelper`.
- "★" prefix denotes the user with the highest YTD total.
- "Last active" computed as days since `MAX(inspected_on)` across both lead and helper rows.

### 3.3 Row B — 12-month stacked bar chart (`FoBarChart` reused)

X-axis: last 12 months (oldest → newest, rolling window ending in current month).
Y-axis: total participations (lead + helper).
Bars stacked per inspector, color-coded by username.

### 3.4 Row C — Lead vs Helper donut per inspector (`FoDonut` reused, 3-column grid)

One small donut per active inspector showing the split of their YTD participations: lead slice vs helper slice. Quickly answers "is this person mostly leading or mostly assisting?"

## 4. Backend API

### 4.1 New route: `GET /api/analytics/inspectors`

Auth: same as `/api/analytics/summary` — logged-in only via middleware. No admin gate (per Q3, everyone sees everyone).

### 4.2 Response shape

```ts
{
  generatedAt: string;                    // ISO timestamp
  thisYear: number;                       // 2026
  thisMonth: string;                      // "2026-05"
  inspectors: Array<{
    userId: number;
    username: string;
    displayName: string;
    ytdTotal: number;                     // ytdAsLead + ytdAsHelper, year 2026
    monthTotal: number;                   // lead + helper, current month
    ytdAsLead: number;
    ytdAsHelper: number;
    lastActive: string | null;            // YYYY-MM-DD of latest participation, null if never
  }>;
  monthlySeries: Array<{                  // 12 entries, oldest → newest
    month: string;                        // "2025-06"
    perUser: Record<string /* username */, number>;
  }>;
  kpis: {
    activeThisMonth: number;
    largestTeam: {
      inspectionId: number;
      stationId: number;
      stationName: string;
      inspectedOn: string;
      memberCount: number;                // 1 (lead) + N (helpers)
    } | null;
    mostTaggedHelperThisYear: {
      username: string;
      displayName: string;
      count: number;
    } | null;
  };
}
```

### 4.3 Queries

All run in `Promise.all`:

1. Active inspectors: `prisma.user.findMany({ where: { active: true, role: { in: ['admin','inspector'] } } })`.
2. Per-user YTD lead count via `prisma.station_inspection.groupBy({ by: ['lead_user_id'], _count: { _all: true }, where: { inspected_on: { gte: <2026-01-01> } } })`.
3. Per-user YTD helper count via a raw `SELECT user_id, COUNT(*) FROM station_inspection_member m JOIN station_inspection i ON i.id = m.inspection_id WHERE i.inspected_on >= <2026-01-01> GROUP BY user_id`.
4. Same two queries scoped to current month for `monthTotal`.
5. Last-active per user: `MAX(inspected_on)` across both lead rows and helper rows. Two `groupBy`/`max` queries merged in JS.
6. Monthly series: one raw SQL bucketed by `to_char(date_trunc('month', inspected_on), 'YYYY-MM')` per lead user, plus the analogue joined through the member table, merged into a 12-element array oldest → newest. Months with no activity get `perUser: {}`.
7. Largest team (this year): raw SQL — `SELECT i.id, i.station_id, i.inspected_on, 1 + COUNT(m.user_id) AS member_count FROM station_inspection i LEFT JOIN station_inspection_member m ON m.inspection_id = i.id WHERE i.inspected_on >= <2026-01-01> GROUP BY i.id ORDER BY member_count DESC, i.inspected_on DESC LIMIT 1`, then join `fm_station` for `name`. Null when no inspections this year.
8. Most-tagged helper (this year): `prisma.station_inspection_member.groupBy({ by: ['user_id'], _count: { _all: true }, where: { inspection: { inspected_on: { gte: <2026-01-01> } } } })` → take top row, fetch user. Null when zero helper rows.

### 4.4 Performance

- Each query is small (single-digit row counts for the team). The largest input table (`station_inspection`) holds tens of rows today and will grow at most a few per day. No pagination needed.
- Module-level 60-second in-memory cache (same pattern as is used today for cloudrf caches at the service layer). Cache key: `'inspectors-analytics'` (singleton). Invalidates on TTL only; explicit invalidation not needed for analytics.

### 4.5 Source filter

No filter applied. Both `source = 'app'` (live toggles) and `source = 'xlsx_import_2026_05'` rows count toward leaderboards (per Q5).

## 5. Frontend integration

### 5.1 Files

- **New:** `src/components/analytics/InspectorsSection.tsx` (~150 lines). Self-contained: fetches its own data, owns loading/error/empty states, renders four sub-blocks.
- **New addition to:** `src/types/analytics.ts` — exports `InspectorsAnalytics` type mirroring §4.2.
- **Modify:** `src/components/analytics/AnalyticsDashboard.tsx` — append `<InspectorsSection />` after the last existing section. One-line wiring. No parent-state changes.
- **Reuse, no changes:** `src/components/analytics/FoKPI.tsx`, `src/components/analytics/charts/FoBarChart.tsx`, `src/components/analytics/charts/FoDonut.tsx`.

### 5.2 Sub-components (file-local, not exported)

```
InspectorsSection
├── <SectionHeader title="Inspectors" subtitle="Year-to-date team performance" />
├── <KpiStrip kpis={data.kpis} />            // 3 FoKPI cards in a row
├── <LeaderboardTable inspectors={data.inspectors} />
├── <MonthlyParticipationChart series={data.monthlySeries} />
└── <PerUserRoleDonuts inspectors={data.inspectors} />
```

Each sub-component is ≤40 lines. They exist only for InspectorsSection. Keeps the file focused and easy to hold in context.

### 5.3 States

- Loading: skeleton rows + greyed-out KPI cards (consistent with existing dashboard).
- Error: red banner with retry button mirroring `AnalyticsDashboard`'s existing pattern.
- Empty (`inspectors.length === 0` AND `monthlySeries` is all empty): friendly "No inspection activity yet" message in place of charts.

### 5.4 Data refresh

One fetch on mount. No refresh controls (analytics doesn't need real-time). The 60-second server cache absorbs any tab re-mounts during a session.

## 6. Testing

- **`src/__tests__/api-analytics-inspectors.test.ts`** — Vitest with `vi.mock('@/lib/prisma')`. Cases:
  - 401 when no session cookie.
  - Returns correctly shaped JSON: top-level fields + nested shapes.
  - Aggregates YTD lead + helper counts correctly (fixture: 3 inspections, 2 leads, 4 helper rows).
  - Excludes inactive users (`aom`).
  - `lastActive` returns max of lead and helper dates.
  - `monthlySeries` returns 12 entries oldest → newest with correct per-user counts.
  - `largestTeam` returns the inspection with the most members + station name.
  - `mostTaggedHelperThisYear` returns null when no helper rows exist in current year.
- **`src/__tests__/inspectors-section.test.tsx`** — Component test:
  - Renders leaderboard rows in DESC `ytdTotal` order.
  - Renders the 3 KPI cards with correct values.
  - Shows skeleton while fetching.
  - Shows error banner on fetch failure.
  - Shows empty-state when `inspectors` is `[]`.

Coverage target: keep ≥81% project bar.

## 7. Rollout

1. Land the API route + its unit tests.
2. Land the section component + its tests + the one-line wiring into `AnalyticsDashboard.tsx`.
3. `npm run build`, `npm run lint`, full vitest sweep.
4. Manual smoke test: open Analytics tab, scroll to the bottom, confirm:
   - KPI strip shows accurate values.
   - Leaderboard shows up to 5 inspectors sorted by YTD total.
   - 12-month bar stacks render with current month populated.
   - Per-user donuts render with lead/helper split.

## 8. Rollback

UI + API-only change with no schema migration. Revert the PR; no data cleanup needed.

## 9. Open questions

None at design time.
