# Mobile UI Fixes (Field Ops) — Design Spec

**Date:** 2026-05-07
**Branch:** `feature/ui-redesign`
**Scope:** Field Ops tab on mobile (`window.innerWidth < 900`). Intermod and Analytics tabs are unchanged.

## Problem statement

When using the app on a phone:

1. The bottom-sheet station detail (FM tag, FM-id, PENDING, name, location, FREQ, PERMIT) uses light-theme tokens against an undefined background, so the text washes out — hard to read on a dark map.
2. The TYPE (ALL/FM/INT) and STATUS (ALL/PENDING/INSPECTED/OFF AIR) filters are not visible on mobile at all — the right rail that hosts them on desktop is hidden.
3. The header (title + 4 KPI tiles + ☾ DARK + ● LIVE) wraps into a long vertical mess at narrow widths.
4. The footer tab bar (FIELD OPS / INTERMOD / ANALYTICS) eats vertical space and feels misplaced for a primary navigation surface.

## Goal

Make the Field Ops tab usable and legible on phones, with a coherent navigation pattern (left drawer instead of bottom tabs) and high-contrast bottom-sheet detail. Use only existing CSS tokens plus two new variables for the sheet — no new color values.

## Architecture

Five surface changes inside `src/components/field-ops/`, all gated on the existing `isMobile` flag in `FieldOpsClient.tsx`:

1. **`FieldOpsHeader.tsx`** gets a mobile branch: single-row layout with ☰ menu, two-line title, and a `STATS ▾` toggle. KPI strip below is hidden by default and slides in when STATS is tapped.
2. **New `MobileFilterBar.tsx`** renders a sticky two-row chip strip on mobile, sitting between header and map. A `▴` toggle on the bar collapses to a single `≡ FILTERS · N` pill. Last state persisted to `sessionStorage`. Reuses the same filter setters as the existing desktop `FieldOpsFilters.tsx` — that file is unchanged.
3. **New `FieldOpsDrawer.tsx`** — left drawer triggered by ☰. Holds NAV (3 tabs), DARK + ●LIVE pills, and a STATS block mirroring the collapsible KPI strip. Replaces the bottom tab bar.
4. **`FieldOpsClient.tsx`** wires the drawer state, removes the bottom tab bar, and renders the new mobile filter bar.
5. **`FieldOpsBottomSheet.tsx`** stops using `--fo-band` / `--fo-mute` / `--fo-ink` and uses two new dark-only tokens (`--fo-sheet-bg`, `--fo-sheet-text`) so it always renders against the dark map regardless of the active theme.

No prop interfaces change. No DB / Prisma / API changes.

## Components

### `FieldOpsHeader.tsx` (mobile branch)

**Single row, ~56px tall, dark Field Ops palette:**

| Element | Position | Notes |
|---|---|---|
| `☰` menu button | left | 24×24 icon, opens drawer (callback prop `onOpenDrawer`) |
| Title block | center, `flex: 1` | line 1: `NBTC · FIELD OPS · {scope}` (mono, 9px, `--fo-accent`); line 2: `Field Operations` (serif, 14px, `--fo-rail-text`) |
| `STATS ▾` button | right | mono, 10px, hairline border. Toggles a `statsOpen` boolean |

**KPI strip** rendered below the header row, only when `statsOpen === true`:
- 56px tall, horizontally scrollable
- `TOTAL · INSPECTED (/target · pct%) · PENDING · CRITICAL` — same data as desktop, same color rules (accent for INSPECTED, crit for CRITICAL, mute for null)
- Uses existing `<Stat>` helper unchanged

`statsOpen` lives in component state (no persistence — minor toggle).

### `MobileFilterBar.tsx` (new file)

**Position:** sticky between header and map; full-width.

**States:**
- **Expanded (default):** two rows of horizontally-scrollable chips, each row prefixed with a 9px label (`TYPE`, `STATUS`). Active chip uses `--fo-accent` solid background + dark text; inactive chips have a 1px `--fo-rail-border` outline + muted text. The first row also includes a `⋯ MORE` chip on the right that opens a small popover for province/search (reuses existing `FieldOpsFilters` desktop controls).
- **Collapsed:** single pill `≡ FILTERS · N` where `N` is the count of filters whose value is not `ALL` and not empty. The `▾`/`▴` chevron toggles state.

**Persistence:** `sessionStorage["fo:mobileFiltersOpen"]` — boolean, hydrated on mount, written on toggle. Default true.

### `FieldOpsDrawer.tsx` (new file)

**Trigger:** `☰` button in the header (controlled by `drawerOpen` state in `FieldOpsClient`).

**Visual:**
- Width 280px, slides in from the left.
- Backdrop `rgba(0, 0, 0, 0.55)` covers the rest of the screen; tap or swipe-left closes.
- Background `--fo-rail-bg`, color `--fo-rail-text`.

**Sections (top to bottom):**

1. **NAV** — header label "NAV" (9px mono `--fo-rail-mute`). Three full-width buttons:
   - `⚑ FIELD OPS` — active when `tab === "field-ops"`
   - `⚙ INTERMOD` — active when `tab === "intermod"`
   - `📊 ANALYTICS` — active when `tab === "analytics"`
   - Active button: `--fo-accent` background, dark text, bold; inactive: 1px border, muted text. Tapping a button calls `onChangeTab(t)` and closes the drawer.
2. Divider (`1px solid --fo-rail-border`)
3. Two pills inline (gap 8px): `☾ DARK` (or `☀ LIGHT` when in light theme) — calls `onToggleTheme`; `● LIVE` indicator (read-only, accent border + accent color).
4. Divider.
5. **STATS** — header label "STATS". Four rows: `TOTAL · 26`, `INSPECTED · 0/200 · 0%`, `PENDING · 26`, `CRITICAL · —`. Same color rules as the header KPI strip.

**State:** `drawerOpen: boolean` lives in `FieldOpsClient`. No persistence — drawer is a transient overlay.

### `FieldOpsClient.tsx` (changes)

- Add `drawerOpen` state.
- On mobile, render `<FieldOpsDrawer ... />` and `<MobileFilterBar ... />`. Pass `onOpenDrawer={() => setDrawerOpen(true)}` to `<FieldOpsHeader>`.
- **Remove** the `isMobile && <div>...{tabs}</div>` bottom tab bar (currently `FieldOpsClient.tsx:493-520`).
- Drawer's `onChangeTab` calls existing `setTab(t)` and closes the drawer.

### `FieldOpsBottomSheet.tsx` (token swap)

Replace these tokens:

| Before | After |
|---|---|
| `var(--fo-band, #ffffff)` (background) | `var(--fo-sheet-bg)` |
| `var(--fo-ink)` (title, body) | `var(--fo-sheet-text)` |
| `var(--fo-mute)` (labels) | `var(--fo-rail-mute)` |
| `var(--fo-divider)` (border, line) | `var(--fo-rail-border)` |

New tokens defined once in `src/app/field-ops.css` at the `:root` level (always defined regardless of theme):

```css
:root {
  --fo-sheet-bg: #0a1f23;
  --fo-sheet-text: #e6efe9;
}
```

PERMIT lines wrap to multiple lines: `font-size: 12px; line-height: 1.4`. No truncation.

## Data flow

No data changes. All four issues are presentation-only.

- `computeKpis` (existing) feeds both the header KPI strip and the drawer STATS block. Two render sites, one source.
- `FieldOpsFilters` state (existing) backs the mobile chip bar — same setters, same store.

## Error handling

- `sessionStorage` reads in `MobileFilterBar` are wrapped in a try/catch (Safari private mode throws). On read failure, default to expanded.
- Drawer open state is plain React state — no error path.
- The header's `STATS ▾` toggle has no failure modes.

## Testing

Add one new component test file plus extensions to existing tests:

- **New `src/__tests__/field-ops-drawer.test.tsx`** — render `<FieldOpsDrawer open={true} ...>` and assert: NAV buttons render with correct active state; DARK + LIVE pills render; STATS rows render with correct values from a stub `kpis` prop; clicking a NAV button calls `onChangeTab` and `onClose`.
- **New `src/__tests__/mobile-filter-bar.test.tsx`** — render `<MobileFilterBar open={true}>`, assert chip rows visible; toggle to collapsed, assert single `≡ FILTERS · N` pill; verify N reflects active-filter count; verify `sessionStorage` is written.
- **Extend `src/__tests__/field-ops-current.test.tsx`** — already covers REVOKED chip; no change.
- No E2E required — visual smoke is done in dev.

Skip:
- Snapshot tests for divIcon HTML (opaque to vitest).
- Mobile breakpoint tests (manual: resize browser to <900px).

## Out of scope

- Intermod and Analytics tabs (their layouts weren't called out).
- Desktop layout (no changes; everything is `isMobile`-gated).
- Map zoom-controls placement on mobile (works as-is).
- Persistent drawer state across sessions (transient is fine).
- Right-rail desktop hide/show toggle (not asked for).
- iPad/tablet breakpoint between mobile and desktop (the existing 900px split stays).

## Risks / open questions

- **Sticky filter bar might fight Leaflet's gesture handling** on the iOS Safari rubber-band scroll edge — verify no scroll trapping during dev smoke.
- **Drawer + bottom sheet z-index** — the drawer must render above the bottom sheet but below toast notifications. Set drawer at `z-index: 60`, bottom sheet at `z-index: 40`, backdrop at `z-index: 50`.
- **`⋯ MORE` popover** for province/search inside the chip bar may need an additional design pass if the existing `FieldOpsFilters` controls don't fit a 240px-wide popover. Acceptable fallback: tap `⋯ MORE` opens the drawer's "extras" section instead.
