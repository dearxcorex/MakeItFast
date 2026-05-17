# Heading-Aware Location Pin — Design

**Date:** 2026-05-08
**Branch:** `feature/ui-redesign`
**Status:** Approved for planning

## Problem

The current "you are here" pin (`createLocationIcon` in `src/utils/mapHelpers.ts`)
is a static cyan dot with a pulse halo. It does not show which way the user is
facing. The primary use case for this app is field inspection while **driving**
between FM stations, so the user almost always wants to know where they are
*and which way the car is pointing* — to decide which station to drive toward
next, and to orient themselves on the map.

GPS already returns `position.coords.heading` (degrees clockwise from true
north) and we already capture it in two places, but neither map renders a
direction indicator.

## Goals

- Render the user's location with a clear visual indication of heading.
- Work in both the **stations map** and the **interference map**.
- Read well at a glance while driving (high contrast, no fine details).
- Degrade gracefully when no heading is available (parked, cold start).
- No new runtime dependencies, no new permission prompts.

## Non-goals

- Map auto-pan to follow the user (a separate "drive mode" feature).
- Rotating the map heading-up. Map stays north-up; only the pin rotates.
- iOS `DeviceOrientationEvent` compass fallback (deferred — needs permission UX).
- Consolidating the two parallel `watchPosition` calls in
  `OptimizedFMStationClient` and `Map.tsx` (pre-existing tech debt; out of scope).

## Decisions (from brainstorming)

| Question | Choice |
|---|---|
| Scope | Both maps — stations map + interference map |
| Heading fallback when GPS heading is null | Freeze last known heading and gray out the cone |
| Map orientation | North-up; rotate only the pin |
| Pin shape | Dot + beam cone (cyan dot, 60° translucent cone projecting forward) |
| Implementation pattern | Rebuild Leaflet `divIcon` on each heading change (idiomatic react-leaflet) |

## Architecture

```
src/utils/headingTracking.ts        // pure: smoothing + stale + bearing-from-positions
src/utils/mapHelpers.ts             // createLocationIcon(heading, stale) — updated signature
src/components/Map.tsx              // wires headingTracking into LocationTracker
src/components/interference/
  InterferenceMap.tsx               // wires headingTracking into its own location flow
src/app/globals.css                 // .heading-cone, .heading-cone--stale, pulse rules
```

No new dependencies.

## Components

### `src/utils/headingTracking.ts` (new, pure)

Single function plus a small state shape. No React, no DOM — easy to unit test.

```ts
export interface HeadingState {
  heading: number | null;       // smoothed degrees [0, 360), null until first sample
  stale: boolean;               // true when last GPS sample had no usable heading
  lastSampleAt: number;         // ms epoch of last fresh sample (for debugging only)
  lastPosition: { lat: number; lng: number } | null; // for bearing-fallback
}

export interface HeadingSample {
  lat: number;
  lng: number;
  heading: number | null;       // GPS heading in degrees, may be null
  speed: number | null;         // GPS speed in m/s, may be null
}

export function initialHeadingState(): HeadingState;

export function updateHeading(
  prev: HeadingState,
  sample: HeadingSample,
  now?: number,
): HeadingState;
```

Rules inside `updateHeading`:

1. If `sample.heading` is non-null **and** `sample.speed ?? 0 >= MIN_SPEED_MS` (0.5 m/s):
   smooth via exponential moving average — `next = ema(prev.heading, sample.heading, α=0.3)`,
   handling 0/360 wraparound. Set `stale=false`. Update `lastSampleAt`.
2. Else if `sample.heading` is null **and** `prev.lastPosition` exists **and**
   distance moved ≥ `MIN_BEARING_DISTANCE_M` (5 m):
   compute bearing from `prev.lastPosition → sample` via Haversine bearing,
   smooth into `prev.heading`, set `stale=false`.
3. Else: keep `prev.heading`, set `stale=true`.
4. Always update `lastPosition` to the new sample's coords.

Constants live at top of the file:

```ts
const MIN_SPEED_MS = 0.5;
const MIN_BEARING_DISTANCE_M = 5;
const EMA_ALPHA = 0.3;
```

### `src/utils/mapHelpers.ts::createLocationIcon`

Signature changes from `createLocationIcon()` to:

```ts
createLocationIcon(opts?: { heading?: number | null; stale?: boolean }): L.DivIcon
```

- All current callers pass nothing → backward-compatible default = plain dot,
  no cone (cold-start state).
- When `heading` is a number: render the cone, rotated by `${heading}deg`.
- When `stale=true`: cone gets `.heading-cone--stale` (low opacity, gray fill).
- Pulse halo and dot are rotation-invariant; only the cone `<g>` rotates so the
  pin never appears to wobble.

Icon size grows from `[20, 20]` to `[80, 80]` to fit the cone, with
`iconAnchor: [40, 40]` so the dot stays centered on the actual lat/lng.

The SVG stays inline in the `divIcon` HTML (consistent with existing
`createStationIcon` pattern).

### `src/app/globals.css`

Add cone styling adjacent to the existing `.location-marker` rules
(`globals.css:1283`). Stale variant is a single class swap.

### `src/components/Map.tsx`

In `LocationTracker`:

- Add `headingStateRef = useRef(initialHeadingState())`.
- Inside both `getCurrentPosition` and `watchPosition` success callbacks, call
  `updateHeading(headingStateRef.current, sample)` and persist back to the ref.
- Extend the `UserLocation` callback payload (already includes `heading`) with
  the smoothed value and a new `stale: boolean` field.

In the `<Marker>` for the user (line 189–209):

- Replace `icon={createLocationIcon()}` with
  `icon={createLocationIcon({ heading: userLocation.heading, stale: userLocation.stale })}`.

The `Marker` prop change is enough — react-leaflet diffs the icon prop and
re-applies it when the value changes.

### `src/components/interference/InterferenceMap.tsx`

Mirror the wiring. `InterferenceMap` already receives `userLocation` as a prop
from `OptimizedFMStationClient`, which runs its own `watchPosition`
(`OptimizedFMStationClient.tsx:184`). Add the `headingStateRef` *there* — call
`updateHeading()` inside the existing watcher's success callback, then route
`{ heading, stale }` to `InterferenceMap` through the existing prop chain.

`Map.tsx` keeps its own `LocationTracker` watcher and its own `headingStateRef`
(it doesn't share state with the parent today, and consolidating that is
out of scope per the non-goals). The two refs operate on the same physical GPS
stream, so values stay consistent in practice; in addition, the two maps live
on different tabs (`ActiveTab` in `OptimizedFMStationClient`) and are never
visible at the same time, so any transient mismatch is not user-observable.

### `src/types/station.ts::UserLocation`

Add an optional `stale?: boolean` field. `heading` already exists.

## Data flow

```
navigator.geolocation.watchPosition
   ↓
{ coords: { lat, lng, accuracy, heading, speed } }
   ↓
updateHeading(headingStateRef.current, sample)        // smoothing + stale flag
   ↓
setUserLocation({ lat, lng, accuracy, speed,
                  heading: smoothedHeading, stale })
   ↓
<Marker
  position={[lat, lng]}
  icon={createLocationIcon({ heading, stale })}      // re-derived per render
/>
```

## Visual spec (chosen: B — Dot + beam cone)

| Element | Spec |
|---|---|
| Dot | 18 px cyan disc (`#22D3EE`), 3 px white border, drop shadow |
| Cone | 60° wide, ~40 px radius, radial gradient cyan→transparent, rotated by `heading` |
| Pulse halo | Existing `locationPulse` keyframes; paused (`animation-play-state: paused`) when `stale=true` |
| Stale cone | `opacity: 0.35`, fill `#94a3b8` (slate-400), no animation |
| Cold-start (no heading ever) | Plain dot + pulse only; cone hidden |
| Brand color | Reuse `#22D3EE` (matches existing `.location-marker`) |

## Error / fallback table

| Situation | Behavior |
|---|---|
| GPS heading non-null, speed ≥ 0.5 m/s | Smooth with EMA, render fresh cone |
| GPS heading null, distance from last position ≥ 5 m | Bearing fallback, render fresh cone |
| GPS heading null, slow / stationary | Keep last known heading, render `--stale` cone |
| No prior heading ever (cold start) | Plain dot, no cone, pulse on |
| Geolocation permission denied | Existing default-to-LA flow; no pin (unchanged) |

## Testing

- **Unit (`headingTracking`):** EMA math including 358°↔2° wraparound, stale
  toggle on null heading, bearing-fallback when speed is null but movement is
  large, behavior across the `MIN_SPEED_MS` threshold.
- **Unit (`createLocationIcon`):** snapshot the generated HTML for fresh,
  stale, and cold-start states; assert `transform: rotate(...)` is present
  only when `heading != null`.
- **Component (`Map.tsx`):** existing Leaflet mocks
  (`vi.mock('react-leaflet')`) already stub `divIcon`/`icon`. Add a test that
  feeds successive `watchPosition` samples and asserts the icon factory is
  called with the expected `{ heading, stale }` arguments.
- **Coverage target:** maintain the 80%+ project floor; new utility should be
  ≥95% (it is pure).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Heading jitter at low speeds | EMA smoothing + speed threshold for accepting samples |
| 0/360 wraparound jumps | Wraparound-aware EMA (compute shortest angular delta) |
| Icon recreation cost | GPS rate is ~1 Hz; one `divIcon` per tick is negligible |
| Stale flag sticks forever if user never moves | Acceptable — visual gray clearly communicates "not current" |
| Two maps showing different angles | Same GPS stream + non-overlapping tabs; transient mismatch isn't user-visible |

## Open questions

None at this stage. Defer drive-mode auto-pan and compass-fallback until the
basic pin lands and we have field feedback.
