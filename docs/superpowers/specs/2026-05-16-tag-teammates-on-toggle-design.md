# Tag Teammates on Inspect Toggle — Design

**Date:** 2026-05-16
**Status:** Draft, pending user review
**Author:** brainstormed with deardevx@gmail.com
**Builds on:** the reverted `✓ INSPECT/INSPECTED` toggle (`099d3be`) + the silent history-capture in `PATCH /api/stations/:id` (`createInspection` sidecar).

---

## 1. Problem

After the revert, every UI inspect-toggle creates a `station_inspection` row with `helperUserIds: []`. Helper attribution only exists in the 26 xlsx-backfilled rows; new live work has zero helper data. The Inspectors dashboard's "Most-tagged helper" and per-user lead/helper donut splits will skew 100% lead over time unless toggling lets the user tag teammates.

Goal: add a minimal "tag teammates" affordance to the existing toggle without bringing back the date-picker / history / notes panel the user rejected.

## 2. Non-goals

- Re-introducing the date picker (date is always today).
- Re-introducing the notes field.
- History view in the field-ops UI (still surfaced in the Analytics tab).
- Tagging teammates on the main map's `StationCard` (per Q3 — not selected).
- Re-tagging after a station is already INSPECTED (per Q2 — picker hidden on INSPECTED).
- Admin/UPDATE endpoint to amend an existing inspection's helpers in place.
- Bulk tag (apply same helpers across multiple stations).

## 3. UX

### 3.1 Trigger and layout

Below the `✓ INSPECT` button in `FieldOpsCurrentFM` (desktop rail) and `FieldOpsBottomSheet` (mobile sheet), render a `<TeammatePicker>` component.

Collapsed default state:

```
[ ✓ INSPECT ]
+ tag teammates
```

Expanded state (after clicking the link):

```
[ ✓ INSPECT ]
[★ daf] [ ice ] [ admin ] [ dao ]   – collapse
```

Clicked chips highlight; selected helpers stay visible as filled chips even after collapsing.

### 3.2 Behavior

- The picker is rendered **only when `station.inspection69 === 'ยังไม่ตรวจ'`** (PENDING). Once INSPECTED, the picker disappears; the legacy `✓ INSPECTED` toggle behaves as today.
- Self (current user) is **excluded** from the helper list — they're always the lead.
- Inactive users (`aom`) are excluded via the existing `/api/users/inspectors` filter.
- Renders nothing if the active inspector roster has only the current user.
- When the user clicks `✓ INSPECT`, the currently-selected helpers are sent with the toggle. After a successful toggle, helper selection resets so the next station starts with an empty picker.
- When the user switches stations without clicking INSPECT, the picker resets to empty.

## 4. Component

### 4.1 `src/components/field-ops/TeammatePicker.tsx`

```ts
interface Props {
  inspectors: { id: number; username: string; displayName: string }[];
  currentUserId: number;
  value: number[];                              // selected helper IDs
  onChange: (helperUserIds: number[]) => void;
  disabled?: boolean;                           // dimmed while pending
}
```

- ~80 lines, single-purpose. Styled with the existing `--fo-` design tokens (`var(--fo-accent)`, `var(--fo-mono)`, `var(--fo-line)`) so it slots into both the desktop rail and the mobile sheet without theme branching.
- Local `useState<boolean>` for collapsed/expanded.
- `helperOptions = inspectors.filter(u => u.id !== currentUserId)`.
- Returns `null` when `helperOptions.length === 0`.
- Selected helpers stored as `Set<number>` internally for fast toggling; surfaced to parent as `number[]` via `onChange`.

### 4.2 Wiring in `FieldOpsClient`

`FieldOpsClient` already fetches inspectors and holds the controller state for the FM flow. Add:

```ts
const [helperUserIds, setHelperUserIds] = useState<number[]>([]);

// Reset whenever the selected FM station changes.
const fmStationId = selection?.kind === 'fm' ? selectedStation?.id ?? null : null;
useEffect(() => { setHelperUserIds([]); }, [fmStationId]);
```

Pass four props to both `<FieldOpsCurrentFM>` and `<FieldOpsBottomSheet>`:

```ts
inspectors,
currentUser,
helperUserIds,
onHelperUserIdsChange: setHelperUserIds,
```

In `handleToggleInspection`'s FM branch, when the new state is `'ตรวจแล้ว'`, send the current `helperUserIds` along with the PATCH body, and clear `setHelperUserIds([])` after a successful response.

### 4.3 Wiring in `FieldOpsCurrentFM` and `FieldOpsBottomSheet`

Both gain four optional props (`inspectors`, `currentUser`, `helperUserIds`, `onHelperUserIdsChange`). Both render `<TeammatePicker>` immediately below the existing INSPECT button, gated by `inspection69 !== 'ตรวจแล้ว'`:

```tsx
{station.inspection69 !== 'ตรวจแล้ว' && onHelperUserIdsChange && inspectors && currentUser && (
  <TeammatePicker
    inspectors={inspectors}
    currentUserId={currentUser.id}
    value={helperUserIds ?? []}
    onChange={onHelperUserIdsChange}
    disabled={pending}
  />
)}
```

## 5. Backend

### 5.1 `PATCH /api/stations/[id]`

Extend the request body type to include an optional array:

```ts
{
  inspection69?: 'ตรวจแล้ว' | 'ยังไม่ตรวจ' | boolean;
  helperUserIds?: number[];   // honored only when toggling on
  // ...other existing fields...
}
```

When the handler reaches its existing `createInspection` sidecar call (the one that records who toggled), pass the helpers through:

```ts
await createInspection({
  stationId,
  inspectedOn: today,
  leadUserId: session.userId,
  helperUserIds: Array.isArray(body.helperUserIds) ? body.helperUserIds : [],
});
```

The `inspectionService.createInspection` already validates helper IDs (active inspectors, no duplicates, helpers ⊄ {lead}, ≤5 helpers), so no additional validation is added in the route. If validation fails inside the service, the error is caught by the existing `try/catch` and logged — the PATCH still succeeds (boolean flip is the primary intent). The user sees the toggle succeed but won't see history attribution; this is the desired graceful degradation.

### 5.2 No new endpoint

No new routes. `/api/users/inspectors` already returns the active roster.

## 6. Testing

- **`src/__tests__/teammate-picker.test.tsx`** — new. Cases:
  - Renders the collapsed link by default.
  - Clicking the link expands the helper checkbox row.
  - Clicking a helper checkbox calls `onChange` with the updated array.
  - Hides self from the helper list.
  - Returns null when `inspectors.length === 1` (only self).
  - Selected helpers remain visible as chips after collapsing.
- **`src/__tests__/api-routes.test.ts`** — extend the existing PATCH test that asserts the `createInspection` sidecar. Add a case verifying `helperUserIds: [6]` in the request body produces `createInspection({..., helperUserIds: [6] })`.
- **`src/__tests__/field-ops-current.test.tsx`** — add cases:
  - Picker absent when `inspection69 === 'ตรวจแล้ว'`.
  - Picker present when `inspection69 === 'ยังไม่ตรวจ'` and the four props are provided.

Coverage target: keep ≥81% project bar.

## 7. Rollout

1. Land `TeammatePicker` + its unit tests.
2. Extend `PATCH /api/stations/[id]` to accept and forward `helperUserIds`. Add the API-routes test case.
3. Wire `FieldOpsClient` state + props pass-through into `FieldOpsCurrentFM` and `FieldOpsBottomSheet`. Add the two field-ops-current tests.
4. `npm run build`, `npm run lint`, full vitest sweep.
5. Manual smoke: open a PENDING station, tag a teammate, click INSPECT. Verify the new `station_inspection` row in DB has the helper. Verify the picker disappears now that the station is INSPECTED.

## 8. Rollback

UI + a single optional body field on PATCH. Revert the PR; no schema or data changes.

## 9. Open questions

None at design time.
