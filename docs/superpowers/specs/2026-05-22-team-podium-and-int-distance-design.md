# Inspector Podium + INT Distance Navigation Design

**Date:** 2026-05-22
**Status:** Approved, ready for implementation plan

## Goal

Two tightly-scoped UX wins that share one PR:

1. **Team analytics → "Am I top 3 this month?"** Inspectors open the analytics page and immediately see who's on the podium for the current month and where THEY sit on the leaderboard.
2. **INT map → "Drive this direction, this far."** When an interference site has a recorded source location, the map and bottom sheet expose the bearing + distance prominently so the inspector can plan their next field visit.

No new API routes, no schema changes, no migrations. Pure UI restructure + visual polish over data the codebase already returns.

## Audience & Scope Decisions

| Question | Decision |
|---|---|
| Who is the primary reader? | Inspectors checking their own rank |
| Which timeframe is the hero? | This month (with YTD as a toggle) |
| What counts as 1 "point"? | Lead + Helper, equal weight |
| Desktop podium shape? | 3-column podium with you-pinned leaderboard below |
| Mobile podium shape? | Stacked gold/silver/bronze cards |
| INT workflow being served? | Planning the next field visit |
| INT map treatment? | Clean bearing arrow + distance label (no FM-candidate panel for v1) |

Explicitly **out of scope** for this design (could be follow-ups):
- FM-station "source candidate" suggestions inside the bearing wedge
- Bearing-uncertainty wedge visualization
- Concentric distance rings
- Multi-site triangulation
- Manager-focused team-health view

## Architecture

Pure client-side. Both surfaces consume data that's already in their props or the existing API responses:

- **Podium** reads `/api/analytics/inspectors` (existing) — fields `ytdTotal`, `monthTotal`, `displayName`, `id`. Adds a client-side `points` derivation based on the active timeframe pill.
- **INT distance** reads the already-loaded `InterferenceSite` record — fields `lat`, `long`, `sourceLat`, `sourceLong`, `direction`, `estimateDistance`. No new fetches.

The "You" highlight uses `currentUser.id` already plumbed through `AnalyticsDashboard` → `InspectorsSection` and `FieldOpsClient` respectively.

## Feature 1 — Inspector Podium

### Page layout

The current `AnalyticsDashboard` has an `InspectorsSection` that renders four child components: `TopPerformer`, `LeaderboardTable`, `MonthlyParticipationChart`, `PerUserRoleDonuts`. We restructure the top half:

```
┌──────────────────────────────────────────────┐
│  Timeframe pills:  [ MAY 2026 ] [ YTD ]      │  ← default Month
├──────────────────────────────────────────────┤
│                                              │
│  Desktop podium  (3 columns, gold center):   │
│      ┌────────┐ ┌────────┐ ┌────────┐         │
│      │ silver │ │ GOLD🏆 │ │ bronze │         │
│      │  #2    │ │  #1    │ │  #3    │         │
│      │ Boom   │ │ Aom    │ │ Cherry │         │
│      │  14    │ │  18    │ │  11    │         │
│      └────────┘ └────────┘ └────────┘         │
│                                              │
├──────────────────────────────────────────────┤
│  YOU-PINNED LEADERBOARD (ranks 4+):          │
│  #4  Daeng                              8    │
│  #5  YOU                                7    │ ← accent border + bold
│  #6  Eak                                6    │
│  #7  Fay                                4    │
└──────────────────────────────────────────────┘
[ existing MonthlyParticipationChart ]
[ existing PerUserRoleDonuts ]
```

Mobile reuses the same content with the podium re-rendered as stacked gold/silver/bronze cards (each card spans the full sheet width, large medal icon left, name + score right).

### Components

| File | Responsibility |
|---|---|
| `src/components/analytics/InspectorsSection.tsx` | Container. Owns the `timeframe` state (`'month' \| 'ytd'`). Renders pill toggle + podium + leaderboard. Keeps `MonthlyParticipationChart` + `PerUserRoleDonuts` below as the existing secondary block. |
| `src/components/analytics/TimeframePills.tsx` (NEW) | Two-pill toggle. Defaults to `month`. Stores in `useState` (no persistence). |
| `src/components/analytics/InspectorPodium.tsx` (NEW) | Desktop 3-column podium. Accepts `inspectors: { id, displayName, points }[]` (already sorted desc), `currentUserId`. Renders top-3 in podium order (`#2`, `#1`, `#3` columns) with bigger gold center. Degrades gracefully when <3 inspectors. |
| `src/components/analytics/InspectorPodiumMobile.tsx` (NEW) | Mobile stacked gold/silver/bronze cards. Same props as `InspectorPodium`. Each card = `<MedalCard rank tone="gold|silver|bronze" name points />`. |
| `src/components/analytics/InspectorLeaderboard.tsx` (NEW) | Renders ranks 4+ with "You" highlight. If `currentUserId` is in top 3, leaderboard starts at rank 4 normally. If `currentUserId` is below top 3, the user's row is sticky-positioned at the top of the list (with the natural-rank row also kept inline so the leaderboard remains contiguous). |

`InspectorPodium` and `InspectorPodiumMobile` render side-by-side in the DOM; CSS `@media` chooses which is visible. (Avoids a `window.innerWidth` listener.)

### Scoring derivation

```ts
const points = timeframe === 'month' ? inspector.monthTotal : inspector.ytdTotal;
```

Both `monthTotal` and `ytdTotal` are already calculated server-side as `lead + helper` participation counts. No backend change.

### "You" detection

```ts
const isYou = inspector.id === currentUserId;
```

Applied as:
- **In podium:** if `isYou` for a top-3 inspector, add an accent ring around their pedestal (don't change the medal color — keep the visual celebration).
- **In leaderboard:** `border-left: 3px solid var(--fo-accent)`, bold name, `color: var(--fo-accent)` on the row.

### Empty / degraded states

| Condition | Behavior |
|---|---|
| 3+ inspectors with `points > 0` | Full podium. |
| 2 inspectors with `points > 0` | Render only gold + silver pedestals (centered). Bronze slot hidden, not greyed. |
| 1 inspector with `points > 0` | Render only the gold pedestal (centered, full width). |
| 0 inspectors with `points > 0` | Replace podium with empty state: `"No inspections recorded yet this {timeframe}."` |
| Current user has `points = 0` | Show in leaderboard with score 0; no special "you're not on the board" callout — keeps tone neutral. |

### Visual tokens

Uses existing field-ops palette:
- Gold: `#ffc845` background, `#001e2b` text
- Silver: `#c0c0c0` background, `#001e2b` text
- Bronze: `#cd7f32` background, `#fff` text
- "You" accent: `var(--fo-accent)` (the `#00ed64` already used across the app)
- Card surface: `var(--fo-band)` for podium pedestals, `var(--fo-canvas)` for leaderboard rows

### Tests

- `InspectorPodium`: renders 3, 2, 1, 0 inspectors correctly. Order is silver-left, gold-center, bronze-right. "You" ring appears only when `currentUserId` matches a top-3 inspector.
- `InspectorPodiumMobile`: renders gold/silver/bronze as stacked full-width cards. Order is top-down 1→2→3.
- `InspectorLeaderboard`: shows ranks 4+ when current user is in top 3. When current user is rank 5+, current user appears at the top of the leaderboard (sticky) AND in natural position.
- `InspectorsSection` integration: toggle pill flips between month and YTD; podium re-sorts.

## Feature 2 — INT Distance Navigation

### What changes on the maps

Both `InterferenceMap` (desktop) and `FieldOpsMap` (mobile) currently render a cell-site pin, a source pin (red rotated square), and a dashed connecting line. We replace the dashed line and add a navigation pill.

```
┌────────────────────────────────────────┐
│  ┌─────────────────────────┐           │
│  │ → 062°  ·  5.4 km       │ ← pill    │
│  └─────────────────────────┘  top-left │
│                                        │
│                            ◇  SOURCE   │
│                          ╱             │
│                        ╱   5.4 km      │  ← chip on midpoint
│                      ╱                 │  ← solid green→red gradient
│                    ╱                   │     with arrowhead
│       📡 CELL ───╱                     │
└────────────────────────────────────────┘
```

### Components

| File | Responsibility |
|---|---|
| `src/components/interference/NavigationPill.tsx` (NEW) | Pure presentational. Props: `bearing: number \| null`, `distance: number \| null`, `position?: 'top-left' \| 'inline'`. Renders nothing when both are null. |
| `src/components/interference/InterferenceMap.tsx` (MODIFY) | Replace `<Polyline dashArray>` with gradient line + Leaflet decorator for the arrowhead. Render `<NavigationPill position="top-left" />` as a Leaflet `Control` (so it floats over the map rather than re-rendering on pan). Add a `<DistanceBadge>` as a midpoint marker. |
| `src/components/field-ops/FieldOpsMap.tsx` (MODIFY) | Same pill + line treatment, scaled for mobile (smaller pill, larger arrowhead). |
| `src/components/field-ops/FieldOpsBottomSheet.tsx` (MODIFY) | Promote the existing `BEARING` + `DIST` `Inline` fields into a single prominent row directly under the title: `→ {bearing}° · {distance.toFixed(1)} km`. Use `var(--fo-accent)` and larger type (~16px). The old `BEARING` and `DIST` `Inline` chips disappear (folded into the new row). |

### Data, no new fields

| What | From |
|---|---|
| Cell position | `site.lat`, `site.long` |
| Source position | `site.sourceLat`, `site.sourceLong` |
| Bearing (degrees from cell) | `site.direction` (already populated by inspectors) |
| Distance (km) | `site.estimateDistance` (already computed when source is dropped) |

Formatting:
- Bearing: 3-digit padded — `"062°"` not `"62°"`.
- Distance: 1 decimal — `"5.4 km"`, not `"5.4321 km"`.

### Fallback states

| Condition | Pill | Map line | Bottom-sheet row |
|---|---|---|---|
| Source recorded, bearing + distance present | `→ 062° · 5.4 km` | Visible | `→ 062° · 5.4 km` |
| Source recorded, no `direction` | `5.4 km` (no arrow) | Visible | `5.4 km` |
| No source recorded, `direction` present | `→ 062° · pending source` | Hidden | `→ 062° · pending source` |
| No source, no `direction` | Hidden | Hidden | Hidden |

### Visual treatment

- **Pill:** `var(--fo-canvas)` background, `1px solid var(--fo-accent)` border, monospace, `letter-spacing: 0.12em`, padding `6px 10px`, border-radius `999px`.
- **Connecting line:** `linear-gradient(to right, var(--fo-accent), var(--fo-crit))` with `stroke-width: 3`, arrowhead at the source end. On Leaflet this is two layers: a base `<Polyline>` with gradient (via SVG `<defs>`) + a `<Marker>` at the source with a small SVG triangle rotated to match the bearing.
- **Distance chip on midpoint:** small black-on-accent pill, `font-size: 11px`, centered on the line's geometric midpoint.

### Tests

- `NavigationPill`: renders correctly for all 4 fallback combinations.
- `NavigationPill`: bearing 5 → renders `"005°"`; bearing 90 → `"090°"`; bearing 359 → `"359°"`. Distance `5.4321` → `"5.4 km"`.
- `InterferenceMap` integration: site with source → pill visible at top-left; site without source → pill absent.
- `FieldOpsBottomSheet`: bearing + distance row replaces the old `BEARING` and `DIST` chips when a source exists; falls back to "pending source" when only `direction` is set.

## File Structure Summary

**Create:**
- `src/components/analytics/TimeframePills.tsx`
- `src/components/analytics/InspectorPodium.tsx`
- `src/components/analytics/InspectorPodiumMobile.tsx`
- `src/components/analytics/InspectorLeaderboard.tsx`
- `src/components/interference/NavigationPill.tsx`
- `src/__tests__/inspector-podium.test.tsx`
- `src/__tests__/inspector-leaderboard.test.tsx`
- `src/__tests__/navigation-pill.test.tsx`

**Modify:**
- `src/components/analytics/InspectorsSection.tsx` — rip out the existing top half, mount the new components. Keep the lower secondary section (monthly chart + role donuts) intact.
- `src/components/interference/InterferenceMap.tsx` — gradient line, arrowhead, pill control, midpoint chip.
- `src/components/field-ops/FieldOpsMap.tsx` — same map treatment scaled for mobile.
- `src/components/field-ops/FieldOpsBottomSheet.tsx` — promoted bearing + distance row.

**Remove:**
- The existing `TopPerformer.tsx` card if it's no longer used after the podium replaces it. Verify by grep before removing.

**No changes:** API routes, Prisma schema, middleware, session helpers.

## Acceptance Criteria

- [ ] Opening `/analytics` defaults to "MAY 2026" pill selected; podium shows the top 3 by `monthTotal`.
- [ ] Clicking the `YTD` pill re-sorts the podium and leaderboard by `ytdTotal` without re-fetching.
- [ ] If you're inspector `id=5`, your row in the leaderboard has the green left border and bold text. If you're in the top 3, your pedestal has the accent ring.
- [ ] On phone viewport, the podium renders as 3 stacked gold/silver/bronze cards instead of the 3-column layout.
- [ ] Opening any INT site with a recorded source shows a `→ NNN° · X.X km` pill at top-left of the map.
- [ ] The connecting line is solid, gradient (green→red), arrowhead at the source.
- [ ] The mobile bottom sheet shows the promoted `→ NNN° · X.X km` row immediately under the site title for sites with a source.
- [ ] Sites without a source show no pill, no line, and a "pending source" hint in the bottom sheet (only when `direction` is set).
- [ ] All new tests pass: podium ×4 cases, leaderboard "You" placement ×2, navigation pill ×4 fallbacks.

## Out of Scope (Explicit)

- FM-station candidate suggestions or any "auto-find the source" logic.
- Bearing-uncertainty wedge visualization.
- Concentric distance rings.
- Multi-site triangulation when two sites detect the same source.
- Manager-focused team-health view ("who's overloaded", "coverage gaps").
- Big-screen "office wall" dashboard mode.
- Persisting the user's timeframe pill choice across sessions.
- Notifications when an inspector enters the top 3.

These can each become their own brainstorm → spec → plan cycle if the team wants them.
