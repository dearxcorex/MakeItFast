# Desktop Field-Ops Inspection Panel — Design

**Date:** 2026-05-16
**Status:** Draft, pending user review
**Author:** brainstormed with deardevx@gmail.com
**Builds on:** `docs/superpowers/specs/2026-05-13-inspector-tagging-design.md`

---

## 1. Problem

The inspector-tagging feature ships an `InspectionPanel` (date + lead + helpers + history) on the main map popup and the mobile field-ops bottom sheet. The **desktop field-ops right rail** (`FieldOpsCurrentFM` at `src/components/field-ops/FieldOpsCurrent.tsx`) still uses the legacy `✓ INSPECT` toggle: one-tap PATCH that flips `inspection_69` and stamps `date_inspected = today`. No date is shown to the user. No inspector name is shown. The new `station_inspection` table is not consulted.

We want desktop to surface the same information as mobile: the inspection date and the inspector(s) who did the work, with the same "+ Record inspection" flow.

## 2. Non-goals

- Theming the main map popup (`StationCard`) to match the field-ops dark theme. It keeps its Tailwind look.
- Editing or deleting historical inspections from the desktop rail (the DELETE endpoint exists; no UI is added now).
- Replacing the inspector display name. Usernames (`iff`, `dao`, `admin`, `ice`, `daf`) stay as the visible label.
- Surfacing inspector names in list rows (FM list, popups). Detail-view only.
- Touching the interference (`int`) inspection toggle — interference inspections are a separate workflow and remain on the legacy PATCH.

## 3. Component structure

### 3.1 New: `FieldOpsInspectionPanel`

Path: `src/components/field-ops/FieldOpsInspectionPanel.tsx`.

Props interface matches the existing `InspectionPanel` exactly so the controller passes identical data:

```ts
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
```

It renders using the rail's design tokens — no Tailwind utility classes:

- **Wrapper:** `border: 1px solid var(--fo-rail-border); border-radius: 12px; background: rgba(255,255,255,0.02); padding: 12px`.
- **Section header row:** `fo-mono` label `INSPECTION` in `var(--fo-accent)`, with the `+ บันทึก` button right-aligned (matches existing `ButtonRow` `primary` variant).
- **Latest line:** `fo-serif` date in Thai locale (`formatInspectionDate`), preceded by a mono `INSPECTED`/`PENDING` token in `var(--fo-accent)` / `var(--fo-warn)`.
- **Chips row:** inline mono label `ผู้ตรวจ:` → filled lead chip (`background: var(--fo-accent); color: var(--fo-rail-bg)`) with `★` prefix → outline helper chips (`border: 1px solid var(--fo-rail-border); color: var(--fo-rail-mute)`).
- **History toggle:** mono caret `▾ HISTORY (n)` → expanded list reuses the same chip atoms; each row shows date + chips, divider above.
- **`FieldOpsNewInspectionForm`** (~60-line inline subcomponent in the same file): stacked inputs themed for the rail. Date input gets `border: 1px solid var(--fo-rail-border); background: var(--fo-rail-bg)`. Helper checkboxes are mono with rail-mute label color. Cancel + Save buttons mirror existing `ButtonRow` style.

The form is in the same file (not shared with the Tailwind `NewInspectionForm`) so each theme stays self-contained and easy to evolve.

### 3.2 Unchanged

- `inspectionService`, `/api/stations/:id/inspections`, `/api/inspections/:id`, `/api/users/inspectors`.
- `src/types/inspection.ts`.
- `OptimizedFMStationClient` and `StationCard` (main map view — still Tailwind).
- `FieldOpsBottomSheet` (mobile — still Tailwind `InspectionPanel`).
- `FieldOpsClient`'s data plumbing (already fetches inspectors, holds `inspectionHistory`, exposes `loadInspectionsFor` + `handleCreateInspection`, forwards `currentUser`).

## 4. Wiring + layout changes

### 4.1 `FieldOpsCurrentFM` (modify)

Props gain the same five fields used in the mobile sheet:

```ts
inspectionHistory?: StationInspection[];
inspectors?: InspectorOption[];
currentUser?: { id: number; displayName: string };
onLoadInspections?: () => void;
onCreateInspection?: (input: { ... }) => Promise<void>;
```

The `onToggleInspection` prop is **removed**. The button row at line 114-127 becomes single-button (`▶ NAVIGATE` only). The new panel is rendered right after the meters row, before the On-Air row:

```
[ FM ]  [INSPECTED ●]  [OFF AIR]                badges (unchanged; INSPECTED badge stays)
สวท. ชัยภูมิ                                     name (unchanged)
ชัยภูมิ · เมืองชัยภูมิ                            location (unchanged)
FREQ  92.75 MHz   PERMIT  —   POWER  —          meters (unchanged)
▶ NAVIGATE                                       single-button row
─────────────────────────────────────────────
INSPECTION                              [+ บันทึก]
✓ INSPECTED · 12 กุมภาพันธ์ 2569
ผู้ตรวจ: [★ iff]  [daf]  [ice]
▾ HISTORY (2)
─────────────────────────────────────────────
[ ON AIR · STOP ]                                existing OnAir toggle (unchanged)
─────────────────────────────────────────────
ALSO AT THIS LOCATION · 2                        co-located list (unchanged)
```

The panel is rendered conditionally:

```tsx
{onCreateInspection && currentUser && inspectors && (
  <FieldOpsInspectionPanel
    stationId={Number(station.id)}
    history={inspectionHistory ?? []}
    currentUser={currentUser}
    inspectors={inspectors}
    onCreate={onCreateInspection}
  />
)}
```

A `useEffect` calls `onLoadInspections?.()` when `station.id` changes, mirroring `StationCard`'s mount-time fetch.

### 4.2 `FieldOpsClient` (modify)

The render site at `FieldOpsClient.tsx:514-522` passes the five new props (analogous to what's already passed to `<FieldOpsBottomSheet>`):

```tsx
<FieldOpsCurrentFM
  station={selectedStation}
  coLocated={coLocatedStations}
  onSelectStation={(id) => handleSelect({ kind: "fm", id })}
  onToggleOnAir={handleToggleOnAir}
  pending={pending}
  inspectors={inspectors}
  inspectionHistory={inspectionHistory[Number(selectedStation.id)] ?? []}
  currentUser={currentUser}
  onLoadInspections={() => loadInspectionsFor(Number(selectedStation.id))}
  onCreateInspection={handleCreateInspection}
/>
```

`onToggleInspection` is gone from this render site for FM.

### 4.3 `handleToggleInspection` cleanup

`FieldOpsClient.tsx:205-244` currently branches on `selection.kind`. The FM branch becomes dead code. Trim to interference-only and rename for clarity:

```ts
const handleToggleInterferenceInspection = async () => {
  if (!selection || selection.kind !== "int" || !selectedSite) return;
  setPending(true);
  try {
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
  } catch (err) {
    console.error(err);
    window.location.reload();
  } finally {
    setPending(false);
  }
};
```

`FieldOpsCurrentINT` keeps receiving this handler under the same prop name (rename of the variable, not the prop, to minimize churn). The mobile bottom sheet's `onToggleInspection` prop similarly continues to point at this handler for the interference branch — its FM branch was never reachable from the panel-driven flow anyway.

## 5. Testing

- **`src/__tests__/field-ops-inspection-panel.test.tsx`** (new):
  - Renders empty state when `history=[]` (shows `PENDING` token, no date).
  - Renders latest date + lead chip + helper chips for a populated history.
  - History toggle expands to show prior rows.
  - `+ บันทึก` opens the form; submitting calls `onCreate` with the right shape; helpers exclude self; date defaults to today; future dates blocked.
- **Update existing field-ops tests** that asserted on the legacy `✓ INSPECT` button (`field-ops-current.test.tsx` if present, else `components-batch*`): drop those assertions; replace with `getByRole('button', { name: /บันทึก/i })` or `data-testid="field-ops-inspection-panel"`.
- **`field-ops-inspection.test.tsx`** (mobile): unchanged.

Coverage target: keep ≥81% (project bar).

## 6. Rollout

1. Land `FieldOpsInspectionPanel` + its unit test (panel works in isolation, no consumer changes).
2. Wire into `FieldOpsCurrentFM`, drop the legacy button, update render site in `FieldOpsClient`, update affected tests.
3. Trim `handleToggleInspection` in `FieldOpsClient` to `handleToggleInterferenceInspection`.
4. `npm run build`, `npm run lint`, full test sweep.
5. Manual smoke test on `/field-ops` desktop:
   - Open an inspected station (e.g. `5520014`) → see `INSPECTED · 3 เมษายน 2569` + `iff` + helper chips.
   - Open a never-inspected station → see `PENDING` empty state.
   - Click `+ บันทึก` → form opens with today's date, tag a helper, save → panel updates with new latest, history count bumps.

## 7. Rollback

UI-only change with no DB or API surface changes. Revert the PR.

## 8. Open questions

None at design time.
