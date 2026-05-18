# Mobile Filter Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-row stacked all-caps filter bar on `/` (mobile) with a two-row quick bar (Type + Status + More + Reset) plus a bottom-sheet "More filters" modal that holds search, province, and the rarely-toggled advanced filters.

**Architecture:** Two small components: (1) `MobileFilterSheet` — a new self-contained bottom-sheet modal that owns its own DOM but pure-functionally takes `{ open, onClose, filters, onChange, provinces, resultCount }`. Renders search, province `<select>`, type-gated toggle pills, an active-filter chip row, and a sticky `Show N results` CTA. (2) `MobileFilterBar` — fully rewritten to a two-row layout (Type segment group + Status segment group on row 1; `More · N` + conditional `Reset` on row 2). The bar owns the sheet's open/close state and persists it to sessionStorage. `FieldOpsClient` passes the new `resultCount` prop.

**Tech Stack:** TypeScript, React 19, Next.js 15, Vitest + @testing-library/react. No new dependencies — animations are CSS `transform` + `transition`; swipe-to-dismiss uses the same `touchStart`/`touchEnd` ref pattern already in `FieldOpsBottomSheet.tsx`.

**Spec:** `docs/superpowers/specs/2026-05-18-mobile-filter-redesign-design.md` — re-read it once before starting.

---

## File map (locked in before tasks)

- **Create** `src/components/field-ops/MobileFilterSheet.tsx` (~250 LoC)
  - Bottom-sheet modal with backdrop, drag-handle, scrollable content, sticky CTA.
  - Pure consumer of `filters` + emits `onChange` / `onClose`. No state of its own except a ref for swipe-gesture tracking.
  - Renders: active-chip row, search input (autofocus on open), province `<select>`, type-gated toggle pills, sticky `Show N results` button.
- **Create** `src/__tests__/mobile-filter-sheet.test.tsx` (~150 LoC)
  - Unit tests for: render when open, autofocus, search/province/toggle onChange wiring, type-gating of toggle blocks, active-chip row visibility + clearing, CTA shows resultCount, CTA calls onClose, backdrop click calls onClose.
- **Rewrite** `src/components/field-ops/MobileFilterBar.tsx` (~140 LoC, down from 277)
  - Two-row layout. Type + Status segment groups on row 1; More + Reset on row 2.
  - Hosts a `<MobileFilterSheet>` and owns the open/close state with sessionStorage persistence (key: `fo:filterSheetOpen`, default false).
- **Create** `src/__tests__/mobile-filter-bar-redesign.test.tsx` (~120 LoC)
  - Two segment groups render, Status group only shows 3 options (not 5), tapping chips calls `onChange` with correct payload, `More · N` count accurate, `Reset` visibility + behaviour, sheet open/close on More tap, default sheet state is closed.
- **Modify** `src/components/field-ops/FieldOpsClient.tsx`
  - Add `resultCount={filteredStations.length + filteredInterference.length}` to the `<MobileFilterBar>` consumer (currently around line 499).

---

### Task 1: `MobileFilterSheet` — new bottom-sheet component (TDD)

**Files:**
- Create: `src/components/field-ops/MobileFilterSheet.tsx`
- Test: `src/__tests__/mobile-filter-sheet.test.tsx`

- [ ] **Step 1: Write the failing test file**

Create `/Users/deardevx/Documents/my_stufF/nbtc_project/fast_work/fm-station-tracker/src/__tests__/mobile-filter-sheet.test.tsx` with EXACTLY this content:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MobileFilterSheet } from "@/components/field-ops/MobileFilterSheet";
import { DEFAULT_FILTERS, type FieldFilters } from "@/components/field-ops/FieldOpsFilters";

function baseFilters(o: Partial<FieldFilters> = {}): FieldFilters {
  return { ...DEFAULT_FILTERS, ...o };
}

describe("MobileFilterSheet", () => {
  it("renders search input, province select, and FM + INT toggle blocks when type=ALL", () => {
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A", "B"]}
        resultCount={42}
      />
    );
    expect(container.querySelector('input[type="search"]')).not.toBeNull();
    expect(container.querySelector("select")).not.toBeNull();
    const text = container.textContent ?? "";
    expect(text).toContain("Off air");
    expect(text).toContain("Revoked");
    expect(text).toContain("Law-paper sent");
  });

  it("hides INT toggles when type=FM", () => {
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters({ type: "FM" })}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Off air");
    expect(text).not.toContain("Law-paper sent");
  });

  it("hides FM toggles when type=INT", () => {
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters({ type: "INT" })}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain("Off air");
    expect(text).not.toContain("Revoked");
    expect(text).toContain("Law-paper sent");
  });

  it("typing in search calls onChange with new search value", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters()}
        onChange={onChange}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const input = container.querySelector('input[type="search"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "fm99" } });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, search: "fm99" });
  });

  it("changing province calls onChange with new province", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters()}
        onChange={onChange}
        provinces={["Bangkok", "Chiang Mai"]}
        resultCount={1}
      />
    );
    const select = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "Bangkok" } });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, province: "Bangkok" });
  });

  it("tapping Off air toggle inverts filters.offAir", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters()}
        onChange={onChange}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const btn = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Off air")
    );
    expect(btn).toBeDefined();
    fireEvent.click(btn!);
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, offAir: true });
  });

  it("active-chip row is hidden when no advanced filters are set", () => {
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    expect(container.textContent ?? "").not.toContain("Active:");
  });

  it("active-chip row shows applied advanced filters; clicking a chip clears it", () => {
    const onChange = vi.fn();
    const filters = baseFilters({ search: "btc", province: "Bangkok", offAir: true });
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={filters}
        onChange={onChange}
        provinces={["Bangkok"]}
        resultCount={1}
      />
    );
    expect(container.textContent ?? "").toContain("Active:");
    expect(container.textContent ?? "").toContain('Search "btc"');
    expect(container.textContent ?? "").toContain("Province: Bangkok");
    expect(container.textContent ?? "").toContain("Off air");

    const offAirChip = Array.from(container.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").startsWith("Off air") && (b.textContent ?? "").includes("✕")
    );
    expect(offAirChip).toBeDefined();
    fireEvent.click(offAirChip!);
    expect(onChange).toHaveBeenCalledWith({ ...filters, offAir: false });
  });

  it("bottom CTA shows the resultCount and calls onClose when tapped", () => {
    const onClose = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={onClose}
        filters={baseFilters()}
        onChange={onChange}
        provinces={["A"]}
        resultCount={247}
      />
    );
    const cta = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Show 247 results")
    );
    expect(cta).toBeDefined();
    fireEvent.click(cta!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clicking the backdrop calls onClose", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <MobileFilterSheet
        open
        onClose={onClose}
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    fireEvent.click(getByTestId("fo-filter-sheet-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test, confirm it FAILS**

Run from project root: `npx vitest run src/__tests__/mobile-filter-sheet.test.tsx`

Expected: FAIL — `Cannot find module '@/components/field-ops/MobileFilterSheet'`.

- [ ] **Step 3: Implement `MobileFilterSheet`**

Create `/Users/deardevx/Documents/my_stufF/nbtc_project/fast_work/fm-station-tracker/src/components/field-ops/MobileFilterSheet.tsx` with EXACTLY this content:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { FieldFilters } from "./FieldOpsFilters";

interface Props {
  open: boolean;
  onClose: () => void;
  filters: FieldFilters;
  onChange: (next: FieldFilters) => void;
  provinces: string[];
  resultCount: number;
}

export function MobileFilterSheet({
  open,
  onClose,
  filters,
  onChange,
  provinces,
  resultCount,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleSwipeStart = (e: React.TouchEvent) => {
    // Inputs/selects own their touch interaction; never treat swipes that
    // start on them as a dismiss gesture.
    if ((e.target as HTMLElement).closest("input, textarea, select")) {
      touchStartY.current = null;
      return;
    }
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };

  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
    const dy = endY - touchStartY.current;
    touchStartY.current = null;
    if (dy > 60) onClose();
  };

  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (filters.search.trim().length > 0) {
    activeChips.push({
      key: "search",
      label: `Search "${filters.search}"`,
      clear: () => onChange({ ...filters, search: "" }),
    });
  }
  if (filters.province !== "All") {
    activeChips.push({
      key: "province",
      label: `Province: ${filters.province}`,
      clear: () => onChange({ ...filters, province: "All" }),
    });
  }
  if (filters.offAir) {
    activeChips.push({
      key: "offAir",
      label: "Off air",
      clear: () => onChange({ ...filters, offAir: false }),
    });
  }
  if (filters.revoked) {
    activeChips.push({
      key: "revoked",
      label: "Revoked",
      clear: () => onChange({ ...filters, revoked: false }),
    });
  }
  if (filters.lawSent) {
    activeChips.push({
      key: "lawSent",
      label: "Law-paper sent",
      clear: () => onChange({ ...filters, lawSent: false }),
    });
  }

  const showFMFilters = filters.type !== "INT";
  const showINTFilters = filters.type !== "FM";

  return (
    <>
      <div
        data-testid="fo-filter-sheet-backdrop"
        onClick={onClose}
        aria-hidden={!open}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.55)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 180ms ease",
          zIndex: 1000,
        }}
      />
      <aside
        role="dialog"
        aria-label="More filters"
        aria-hidden={!open}
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "75dvh",
          background: "var(--fo-band)",
          color: "var(--fo-text)",
          borderRadius: "16px 16px 0 0",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "8px 0 4px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: "var(--fo-rail-mute)",
              opacity: 0.5,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px 12px",
            flexShrink: 0,
          }}
        >
          <span className="fo-serif" style={{ fontSize: 18, lineHeight: 1.1 }}>
            More filters
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 44,
              height: 44,
              border: "1px solid var(--fo-rail-border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--fo-rail-mute)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              touchAction: "manipulation",
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 16px",
            WebkitOverflowScrolling: "touch",
            minHeight: 0,
          }}
        >
          {activeChips.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
                padding: "8px 0 16px",
                borderBottom: "1px solid var(--fo-divider)",
                marginBottom: 16,
              }}
            >
              <span
                className="fo-mono"
                style={{
                  fontSize: 10,
                  color: "var(--fo-rail-mute)",
                  letterSpacing: "0.16em",
                }}
              >
                Active:
              </span>
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.clear}
                  className="fo-mono"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    minHeight: 32,
                    border: "1px solid var(--fo-accent)",
                    borderRadius: 999,
                    background: "rgba(0, 237, 100, 0.08)",
                    color: "var(--fo-accent)",
                    fontSize: 11,
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                >
                  {c.label} <span aria-hidden>✕</span>
                </button>
              ))}
            </div>
          )}

          <FilterSection label="Search">
            <input
              ref={searchRef}
              type="search"
              placeholder="Search stations…"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid var(--fo-divider)",
                background: "transparent",
                color: "var(--fo-text)",
                borderRadius: 10,
                fontSize: 14,
                minHeight: 44,
              }}
            />
          </FilterSection>

          <FilterSection label="Province">
            <select
              value={filters.province}
              onChange={(e) => onChange({ ...filters, province: e.target.value })}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid var(--fo-divider)",
                background: "transparent",
                color: "var(--fo-text)",
                borderRadius: 10,
                fontSize: 14,
                minHeight: 44,
                cursor: "pointer",
              }}
            >
              <option value="All">All provinces</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FilterSection>

          {showFMFilters && (
            <FilterSection label="FM filters">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TogglePill
                  label="Off air"
                  active={filters.offAir}
                  onClick={() => onChange({ ...filters, offAir: !filters.offAir })}
                />
                <TogglePill
                  label="Revoked"
                  active={filters.revoked}
                  onClick={() => onChange({ ...filters, revoked: !filters.revoked })}
                />
              </div>
            </FilterSection>
          )}

          {showINTFilters && (
            <FilterSection label="INT filters">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TogglePill
                  label="Law-paper sent"
                  active={filters.lawSent}
                  onClick={() => onChange({ ...filters, lawSent: !filters.lawSent })}
                />
              </div>
            </FilterSection>
          )}
        </div>

        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--fo-divider)",
            background: "var(--fo-band)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="fo-mono"
            style={{
              width: "100%",
              minHeight: 56,
              border: "none",
              background: "var(--fo-accent)",
              color: "#001e2b",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.04em",
              touchAction: "manipulation",
            }}
          >
            Show {resultCount} {resultCount === 1 ? "result" : "results"}
          </button>
        </div>
      </aside>
    </>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        className="fo-mono"
        style={{
          fontSize: 10,
          color: "var(--fo-rail-mute)",
          letterSpacing: "0.16em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="fo-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        minHeight: 44,
        border: `1px solid ${active ? "var(--fo-accent)" : "var(--fo-divider)"}`,
        background: active ? "var(--fo-accent)" : "transparent",
        color: active ? "#001e2b" : "var(--fo-text)",
        borderRadius: 999,
        fontSize: 12,
        cursor: "pointer",
        letterSpacing: "0.04em",
        transition: "background-color 120ms ease, border-color 120ms ease",
      }}
    >
      <span>{label}</span>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: active ? "#001e2b" : "var(--fo-rail-mute)",
          opacity: active ? 1 : 0.3,
        }}
      />
    </button>
  );
}
```

- [ ] **Step 4: Run the test, confirm it PASSES**

Run: `npx vitest run src/__tests__/mobile-filter-sheet.test.tsx`

Expected: PASS — 10 `it` blocks all green.

- [ ] **Step 5: Lint + typecheck**

Run: `npx eslint src/components/field-ops/MobileFilterSheet.tsx src/__tests__/mobile-filter-sheet.test.tsx`
Expected: clean.

Run: `npx tsc --noEmit 2>&1 | grep -E "MobileFilterSheet|mobile-filter-sheet" || echo "MobileFilterSheet clean"`
Expected: `MobileFilterSheet clean`.

DO NOT commit. Proceed to Task 2.

---

### Task 2: Rewrite `MobileFilterBar` (two-row quick bar + sheet host)

**Files:**
- Rewrite: `src/components/field-ops/MobileFilterBar.tsx`
- Test: `src/__tests__/mobile-filter-bar-redesign.test.tsx`

- [ ] **Step 1: Write the failing test file**

Create `/Users/deardevx/Documents/my_stufF/nbtc_project/fast_work/fm-station-tracker/src/__tests__/mobile-filter-bar-redesign.test.tsx` with EXACTLY this content:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MobileFilterBar } from "@/components/field-ops/MobileFilterBar";
import { DEFAULT_FILTERS, type FieldFilters } from "@/components/field-ops/FieldOpsFilters";

function baseFilters(o: Partial<FieldFilters> = {}): FieldFilters {
  return { ...DEFAULT_FILTERS, ...o };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("MobileFilterBar (redesigned)", () => {
  it("renders two segment groups: Type (All/FM/INT) and Status (All/Pending/Inspected)", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("All");
    expect(text).toContain("FM");
    expect(text).toContain("INT");
    expect(text).toContain("Pending");
    expect(text).toContain("Inspected");
    expect(text).not.toContain("OFF AIR");
    expect(text).not.toContain("REVOKED");
  });

  it("tapping FM chip calls onChange with type=FM and lawSent=false", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters({ lawSent: true })}
        onChange={onChange}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const fmBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "FM"
    );
    expect(fmBtn).toBeDefined();
    fireEvent.click(fmBtn!);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "FM", lawSent: false })
    );
  });

  it("tapping INT chip zeroes offAir and revoked", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters({ offAir: true, revoked: true })}
        onChange={onChange}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const intBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "INT"
    );
    fireEvent.click(intBtn!);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "INT", offAir: false, revoked: false })
    );
  });

  it("tapping Pending chip calls onChange with status=PENDING", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={onChange}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Pending"
    );
    fireEvent.click(btn!);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PENDING" })
    );
  });

  it("More button shows just 'More' when no advanced filters set", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const more = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("More")
    );
    expect(more).toBeDefined();
    expect(more!.textContent).not.toMatch(/More\s*·\s*\d/);
  });

  it("More button shows count when advanced filters are set", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters({ search: "abc", province: "X", offAir: true })}
        onChange={vi.fn()}
        provinces={["X"]}
        resultCount={1}
      />
    );
    const more = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("More")
    );
    expect(more!.textContent).toMatch(/More\s*·\s*3/);
  });

  it("Reset button is hidden in default state", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const reset = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Reset"
    );
    expect(reset).toBeUndefined();
  });

  it("Reset button appears when any filter is non-default; clicking it calls onChange with DEFAULT_FILTERS", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters({ type: "FM" })}
        onChange={onChange}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const reset = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Reset"
    );
    expect(reset).toBeDefined();
    fireEvent.click(reset!);
    expect(onChange).toHaveBeenCalledWith(DEFAULT_FILTERS);
  });

  it("sheet is closed by default; tapping More opens it", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={5}
      />
    );
    // Sheet is in DOM but with aria-hidden=true and transform translateY(100%)
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-hidden")).toBe("true");

    const more = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("More")
    );
    fireEvent.click(more!);
    expect(dialog!.getAttribute("aria-hidden")).toBe("false");
  });

  it("sheet open state persists to sessionStorage", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const more = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("More")
    );
    fireEvent.click(more!);
    expect(window.sessionStorage.getItem("fo:filterSheetOpen")).toBe("true");
  });
});
```

- [ ] **Step 2: Run the test, confirm it FAILS**

Run: `npx vitest run src/__tests__/mobile-filter-bar-redesign.test.tsx`

Expected: FAIL — the existing `MobileFilterBar` component doesn't accept the new `resultCount` prop, doesn't render sheet, and renders the old 4-row stack so several assertions fail. Confirm one specific failure (e.g., the "not.toContain('OFF AIR')" check) so you know you're testing the right thing.

- [ ] **Step 3: Replace `MobileFilterBar.tsx` with the new implementation**

OVERWRITE the entire contents of `/Users/deardevx/Documents/my_stufF/nbtc_project/fast_work/fm-station-tracker/src/components/field-ops/MobileFilterBar.tsx` with EXACTLY this content:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_FILTERS,
  type FieldFilters,
  type StatusFilter,
  type TypeFilter,
} from "./FieldOpsFilters";
import { MobileFilterSheet } from "./MobileFilterSheet";

const SS_KEY = "fo:filterSheetOpen";
const TYPES: TypeFilter[] = ["ALL", "FM", "INT"];
const STATUSES: StatusFilter[] = ["ALL", "PENDING", "INSPECTED"];

const TYPE_LABEL: Record<TypeFilter, string> = {
  ALL: "All",
  FM: "FM",
  INT: "INT",
};

const STATUS_LABEL: Record<StatusFilter, string> = {
  ALL: "All",
  PENDING: "Pending",
  INSPECTED: "Inspected",
};

export function MobileFilterBar({
  filters,
  onChange,
  provinces,
  resultCount,
}: {
  filters: FieldFilters;
  onChange: (next: FieldFilters) => void;
  provinces: string[];
  resultCount: number;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(SS_KEY);
      if (stored === "true") setSheetOpen(true);
    } catch {
      // Safari private mode — keep default
    }
  }, []);

  const persist = (open: boolean) => {
    setSheetOpen(open);
    try {
      window.sessionStorage.setItem(SS_KEY, String(open));
    } catch {
      // ignore
    }
  };

  const advancedCount =
    (filters.search.trim().length > 0 ? 1 : 0) +
    (filters.province !== "All" ? 1 : 0) +
    (filters.offAir ? 1 : 0) +
    (filters.revoked ? 1 : 0) +
    (filters.lawSent ? 1 : 0);

  const anyFilterActive =
    filters.type !== "ALL" || filters.status !== "ALL" || advancedCount > 0;

  const handleType = (v: TypeFilter) => {
    const next: FieldFilters = { ...filters, type: v };
    if (v === "FM") next.lawSent = false;
    if (v === "INT") {
      next.offAir = false;
      next.revoked = false;
    }
    onChange(next);
  };

  const handleStatus = (v: StatusFilter) => {
    onChange({ ...filters, status: v });
  };

  const handleReset = () => {
    onChange(DEFAULT_FILTERS);
  };

  return (
    <>
      <div
        style={{
          background: "var(--fo-rail-bg)",
          borderBottom: "1px solid var(--fo-rail-border)",
          padding: "8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <ChipGroup
            options={TYPES}
            label={(v) => TYPE_LABEL[v]}
            isActive={(v) => filters.type === v}
            onPick={handleType}
          />
          <ChipGroup
            options={STATUSES}
            label={(v) => STATUS_LABEL[v]}
            isActive={(v) => filters.status === v}
            onPick={handleStatus}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={() => persist(true)}
            className="fo-mono"
            aria-label={
              advancedCount > 0
                ? `More filters (${advancedCount} active)`
                : "More filters"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
              padding: "0 14px",
              border: "1px solid var(--fo-accent)",
              borderRadius: 999,
              background: "transparent",
              color: "var(--fo-accent)",
              fontSize: 11,
              cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            <span aria-hidden>⇅</span>
            <span>More{advancedCount > 0 ? ` · ${advancedCount}` : ""}</span>
          </button>
          {anyFilterActive && (
            <button
              type="button"
              onClick={handleReset}
              className="fo-mono"
              style={{
                minHeight: 44,
                padding: "0 14px",
                border: "1px solid var(--fo-rail-border)",
                borderRadius: 999,
                background: "transparent",
                color: "var(--fo-rail-mute)",
                fontSize: 11,
                cursor: "pointer",
                letterSpacing: "0.04em",
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <MobileFilterSheet
        open={sheetOpen}
        onClose={() => persist(false)}
        filters={filters}
        onChange={onChange}
        provinces={provinces}
        resultCount={resultCount}
      />
    </>
  );
}

function ChipGroup<T extends string>({
  options,
  label,
  isActive,
  onPick,
}: {
  options: readonly T[];
  label: (v: T) => string;
  isActive: (v: T) => boolean;
  onPick: (v: T) => void;
}) {
  return (
    <div
      role="group"
      style={{
        flex: 1,
        display: "flex",
        gap: 2,
        minWidth: 0,
      }}
    >
      {options.map((opt) => {
        const active = isActive(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onPick(opt)}
            aria-pressed={active}
            className="fo-mono"
            style={{
              flex: 1,
              minHeight: 44,
              padding: "0 8px",
              border: "none",
              background: active ? "var(--fo-accent)" : "transparent",
              color: active ? "#001e2b" : "var(--fo-rail-text)",
              fontSize: 12,
              fontWeight: active ? 700 : 400,
              cursor: "pointer",
              letterSpacing: "0.04em",
              borderRadius: 8,
              transition:
                "background-color 120ms ease, color 120ms ease",
              whiteSpace: "nowrap",
            }}
          >
            {label(opt)}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the test, confirm it PASSES**

Run: `npx vitest run src/__tests__/mobile-filter-bar-redesign.test.tsx`

Expected: PASS — 10 `it` blocks all green.

⚠️ Note — the existing `<MobileFilterBar>` call site in `FieldOpsClient.tsx` does NOT yet pass `resultCount`. That's Task 3's job. `tsc` will report an error in `FieldOpsClient.tsx` about the missing prop — that's expected.

- [ ] **Step 5: Lint + verify the expected `tsc` error is in FieldOpsClient only**

Run: `npx eslint src/components/field-ops/MobileFilterBar.tsx src/__tests__/mobile-filter-bar-redesign.test.tsx`
Expected: clean.

Run: `npx tsc --noEmit 2>&1 | grep -E "MobileFilterBar|mobile-filter-bar"` and confirm: no errors in `MobileFilterBar.tsx` or its test. The only related error should be in `FieldOpsClient.tsx` (missing `resultCount` prop). If there are errors in `MobileFilterBar.tsx`, fix them.

DO NOT commit. Proceed to Task 3.

---

### Task 3: Wire `resultCount` in `FieldOpsClient`

**Files:**
- Modify: `src/components/field-ops/FieldOpsClient.tsx`

- [ ] **Step 1: Locate the `<MobileFilterBar>` call site**

Open `src/components/field-ops/FieldOpsClient.tsx`. Search for `<MobileFilterBar`. You'll find the existing JSX (currently around line 499):

```tsx
              {isMobile && (
                <MobileFilterBar
                  filters={filters}
                  onChange={setFilters}
                  provinces={initialProvinces}
                />
              )}
```

- [ ] **Step 2: Add the `resultCount` prop**

Change the block to:

```tsx
              {isMobile && (
                <MobileFilterBar
                  filters={filters}
                  onChange={setFilters}
                  provinces={initialProvinces}
                  resultCount={visibleCount}
                />
              )}
```

`visibleCount` is already computed at the top of the component (around line 172: `const visibleCount = filteredStations.length + filteredInterference.length;`). No new state, no new computation needed.

- [ ] **Step 3: Lint + typecheck**

Run: `npx eslint src/components/field-ops/FieldOpsClient.tsx`
Expected: clean.

Run: `npx tsc --noEmit 2>&1 | grep -E "FieldOpsClient" || echo "FieldOpsClient clean"`
Expected: `FieldOpsClient clean`. The previously-expected `resultCount` missing-prop error is gone.

DO NOT commit. Proceed to Task 4.

---

### Task 4: Full test suite + lint + typecheck

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: net higher passing count vs baseline (Tasks 1+2 add ~20 new `it()` blocks across the two new test files; nothing is removed). Pre-existing failure count (26 at baseline, in `analytics.test.tsx`, `intermod-calculator-deep.test.tsx`, `field-ops-drawer.test.tsx`, `login-spinner.test.tsx`, `components-batch4.test.tsx`) must be unchanged. If failures grow, find the new failing test and fix.

- [ ] **Step 2: Project lint**

Run: `npm run lint`

Expected: no new warnings vs baseline.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "MobileFilter|FieldOpsClient|mobile-filter" || echo "all touched files clean"`

Expected: `all touched files clean`.

Proceed to Task 5.

---

### Task 5: Manual verification + commit

The bottom-sheet animation, swipe-to-dismiss, autofocus, and visual styling can't be fully verified in jsdom. Spec §Testing manual checklist is the source of truth.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

Expected: dev server boots at `http://localhost:3000`.

- [ ] **Step 2: Verify on 390 × 844 mobile viewport (Chrome DevTools iPhone 13)**

Open `http://localhost:3000`. Log in if prompted. On the field-ops map:

1. Filter bar is two rows: Type segment + Status segment (row 1); single `More` button (row 2). No Reset visible. ~96px total height.
2. Tap `FM` → chip turns green, map markers refresh to FM only.
3. Tap `Pending` → second chip turns green.
4. `Reset` appears in row 2 since filters are non-default.
5. Tap `More` → sheet slides up from bottom, map dimmed but visible behind.
6. Search input autofocuses — keyboard opens.
7. Type `abc` in search → results filter live; bottom CTA "Show N results" updates.
8. Pick a province from the native `<select>` → an `Active:` row appears with `Search "abc"` and `Province: …` chips.
9. Toggle `Off air` → chip appears in Active row.
10. Tap the `Off air ✕` chip → cleared; Active row updates.
11. Swipe down on the drag handle → sheet dismisses.
12. Back on the bar: `More · 2` badge visible (province + search still set).
13. Tap `Reset` → all filters clear, Reset button disappears, single segment chips return to `All / All`.
14. Open `More` again → search input is empty, sheet reflects cleared state.
15. Try pinching the map while sheet is open — map should NOT respond to gestures (modal scrim eats events).

- [ ] **Step 3: Stage and commit (DO NOT push — per CLAUDE.md)**

Files changed by this plan:

```bash
git add \
  src/components/field-ops/MobileFilterSheet.tsx \
  src/components/field-ops/MobileFilterBar.tsx \
  src/components/field-ops/FieldOpsClient.tsx \
  src/__tests__/mobile-filter-sheet.test.tsx \
  src/__tests__/mobile-filter-bar-redesign.test.tsx \
  docs/superpowers/specs/2026-05-18-mobile-filter-redesign-design.md \
  docs/superpowers/plans/2026-05-18-mobile-filter-redesign.md

git commit -m "$(cat <<'EOF'
feat: redesign mobile filter — quick chips + More bottom sheet

User feedback: the mobile filter looked dated and was hard to use.
The 4-row stack of uppercase segment groups ate 40% of the viewport
and put rarely-used filters next to the daily ones.

- Replace the 4-row stack with a two-row quick bar: Type and Status
  as chip groups (the 2 filters operators toggle multiple times per
  shift), More · N button, and a conditional Reset.
- Move Search, Province, Off-air, Revoked, and Law-paper sent into
  a new MobileFilterSheet bottom-sheet modal. Sheet has a sticky
  Show N results CTA, an active-filter chip row inside, swipe-down
  dismiss, and search-autofocus on open.
- Drop the uppercase casing and bordered chip rails. Sentence case,
  44px minimum tap targets throughout.
- Replace sessionStorage key fo:mobileFiltersOpen → fo:filterSheetOpen
  with default closed (max map space on first visit).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: hooks pass, commit succeeds. `git status` after: clean except for any pre-existing untracked files (`src/__tests__/analytics.test.tsx`, `src/app/mockup/`).

---

## Notes for the executor

- **Do NOT push or open a PR.** CLAUDE.md is explicit: "Do not commit and push to GitHub. Wait for explicit command." Stop after the local commit.
- **Do NOT commit between tasks.** Batch everything into the single commit at Task 5.
- **Pre-existing test failures.** The baseline before this work is `26 failed | ~1251 passed | 1 skipped` (after the cluster pin work). The failures live in `analytics.test.tsx`, `intermod-calculator-deep.test.tsx`, `field-ops-drawer.test.tsx`, `login-spinner.test.tsx`, `components-batch4.test.tsx`. Don't try to fix them.
- **`fo-band-inset` CSS variable.** The spec referenced it for input backgrounds; the implementation above uses `transparent` instead to avoid introducing an undeclared variable. If you prefer the inset look, define `--fo-band-inset` in `src/app/field-ops.css` first.
- **Spec change requests during implementation:** if a paste-and-verify step doesn't match what the spec describes, STOP and surface to the human. Don't silently deviate.
- **One thing not in the spec but worth noting:** the new `MobileFilterBar` no longer has the collapsed/expanded state from the old one. The bar is always two rows, the sheet is the "expanded" surface. That's intentional per the spec.
