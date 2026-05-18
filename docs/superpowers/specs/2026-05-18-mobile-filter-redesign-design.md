# Mobile Filter Redesign

**Status:** Approved, ready for implementation plan
**Date:** 2026-05-18
**Surface:** `src/components/field-ops/MobileFilterBar.tsx` (mobile only — desktop `FieldOpsFilters.tsx` is out of scope)
**User pain (verbatim):** "filter in mobile view ... it look not modern and not easy for mobile user"

---

## Problem

The current mobile filter is a 4-row vertical stack of segment groups (`TYPE`, `PROVINCE`, `STATUS`, `LAW`), each rendered as horizontally-scrolling all-caps pills with bordered rails and 0.18em letter-spacing. It violates three modern map+filter conventions confirmed by a pattern survey of Airbnb, Zillow, Google Maps, Booking.com, and Material Design 3:

1. **Filters cover the map.** The expanded bar takes ~180–240px of vertical space, pushing the map into the bottom third of a 390px viewport.
2. **No active-filter visibility once collapsed.** The collapsed state shows only `≡ FILTERS · 3` — operators can't see *which* filters are applied without expanding.
3. **2018-era aesthetic.** Uppercase mono labels, wide letter-spacing, bordered chip rails read as a control-panel UI from before bottom-sheet patterns became standard.

Decision (confirmed in brainstorming): **hybrid layout** — promote the 2 most-used filters to an always-visible quick bar, push the remaining 5 to a bottom sheet, drop the all-caps, and let the map own the screen.

---

## Goals

1. The map gets ≥ 80% of vertical viewport on a 390 × 844 device (today: ~60–70%).
2. The 2 filters operators toggle multiple times per shift (Type, Status) are reachable in one tap from any point in the workflow.
3. The remaining 5 filters (Search, Province, Off-air, Revoked, Law-paper-sent) are reachable in two taps via a bottom sheet — but never visible by default.
4. Every chip and toggle has a ≥ 44 × 44 px tap target. Letter casing is sentence case, not all-caps.
5. Active filters are surfaced without adding a third UI row above the map.

## Non-goals

- **Desktop filter (`FieldOpsFilters.tsx`).** Different ergonomics (mouse, room for 7 columns); leave it alone.
- **Reordering the filter taxonomy.** Type / Status / Province / Off-air / Revoked / Law-sent / Search are the same dimensions as today.
- **Changing what each filter *does*** (predicates, default values, type-gated visibility). The pure filter predicates in `FieldOpsClient.fmStationMatchesFilter` and `filteredInterference` stay untouched.
- **Server-side anything.** This is pure presentational work.
- **An "Apply" button on the sheet.** Modern map+filter apps apply on tap; the sheet's bottom CTA only closes the sheet (it doesn't gate the filter).

---

## Design

### 1. Always-visible quick bar (replaces the current expanded stack)

A two-row bar, ~96 px tall. Row 1 is the two quick-filter segment groups; row 2 holds the always-visible `More` button and a conditional `Reset` button.

```
┌───────────────────────────────────────┐
│  [ All | FM | INT ]  [ All | Pending | Inspected ]  │   ← row 1, always
│  [ ⇅ More · 2 ]                              [ Reset ]  │   ← row 2, always
└───────────────────────────────────────┘
```

- **Two segment groups, no left labels.** Type (`All / FM / INT`) and Status (`All / Pending / Inspected`). The current `TYPE` / `STATUS` text labels are removed — sentence-case chip values are self-describing.
- **Segment group visual:** three contiguous pills with subtle dividers between them; no surrounding "track" border. Active pill = solid `--fo-accent` background + `#001e2b` text. Inactive = transparent + `--fo-rail-text`. Hover/focus uses a 1px `--fo-accent` outer ring.
- **Status group simplified to 3 options.** `Off air` and `Revoked` move into the sheet as toggles — they're rarely used and crowd the status row today.
- **Tap behaviour:** any chip applies the filter immediately. Map markers refresh in the same frame. No "Apply" button.
- **`More · N` button** opens the bottom sheet. `N` is the count of *advanced* filters set: `province !== "All"` + `offAir` + `revoked` + `lawSent` + `search.trim().length > 0`. Hidden zero-state (just `More`, no `· N`) when N = 0.
- **`Reset` appears only when *any* filter (quick or advanced) is non-default.** Single tap clears every filter back to `DEFAULT_FILTERS`. When no filter is set, the right slot in row 2 is empty (the `More` button stays put — only `Reset` is conditional). The bar height stays constant at ~96 px so the map below doesn't reflow when filters change.

### 2. The "More" bottom sheet

Slides up from the bottom on tap. Backed by a semi-transparent scrim that keeps the map dimmed-but-visible behind. Swipe-down on the drag handle dismisses; tapping the bottom CTA also dismisses.

Dimensions:
- **Height:** up to 75 dvh, content-fit otherwise. Never full-screen — keeps the map peeking at top, which is the cue that you're in a modal.
- **Width:** full viewport width.
- **Drag handle:** 4 × 36 px rounded pill, centred at the top with 8 px margin above and below.

Internal order:

```
┌───────────────────────────────────────┐
│              ▭▭▭▭                     │  drag handle
├───────────────────────────────────────┤
│  More filters                    [ ✕ ]│  title row (fo-serif 18, close button right)
├───────────────────────────────────────┤
│  Active:  [Province: นครราชสีมา ✕]    │  chip row (only when ≥1 advanced active)
│           [Off air ✕] [Search "btc" ✕]│
├───────────────────────────────────────┤
│  Search                               │  label
│  ┌─────────────────────────────────┐  │
│  │ 🔍  Search stations…            │  │  text input, autofocuses on open
│  └─────────────────────────────────┘  │
│                                       │
│  Province                             │
│  ┌─────────────────────────────────┐  │
│  │ All provinces                  ▾│  │  native <select> (OS-level scroll/search)
│  └─────────────────────────────────┘  │
│                                       │
│  FM filters                           │  sub-header, hidden when type=INT
│  [  Off air  ⃝ ]  [  Revoked  ⃝ ]    │  toggle pills
│                                       │
│  INT filters                          │  sub-header, hidden when type=FM
│  [  Law-paper sent  ⃝ ]               │  toggle pill
│                                       │
├───────────────────────────────────────┤
│        [ Show 247 results ]           │  sticky bottom CTA, full width, 56 px
└───────────────────────────────────────┘
```

- **Active-filter chip row** (between title and Search) lists only *advanced* filters that are currently set. Each chip = filter name + value + ✕. Tapping the chip body scrolls to that filter's row inside the sheet. Tapping the ✕ clears just that one filter (without closing the sheet). The row is hidden entirely when no advanced filters are active. Type and Status are deliberately NOT chipped here — they're visible on the bar behind the sheet, and chipping them would be redundant.
- **Search.** Native `<input type="search">`. Autofocuses when the sheet opens — operators who open the sheet usually want search. Has a clear (✕) button while non-empty.
- **Province.** Native `<select>` (not a chip row). Thai has 77 provinces; a horizontal scroll hides 90 % of them. Native select gets free OS scroll, type-to-jump, and keyboard ergonomics on hardware keyboards. Disabled state shown when no station matches the current Type filter, but this only happens for empty datasets — we don't gate UI on it.
- **FM/INT sub-headers** gate the advanced toggles. When `type === "FM"`, only Off-air / Revoked show. When `type === "INT"`, only Law-paper sent shows. When `type === "ALL"`, all three show under separate sub-headers. Matches existing `FieldFilters` gating logic.
- **Toggle pills** for off-air / revoked / law-sent — pill body shows the label, right edge shows a tiny circle that fills with `--fo-accent` when on.
- **Bottom CTA** is sticky to the bottom of the sheet, always visible while scrolling. Text reads `Show {N} results` where `N = filteredStations.length + filteredInterference.length`. Tapping closes the sheet (does NOT clear or commit anything — filters are already applied).
- **Close ✕** in the top-right corner of the title row is a secondary dismiss path (alongside swipe-down and bottom CTA).

### 3. Active-filter visibility

Two surfaces, no third UI row above the map:

1. **Count badge on the `More · N` quick-bar button.** Tells the operator how many advanced filters are set without opening the sheet. Costs zero vertical space.
2. **Removable chip row inside the sheet** (section above). Lets the operator see *which* advanced filters are set and clear individual ones without scrolling to find them.

Quick filters (Type, Status) are not chipped because they're already visible on the quick bar behind the open sheet.

### 4. Visual & typography

| Element | Today | Spec |
|---|---|---|
| Chip label casing | `OFF AIR` (uppercase) | `Off air` (sentence) |
| Chip letter-spacing | `0.18em` | `0.04em` |
| Chip font | `fo-mono` | `fo-mono` (unchanged — keeps field-ops aesthetic) |
| Active chip | Background `--fo-accent` | Same |
| Inactive chip | Transparent + border | Transparent, no border; subtle divider between siblings in a segment group |
| Segment-group rail | Bordered "track" around the 3 pills | None — pills sit naked with thin dividers |
| Sheet title font | n/a | `fo-serif` size 18 (different register from the bar's mono) |
| Tap target min | ~30 × 28 px | 44 × 44 px (Apple HIG) |
| Hover/focus | None | 1 px `--fo-accent` outer ring on focused chip |
| State transition | none | 120 ms ease on background-color |

Casing applies to every visible label: chips, sub-headers, sheet title, buttons. Sub-headers and helper text are `fo-mono` at `--fo-rail-mute` color, 10 px, 0.16em tracking (looser than chip body because they're decorative).

### 5. Interactions

- **Filter on tap, no Apply button.** Every chip / toggle / select / text input commits its change to `filters` immediately. The map and result count re-render in the same React tick.
- **Sheet open:** tap `More` → sheet animates up (220ms cubic-bezier 0.32, 0.72, 0, 1 — iOS spring). Backdrop fades in. Map below freezes (no pan/zoom while sheet is up).
- **Sheet dismiss:** any of (a) swipe down on handle, (b) tap backdrop, (c) tap title-row ✕, (d) tap bottom CTA. Sheet animates down 180ms, backdrop fades out, map regains input.
- **Reset:** quick-bar `Reset` button → `onChange(DEFAULT_FILTERS)`. Immediate, no confirmation prompt — the result count visibly resets so it's self-evident.
- **No "Apply" button on the sheet.** This is intentional and modern (Airbnb, Booking, Zillow). The bottom CTA's `Show N results` is a dismiss-with-positive-affordance, not a commit.
- **Sheet open state persisted** — `sessionStorage` key `fo:filterSheetOpen` (replaces current `fo:mobileFiltersOpen`). False by default. Defaults to closed so a returning user lands on a max-map view.

---

## Files

- **Rewrite** `src/components/field-ops/MobileFilterBar.tsx`
  - Strip the 4-row `SegmentRow` stack.
  - New layout: row of Type segment + Status segment + `More · N` + (conditional) `Reset`.
  - Sentence-case all labels. Drop `letter-spacing: 0.18em` → `0.04em`. Drop bordered chip rails.
  - Add the bottom-sheet UI (or import it as a new component — see below).
  - Replace `sessionStorage` key `fo:mobileFiltersOpen` with `fo:filterSheetOpen` (false default).
- **Create** `src/components/field-ops/MobileFilterSheet.tsx`
  - Owns the bottom-sheet markup, drag-handle, backdrop, scroll container, sticky CTA.
  - Renders: active-filter chip row, search input, province `<select>`, type-gated toggle blocks.
  - Props: `{ open: boolean; onClose: () => void; filters: FieldFilters; onChange: (next: FieldFilters) => void; provinces: string[]; resultCount: number }`.
  - Animation: CSS `transform: translateY()` + `transition` (220ms in, 180ms out). No animation library needed.
  - Swipe-to-dismiss handled via the same `touchStartY`/`touchEndY` pattern already used in `FieldOpsBottomSheet.tsx` (see `handleSwipeStart`/`handleSwipeEnd` — copy the gesture filter that ignores `input, textarea` so the search input still works).
- **Modify** `src/components/field-ops/FieldOpsClient.tsx`
  - The `MobileFilterBar` consumer (around line 499) gets one new prop: `resultCount={filteredStations.length + filteredInterference.length}`. Everything else (filters, onChange, provinces) is already passed.
- **Modify or create** `src/app/field-ops.css`
  - Add `.fo-chip` / `.fo-chip-group` / `.fo-toggle` / `.fo-filter-sheet` classes if they make styles more maintainable; otherwise keep inline-style approach used elsewhere in field-ops. (Implementer's call — both fit existing codebase patterns.)

---

## Testing

**Unit (Vitest):**

- `src/__tests__/mobile-filter-bar-redesign.test.tsx`
  - Renders the always-visible quick bar with Type/Status segment groups.
  - Tapping a Type chip calls `onChange` with `{ ...filters, type: "FM" }` (and zeroes `lawSent` for FM, matching existing `handleType` logic).
  - Tapping a Status chip calls `onChange` with `{ ...filters, status: "PENDING" }`.
  - `More · N` count badge increments correctly when an advanced filter is added (search, province, off-air, revoked, law-sent).
  - `Reset` button hidden in default state; visible when any filter is set; tapping clears all.
  - Sheet is closed on mount (default `sessionStorage` state is false).

- `src/__tests__/mobile-filter-sheet.test.tsx`
  - Sheet renders Search input, Province select, type-gated toggle blocks.
  - Search input autofocuses when sheet opens.
  - Toggling Off-air pill calls `onChange` with `{ ...filters, offAir: true }`.
  - Type-gated blocks hide correctly per `filters.type`.
  - Active-filter chip row renders only when at least one advanced filter is set.
  - Tapping a chip's ✕ clears just that filter (e.g., `onChange({ ...filters, search: "" })`).
  - Bottom CTA shows the `resultCount` prop value.
  - Tapping bottom CTA calls `onClose` (not `onChange`).
  - Sheet open/close state syncs to `sessionStorage` key `fo:filterSheetOpen`.

- Existing `src/__tests__/field-ops-filters.test.ts` and `src/__tests__/field-ops-filter-status.test.tsx` — confirm they still pass (filter predicates are untouched).

**Manual (real device or Chrome DevTools mobile-throttled):**

1. Open `/` on 390 × 844. Quick bar is 48 px tall, Type and Status pills visible, no Reset.
2. Tap `FM` → chip turns green, map refreshes. Tap `Pending` → second chip turns green, both visible.
3. Tap `More` → sheet slides up. Map dimmed but visible behind.
4. Type in Search → results update live in the bottom CTA.
5. Pick a Province from native select → chip appears in Active row inside sheet.
6. Toggle `Off air` → chip appears in Active row, count badge increments.
7. Tap `Off air ✕` chip → cleared, badge decrements.
8. Swipe down on drag handle → sheet dismisses.
9. Back on the bar: `More · 2` badge visible (province + search still set).
10. Tap `Reset` → all filters clear, bar returns to single-row state.
11. Pinch the map while sheet is open → map should NOT respond (sheet has input).

---

## Risks / open items

- **Sheet z-index over Leaflet.** Leaflet's marker pane and zoom controls sit at z-index 400-800. The sheet backdrop needs ≥ 1000 to cover them. Existing `FieldOpsBottomSheet.tsx` already solves this — copy the z-index pattern.
- **iOS Safari `100dvh` rounding.** Sheet height set in `dvh` to handle the iOS URL-bar collapse. Already used in `FieldOpsBottomSheet.tsx`.
- **Province native `<select>` styling.** Native selects ignore most CSS on iOS/Android. The select shows OS-styled dropdown; the trigger row can be styled. Acceptable trade-off for 77-item ergonomics.
- **Backdrop tap dismiss conflict with map.** The sheet's backdrop captures taps; tapping through the dimmed map to interact with a pin won't work while the sheet is open. That's the desired modal behaviour — operators close the sheet first, then interact with the map.
- **Replacing `sessionStorage` key** means returning users see a closed sheet on their next session even if they had the old expanded bar open. Acceptable one-time reset; not worth a migration shim for a UI redesign.
