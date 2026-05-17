# Year-to-Date Team Performance Dashboard — Design

**Date:** 2026-05-17
**Status:** Approved
**Surface:** `/api/analytics/*` view in field-ops Analytics tab
**Related:** [2026-05-16-inspector-performance-dashboard-design](2026-05-16-inspector-performance-dashboard-design.md), [2026-05-17-analytics-count-audit-design](2026-05-17-analytics-count-audit-design.md)

## Goal

Promote the existing inspector / team performance section to the top of the Analytics page, replace the 3-card KPI strip (ACTIVE INSPECTORS / LARGEST TEAM / MOST-TAGGED HELPER) with a single TOP PERFORMER hero card, add an explicit "2026" year label, and strip the sidebar's dead navigation items. Demote the existing FM/interference widgets to a secondary "Operations overview" section below.

This is a UI reorganization + one new component. No new API endpoints, no schema changes.

## Page structure after the change

```
┌─ Sidebar ──────┐  ┌─ Main ──────────────────────────────────────┐
│ ANALYZE        │  │ Header:  ANALYTICS · TEAM · NBTC THAILAND    │
│ [Overview]     │  │          Year-to-date team performance · 2026│
│                │  ├──────────────────────────────────────────────┤
│ (no FM/        │  │ 🏆 TOP PERFORMER hero card                   │
│  Interference/ │  │    name · YTD count · led/helped pills       │
│  Provinces)    │  │    "Last active N days ago · M this month"   │
│                │  ├──────────────────────────────────────────────┤
│                │  │ Leaderboard table (existing, unchanged)      │
│                │  ├──────────────────────────────────────────────┤
│                │  │ Monthly participation chart (existing)       │
│                │  ├──────────────────────────────────────────────┤
│ UPDATED hh:mm  │  │ Per-user role donuts (existing)              │
└────────────────┘  │ ─── divider ───                              │
                    │ "OPERATIONS OVERVIEW" small label            │
                    │ KPI row (FM/Inspection rate/INT/Critical)    │
                    │ Charts row 1 (line chart + interference donut)│
                    │ Charts row 2 (bar chart + coverage ring)     │
                    └──────────────────────────────────────────────┘
```

## Components

### 1. `TopPerformer.tsx` (new)

**Path:** `src/components/analytics/TopPerformer.tsx`

**Props:**

```ts
interface Props {
  inspectors: InspectorsAnalytics['inspectors']; // already sorted DESC by ytdTotal
  thisYear: number;                              // from the payload (2026)
}
```

**Behavior:**
- Pick the first inspector in the list. If none exist OR if its `ytdTotal === 0`, render a muted "No activity yet for {year}" card.
- Otherwise render:
  - Mono header: `🏆 TOP PERFORMER · YTD {year}`
  - Big serif name (e.g. `iff`)
  - Subtitle: `{ytdTotal} inspections this year`
  - Two role pills: green `{ytdAsLead} led` + neutral `{ytdAsHelper} helped`
  - Footer line: `Last active {daysAgo(lastActive)} · {monthTotal} this month`

**Styling:**
- Gradient background `linear-gradient(135deg, #f0fdf4, #ecfdf5)`
- Border `1px solid #86efac`
- Border radius `12px`
- Inner padding `18px`
- Uses the existing `fo-mono` / `fo-serif` CSS classes
- The `daysAgo()` helper from `InspectorsSection.tsx` (currently a local function) becomes shared — extract to a small util or duplicate (we choose duplicate to avoid an unrelated refactor; see Out of scope).

**No new API call.** Consumes data from the existing `InspectorsSection` payload via props.

### 2. `InspectorsSection.tsx` (modify)

**Changes:**
- **`SectionHeader`** title becomes `Year-to-date team performance · {data.thisYear}` (currently `Year-to-date team performance` with no year).
- **Remove `KpiStrip`** entirely. Replace its render call with `<TopPerformer inspectors={data.inspectors} thisYear={data.thisYear} />`.
- The empty-state, error-state, and other sub-components (`LeaderboardTable`, `MonthlyParticipationChart`, `PerUserRoleDonuts`) remain unchanged.

### 3. `AnalyticsDashboard.tsx` (modify)

**Sidebar:**
- Delete the `SIDEBAR_ANALYZE` constant and its `.map(...)` render.
- Replace with a single inline "Overview" pill using the same styling as the active item (border, background tint). The pill remains inert — no click handler.
- Keep the `UPDATED hh:mm:ss` footer.

**Main content reorder:**
- Move the existing `<InspectorsSection />` from the BOTTOM of the main column to a position IMMEDIATELY AFTER the page header (above what is currently the KPI row).
- Wrap the existing FM/interference content (KPI row + 2 chart rows) in a fragment preceded by:
  - A divider: `<hr style={{ border: 'none', borderTop: '2px dashed var(--fo-line)', margin: '24px 0 16px' }} />`
  - A small mono label: `<div className="fo-mono" style={{ color: 'var(--fo-mute)', marginBottom: 12 }}>OPERATIONS OVERVIEW</div>`

**No other changes** to existing FM/interference render code.

## Data flow

No API changes. `/api/analytics/inspectors` payload already includes `inspectors[]` (sorted DESC by `ytdTotal`) and `thisYear` — both consumed by the new `TopPerformer`. The route's `kpis.activeThisMonth` / `kpis.largestTeam` / `kpis.mostTaggedHelperThisYear` fields go unused; they remain in the response payload (removing them is out of scope and would be a breaking change for any future consumers).

## Empty / loading / error states

- **Loading** (`InspectorsSection`): existing "Loading..." pill — unchanged.
- **Error** (`InspectorsSection`): existing red error card — unchanged.
- **No activity** (`hasAnyActivity === false`): existing "No inspection activity yet." pill — unchanged.
- **Has activity but `inspectors[0].ytdTotal === 0`**: `TopPerformer` renders its own muted "No activity yet for 2026" card.

## Testing

| File | Cases |
|---|---|
| **NEW** `src/__tests__/top-performer.test.tsx` | 6 cases (see below) |
| `src/__tests__/api-analytics-inspectors.test.ts` | Unchanged — route response shape unchanged |
| `src/__tests__/analytics.test.tsx` | Pre-existing failing baseline — leave alone, out of scope |

**TopPerformer test cases:**
1. Empty `inspectors` array → renders muted "No activity yet for 2026" card.
2. `inspectors` populated but all have `ytdTotal === 0` → same empty state.
3. Single inspector with `ytdTotal > 0` → renders name + count + lead/helper pills + last-active footer.
4. Multiple inspectors → picks `inspectors[0]` (relies on caller passing pre-sorted array; route guarantees this).
5. Header always reads `TOP PERFORMER · YTD {thisYear}` when `thisYear=2026`.
6. `lastActive === null` → footer reads `Last active —` (matches existing `daysAgo` helper behavior).

## Out of scope (YAGNI)

- **Remove unused fields from `/api/analytics/inspectors`** (`kpis.activeThisMonth`, `kpis.largestTeam`, `kpis.mostTaggedHelperThisYear`). Still emitted; future cleanup.
- **Extract `daysAgo()` to a shared util.** `InspectorsSection.tsx` has a local copy; `TopPerformer.tsx` duplicates it. Avoids an unrelated refactor; either file owns 5 lines.
- **Make the "Overview" sidebar pill a real route.** It stays inert — there's no second view to navigate to.
- **Mobile-specific sidebar hide.** The 140px sidebar still renders on mobile field-ops; out of scope for this redesign.
- **Animate the hero card** (sparklines, count-up animation, etc.). Static render is fine.
- **Rising star / streak / "best helper" alternative angles** for the hero card. User picked single-hero (Option A); leave the other angles for later if needed.
- **Updating chart x-axis labels** from `25-08` to `Aug 25` or `Aug 2025`. Compact labels work; year context lives in the header.

## Open questions

None. All UI, data flow, and scope decisions captured above.
