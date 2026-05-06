# Mobile UI Fixes (Field Ops) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Field Ops tab usable on phones — high-contrast bottom sheet, sticky collapsible filter chips, compact header with `STATS ▾`, and a left drawer that replaces the bottom tab bar.

**Architecture:** Five surface changes inside `src/components/field-ops/` and one CSS-token addition. All gated on the existing `isMobile` flag (`window.innerWidth < 900`) in `FieldOpsClient.tsx`. No DB / API / Prisma / type changes. Two new dark-only CSS variables (`--fo-sheet-bg`, `--fo-sheet-text`) so the bottom sheet renders consistently in both dark and light app themes.

**Tech Stack:** TypeScript, React 19, Next.js 15, vitest + `@testing-library/react`, Tailwind CSS 4 (used incidentally), inline-style components per existing field-ops convention.

**Reference spec:** `docs/superpowers/specs/2026-05-07-mobile-ui-fixes-design.md`.

**Verified before planning:**
- `FieldOpsClient.tsx:50-59` defines `isMobile` via `window.innerWidth < 900`. The bottom tab bar lives at lines `493-520`. Header is mounted at line 355, mobile filter is currently absent, mobile bottom sheet at line 459-468.
- `FieldOpsHeader.tsx` is 157 lines, single horizontal flex layout — ready for a mobile branch.
- `FieldOpsFilters.tsx` exports `FieldFilters`, `DEFAULT_FILTERS`, and the desktop component. The mobile bar must reuse `FieldFilters` and the same `onChange` setter so state stays in `FieldOpsClient`.
- `FieldOpsBottomSheet.tsx` currently uses `var(--fo-band, #ffffff)` for background (which becomes white in `.fo-light` mode) — that's the contrast bug.
- `field-ops.css` defines `--fo-rail-*` tokens that get redefined under `.fo-light` (confirmed via grep). Therefore the bottom-sheet fix MUST use new tokens defined only at `:root`, not the existing rail tokens.

---

## Task 1: Add `--fo-sheet-bg` / `--fo-sheet-text` tokens

**Files:**
- Modify: `src/app/field-ops.css`

- [ ] **Step 1: Locate the `:root { --fo-* }` block**

```bash
grep -n "^:root\|--fo-canvas: var(--fo-ink)" src/app/field-ops.css | head
```

Expected: prints the line numbers of the `:root` block (the one that starts with the dark-theme defaults — the block containing `--fo-canvas: var(--fo-ink); --fo-rail-bg: var(--fo-ink); ...`).

- [ ] **Step 2: Append two new tokens at the end of that root block**

Insert two lines just before the closing `}` of the dark-defaults `:root` block, e.g.:

```css
  --fo-sheet-bg: #0a1f23;
  --fo-sheet-text: #e6efe9;
```

These MUST NOT be redefined inside `.fo-light` — the bottom sheet stays dark even when the app theme is light.

- [ ] **Step 3: Verify with a quick CSS sanity check**

```bash
grep -n "fo-sheet-bg\|fo-sheet-text" src/app/field-ops.css
```

Expected: exactly two matches, both in the dark-defaults block. None inside `.fo-light`.

- [ ] **Step 4: Commit**

```bash
git add src/app/field-ops.css
git commit -m "feat(field-ops): add --fo-sheet-bg/--fo-sheet-text dark-only tokens"
```

---

## Task 2: Bottom-sheet token swap

**Files:**
- Modify: `src/components/field-ops/FieldOpsBottomSheet.tsx`

- [ ] **Step 1: Find the four current token uses**

```bash
grep -n "fo-band\|--fo-mute\|--fo-ink\|--fo-divider" src/components/field-ops/FieldOpsBottomSheet.tsx
```

Expected: ~4-6 matches across the file (background, title color, mute label color, divider).

- [ ] **Step 2: Apply the swap (replace each occurrence)**

Replace these strings throughout the file:

| Old | New |
|---|---|
| `var(--fo-band, #ffffff)` | `var(--fo-sheet-bg)` |
| `var(--fo-ink)` | `var(--fo-sheet-text)` |
| `var(--fo-mute)` | `var(--fo-rail-mute)` |
| `var(--fo-divider)` | `var(--fo-rail-border)` |

If you find a `var(--fo-band)` (no fallback) — same swap, → `var(--fo-sheet-bg)`.

Use Edit's `replace_all: true` for each search/replace pair. The file has no lines that legitimately keep the old tokens — every match should flip.

- [ ] **Step 3: Add `whiteSpace: "normal"` and `lineHeight: 1.4` to the PERMIT row**

In the existing PERMIT block (the one rendering `<Inline label="PERMIT" value={station!.permit} />` or equivalent), make sure the `value` text wraps. The `Inline` helper at the bottom of the file already supports a `value` string but renders it on one line with white-space nowrap or similar. Open the helper definition (search for `function Inline` in the file) and ensure its value `<span>` or `<div>` uses:

```ts
style={{
  fontSize: 12,
  lineHeight: 1.4,
  whiteSpace: "normal",
  wordBreak: "break-word",
  color: "var(--fo-sheet-text)",
}}
```

If the existing `Inline` already wraps, keep what's there but ensure the color uses `--fo-sheet-text`.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "FieldOpsBottomSheet" | head
```

Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add src/components/field-ops/FieldOpsBottomSheet.tsx
git commit -m "feat(field-ops): bottom sheet uses dark-only sheet tokens; PERMIT wraps"
```

---

## Task 3: New `FieldOpsDrawer.tsx` component

**Files:**
- Create: `src/components/field-ops/FieldOpsDrawer.tsx`
- Create: `src/__tests__/field-ops-drawer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/field-ops-drawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { FieldOpsDrawer } from '@/components/field-ops/FieldOpsDrawer';
import type { FieldOpsKpis } from '@/utils/fieldOpsKpi';

const baseKpis: FieldOpsKpis = {
  total: 26,
  inspected: 0,
  pending: 26,
  critical: null,
  target: 200,
  pct: 0,
};

describe('FieldOpsDrawer', () => {
  it('does not render when open is false', () => {
    const { container } = render(
      <FieldOpsDrawer
        open={false}
        activeTab="field-ops"
        theme="dark"
        kpis={baseKpis}
        onChangeTab={vi.fn()}
        onToggleTheme={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.textContent).toBe('');
  });

  it('renders NAV / theme / STATS sections when open', () => {
    const { container } = render(
      <FieldOpsDrawer
        open={true}
        activeTab="field-ops"
        theme="dark"
        kpis={baseKpis}
        onChangeTab={vi.fn()}
        onToggleTheme={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.textContent).toContain('NAV');
    expect(container.textContent).toContain('FIELD OPS');
    expect(container.textContent).toContain('INTERMOD');
    expect(container.textContent).toContain('ANALYTICS');
    expect(container.textContent).toContain('DARK');
    expect(container.textContent).toContain('LIVE');
    expect(container.textContent).toContain('STATS');
    expect(container.textContent).toContain('TOTAL');
    expect(container.textContent).toContain('26');
    expect(container.textContent).toContain('INSPECTED');
    expect(container.textContent).toContain('0/200');
    expect(container.textContent).toContain('CRITICAL');
  });

  it('clicking a NAV button calls onChangeTab AND onClose', () => {
    const onChangeTab = vi.fn();
    const onClose = vi.fn();
    const { getByText } = render(
      <FieldOpsDrawer
        open={true}
        activeTab="field-ops"
        theme="dark"
        kpis={baseKpis}
        onChangeTab={onChangeTab}
        onToggleTheme={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(getByText('INTERMOD'));
    expect(onChangeTab).toHaveBeenCalledWith('intermod');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the backdrop calls onClose', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <FieldOpsDrawer
        open={true}
        activeTab="field-ops"
        theme="dark"
        kpis={baseKpis}
        onChangeTab={vi.fn()}
        onToggleTheme={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(getByTestId('fo-drawer-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the DARK toggle calls onToggleTheme', () => {
    const onToggleTheme = vi.fn();
    const { getByText } = render(
      <FieldOpsDrawer
        open={true}
        activeTab="field-ops"
        theme="dark"
        kpis={baseKpis}
        onChangeTab={vi.fn()}
        onToggleTheme={onToggleTheme}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(getByText(/DARK/));
    expect(onToggleTheme).toHaveBeenCalled();
  });

  it('shows critical as "—" when kpis.critical is null', () => {
    const { container } = render(
      <FieldOpsDrawer
        open={true}
        activeTab="field-ops"
        theme="dark"
        kpis={{ ...baseKpis, critical: null }}
        onChangeTab={vi.fn()}
        onToggleTheme={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.textContent).toContain('CRITICAL');
    expect(container.textContent).toContain('—');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/field-ops-drawer.test.tsx
```

Expected: FAIL with `Failed to resolve import '@/components/field-ops/FieldOpsDrawer'`.

- [ ] **Step 3: Implement the drawer**

Create `src/components/field-ops/FieldOpsDrawer.tsx`:

```tsx
"use client";

import type { FieldOpsTab } from "./FieldOpsNav";
import type { FieldOpsKpis } from "@/utils/fieldOpsKpi";

interface NavItem {
  id: FieldOpsTab;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "field-ops", label: "FIELD OPS", icon: "⚑" },
  { id: "intermod", label: "INTERMOD", icon: "Σ" },
  { id: "analytics", label: "ANALYTICS", icon: "▦" },
];

export function FieldOpsDrawer({
  open,
  activeTab,
  theme,
  kpis,
  onChangeTab,
  onToggleTheme,
  onClose,
}: {
  open: boolean;
  activeTab: FieldOpsTab;
  theme: "dark" | "light";
  kpis: FieldOpsKpis;
  onChangeTab: (id: FieldOpsTab) => void;
  onToggleTheme: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const handleNav = (id: FieldOpsTab) => {
    onChangeTab(id);
    onClose();
  };

  return (
    <>
      <div
        data-testid="fo-drawer-backdrop"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.55)",
          zIndex: 50,
        }}
      />
      <aside
        role="dialog"
        aria-label="Field Ops navigation"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          background: "var(--fo-rail-bg)",
          color: "var(--fo-rail-text)",
          borderRight: "1px solid var(--fo-rail-border)",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          zIndex: 60,
          overflowY: "auto",
        }}
      >
        <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", fontSize: 9, letterSpacing: "0.2em" }}>
          NAV
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className="fo-mono"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: isActive ? "var(--fo-accent)" : "transparent",
                  color: isActive ? "#001e2b" : "var(--fo-rail-text)",
                  border: isActive ? "none" : "1px solid var(--fo-rail-border)",
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span aria-hidden style={{ fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>

        <div style={{ height: 1, background: "var(--fo-rail-border)", margin: "4px 0" }} />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onToggleTheme}
            className="fo-mono"
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid var(--fo-accent)",
              background: "transparent",
              color: "var(--fo-accent)",
              fontSize: 10,
              cursor: "pointer",
              letterSpacing: "0.16em",
            }}
          >
            {theme === "light" ? "☀ LIGHT" : "☾ DARK"}
          </button>
          <span
            className="fo-mono"
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid var(--fo-accent)",
              color: "var(--fo-accent)",
              fontSize: 10,
              textAlign: "center",
              letterSpacing: "0.16em",
            }}
          >
            ● LIVE
          </span>
        </div>

        <div style={{ height: 1, background: "var(--fo-rail-border)", margin: "4px 0" }} />

        <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", fontSize: 9, letterSpacing: "0.2em" }}>
          STATS
        </div>
        <StatsRow label="TOTAL" value={String(kpis.total)} />
        <StatsRow
          label="INSPECTED"
          value={`${kpis.inspected}/${kpis.target} · ${kpis.pct}%`}
          accent
        />
        <StatsRow label="PENDING" value={String(kpis.pending)} />
        <StatsRow
          label="CRITICAL"
          value={kpis.critical === null ? "—" : String(kpis.critical)}
          warn={kpis.critical !== null}
          mute={kpis.critical === null}
        />
      </aside>
    </>
  );
}

function StatsRow({
  label,
  value,
  accent = false,
  warn = false,
  mute = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
  mute?: boolean;
}) {
  const valueColor = mute
    ? "var(--fo-rail-mute)"
    : accent
      ? "var(--fo-accent)"
      : warn
        ? "var(--fo-crit)"
        : "var(--fo-rail-text)";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontSize: 12,
      }}
    >
      <span className="fo-mono" style={{ color: "var(--fo-rail-mute)", fontSize: 10 }}>
        {label}
      </span>
      <span style={{ color: valueColor }}>{value}</span>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/field-ops-drawer.test.tsx
```

Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/components/field-ops/FieldOpsDrawer.tsx src/__tests__/field-ops-drawer.test.tsx
git commit -m "feat(field-ops): FieldOpsDrawer component with NAV / theme / STATS"
```

---

## Task 4: New `MobileFilterBar.tsx` component

**Files:**
- Create: `src/components/field-ops/MobileFilterBar.tsx`
- Create: `src/__tests__/mobile-filter-bar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/mobile-filter-bar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MobileFilterBar } from '@/components/field-ops/MobileFilterBar';
import { DEFAULT_FILTERS } from '@/components/field-ops/FieldOpsFilters';

const SS_KEY = 'fo:mobileFiltersOpen';

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('MobileFilterBar', () => {
  it('renders TYPE and STATUS chip rows when expanded', () => {
    const { container } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={vi.fn()} />
    );
    expect(container.textContent).toContain('TYPE');
    expect(container.textContent).toContain('STATUS');
    expect(container.textContent).toContain('FM');
    expect(container.textContent).toContain('INT');
    expect(container.textContent).toContain('PENDING');
    expect(container.textContent).toContain('INSPECTED');
    expect(container.textContent).toContain('OFF AIR');
  });

  it('clicking a TYPE chip calls onChange with the new type', () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={onChange} />
    );
    fireEvent.click(getByText('FM'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'FM' }));
  });

  it('clicking the collapse chevron toggles to a single FILTERS pill', () => {
    const { container, getByLabelText } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={vi.fn()} />
    );
    fireEvent.click(getByLabelText('Collapse filters'));
    expect(container.textContent).toContain('FILTERS · 0');
    expect(container.textContent).not.toContain('TYPE');
  });

  it('shows non-zero count in the collapsed pill when filters are active', () => {
    const { container, getByLabelText } = render(
      <MobileFilterBar
        filters={{ ...DEFAULT_FILTERS, type: 'FM', status: 'PENDING' }}
        onChange={vi.fn()}
      />
    );
    fireEvent.click(getByLabelText('Collapse filters'));
    expect(container.textContent).toContain('FILTERS · 2');
  });

  it('persists collapsed state to sessionStorage', () => {
    const { getByLabelText } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={vi.fn()} />
    );
    fireEvent.click(getByLabelText('Collapse filters'));
    expect(window.sessionStorage.getItem(SS_KEY)).toBe('false');
  });

  it('hydrates from sessionStorage on mount', () => {
    window.sessionStorage.setItem(SS_KEY, 'false');
    const { container } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={vi.fn()} />
    );
    expect(container.textContent).toContain('FILTERS');
    expect(container.textContent).not.toContain('TYPE');
  });

  it('clicking the expand pill restores the chip rows', () => {
    window.sessionStorage.setItem(SS_KEY, 'false');
    const { container, getByLabelText } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={vi.fn()} />
    );
    fireEvent.click(getByLabelText('Expand filters'));
    expect(container.textContent).toContain('TYPE');
    expect(container.textContent).toContain('STATUS');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/mobile-filter-bar.test.tsx
```

Expected: FAIL with `Failed to resolve import '@/components/field-ops/MobileFilterBar'`.

- [ ] **Step 3: Implement the component**

Create `src/components/field-ops/MobileFilterBar.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  type FieldFilters,
  type TypeFilter,
  type StatusFilter,
} from "./FieldOpsFilters";

const SS_KEY = "fo:mobileFiltersOpen";
const TYPES: TypeFilter[] = ["ALL", "FM", "INT"];
const STATUSES: Array<StatusFilter | "OFF AIR"> = ["ALL", "PENDING", "INSPECTED", "OFF AIR"];

export function MobileFilterBar({
  filters,
  onChange,
}: {
  filters: FieldFilters;
  onChange: (next: FieldFilters) => void;
}) {
  const [expanded, setExpanded] = useState<boolean>(true);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(SS_KEY);
      if (stored === "false") setExpanded(false);
      if (stored === "true") setExpanded(true);
    } catch {
      // Safari private mode — keep default
    }
  }, []);

  const persist = (v: boolean) => {
    setExpanded(v);
    try {
      window.sessionStorage.setItem(SS_KEY, String(v));
    } catch {
      // ignore
    }
  };

  const activeCount =
    (filters.type !== "ALL" ? 1 : 0) +
    (filters.status !== "ALL" ? 1 : 0) +
    (filters.province !== "All" ? 1 : 0) +
    (filters.offAir ? 1 : 0) +
    (filters.lawSent ? 1 : 0) +
    (filters.search.trim().length > 0 ? 1 : 0);

  const handleType = (v: TypeFilter) => {
    const next: FieldFilters = { ...filters, type: v };
    if (v === "FM") {
      next.severity = "ALL";
      next.lawSent = false;
    }
    if (v === "INT") {
      next.offAir = false;
    }
    onChange(next);
  };

  const handleStatus = (v: StatusFilter | "OFF AIR") => {
    if (v === "OFF AIR") {
      onChange({ ...filters, status: "ALL", offAir: !filters.offAir });
    } else {
      onChange({ ...filters, status: v as StatusFilter, offAir: false });
    }
  };

  const isStatusActive = (v: StatusFilter | "OFF AIR"): boolean => {
    if (v === "OFF AIR") return filters.offAir;
    return filters.status === v && !filters.offAir;
  };

  if (!expanded) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "var(--fo-rail-bg)",
          borderBottom: "1px solid var(--fo-rail-border)",
        }}
      >
        <button
          type="button"
          aria-label="Expand filters"
          className="fo-mono"
          onClick={() => persist(true)}
          style={{
            border: "1px solid var(--fo-accent)",
            color: "var(--fo-accent)",
            background: "transparent",
            padding: "5px 12px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: "0.16em",
            cursor: "pointer",
          }}
        >
          ≡ FILTERS · {activeCount}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--fo-rail-bg)",
        borderBottom: "1px solid var(--fo-rail-border)",
        padding: "8px 12px",
      }}
    >
      <ChipRow
        label="TYPE"
        options={TYPES}
        isActive={(v) => filters.type === v}
        onPick={handleType}
        rightAdornment={
          <button
            type="button"
            aria-label="Collapse filters"
            onClick={() => persist(false)}
            className="fo-mono"
            style={{
              marginLeft: "auto",
              border: "1px solid var(--fo-rail-border)",
              color: "var(--fo-rail-mute)",
              background: "transparent",
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            ▴
          </button>
        }
      />
      <div style={{ height: 4 }} />
      <ChipRow
        label="STATUS"
        options={STATUSES}
        isActive={isStatusActive}
        onPick={handleStatus}
      />
    </div>
  );
}

function ChipRow<T extends string>({
  label,
  options,
  isActive,
  onPick,
  rightAdornment,
}: {
  label: string;
  options: readonly T[];
  isActive: (v: T) => boolean;
  onPick: (v: T) => void;
  rightAdornment?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      <span
        className="fo-mono"
        style={{ color: "var(--fo-rail-mute)", fontSize: 9, flexShrink: 0 }}
      >
        {label}
      </span>
      {options.map((opt) => {
        const active = isActive(opt);
        return (
          <button
            key={opt}
            type="button"
            className="fo-mono"
            onClick={() => onPick(opt)}
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              border: active ? "none" : "1px solid var(--fo-rail-border)",
              background: active ? "var(--fo-accent)" : "transparent",
              color: active ? "#001e2b" : "var(--fo-rail-text)",
              fontSize: 10,
              fontWeight: active ? 700 : 400,
              flexShrink: 0,
              cursor: "pointer",
              letterSpacing: "0.1em",
            }}
          >
            {opt}
          </button>
        );
      })}
      {rightAdornment}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/mobile-filter-bar.test.tsx
```

Expected: PASS (7/7).

- [ ] **Step 5: Commit**

```bash
git add src/components/field-ops/MobileFilterBar.tsx src/__tests__/mobile-filter-bar.test.tsx
git commit -m "feat(field-ops): MobileFilterBar with collapsible chip strip + sessionStorage"
```

---

## Task 5: Header mobile branch with `STATS ▾` toggle

**Files:**
- Modify: `src/components/field-ops/FieldOpsHeader.tsx`

- [ ] **Step 1: Read the current header**

```bash
cat src/components/field-ops/FieldOpsHeader.tsx
```

Note the existing exports — `FieldOpsHeader` and the local `Stat` helper. The current `FieldOpsHeader` accepts `stations`, `interference`, `type`, `theme`, `onToggleTheme` and renders 4 KPI tiles inline.

- [ ] **Step 2: Extend the props with `isMobile` and `onOpenDrawer`**

Replace the `FieldOpsHeader` props block (top of the function, around lines 8-20):

```tsx
export function FieldOpsHeader({
  stations,
  interference,
  type,
  theme,
  onToggleTheme,
  isMobile = false,
  onOpenDrawer,
}: {
  stations: FMStation[];
  interference: InterferenceSite[];
  type: TypeFilter;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  isMobile?: boolean;
  onOpenDrawer?: () => void;
}) {
```

- [ ] **Step 3: Add a mobile-only render branch above the existing return**

Inside `FieldOpsHeader`, after computing `kpis` and the colors but BEFORE the existing `return (<header>...</header>)`, add:

```tsx
  if (isMobile) {
    return <MobileHeader
      kpis={kpis}
      scopeLabel={scopeLabel}
      headerBg={headerBg}
      textColor={textColor}
      borderColor={borderColor}
      labelColor={labelColor}
      accentText={accentText}
      onOpenDrawer={onOpenDrawer}
    />;
  }
```

Keep the existing desktop return unchanged.

- [ ] **Step 4: Implement `MobileHeader` at the bottom of the file (below the existing `Stat` helper)**

```tsx
function MobileHeader({
  kpis,
  scopeLabel,
  headerBg,
  textColor,
  borderColor,
  labelColor,
  accentText,
  onOpenDrawer,
}: {
  kpis: ReturnType<typeof computeKpis>;
  scopeLabel: string;
  headerBg: string;
  textColor: string;
  borderColor: string;
  labelColor: string;
  accentText: string;
  onOpenDrawer?: () => void;
}) {
  const [statsOpen, setStatsOpen] = useState(false);
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        background: headerBg,
        color: textColor,
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
        }}
      >
        <button
          type="button"
          aria-label="Open menu"
          onClick={onOpenDrawer}
          style={{
            border: `1px solid ${borderColor}`,
            background: "transparent",
            color: textColor,
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 16,
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          ☰
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="fo-mono" style={{ color: accentText, fontSize: 9, letterSpacing: "0.18em" }}>
            NBTC · FIELD OPS · {scopeLabel}
          </div>
          <div className="fo-serif" style={{ fontSize: 14, lineHeight: 1.1, color: textColor }}>
            Field Operations
          </div>
        </div>
        <button
          type="button"
          aria-label={statsOpen ? "Hide stats" : "Show stats"}
          aria-expanded={statsOpen}
          onClick={() => setStatsOpen((v) => !v)}
          className="fo-mono"
          style={{
            border: `1px solid ${borderColor}`,
            background: "transparent",
            color: labelColor,
            padding: "5px 10px",
            borderRadius: 6,
            fontSize: 10,
            cursor: "pointer",
            letterSpacing: "0.16em",
          }}
        >
          STATS {statsOpen ? "▴" : "▾"}
        </button>
      </div>
      {statsOpen && (
        <div
          style={{
            display: "flex",
            gap: 18,
            padding: "8px 12px",
            borderTop: `1px solid ${borderColor}`,
            overflowX: "auto",
          }}
        >
          <Stat label="TOTAL" value={kpis.total} textColor={textColor} labelColor={labelColor} />
          <Stat
            label="INSPECTED"
            value={kpis.inspected}
            sub={`/ ${kpis.target} · ${kpis.pct}%`}
            accent
            textColor={textColor}
            labelColor={labelColor}
            accentText={accentText}
          />
          <Stat label="PENDING" value={kpis.pending} textColor={textColor} labelColor={labelColor} />
          <Stat
            label="CRITICAL"
            value={kpis.critical}
            warn
            textColor={textColor}
            labelColor={labelColor}
          />
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 5: Add the `useState` import at the top of the file if not already present**

The top of `FieldOpsHeader.tsx` currently has `"use client"` and a few imports. Add `useState`:

```tsx
"use client";

import { useState } from "react";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import type { TypeFilter } from "./FieldOpsFilters";
import { computeKpis } from "@/utils/fieldOpsKpi";
```

(If `useState` is already imported, leave as-is.)

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "FieldOpsHeader" | head
```

Expected: empty.

- [ ] **Step 7: Commit**

```bash
git add src/components/field-ops/FieldOpsHeader.tsx
git commit -m "feat(field-ops): mobile header branch — ☰ + STATS ▾ collapsible KPIs"
```

---

## Task 6: Wire the drawer + mobile filter bar into `FieldOpsClient`

**Files:**
- Modify: `src/components/field-ops/FieldOpsClient.tsx`

- [ ] **Step 1: Add the new imports**

At the top of the file, after the existing import for `FieldOpsBottomSheet`, add:

```tsx
import { FieldOpsDrawer } from "./FieldOpsDrawer";
import { MobileFilterBar } from "./MobileFilterBar";
import { computeKpis } from "@/utils/fieldOpsKpi";
```

- [ ] **Step 2: Add `drawerOpen` state next to `isMobile`**

Find the `useState` block near the top of `FieldOpsClient` (around line 50). Add:

```tsx
const [drawerOpen, setDrawerOpen] = useState(false);
```

- [ ] **Step 3: Pass `isMobile` + `onOpenDrawer` to the header**

Find the existing `<FieldOpsHeader ... />` JSX (around line 355) and add the two props:

```tsx
<FieldOpsHeader
  stations={filteredStations}
  interference={filteredInterference}
  type={filters.type}
  theme={theme}
  onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
  isMobile={isMobile}
  onOpenDrawer={() => setDrawerOpen(true)}
/>
```

- [ ] **Step 4: Render the mobile filter bar BELOW the header but ABOVE the map (mobile only)**

Find the section where the desktop `FieldOpsFilters` is rendered:

```tsx
{!isMobile && (
  <FieldOpsFilters
    filters={filters}
    onChange={setFilters}
    provinces={initialProvinces}
    visibleCount={visibleCount}
  />
)}
```

Add a sibling block immediately after it:

```tsx
{isMobile && (
  <MobileFilterBar filters={filters} onChange={setFilters} />
)}
```

- [ ] **Step 5: Render the drawer at the root of the component**

Find the outer `<div className="field-ops-root" ...>` wrapper. Just before the closing `</div>` of that wrapper, add the drawer:

```tsx
{isMobile && (
  <FieldOpsDrawer
    open={drawerOpen}
    activeTab={tab}
    theme={theme}
    kpis={computeKpis(filteredStations, filteredInterference, filters.type)}
    onChangeTab={setTab}
    onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
    onClose={() => setDrawerOpen(false)}
  />
)}
```

(Place this block after the existing mobile bottom-tab JSX you'll delete in Step 6.)

- [ ] **Step 6: Delete the existing bottom tab bar**

Locate the existing block at the end of the component (currently `FieldOpsClient.tsx:493-520`):

```tsx
{isMobile && (
  <div
    style={{
      display: "flex",
      background: "var(--fo-rail-bg)",
      borderTop: "1px solid var(--fo-rail-border)",
    }}
  >
    {(["field-ops", "intermod", "analytics"] as FieldOpsTab[]).map((t) => (
      <button
        key={t}
        type="button"
        onClick={() => setTab(t)}
        className="fo-mono"
        style={{
          flex: 1,
          padding: "12px 8px",
          background: tab === t ? "var(--fo-accent)" : "transparent",
          color: tab === t ? "#001e2b" : "var(--fo-rail-mute)",
          border: "none",
          cursor: "pointer",
        }}
      >
        {t === "field-ops" ? "FIELD OPS" : t.toUpperCase()}
      </button>
    ))}
  </div>
)}
```

Delete it entirely.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "FieldOpsClient" | head
```

Expected: empty.

- [ ] **Step 8: Commit**

```bash
git add src/components/field-ops/FieldOpsClient.tsx
git commit -m "feat(field-ops): wire drawer + mobile filter bar; remove bottom tab bar"
```

---

## Task 7: Visual smoke

**Files:** none (manual verification only).

- [ ] **Step 1: Confirm dev server is up**

```bash
tmux capture-pane -t dev -p | tail -3
```

Expected: shows `✓ Ready in ...`. If not, restart with `tmux kill-session -t dev 2>/dev/null; CMD="npm run dev"; tmux new-session -d -s dev "$CMD"`.

- [ ] **Step 2: Open mobile width in the browser**

Open http://localhost:3000 in DevTools responsive mode set to a phone width (e.g., 390 × 844 — iPhone 12 Pro). Navigate to Field Ops tab.

Confirm:
- Header is one row: ☰ + title + STATS ▾. No KPIs visible by default.
- Tap STATS ▾ → KPI strip slides down with TOTAL/INSPECTED/PENDING/CRITICAL.
- Below the header is the sticky filter chip bar with TYPE and STATUS rows. The right edge of TYPE row has a `▴` collapse chevron.
- Tap `▴` → both rows collapse to a single `≡ FILTERS · 0` pill. Reload the page → it remembers (sessionStorage).
- Tap ≡ FILTERS pill → expands again.
- Tap ☰ → left drawer slides in over the map with NAV / DARK · LIVE / STATS sections. Tap backdrop → drawer closes.
- Tap a station marker on the map → bottom sheet slides up. Background is dark (`#0a1f23`), title is white, labels are muted teal. PERMIT field wraps to multiple lines and is fully readable.
- Tap INTERMOD in the drawer → switches tab AND drawer closes.
- No bottom tab bar exists anymore.

- [ ] **Step 3: Stop here. Report findings.**

If anything looks wrong, raise specific issues; don't try to fix them inside this plan. Defects become a follow-up.

---

## Verification (end-to-end)

1. `npx vitest run` — all touched tests green:
   - Existing `field-ops-current.test.tsx` (3) — no change
   - New `field-ops-drawer.test.tsx` (6)
   - New `mobile-filter-bar.test.tsx` (7)
   - Other existing tests unchanged
2. `npx tsc --noEmit` — no NEW errors.
3. Manual mobile smoke (Task 7) passes all 7 visual confirmations.
4. Desktop layout at width ≥ 900 is unchanged: same right rail, same horizontal header, same desktop filter bar, same `FieldOpsNav` left rail.

## Out of scope

- Intermod and Analytics tabs (their layouts are independent).
- Desktop changes — no edits beyond the `isMobile` branch additions.
- Province / search filters (the chip bar shows TYPE + STATUS only). The full `FieldOpsFilters` desktop component still owns province/search; the spec's `⋯ MORE` popover is deferred to a follow-up if the user asks for it.
- Persistent drawer state across reloads (transient `useState` is fine).

## Self-review

- **Spec coverage**: bottom-sheet contrast → Tasks 1, 2; filter chips → Task 4; header → Task 5; drawer + bottom-tab removal → Tasks 3, 6. ✓
- **Placeholders**: every step has actual code or commands. The `⋯ MORE` popover is documented in "Out of scope" rather than left as a TBD.
- **Type consistency**: `FieldOpsKpis` (Task 3) imported from `@/utils/fieldOpsKpi` matches the existing `computeKpis` return type. `FieldFilters` (Task 4) imported from `FieldOpsFilters.tsx` matches the existing export. Drawer's `onChangeTab(id: FieldOpsTab)` matches `FieldOpsClient`'s existing `setTab`.
- **Dependency order**: 1 → 2 (token → consumer); 3 and 4 are independent; 5 depends on neither 3 nor 4; 6 needs 3 + 4 + 5; 7 needs 6.
- **Testing**: pure-component tests use `@testing-library/react` with the project's existing jsdom setup. No leaflet or prisma mocking required because the new components don't touch either.
