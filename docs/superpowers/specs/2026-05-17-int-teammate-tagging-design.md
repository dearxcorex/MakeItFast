# INT Teammate Tagging + Analytics Inclusion — Design

**Date:** 2026-05-17
**Status:** Approved
**Surface:** field-ops INT toggle + analytics dashboard
**Related:** [2026-05-13-inspector-tagging-design](2026-05-13-inspector-tagging-design.md), [2026-05-17-default-crew-modal-design](2026-05-17-default-crew-modal-design.md), [2026-05-17-analytics-count-audit-design](2026-05-17-analytics-count-audit-design.md), [2026-05-17-ytd-team-performance-dashboard-design](2026-05-17-ytd-team-performance-dashboard-design.md)

## Goal

Bring Interference (INT) inspections to feature parity with FM inspections for teammate tagging and analytics counting. After this change:

- Toggling INSPECT ON an INT site writes a history row with the calling user as lead and any tagged teammates as helpers (mirrors the existing FM PATCH sidecar).
- Toggling INSPECT OFF deletes the caller's today row + recomputes the site status (mirrors the FM audit fix).
- The default crew picker pre-fills helpers for INT toggles too, same as FM.
- The analytics dashboard's per-inspector counts merge FM + INT into a single total (no separate breakdown).

This is a parallel-table refactor: zero risk to existing FM data, all new tables live alongside.

## Data model

Two new tables that mirror the FM `station_inspection` / `station_inspection_member` shape exactly:

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

Back-relations on existing models:

```prisma
model interference_site {
  // ...existing fields...
  inspections interference_inspection[]
}

model user {
  // ...existing fields...
  int_inspections_led    interference_inspection[]        @relation("int_inspection_lead")
  int_inspection_members interference_inspection_member[] @relation("int_inspection_member")
}
```

Migration: hand-written SQL at `prisma/migrations/2026-05-17-add-interference-inspection/migration.sql`, applied via `npx prisma db push`. Force-add (since `*.sql` is in `.gitignore`).

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

## Service layer

New file `src/services/interferenceInspectionService.ts`. Mirrors `inspectionService.ts` API shape:

```ts
export interface CreateInterferenceInspectionInput {
  interferenceId: number;
  inspectedOn: string;       // YYYY-MM-DD
  leadUserId: number;
  helperUserIds: number[];
  notes?: string;
}

export async function createInterferenceInspection(
  input: CreateInterferenceInspectionInput,
): Promise<InterferenceInspection>;

export async function recomputeInterferenceInspectionState(
  interferenceId: number,
  db?: DbLike,
): Promise<void>;

export async function listInspectionsForInterferenceSite(
  interferenceId: number,
): Promise<InterferenceInspection[]>;
```

Validation rules mirror `createInspection` exactly:
- `inspectedOn` matches `YYYY-MM-DD`, not in the future.
- `helperUserIds` length ≤ 5, no duplicates, doesn't include `leadUserId`.
- Site exists, all users active + role in `{admin, inspector}`.
- Idempotent on `(interference_id, inspected_on, lead_user_id)` — returns the existing row if found.

`recomputeInterferenceInspectionState` sets `interference_site.status`:
- `'ตรวจแล้ว'` if at least one history row exists.
- `'ยังไม่ตรวจ'` otherwise.

The `'app'` source string is the same constant used by FM; an admin can backfill via a different source string later (out of scope).

Types: new file `src/types/interferenceInspection.ts` (or extend existing types module). Exports `InterferenceInspection`, `InterferenceInspectionMember`.

## API route changes

`src/app/api/interference/[id]/route.ts` PATCH gains two sidecars after the existing `prisma.interference_site.update`:

### Toggle ON sidecar (`status === 'ตรวจแล้ว'`)

```ts
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
```

### Toggle OFF sidecar (`status === 'ยังไม่ตรวจ'`)

```ts
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

Body schema: `helperUserIds?: number[]` is now consumed (was silently ignored). All other existing fields (`notes`, `ranking`, `lawPaperSent`, `sourceLat/Long/estimateDistance`) unchanged.

Failure mode (matches FM): sidecar errors don't fail the PATCH. The `status` update is the user's intent; history cleanup is best-effort.

## UI changes

### `FieldOpsClient.tsx`

**Generalize the helper-reset effect** so both FM stations and INT sites trigger a fresh default-crew pre-fill on selection:

```diff
- const fmStationId = selection?.kind === "fm" && selectedStation ? selectedStation.id : null;
- useEffect(() => {
-   setHelperUserIds(defaultCrew ?? []);
- }, [fmStationId, defaultCrew]);
+ const selectedTargetKey = selection
+   ? `${selection.kind}-${selection.id}`
+   : null;
+ useEffect(() => {
+   setHelperUserIds(defaultCrew ?? []);
+ }, [selectedTargetKey, defaultCrew]);
```

**Extend the INT branch of `handleToggleInspection`** to forward `helperUserIds`:

```diff
} else if (selection.kind === "int" && selectedSite) {
  const next = selectedSite.status === "ตรวจแล้ว" ? "ยังไม่ตรวจ" : "ตรวจแล้ว";
  setInterference(...);
  const res = await fetch(`/api/interference/${selectedSite.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
-   body: JSON.stringify({ status: next }),
+   body: JSON.stringify({
+     status: next,
+     ...(next === "ตรวจแล้ว" ? { helperUserIds } : {}),
+   }),
  });
  if (!res.ok) throw new Error("Interference update failed");
+ if (next === "ตรวจแล้ว") setHelperUserIds(defaultCrew ?? []);
}
```

**Pass crew props to INT current panels:** add `inspectors`, `currentUser`, `helperUserIds`, `onHelperUserIdsChange` to the `<FieldOpsCurrentINT>` and `<FieldOpsBottomSheet>` (INT branch) invocations — same shape as the FM panel already receives.

### `FieldOpsCurrent.tsx`

`FieldOpsCurrentINT` props extended with the same four crew-related fields as `FieldOpsCurrentFM`. Renders `<TeammatePicker>` under the INSPECT button, gated on `site.status !== 'ตรวจแล้ว'` (matches the FM PENDING-only gate so the picker doesn't show on already-inspected items).

### `FieldOpsBottomSheet.tsx`

Mirror: the INT branch passes the same crew props through to its INSPECT row and renders the same `<TeammatePicker>` below.

### `TeammatePicker.tsx`

**No changes.** The component is target-agnostic and already drops in via the four props.

## Analytics changes

`src/app/api/analytics/inspectors/route.ts` — change every per-user aggregation from a single-source `prisma.groupBy` to a UNION ALL raw query that pulls from both `station_inspection` (FM) and `interference_inspection` (INT). Same shape for members and the monthly bucket.

Example: the `leadYtd` aggregation becomes

```sql
SELECT lead_user_id, COUNT(*)::int AS n FROM (
  SELECT lead_user_id FROM station_inspection      WHERE inspected_on >= $1
  UNION ALL
  SELECT lead_user_id FROM interference_inspection WHERE inspected_on >= $1
) x
GROUP BY lead_user_id;
```

Same UNION ALL pattern applied to:
- `leadYtd`, `leadMonth`, `leadMax`
- `memberYtd`, `memberMonth`, `helperMax`
- `leadMonthly`, `helperMonthly` (the per-month series feeding the chart)
- `largestTeamRows` (also unions the source tables)

All shift from Prisma `.groupBy` to `$queryRawUnsafe` because Prisma can't UNION across tables. This is a deliberate trade — TypeScript safety on column names is lost for these queries; in exchange we get the merged metric the user wants without a second analytics endpoint.

Result payload (`InspectorsAnalytics`) shape unchanged. `TopPerformer`, `LeaderboardTable`, `MonthlyParticipationChart`, `PerUserRoleDonuts` all render the merged numbers without any UI code change.

## Self-healing already applies

The `defaultCrew` self-healing logic (Phase 1 audit Q4 + the existing `getDefaultCrew` filter) doesn't need extension. Deactivated users get filtered out of `userById` regardless of which inspection table their helper rows live in — the analytics aggregations group by `user_id`, and the `if (!u)` guard at the route level skips entries whose user is no longer active.

## Testing

| File | Cases |
|---|---|
| **NEW** `src/__tests__/interference-inspection-service.test.ts` | Mirror the existing `inspection-service.test.ts` cases for FM. ~8-10 cases covering create (success, idempotent, validation failures), recompute, list. |
| **NEW** `src/__tests__/api-interference-toggle.test.ts` | PATCH route sidecars. Toggle ON forwards `helperUserIds` to `createInterferenceInspection`. Toggle OFF calls `prisma.interference_inspection.deleteMany` with the right where + recompute. Both branches gracefully handle session/service failures with `console.warn`. 4-5 cases. |
| `src/__tests__/api-analytics-inspectors.test.ts` (modify) | Existing test fixtures extended: each `$queryRawUnsafe` mock that previously returned a single-table result now represents the UNION ALL output. May need to add empty `interference_inspection` rows to existing test setups so assertions still match. |
| `src/__tests__/analytics-invariants.test.ts` (no change expected) | Invariants are mathematical contracts (`ytdTotal = lead + helper`, chart ↔ groupBy agreement). They hold regardless of data source. |
| `src/__tests__/field-ops-current.test.tsx` (modify) | Add an INT-teammate-picker visibility test, mirroring the existing FM test. |
| `src/__tests__/field-ops-crew-bootstrap.test.tsx` (no change) | Pre-fill flows through the same `helperUserIds` state; INT selection now triggers the same reset. |

## Error handling

| Scenario | Behavior |
|---|---|
| `createInterferenceInspection` throws (DB outage, validation) | `console.warn`, PATCH still returns 200 — the `status` update was the user's intent. Same pattern as FM ON sidecar. |
| `deleteMany` throws on toggle OFF | `console.warn`, PATCH still returns 200. Same pattern as FM OFF sidecar. |
| `getSession` throws | Caught by the outer try; warn + continue (the status flip already happened). |
| Stale `helperUserIds` references a deactivated user | `createInterferenceInspection` validates and throws `'One or more users are inactive, missing, or not inspectors'`. Caller's warn fires; status still updates. UI's next data refresh shows no helper attribution (matches FM). |
| Analytics raw query returns a row with `user_id` not in active users | Existing `userById.get()` guard at route level filters it out; behavior unchanged. |

## Out of scope (YAGNI)

- **Splitting "11 FM · 3 INT" breakdown** in hero/leaderboard. User picked merge.
- **Per-type donuts** (FM-only vs INT-only ring per user).
- **Backfilling existing `interference_site.status='ตรวจแล้ว'` rows** into the new history table. No inspector attribution exists for those; leave alone.
- **INT inspection history view** (UI to see who inspected a site historically). The FM equivalent doesn't exist either.
- **Per-site notes on the history row** beyond what `createInterferenceInspection` already accepts.
- **Soft-delete** on toggle OFF. We use hard delete to match the FM audit decision.
- **Toggle-OFF affecting pre-feature legacy rows.** Only deletes rows created by this new flow (matched by `lead_user_id = caller`).
- **Bulk import** of historical interference inspections from xlsx (FM had this; INT can have its own later if needed).

## Risk callouts

- **Raw SQL maintenance burden** in `/api/analytics/inspectors`: 6+ aggregations move from Prisma `.groupBy` to `$queryRawUnsafe`. Column-name typos won't fail at compile time. Mitigation: comprehensive test coverage (existing `api-analytics-inspectors.test.ts` + invariants suite) catches regressions at runtime.
- **`Math.max` divergence-warn may fire more often.** The audit removed the masker; now any disagreement logs `console.warn`. Adding INT could surface new edge cases. The warn is informational, not a failure.
- **Existing pre-feature INT toggles** (`interference_site.status='ตรวจแล้ว'` without history) stay attributed-to-nobody. Analytics will show fewer counts than the visible "inspected" count on the map. Acceptable; this is the same situation FM had before the inspector-tagging feature launched.

## Open questions

None. All schema, service, UI, and analytics decisions captured above.
