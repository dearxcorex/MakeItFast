# Analytics Teammate-Count Audit — Design

**Date:** 2026-05-17
**Status:** Approved
**Surface:** `/api/analytics/inspectors` route, `PATCH /api/stations/[id]`, dashboard counts
**Related:** [2026-05-16-inspector-performance-dashboard-design](2026-05-16-inspector-performance-dashboard-design.md), [2026-05-17-default-crew-modal-design](2026-05-17-default-crew-modal-design.md)

## Goal

Find and fix the bugs that make the analytics dashboard's per-inspector counts (YTD, this-month, monthly chart, KPIs) potentially wrong, and add invariants so future regressions are caught by tests rather than by the user noticing a bad number.

This is a defensive audit, not a response to a single reported wrong number. Bug list below was derived from a code read of the analytics route + the PATCH toggle path.

## Identified bugs

| # | Bug | Severity | Source |
|---|---|---|---|
| B1 | Toggling INSPECT **OFF** leaves the `station_inspection` history row in place. Analytics keeps counting "I changed my mind" inspections forever. | **High** — inflates every per-user count for any user who has ever toggled OFF | `src/app/api/stations/[id]/route.ts` — no sidecar on `inspection_69 === false` |
| B2 | `Math.max(monthFromSeries, monthAsLead + monthAsHelper)` at `route.ts:162` reconciles two source-of-truth queries by taking the higher value. Hides real divergence; potentially shows a count higher than reality. | **Medium** — the workaround comment admits guesswork | `src/app/api/analytics/inspectors/route.ts:158-162` |
| B3 | `mostTaggedHelperThisYear` picks `memberYtd[0]` and shows `null` if that top helper is deactivated, instead of falling through to the next-most-tagged active helper. | **Low** — KPI disappears when it shouldn't, but no count is wrong | `src/app/api/analytics/inspectors/route.ts:204-217` |
| B-DB? | Possible data-level corruption (orphan rows, lead-in-members, fm_station/history drift). | Unknown until Phase 1 runs | DB |

## Phase 1 — DB sanity SQL

Run 7 queries against Neon via `npx prisma db execute`. Capture row counts + a sample of any non-empty result. Write everything to `docs/superpowers/audits/2026-05-17-analytics-count-audit.md` alongside the fix commit SHAs.

| Q | SQL | What it catches | Expected (healthy) |
|---|---|---|---|
| Q1 | `SELECT m.inspection_id, m.user_id FROM station_inspection_member m LEFT JOIN station_inspection i ON i.id = m.inspection_id WHERE i.id IS NULL;` | Orphan member rows. Schema FK + `onDelete: Cascade` should prevent — confirm. | 0 rows |
| Q2 | `SELECT i.id, i.lead_user_id FROM station_inspection i JOIN station_inspection_member m ON m.inspection_id = i.id AND m.user_id = i.lead_user_id;` | Lead user also appearing as a helper on the same inspection. Service forbids, DB allows. | 0 rows |
| Q3 | `SELECT station_id, inspected_on, lead_user_id, COUNT(*) FROM station_inspection GROUP BY 1, 2, 3 HAVING COUNT(*) > 1;` | Duplicate `(station_id, inspected_on, lead_user_id)`. Unique constraint should prevent. | 0 rows |
| Q4 | `SELECT i.id, i.lead_user_id, u.username, u.active, u.role FROM station_inspection i JOIN "user" u ON u.id = i.lead_user_id WHERE u.active = false OR u.role NOT IN ('admin', 'inspector');` | Inspections led by deactivated or non-inspector users. | 0 rows (or surface for remediation) |
| Q5 | `SELECT i.id, i.station_id FROM station_inspection i LEFT JOIN fm_station s ON s.id_fm = i.station_id WHERE s.id_fm IS NULL;` | Inspections with no matching station. FK should prevent. | 0 rows |
| Q6 | `SELECT s.id_fm, s.name, s.inspection_69, s.date_inspected FROM fm_station s LEFT JOIN station_inspection i ON i.station_id = s.id_fm WHERE s.inspection_69 = true AND i.id IS NULL;` | `inspection_69=true` but zero `station_inspection` rows (legacy toggle-only entries, no history). | Some rows likely — pre-history toggles |
| Q7 | `SELECT i.id, i.station_id, s.inspection_69 FROM station_inspection i JOIN fm_station s ON s.id_fm = i.station_id WHERE s.inspection_69 = false;` | Reverse drift: history rows exist but `inspection_69` was toggled off without deleting (this is exactly the B1 bug surfacing in data). | Some rows likely — these are the counts B1 inflates |

For each Q with non-zero rows, the audit doc records: count, 3-row sample, and a one-line remediation plan (delete via SQL, leave alone, etc.). Q6 and Q7 are the most informative — they quantify how much existing data the B1 fix changes.

## Phase 2 — Code fixes

### Fix 1 — Toggle OFF deletes today's caller-owned history row

`PATCH /api/stations/[id]` currently has a sidecar that calls `createInspection` on `inspection_69 === true`. Add a mirror sidecar on `inspection_69 === false`:

```ts
if (updates.inspection_69 === false) {
  try {
    const session = await getSession();
    if (session.userId) {
      const today = new Date().toISOString().split('T')[0];
      await prisma.station_inspection.deleteMany({
        where: {
          station_id: stationId,
          lead_user_id: session.userId,
          inspected_on: new Date(`${today}T00:00:00Z`),
        },
      });
      await recomputeStationInspectionState(stationId);
    }
  } catch (err) {
    console.warn(`Failed to delete inspection history for station ${stationId}:`, err);
  }
}
```

Semantic: **toggle is "today's action"; OFF can only undo today's action.** Older inspections by the same user, or inspections by other leads, are untouched. `recomputeStationInspectionState` keeps `inspection_69=true` if any remaining history exists for the station — which means toggling OFF "doesn't appear to do anything" when another inspector has a record. That's correct: the toggle reflects truth, and the truth is "this station has been inspected (just not by you)."

Side effect: re-toggle ON same day creates a fresh `station_inspection` row with the caller's current `helperUserIds`, fixing the silent "old helpers stuck" bug from the default-crew sidecar's idempotency.

Failure mode: `deleteMany` errors don't fail the PATCH (same pattern as the toggle-ON sidecar). The boolean update reflects intent; history cleanup is best-effort.

### Fix 2 — Remove `Math.max` reconciliation; raw query is the truth

Current code at `route.ts:158-162`:

```ts
const monthFromSeries = thisMonthPerUser[u.username] ?? 0;
// Reconcile the two data sources: take whichever count is higher.
// monthlySeries is sourced from a raw bucketed query; the groupBy queries
// are scoped narrowly to the current month. They normally agree; when
// they don't, the higher value is the truthful count.
const monthTotal = Math.max(monthFromSeries, monthAsLead + monthAsHelper);
```

Replace with:

```ts
const monthFromSeries = thisMonthPerUser[u.username] ?? 0;
const monthTotal = monthFromSeries; // raw query is the truth — same source the chart shows
if (monthFromSeries !== monthAsLead + monthAsHelper) {
  console.warn(
    `[analytics] count divergence for ${u.username}: chart=${monthFromSeries}, groupBy=${monthAsLead + monthAsHelper}`,
  );
}
```

Rationale: the raw `to_char(date_trunc('month', inspected_on), 'YYYY-MM')` query is the source for the monthly chart the user sees. The leaderboard's monthly total must agree with the chart. The `console.warn` surfaces remaining divergence for later root-cause work (likely Prisma's relational filter vs. raw JOIN producing different SQL under some condition; not a count bug if the chart number is right).

### Fix 3 — `mostTaggedHelperThisYear` iterates past deactivated users

Current at `route.ts:204-217`:

```ts
let mostTaggedHelperThisYear: ... = null;
const helperTop = memberYtd.slice().sort((a, b) => b._count._all - a._count._all)[0];
if (helperTop) {
  const u = userById.get(helperTop.user_id);
  if (u) {
    mostTaggedHelperThisYear = { ... };
  }
}
```

Replace with:

```ts
let mostTaggedHelperThisYear: ... = null;
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

Now the KPI shows the top *active* helper, not nothing.

## Phase 3 — Invariant test suite

### `src/__tests__/analytics-invariants.test.ts`

Mocks `prisma` per the existing project pattern and runs `buildPayload` (or a re-exported test handle to it). Asserts:

1. For every `inspector` in the payload: `inspector.ytdTotal === inspector.ytdAsLead + inspector.ytdAsHelper`.
2. For every active user with helper or lead rows in the current month: `monthlySeries[thisMonth].perUser[u.username] === monthAsLead + monthAsHelper` (the contract B2's workaround was hiding; post-fix these must agree).
3. `kpis.activeThisMonth === Object.values(thisMonthPerUser).filter(n => n > 0).length`.
4. `kpis.mostTaggedHelperThisYear` is non-null whenever any active user has `ytdAsHelper > 0` (B3 regression).
5. Deactivated user (`active=false`) contributes their helper attribution to the chart per-month sum for other users' inspections, but does NOT appear in the `inspectors[]` list (filtered out by `users` query).

### `src/__tests__/api-stations-patch-toggle-off.test.ts`

Three cases pinning Fix 1:

1. Toggle OFF with an existing same-day inspection by caller → `prisma.station_inspection.deleteMany` called with `{ station_id, lead_user_id: caller, inspected_on: today }`; `recomputeStationInspectionState` runs.
2. Toggle OFF with no matching row → `deleteMany` still called (no-op delete with `count: 0`), no error thrown.
3. Toggle OFF when ANOTHER user inspected today → caller's `deleteMany` returns `count: 0`, the other user's row persists, recompute keeps `inspection_69=true`.

## Audit document

`docs/superpowers/audits/2026-05-17-analytics-count-audit.md` written as part of Phase 1:

- Phase 1: per-query row counts + sample row + remediation taken (SQL or "leave alone").
- Phase 2: commit SHAs for Fix 1 / Fix 2 / Fix 3.
- Phase 3: test file paths + assertion counts.
- Final reconciliation paragraph: "before this audit the dashboard could report X; after, the dashboard reports Y; deltas above N rows were remediated by SQL Z."

## Error handling

| Scenario | Behavior |
|---|---|
| Phase 1 query returns a surprisingly large row count (>50) | Surface in audit doc, ask user before mass remediation |
| Fix 1 `deleteMany` fails (DB outage) | `console.warn`, PATCH still succeeds — boolean update is the user's intent (mirrors existing toggle-ON sidecar) |
| Fix 1 recompute fails | Same: warn, don't fail PATCH |
| Fix 2 divergence logged in prod | Operations sees the warning, files a follow-up; the visible count is the chart number, which is the user-trustworthy source |

## Out of scope (YAGNI)

- **Soft-delete column** (`voided_at`). User picked hard delete on toggle OFF.
- **"Are you sure?" modal** on toggle OFF. The semantic is "undo today's action" — low-cost mistake, low risk.
- **Re-architecting the leaderboard donut**. Math is correct; no fix needed.
- **Admin route to manually delete arbitrary inspections.** `deleteInspection` service exists; the route isn't exposed yet. Leave that way until a user asks.
- **Backfill cleanup of pre-fix toggle-OFF leftovers.** Phase 1 surfaces the row count; if it's small the audit doc has a one-shot SQL to clean; if large we ask the user before running.
- **Investigating *why* Fix 2's two queries diverge.** The `console.warn` captures it; root-causing is a future ticket if the warning ever fires in prod.

## Open questions

None. All decisions captured in the bug list + fixes + scope notes.
