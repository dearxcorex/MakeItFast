# Separate REVOKED from OFF AIR + Distinct INSPECT Color for Revoked Stations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated REVOKED filter (independent of OFF AIR) on desktop and mobile, and give the INSPECT button on revoked stations a visually distinct color from both off-air and normal inspect states.

**Architecture:** `FieldFilters` gains a new boolean `revoked`. Filter logic in `FieldOpsClient` makes OFF AIR exclusive of revoked rows so the two filters are truly disjoint. UI gets a new REVOKED toggle (desktop pill + mobile segmented option). The shared `ButtonRow` gains a `danger` variant (red, distinct from `warn` amber and `primary` green); both desktop `FieldOpsCurrentFM` and mobile `FieldOpsBottomSheet` use it for INSPECT when `station.revoked === true`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind 4 (CSS variables), Vitest + @testing-library/react.

---

## File Structure

**Created:** none — all changes modify existing files.

**Modified:**
- `src/components/field-ops/FieldOpsFilters.tsx` — add `revoked` to `FieldFilters` interface + `DEFAULT_FILTERS`; add REVOKED `<Toggle>` next to OFF AIR; type-cascade reset on FM/INT switch.
- `src/components/field-ops/FieldOpsClient.tsx` — apply `revoked` filter to FM rows; redefine `offAir` filter to exclude revoked rows so the two are disjoint.
- `src/components/field-ops/MobileFilterBar.tsx` — add `REVOKED` to the FM STATUS segmented row + update `activeCount` / `isStatusActive` / `handleStatus`.
- `src/components/field-ops/FieldOpsCurrent.tsx` — extend `CommonAction.variant` to include `"danger"`; render red palette in `ButtonRow`; use `"danger"` variant for FM INSPECT when `station.revoked === true`.
- `src/components/field-ops/FieldOpsBottomSheet.tsx` — restyle the mobile INSPECT button to match (red when revoked, green when not).
- `src/__tests__/field-ops-current.test.tsx` — test that revoked station renders INSPECT with the danger palette.
- `src/__tests__/mobile-filter-bar-field-ops.test.tsx` — test that REVOKED appears in the FM STATUS row and toggling it calls `onChange` with the new flag.

**Test:** `src/__tests__/field-ops-filters.test.ts` — new file. Tests the pure filter predicate behavior (offAir/revoked disjointness) by extracting the filter logic into a helper.

---

## Task 1: Add `revoked` field to `FieldFilters` type and defaults

**Files:**
- Modify: `src/components/field-ops/FieldOpsFilters.tsx:7-28`

Currently `FieldFilters` has `offAir`, `lawSent` flags but no `revoked`. We add it as another boolean — FM-only, like `offAir`.

- [ ] **Step 1: Edit the interface and defaults**

In `src/components/field-ops/FieldOpsFilters.tsx`, change the interface and `DEFAULT_FILTERS`:

```ts
export interface FieldFilters {
  type: TypeFilter;
  province: string;
  status: StatusFilter;
  /** Interference ranking — INT-only. Ignored when type=FM. */
  severity: SeverityFilter;
  /** FM "off air" toggle — FM-only. Excludes revoked rows so REVOKED stays disjoint. */
  offAir: boolean;
  /** FM "revoked" toggle — FM-only. License revoked by NBTC; illegal if on-air. */
  revoked: boolean;
  /** INT "law paper sent" toggle — INT-only. Ignored when type=FM. */
  lawSent: boolean;
  search: string;
}

export const DEFAULT_FILTERS: FieldFilters = {
  type: "ALL",
  province: "All",
  status: "ALL",
  severity: "ALL",
  offAir: false,
  revoked: false,
  lawSent: false,
  search: "",
};
```

Also update the type-cascade in `handleTypeChange` so switching to INT clears `revoked`:

```ts
  const handleTypeChange = (v: TypeFilter) => {
    const next: FieldFilters = { ...filters, type: v };
    if (v === "FM") {
      next.severity = "ALL";
      next.lawSent = false;
    }
    if (v === "INT") {
      next.offAir = false;
      next.revoked = false;
    }
    onChange(next);
  };
```

- [ ] **Step 2: Run TypeScript to verify no consumers break**

Run: `npx tsc --noEmit 2>&1 | grep -E "FieldFilters|revoked" | head -20`
Expected: no errors mentioning `revoked` (other consumers will continue to work because the new field has a default).

- [ ] **Step 3: Commit**

```bash
git add src/components/field-ops/FieldOpsFilters.tsx
git commit -m "feat(field-ops): add revoked field to FieldFilters type"
```

---

## Task 2: Apply REVOKED filter and make OFF AIR disjoint from REVOKED

**Files:**
- Modify: `src/components/field-ops/FieldOpsClient.tsx:85-99` (the `filteredStations` useMemo)

Today the FM filter applies `if (filters.offAir && s.onAir !== false) return false;` — that includes revoked rows in the OFF AIR set (revoked stations have `on_air = false`). After this task, OFF AIR returns only "naturally" off-air rows (license still valid) and REVOKED is its own bucket.

- [ ] **Step 1: Edit the FM filter predicate**

In `src/components/field-ops/FieldOpsClient.tsx`, replace the `filteredStations` useMemo body:

```ts
  const filteredStations = useMemo(() => {
    if (filters.type === "INT") return [];
    return stations.filter((s) => {
      if (filters.province !== "All" && s.state !== filters.province) return false;
      if (filters.status === "PENDING" && s.inspection69 === "ตรวจแล้ว") return false;
      if (filters.status === "INSPECTED" && s.inspection69 !== "ตรวจแล้ว") return false;
      // OFF AIR: license still valid but currently silent. Excludes revoked
      // so the OFF AIR / REVOKED filters are truly disjoint.
      if (filters.offAir && (s.onAir !== false || s.revoked === true)) return false;
      // REVOKED: license cancelled by NBTC. Illegal if on-air.
      if (filters.revoked && s.revoked !== true) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${s.name} ${s.frequency} ${s.city} ${s.state} ${s.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [stations, filters]);
```

- [ ] **Step 2: Verify dev server still compiles**

Run: `tmux capture-pane -t dev -p | tail -3`
Expected: `✓ Compiled in <Xms>` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/field-ops/FieldOpsClient.tsx
git commit -m "feat(field-ops): apply revoked filter and make OFF AIR exclude revoked rows"
```

---

## Task 3: Add a unit test for the filter predicate behavior

**Files:**
- Create: `src/__tests__/field-ops-filters.test.ts`

Pure function test for the disjointness invariant. Since the filter is currently inline in `FieldOpsClient`, we extract a small pure helper first (it's easier to test, and the current implementation is awkward to mount in jsdom).

- [ ] **Step 1: Extract a pure helper**

In `src/components/field-ops/FieldOpsClient.tsx`, **`FMStation` is already imported at line 5 and `FieldFilters` at line 9 — do not add new imports.** Above `export default function FieldOpsClient(...)`, add the function declaration:

```ts
/**
 * Pure FM filter predicate. Exported for unit tests.
 * Returns true if `s` should be visible under `filters`.
 */
export function fmStationMatchesFilter(s: FMStation, filters: FieldFilters): boolean {
  if (filters.province !== "All" && s.state !== filters.province) return false;
  if (filters.status === "PENDING" && s.inspection69 === "ตรวจแล้ว") return false;
  if (filters.status === "INSPECTED" && s.inspection69 !== "ตรวจแล้ว") return false;
  if (filters.offAir && (s.onAir !== false || s.revoked === true)) return false;
  if (filters.revoked && s.revoked !== true) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const hay = `${s.name} ${s.frequency} ${s.city} ${s.state} ${s.id}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
```

Then change the `filteredStations` useMemo to call it:

```ts
  const filteredStations = useMemo(() => {
    if (filters.type === "INT") return [];
    return stations.filter((s) => fmStationMatchesFilter(s, filters));
  }, [stations, filters]);
```

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/field-ops-filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fmStationMatchesFilter } from "@/components/field-ops/FieldOpsClient";
import { DEFAULT_FILTERS } from "@/components/field-ops/FieldOpsFilters";
import type { FMStation } from "@/types/station";

function makeStation(overrides: Partial<FMStation> = {}): FMStation {
  return {
    id: 1,
    name: "Test",
    frequency: 100.0,
    latitude: 13.7,
    longitude: 100.5,
    city: "City",
    state: "State",
    inspection69: "ยังไม่ตรวจ",
    onAir: true,
    revoked: false,
    ...overrides,
  } as FMStation;
}

describe("fmStationMatchesFilter", () => {
  it("returns true under default filters for a normal on-air station", () => {
    expect(fmStationMatchesFilter(makeStation(), DEFAULT_FILTERS)).toBe(true);
  });

  it("OFF AIR filter excludes on-air rows", () => {
    const filters = { ...DEFAULT_FILTERS, offAir: true };
    expect(fmStationMatchesFilter(makeStation({ onAir: true }), filters)).toBe(false);
  });

  it("OFF AIR filter excludes revoked rows (disjoint from REVOKED)", () => {
    const filters = { ...DEFAULT_FILTERS, offAir: true };
    const s = makeStation({ onAir: false, revoked: true });
    expect(fmStationMatchesFilter(s, filters)).toBe(false);
  });

  it("OFF AIR filter includes naturally off-air rows (revoked=false)", () => {
    const filters = { ...DEFAULT_FILTERS, offAir: true };
    const s = makeStation({ onAir: false, revoked: false });
    expect(fmStationMatchesFilter(s, filters)).toBe(true);
  });

  it("REVOKED filter excludes non-revoked rows", () => {
    const filters = { ...DEFAULT_FILTERS, revoked: true };
    expect(fmStationMatchesFilter(makeStation({ revoked: false }), filters)).toBe(false);
  });

  it("REVOKED filter includes revoked rows regardless of onAir", () => {
    const filters = { ...DEFAULT_FILTERS, revoked: true };
    expect(fmStationMatchesFilter(makeStation({ revoked: true, onAir: true }), filters)).toBe(true);
    expect(fmStationMatchesFilter(makeStation({ revoked: true, onAir: false }), filters)).toBe(true);
  });

  it("OFF AIR + REVOKED both on: only revoked-and-off-air rows match", () => {
    // Both filters are AND-ed. Since OFF AIR now excludes revoked, this
    // combination is intentionally empty — useful to assert disjointness.
    const filters = { ...DEFAULT_FILTERS, offAir: true, revoked: true };
    expect(fmStationMatchesFilter(makeStation({ revoked: true, onAir: false }), filters)).toBe(false);
    expect(fmStationMatchesFilter(makeStation({ revoked: false, onAir: false }), filters)).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/field-ops-filters.test.ts`
Expected: 7 passed.

- [ ] **Step 4: Commit**

```bash
git add src/components/field-ops/FieldOpsClient.tsx src/__tests__/field-ops-filters.test.ts
git commit -m "test(field-ops): extract fmStationMatchesFilter and cover offAir/revoked disjointness"
```

---

## Task 4: Add REVOKED toggle to desktop filter bar

**Files:**
- Modify: `src/components/field-ops/FieldOpsFilters.tsx:107-120` (the toggle block)

Today desktop has `OFF AIR` and `LAW SENT` toggles. We add `REVOKED` between them, with the same `<Toggle>` component but a different active color (red, matching `--fo-crit`).

- [ ] **Step 1: Add a new prop to the Toggle component for active color**

In `src/components/field-ops/FieldOpsFilters.tsx`, change the Toggle definition (currently around line 162):

```tsx
function Toggle({
  label,
  active,
  onChange,
  activeColor = "var(--fo-accent)",
}: {
  label: string;
  active: boolean;
  onChange: (v: boolean) => void;
  activeColor?: string;
}) {
  return (
    <button
      type="button"
      className="fo-mono"
      onClick={() => onChange(!active)}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? activeColor : "var(--fo-divider)"}`,
        background: active ? activeColor : "transparent",
        color: active ? "var(--fo-ink)" : "var(--fo-band-text)",
        fontSize: 10,
        cursor: "pointer",
        letterSpacing: "0.16em",
      }}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Render the REVOKED toggle**

In `src/components/field-ops/FieldOpsFilters.tsx`, replace the toggle block (around lines 107-120) with:

```tsx
      {showOffAir && (
        <Toggle
          label="OFF AIR"
          active={filters.offAir}
          onChange={(v) => onChange({ ...filters, offAir: v })}
        />
      )}
      {showOffAir && (
        <Toggle
          label="REVOKED"
          active={filters.revoked}
          onChange={(v) => onChange({ ...filters, revoked: v })}
          activeColor="var(--fo-crit)"
        />
      )}
      {showLawSent && (
        <Toggle
          label="LAW SENT"
          active={filters.lawSent}
          onChange={(v) => onChange({ ...filters, lawSent: v })}
        />
      )}
```

(`showOffAir` is already defined at line 45 as `filters.type !== "INT"` — REVOKED is FM-only just like OFF AIR.)

- [ ] **Step 3: Verify dev server compiles**

Run: `tmux capture-pane -t dev -p | tail -3`
Expected: `✓ Compiled in <Xms>` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/field-ops/FieldOpsFilters.tsx
git commit -m "feat(field-ops): add REVOKED toggle to desktop filter bar"
```

---

## Task 5: Add REVOKED option to mobile FM STATUS row

**Files:**
- Modify: `src/components/field-ops/MobileFilterBar.tsx:12-13,46-79`

The mobile filter shows STATUS as a segmented control. For FM it includes `OFF AIR`. We add `REVOKED` after `OFF AIR` so users can pick exactly one of (PENDING, INSPECTED, OFF AIR, REVOKED) or ALL.

- [ ] **Step 1: Update the option list and handlers**

In `src/components/field-ops/MobileFilterBar.tsx`, change the `STATUSES_FM` constant and the relevant handlers:

```ts
const STATUSES_FM: Array<StatusFilter | "OFF AIR" | "REVOKED"> = [
  "ALL",
  "PENDING",
  "INSPECTED",
  "OFF AIR",
  "REVOKED",
];
const STATUSES_INT: StatusFilter[] = ["ALL", "PENDING", "INSPECTED"];
```

- [ ] **Step 2: Update `activeCount` to count revoked**

Replace the `activeCount` block (around lines 45-51):

```ts
  const activeCount =
    (filters.type !== "ALL" ? 1 : 0) +
    (filters.status !== "ALL" ? 1 : 0) +
    (filters.province !== "All" ? 1 : 0) +
    (filters.offAir ? 1 : 0) +
    (filters.revoked ? 1 : 0) +
    (filters.lawSent ? 1 : 0) +
    (filters.search.trim().length > 0 ? 1 : 0);
```

- [ ] **Step 3: Update `handleStatus` and `isStatusActive`**

Replace these two handlers in `src/components/field-ops/MobileFilterBar.tsx` (around lines 64-75):

```ts
  const handleStatus = (v: StatusFilter | "OFF AIR" | "REVOKED") => {
    if (v === "OFF AIR") {
      onChange({ ...filters, status: "ALL", offAir: !filters.offAir, revoked: false });
    } else if (v === "REVOKED") {
      onChange({ ...filters, status: "ALL", offAir: false, revoked: !filters.revoked });
    } else {
      onChange({ ...filters, status: v as StatusFilter, offAir: false, revoked: false });
    }
  };

  const isStatusActive = (v: StatusFilter | "OFF AIR" | "REVOKED"): boolean => {
    if (v === "OFF AIR") return filters.offAir;
    if (v === "REVOKED") return filters.revoked;
    return filters.status === v && !filters.offAir && !filters.revoked;
  };
```

- [ ] **Step 4: Update `handleType` to clear revoked when switching to INT**

Replace `handleType` (around lines 53-62):

```ts
  const handleType = (v: TypeFilter) => {
    const next: FieldFilters = { ...filters, type: v };
    if (v === "FM") {
      next.lawSent = false;
    }
    if (v === "INT") {
      next.offAir = false;
      next.revoked = false;
    }
    onChange(next);
  };
```

(`FieldFilters` is already imported at line 5; verify the import line covers it. If not, add `type FieldFilters` to the import.)

- [ ] **Step 5: Verify import**

Read `src/components/field-ops/MobileFilterBar.tsx:1-9` — confirm `FieldFilters` type is imported. If only `TypeFilter, StatusFilter` are imported, add it:

```ts
import {
  type FieldFilters,
  type TypeFilter,
  type StatusFilter,
} from "./FieldOpsFilters";
```

- [ ] **Step 6: Verify dev compiles**

Run: `tmux capture-pane -t dev -p | tail -3`
Expected: `✓ Compiled in <Xms>` with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/field-ops/MobileFilterBar.tsx
git commit -m "feat(field-ops): add REVOKED option to mobile FM STATUS row"
```

---

## Task 6: Test the mobile REVOKED button behavior

**Files:**
- Modify: `src/__tests__/mobile-filter-bar-field-ops.test.tsx`

Add tests that REVOKED appears in the FM STATUS row and clicking it calls `onChange` with `revoked: true, offAir: false, status: "ALL"`.

- [ ] **Step 1: Add new tests at the bottom of the existing describe block**

In `src/__tests__/mobile-filter-bar-field-ops.test.tsx`, before the closing `});` of the `describe("MobileFilterBar", ...)` block, add:

```ts
  it("renders REVOKED option in the FM STATUS row", () => {
    const { container } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={vi.fn()} provinces={['นครราชสีมา', 'ชัยภูมิ']} />
    );
    expect(container.textContent).toContain('REVOKED');
  });

  it("clicking REVOKED toggles filters.revoked and clears offAir/status", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <MobileFilterBar
        filters={{ ...DEFAULT_FILTERS, status: 'PENDING', offAir: true }}
        onChange={onChange}
        provinces={['นครราชสีมา']}
      />
    );
    fireEvent.click(getByText('REVOKED'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ revoked: true, offAir: false, status: 'ALL' })
    );
  });

  it("clicking OFF AIR clears revoked", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <MobileFilterBar
        filters={{ ...DEFAULT_FILTERS, revoked: true }}
        onChange={onChange}
        provinces={['นครราชสีมา']}
      />
    );
    fireEvent.click(getByText('OFF AIR'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ offAir: true, revoked: false })
    );
  });
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/mobile-filter-bar-field-ops.test.tsx`
Expected: 10 passed (7 existing + 3 new).

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/mobile-filter-bar-field-ops.test.tsx
git commit -m "test(field-ops): cover REVOKED option in mobile filter bar"
```

---

## Task 7: Add `danger` variant to ButtonRow + use it for revoked INSPECT (desktop)

**Files:**
- Modify: `src/components/field-ops/FieldOpsCurrent.tsx:8-15` (CommonAction interface)
- Modify: `src/components/field-ops/FieldOpsCurrent.tsx:114-124` (FM INSPECT button)
- Modify: `src/components/field-ops/FieldOpsCurrent.tsx:684-711` (ButtonRow style switch)

Today the FM INSPECT button on a revoked station uses `variant: "warn"` (amber/yellow) — same color as the ON AIR · STOP toggle. The user wants something visually distinct, so we add a `"danger"` variant (red, using `--fo-crit`).

- [ ] **Step 1: Extend CommonAction.variant**

In `src/components/field-ops/FieldOpsCurrent.tsx` line 13, change:

```ts
  variant?: "primary" | "ghost" | "warn" | "danger";
```

- [ ] **Step 2: Add danger branch in ButtonRow style switch**

In `src/components/field-ops/FieldOpsCurrent.tsx`, replace the style switch inside `ButtonRow` (currently lines 684-711):

```tsx
        const style: React.CSSProperties =
          a.variant === "danger"
            ? {
                ...baseStyle,
                background: "var(--fo-crit)",
                color: "#ffffff",
                borderColor: "var(--fo-crit)",
              }
            : a.variant === "warn"
              ? {
                  ...baseStyle,
                  background: "var(--fo-warn)",
                  color: "var(--fo-ink)",
                  borderColor: "var(--fo-warn)",
                }
              : a.variant === "primary"
                ? {
                    ...baseStyle,
                    background: "var(--fo-accent)",
                    color: "var(--fo-ink)",
                    borderColor: "var(--fo-accent)",
                  }
                : a.inverse
                  ? {
                      ...baseStyle,
                      background: "var(--fo-ink)",
                      color: "var(--fo-accent)",
                      borderColor: "var(--fo-accent)",
                    }
                  : {
                      ...baseStyle,
                      background: "transparent",
                      color: "var(--fo-rail-mute)",
                      borderColor: "var(--fo-ink-3)",
                    };
```

- [ ] **Step 3: Use `danger` for the revoked FM INSPECT button**

In `src/components/field-ops/FieldOpsCurrent.tsx` lines 114-124 (the FM INSPECT `ButtonRow`), change the `variant` line:

```tsx
            variant: station.revoked ? "danger" : (inspected ? "ghost" : "primary"),
```

(Keep everything else in the action object the same.)

- [ ] **Step 4: Verify dev compiles**

Run: `tmux capture-pane -t dev -p | tail -3`
Expected: `✓ Compiled in <Xms>` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/field-ops/FieldOpsCurrent.tsx
git commit -m "feat(field-ops): add danger variant to ButtonRow; use for revoked INSPECT"
```

---

## Task 8: Test the revoked desktop INSPECT button color

**Files:**
- Modify: `src/__tests__/field-ops-current.test.tsx`

Verify the INSPECT button background uses `--fo-crit` when the station is revoked. Inline-style assertions on a red color via getComputedStyle work in jsdom because the style is applied as `background: "var(--fo-crit)"` directly — we assert the inline style includes the variable.

- [ ] **Step 1: Add the test**

Append to the existing `describe("FieldOpsCurrentFM", ...)` block in `src/__tests__/field-ops-current.test.tsx`:

```tsx
  it("renders INSPECT with the danger palette for a revoked station", () => {
    const station: FMStation = {
      id: 9999,
      name: "REVOKED STATION",
      frequency: 100,
      latitude: 13.7,
      longitude: 100.5,
      city: "X",
      state: "Y",
      inspection69: "ยังไม่ตรวจ",
      onAir: false,
      revoked: true,
    } as FMStation;

    const { getByText } = render(
      <FieldOpsCurrentFM
        station={station}
        onToggleInspection={() => {}}
        onToggleOnAir={() => {}}
        pending={false}
      />
    );

    const inspectBtn = getByText("✓ INSPECT").closest("button")!;
    // Inline style applies var(--fo-crit) for the danger variant.
    expect(inspectBtn.getAttribute("style")).toContain("var(--fo-crit)");
  });

  it("renders INSPECT with the primary palette for a non-revoked pending station", () => {
    const station: FMStation = {
      id: 9998,
      name: "NORMAL",
      frequency: 100,
      latitude: 13.7,
      longitude: 100.5,
      city: "X",
      state: "Y",
      inspection69: "ยังไม่ตรวจ",
      onAir: true,
      revoked: false,
    } as FMStation;

    const { getByText } = render(
      <FieldOpsCurrentFM
        station={station}
        onToggleInspection={() => {}}
        onToggleOnAir={() => {}}
        pending={false}
      />
    );

    const inspectBtn = getByText("✓ INSPECT").closest("button")!;
    expect(inspectBtn.getAttribute("style")).toContain("var(--fo-accent)");
    expect(inspectBtn.getAttribute("style")).not.toContain("var(--fo-crit)");
  });
```

(`FMStation` is already imported in the test file. If not, add `import type { FMStation } from "@/types/station";` at the top.)

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/field-ops-current.test.tsx`
Expected: previous tests + 2 new tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/field-ops-current.test.tsx
git commit -m "test(field-ops): cover danger palette on revoked INSPECT button"
```

---

## Task 9: Apply distinct INSPECT color for revoked stations on mobile

**Files:**
- Modify: `src/components/field-ops/FieldOpsBottomSheet.tsx` (the INSPECT `<button>` near "INSPECTED" / "INSPECT" text)

The mobile bottom sheet INSPECT button currently uses two states (white/inspected → ink+accent). For revoked stations we want a red palette to match desktop.

- [ ] **Step 1: Find the INSPECT button block**

Read `src/components/field-ops/FieldOpsBottomSheet.tsx` and locate the button whose label is `{inspected ? "✓ INSPECTED" : "✓ INSPECT"}` (it sits next to NAVIGATE in the action row).

- [ ] **Step 2: Compute revoked state and use a red palette**

Right after the line `const lawSent = !isFM && !!site!.lawPaperSent;`, add:

```ts
  const revoked = !!isFM && station!.revoked === true;
```

Then replace the INSPECT button block with:

```tsx
        <button
          type="button"
          onClick={onToggleInspection}
          disabled={pending}
          className="fo-mono"
          style={{
            flex: 1,
            padding: "12px",
            background: revoked
              ? "var(--fo-crit)"
              : inspected
                ? "var(--fo-ink)"
                : "var(--fo-white)",
            color: revoked
              ? "#ffffff"
              : inspected
                ? "var(--fo-accent)"
                : "var(--fo-ink)",
            border: `1px solid ${
              revoked
                ? "var(--fo-crit)"
                : inspected
                  ? "var(--fo-ink)"
                  : "var(--fo-line)"
            }`,
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: "0.2em",
            fontWeight: 700,
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {inspected ? "✓ INSPECTED" : "✓ INSPECT"}
        </button>
```

- [ ] **Step 3: Verify dev compiles**

Run: `tmux capture-pane -t dev -p | tail -3`
Expected: `✓ Compiled in <Xms>` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/field-ops/FieldOpsBottomSheet.tsx
git commit -m "feat(field-ops): distinct red INSPECT button for revoked stations on mobile"
```

---

## Task 10: Smoke test the full flow in the dev server

This task is hands-on UI verification — the dev server is already running.

- [ ] **Step 1: Hard-refresh the browser at http://localhost:3000**

Verify:
- Desktop filter bar shows OFF AIR (green when active) + REVOKED (red when active) toggles in the FM filter row.
- Mobile (≤900px width) filter bar shows STATUS row with `ALL · PENDING · INSPECTED · OFF AIR · REVOKED`.
- Toggling REVOKED on either viewport filters the station list to only revoked stations (red `!` pins on the map).
- Toggling OFF AIR shows only non-revoked off-air stations (grey `⊘` pins) — revoked rows are excluded.
- Selecting a revoked station: the INSPECT button is **red** (`--fo-crit`). Selecting a normal pending station: green (`--fo-accent`). Selecting an inspected station: ghost / outline.

- [ ] **Step 2: Run the full test suite**

Run: `npm test 2>&1 | tail -20`
Expected: all tests pass (or only the pre-existing `lawPaperSent` mock failures noted before).

- [ ] **Step 3: Final commit (if everything green)**

If any small touch-ups were needed during smoke test:

```bash
git add -A
git commit -m "chore(field-ops): smoke-test polish for OFF AIR / REVOKED separation"
```

If nothing needs touching, this task is complete with no extra commit.

---

## Out of scope

- Changing the marker icon for revoked stations on the map — that already happens (red pin with `!` glyph) and is correct.
- A REVOKED filter for INT rows — interference sites have no `revoked` concept.
- Bulk-edit UI to toggle multiple stations' revoked state — destructive operations are scripted, not in-app.
- Surfacing `revokedNote` (xlsx หมายเหตุ) inline in any new place — it already shows as a tooltip on the REVOKED chip and as PERMIT in the bottom sheet.
- Renaming the database column or migrations — schema already has `revoked` and `revoked_note` columns from the prior session.
