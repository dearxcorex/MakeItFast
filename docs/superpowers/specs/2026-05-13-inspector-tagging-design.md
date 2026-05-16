# Inspector Tagging + Inspection History — Design

**Date:** 2026-05-13
**Status:** Draft, pending user review
**Author:** brainstormed with deardevx@gmail.com

---

## 1. Problem

Today the app records "this station was inspected" as two flat fields on `fm_station`: a boolean `inspection_69` and a string `date_inspected`. There is no record of *who* inspected it, no record of teammates who joined, and no history of past inspections. Toggling the Inspect button silently overwrites `date_inspected = today`, which has produced 17 mismatches against the team's official Excel report.

We want to:

1. Keep an authoritative history of every inspection (date + lead + helpers + optional notes).
2. Let the signed-in user record an inspection from the station modal, pick the field-work date, and tag teammates who joined.
3. Surface the latest inspection prominently in the station modal, with a collapsible history.
4. Backfill 29 rows from `/Users/deardevx/Downloads/report.xlsx` as the seed history.

## 2. Non-goals

- Editing/closing past inspections from the UI (only DELETE for admins or the original lead).
- Per-inspector analytics dashboards. Data will support it; UI is a follow-up.
- Bulk import for the older `inspection_68` campaign.
- Backfilling history from existing `fm_station.date_inspected` rows that didn't come from xlsx.
- "You were tagged" notifications.

## 3. Data model

### 3.1 New tables

```prisma
model station_inspection {
  id            Int       @id @default(autoincrement())
  station_id    Int
  inspected_on  DateTime  @db.Date          // YYYY-MM-DD, the field-work date
  lead_user_id  Int
  notes         String?
  source        String    @default("app")   // "app" | "xlsx_import_2026_05"
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt

  station       fm_station                  @relation(fields: [station_id], references: [id_fm])
  lead          user                        @relation("inspection_lead", fields: [lead_user_id], references: [id])
  members       station_inspection_member[]

  @@index([station_id, inspected_on(sort: Desc)])
  @@index([lead_user_id])
  @@unique([station_id, inspected_on, lead_user_id])  // dedupe re-imports
}

model station_inspection_member {
  inspection_id Int
  user_id       Int
  role          String  @default("helper")   // "helper" | (future)
  inspection    station_inspection @relation(fields: [inspection_id], references: [id], onDelete: Cascade)
  member        user               @relation(fields: [user_id], references: [id])

  @@id([inspection_id, user_id])
  @@index([user_id])
}
```

### 3.2 Existing `fm_station` — kept, derived

`fm_station.date_inspected` and `fm_station.inspection_69` stay as-is so existing filters, sidebar UI, and analytics keep working. They become **derived** values:

- `date_inspected = MAX(station_inspection.inspected_on) per station, formatted YYYY-MM-DD`
- `inspection_69 = EXISTS(station_inspection for station)`

A service-layer helper `recomputeStationInspectionState(stationId)` runs inside the same transaction as every inspection insert/delete, so `fm_station` never lags. (Service layer rather than DB trigger to match the existing pattern in `src/services/stationService.ts`.)

`fm_station.note` continues to hold the `#deviation` / `#intermod` hashtags. Inspection-specific notes live on `station_inspection.notes`.

### 3.3 `user` table

- Set `aom.active = false` in the migration. The `/api/users/inspectors` endpoint filters to `active = true`, so `aom` no longer appears in the helpers picker.
- No schema change to `user`.

### 3.4 Why `DateTime @db.Date`?

The existing `fm_station.date_inspected` is `String`, which has caused all the comparison pain (no native year/month queries, sort-as-string only works because of `YYYY-MM-DD`). The new `inspected_on` is `DateTime @db.Date` so `WHERE inspected_on >= '2026-01-01'` works natively. Convert to/from `YYYY-MM-DD` strings at the API boundary to keep the existing UI shape.

## 4. xlsx importer

### 4.1 Location and shape

A one-shot Node script: `scripts/import-inspections-xlsx.ts`, run as `npx tsx scripts/import-inspections-xlsx.ts <path>`. Re-runnable for future reports.

### 4.2 Inspector mapping

```ts
// scripts/inspector-map.ts
export const INSPECTOR_MAP: Record<string, string /* username */> = {
  'นางสาว ปิยาพัชร  เกิดไพบูลย์(เจ้าหน้าที่ตรวจสอบและปฏิบัติการ)': 'iff',
  'พรคุณพระ กิตติวราพล': 'dao',
  'นายภูวกฤต พลชิงชัย (นตป. ก2)': 'admin',
  'นายภควัต ทะสังขา(วก. ก1)': 'ice',
  'นาย ธีราทร  ภิรมย์ไกรภักดิ์(ลูกจ้างประจำ)': 'daf',
};
```

Names are normalized before lookup: collapse internal whitespace (`\s+` → single space) and trim. New variants found in the xlsx → script aborts with a list to add to the map.

### 4.3 Three phases

1. **Parse**: read xlsx, build rows `{ chkId, stationId, leadName, helperNames[], dateBE, dateCE }`. B.E.→C.E. = year − 543. xlsx column 1 = lead, columns 2–4 = helpers (skip blanks).
2. **Validate** (no writes):
   - Every distinct name normalized → mapped username; collect unmapped → fail with the list.
   - Every `id_fm` exists in `fm_station` → collect missing → fail with the list. (The 3 state stations without `id_fm` from the report — รหัสสถานี blank — surface here. They are excluded from the import; user decides whether to add them to `fm_station` first.)
   - Print a diff table: `xlsx_date` vs current `fm_station.date_inspected`, plus a count of rows that already exist in `station_inspection` (idempotency check).
3. **Apply** (only with `--apply`): single transaction —
   - `INSERT … ON CONFLICT DO NOTHING` into `station_inspection` keyed by `(station_id, inspected_on, lead_user_id)`.
   - Insert helpers into `station_inspection_member` (also conflict-safe).
   - Call `recomputeStationInspectionState` for each affected `station_id`.
   - Print: rows inserted, rows skipped (dupes), stations whose `date_inspected` changed.

### 4.4 Source tag and rollback

Every imported inspection gets `source = "xlsx_import_2026_05"`. To roll back:

```sql
DELETE FROM station_inspection WHERE source = 'xlsx_import_2026_05';
-- then recomputeStationInspectionState for each affected station_id
```

### 4.5 What the importer does NOT do

- Touch `inspection_68`.
- Auto-create users for unmapped names.
- Insert rows for stations missing `id_fm`.

## 5. API + service layer

### 5.1 New service: `src/services/inspectionService.ts`

```ts
export interface InspectionMember { userId: number; username: string; displayName: string; }
export interface StationInspection {
  id: number;
  stationId: number;
  inspectedOn: string;        // YYYY-MM-DD
  lead: InspectionMember;
  helpers: InspectionMember[];
  notes?: string;
  source: string;
  createdAt: string;
}

export async function listInspectionsForStation(stationId: number): Promise<StationInspection[]>;
export async function createInspection(input: {
  stationId: number;
  inspectedOn: string;        // YYYY-MM-DD
  leadUserId: number;
  helperUserIds: number[];
  notes?: string;
}): Promise<StationInspection>;
export async function deleteInspection(id: number, actor: SessionData): Promise<void>;
export async function recomputeStationInspectionState(stationId: number, tx?: PrismaTx): Promise<void>;
```

`recomputeStationInspectionState` runs:

```sql
UPDATE fm_station
SET date_inspected = (SELECT to_char(MAX(inspected_on),'YYYY-MM-DD')
                       FROM station_inspection WHERE station_id = $1),
    inspection_69  = (SELECT EXISTS(SELECT 1
                       FROM station_inspection WHERE station_id = $1))
WHERE id_fm = $1;
```

Create + recompute always run in one Prisma transaction.

### 5.2 New routes

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET`    | `/api/stations/:id/inspections` | logged in | — | `{ inspections: StationInspection[] }` newest-first |
| `POST`   | `/api/stations/:id/inspections` | logged in | `{ inspectedOn, helperUserIds[], notes? }` (lead = session user) | `{ inspection: StationInspection, station: FMStation }` |
| `DELETE` | `/api/inspections/:id` | admin OR `lead_user_id == session.userId` | — | `{ ok: true, station: FMStation }` |
| `GET`    | `/api/users/inspectors` | logged in | — | `{ users: { id, username, displayName }[] }`, `active = true`, role ∈ {admin, inspector}, sorted by displayName |

`POST` returns the updated `FMStation` alongside the inspection so the client can patch its store in one round-trip (matches the optimistic-update pattern in `src/components/OptimizedFMStationClient.tsx`).

### 5.3 Changes to existing `PATCH /api/stations/:id`

`src/app/api/stations/[id]/route.ts:38-50` currently auto-stamps `date_inspected = today` whenever `inspection_69` flips true. Remove that branch — `date_inspected` is now always derived from `station_inspection`. Toggling `inspection_69` directly via PATCH stays available for back-compat tooling but the new UI does not use it.

### 5.4 Validation (server-side, 400 on failure)

- `inspectedOn` matches `^\d{4}-\d{2}-\d{2}$`, parses as a real date, not in the future.
- `leadUserId` exists, is `active`, role ∈ {admin, inspector}.
- Every `helperUserId` same; helpers ⊄ {leadUserId}; no dupes; max 5 helpers.
- Station exists.
- Idempotency: same `(stationId, inspectedOn, leadUserId)` → 409 with the existing inspection's id, no insert.

### 5.5 Auth

All routes go through the existing middleware (`src/middleware.ts`). DELETE is the only authorization-sensitive case (admin or original lead).

## 6. UI

### 6.1 Affected files

- `src/components/map/StationCard.tsx` — desktop popup + sidebar.
- `src/components/field-ops/FieldOpsBottomSheet.tsx` — mobile/field-ops sheet.
- `src/components/OptimizedFMStationClient.tsx` — owns `stationsRef`; gets `handleCreateInspection` alongside `handleUpdateStation`; fetches `/api/users/inspectors` once on mount.

### 6.2 New shared components — `src/components/inspection/`

```
InspectionPanel.tsx            // orchestrator: latest + history + new-form toggle
InspectionLatest.tsx           // "Inspected 2026-04-21 by iff with daf, ice"
InspectionHistoryList.tsx      // collapsible list of all prior inspections
NewInspectionForm.tsx          // date picker + helpers checkboxes + notes + Save
InspectorChips.tsx             // shared chip: avatar-circle + display name
```

Each is small, single-purpose, and unit-testable. Both `StationCard` and `FieldOpsBottomSheet` render `<InspectionPanel station={...} />`.

### 6.3 Layout

```
┌─ Inspection ────────────────────────────────────┐
│ ✅ ตรวจแล้ว                                      │
│ 📅 2026-04-21 · iff (lead) + daf, ice           │   InspectionLatest
│                                                  │
│ ▾ History (3)                                    │   collapsed by default
│   2026-02-12 · iff + daf                         │
│   2025-09-14 · admin                             │
│   2025-04-24 · ice + iff                         │
│                                                  │
│ [+ Record inspection]                            │   opens NewInspectionForm
└──────────────────────────────────────────────────┘
```

`+ Record inspection` inline-expands to:

```
┌─ Record inspection ─────────────────────────────┐
│ Date inspected: [📅 2026-05-13 ▾]   max=today   │
│ Lead: iff (you)                                  │   read-only
│ With (optional):                                 │
│   ☐ admin   ☐ ice   ☑ daf   ☐ dao                │   excludes self & inactive (aom hidden)
│ Notes: [_______________________________]         │
│                          [Cancel]  [Save]        │
└──────────────────────────────────────────────────┘
```

- Save → `POST /api/stations/:id/inspections`. Parent merges returned `FMStation` into `stationsRef` (existing optimistic path). Latest row updates immediately; History count bumps.
- Loading spinner reuses `LoadingSpinner`.
- Helpers checklist excludes the current user.
- Old "Inspect" toggle button is removed. The Inspected/ยังไม่ตรวจ badge now derives from "any inspection exists."

### 6.4 Mobile (`FieldOpsBottomSheet`)

Same components, rendered as full-width rows in the sheet, matching the existing `Cell` pattern at `src/components/field-ops/FieldOpsBottomSheet.tsx:543`. Native `<input type="date">` so the iOS picker shows up.

### 6.5 Filter / list compatibility

- Sidebar filter "Inspection 69" still works (reads `station.inspection69`, still derived).
- Distance/sort/search untouched.
- `/api/analytics/summary` untouched in this milestone (counts `inspection_69 = true`, still works). A "by inspector / by month" breakdown is a follow-up.

### 6.6 i18n / a11y

- Form labels in Thai: `วันที่ตรวจ`, `ผู้ร่วมตรวจ`, `บันทึก`, `ยกเลิก`.
- Date input enforces `max={today}` client-side.
- Tab order: date → helpers → notes → Save.

## 7. Testing

| File | Coverage |
|---|---|
| `src/__tests__/inspection-service.test.ts` | `createInspection` happy path; idempotency 409; recompute updates `date_inspected` to MAX; deleting last inspection clears `date_inspected` and flips `inspection_69` to false |
| `src/__tests__/api-inspections.test.ts` | All 4 routes: 200/201/400/403/404/409; 401 when logged out; 403 for non-admin non-owner DELETE |
| `src/__tests__/inspection-import-xlsx.test.ts` | B.E.→C.E. parsing; whitespace normalization; unmapped name → exit 1; missing `id_fm` → exit 1; idempotent re-run = 0 inserts |
| `src/__tests__/inspection-panel.test.tsx` | Renders latest + history toggle; Record form opens, posts payload, merges returned station, closes form |
| `src/__tests__/new-inspection-form.test.tsx` | Date defaults to today; future dates blocked; helpers exclude self; Save disabled while submitting |
| `src/__tests__/field-ops-inspection.test.tsx` | `FieldOpsBottomSheet` shows `InspectionPanel` and behaves like desktop |

Update existing tests:

- `src/__tests__/api-routes.test.ts` — drop the assertion that `inspection_69 = true` auto-stamps `date_inspected = today`.
- `src/__tests__/optimized-client-deep.test.tsx` and `src/__tests__/fm-station-client-deep.test.tsx` — point any old Inspect-toggle assertions at the new flow.

Coverage target: ≥81% (current bar per `CLAUDE.md`).

## 8. Migration + rollout

### 8.1 Migration

Single Prisma migration `20260513_add_station_inspection`:

1. Create `station_inspection` and `station_inspection_member` tables.
2. `UPDATE "user" SET active = false WHERE username = 'aom';`
3. No backfill from existing `fm_station.date_inspected` — the xlsx importer is the canonical seed.

Apply via `npx prisma migrate dev` locally → review SQL → push to Neon (`prisma migrate deploy`) on a Neon branch first per the `wiki/` Neon workflow.

### 8.2 Rollout order

1. Migration + service + API + tests merged. UI still shows the old Inspect button (no user-visible change yet).
2. Run xlsx importer on a Neon branch, verify diff, then on main DB.
3. Ship the new `InspectionPanel` UI in `StationCard` + `FieldOpsBottomSheet`. Old Inspect button removed in the same PR.
4. Manual smoke test on dev server: record an inspection as `iff`, tag `daf`, verify the modal updates and `fm_station.date_inspected` matches in DB.

### 8.3 Rollback

- UI: revert the PR.
- Data: `DELETE FROM station_inspection WHERE source = 'xlsx_import_2026_05';` then `recomputeStationInspectionState` for each affected station.
- Schema: `prisma migrate down` drops the two new tables (only safe if no app-created inspections exist yet).

## 9. Open questions

None at design time. The 3 state stations missing `id_fm` in the xlsx (สวท. ชัยภูมิ / นครราชสีมา / สวส. รัฐสภา นครราชสีมา) will surface during validation — user decides whether to add them to `fm_station` before re-running the importer.
