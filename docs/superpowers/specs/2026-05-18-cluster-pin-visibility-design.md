# Cluster Pin Visibility Design

**Status:** Approved, ready for implementation plan
**Date:** 2026-05-18
**Surface:** `/` (Field Ops home page) → `FieldOpsMap.tsx` + `MarkerClusterGroup`
**User pain (verbatim):** "review from user it say view hard" — operators on the field-ops map say grouped pins are hard to view. Two specific complaints (confirmed in brainstorming): clusters form too aggressively at the zooms they want to work at, and even when a cluster is the right call, the bubble shows only a count — no signal about what's inside.

---

## Goals

1. At the inspection-workflow zoom (city-block scale), markers render individually — no clustering gets between the operator and the pin they want to tap.
2. At wider zooms where clustering is still necessary, the cluster bubble carries enough information that the operator can prioritise without zooming in (e.g., "this cluster has 3 criticals — drive here next" vs "this cluster of 18 is all inspected, skip").
3. Both decisions must hold up on a 390 px-wide mobile screen with a thumb-sized tap target.

## Non-goals

- The "+N" stacked-pin badge at identical coordinates is a related visibility problem but a different rendering path. **Not in scope.** If it's also painful, it gets its own spec.
- Per-cluster spider expansion at intermediate zooms (between cluster-on and cluster-off). The disable-at-zoom-13 cutover is sharp on purpose — adding a third mode would muddy the mental model.
- Off-air, law-paper-sent, sector ranking nuance in the cluster ring. Those signals live at the individual-pin level. Packing more than 3 colours into a ≤56 px ring is visual mush.

---

## Design

### 1. Zoom-gated clustering

`MarkerClusterGroup` gets `disableClusteringAtZoom={13}`. At zoom ≥ 13 (~76 m/px, neighbourhood scale), every marker renders individually — no cluster bubbles at all. Tapping markers and panning the map at the day-to-day inspection zoom now behaves like there is no cluster layer.

At zoom < 13 (province / region scale) clustering still happens with the existing `maxClusterRadius={45}`. Tightening the radius at wide zoom would just trade fewer-but-bigger clusters for more-but-still-opaque clusters; we want fewer/bigger ones combined with the redesigned bubble in §2.

**Edge case:** flying to a station from far out lands the camera past zoom 13, so the surrounding markers naturally pop out of clusters when the fly completes. That's the desired behaviour — don't add code to handle it.

### 2. Cluster bubble — count + segmented ring

The cluster bubble is a two-layer mark:

- **Inner disc** — total count, monospace, centred. Same sizing-by-count buckets as today, but bumped to clear the 44 px tap-target floor:

  | Bucket (by child count) | Today | Spec |
  |---|---|---|
  | small  (≤ 10) | 36 px | **44 px** |
  | medium (≤ 50) | 42 px | **48 px** |
  | large  (> 50) | 48 px | **56 px** |

- **Outer ring**, 5 px thick, split into up to 3 arcs sized by what's inside the cluster:
  - **Red arc** — *critical* bucket. Any INT row with `ranking === "Critical"` AND status pending; any FM with `revoked === true`. (Both are "legal-risk / drop everything else" pins.)
  - **Amber arc** — *pending* bucket. FM `inspection69 !== "ตรวจแล้ว"` AND `revoked !== true`; INT pending that isn't Critical (`ranking !== "Critical"`).
  - **Green arc** — *inspected* bucket. FM `inspection69 === "ตรวจแล้ว"`; INT `status === "ตรวจแล้ว"`.

Each present bucket gets a **minimum 15° (≈ 4 %) arc** so a single critical doesn't vanish into a sea of inspected. The remaining 345° (or less, when ≥2 buckets are floored) is split proportionally across the others. If only one bucket is present the ring is a solid 360° in that colour.

Colour palette matches the existing per-pin colours (red `#ff5b4a`, amber `#ffb800`, green `#00684a`) so the cluster speaks the same visual language as the pins it represents.

`clusterTone(count)` (the existing green/amber/red-by-count function) is **removed**. Count now controls only size; colour comes entirely from the status mix. Leaving both would be two competing colour languages on the same shape.

### 3. Wiring status from markers up to the cluster

`react-leaflet-cluster`'s `iconCreateFunction(cluster)` only gets the Leaflet cluster object — no React-side data. We need each child marker to carry its bucket in a place Leaflet can read.

Approach: encode the bucket in the marker's `divIcon` className. `fmIcon` / `intIcon` already build a `divIcon` with `className: "fo-marker fo-marker--fm …"`. We append `fo-bucket--{critical|pending|inspected}`. In `iconCreateFunction`, we walk `cluster.getAllChildMarkers()`, regex the bucket out of `m.options.icon.options.className`, tally into `{critical, pending, inspected}`, and pass `(count, buckets)` to `makeClusterIcon`.

Two new pure functions, both unit-testable in isolation, live in `src/utils/pinBucket.ts`:

```ts
export type PinBucket = 'critical' | 'pending' | 'inspected';
export function bucketForStation(s: FMStation): PinBucket;
export function bucketForSite(s: InterferenceSite): PinBucket;
```

The bucketing rules above are the spec for these functions. They are referenced from `fmIcon` / `intIcon` (to append the className) and from tests.

`makeClusterIcon`'s signature changes from `(count) => DivIcon` to `(count, buckets) => DivIcon`. The size-by-count logic stays. The single-colour fill is replaced by the inner disc + outer ring SVG.

### 4. Mobile-first details

Already baked into the sizing/ring numbers above, but called out explicitly so they don't get stripped in implementation:

- **44 px minimum diameter** on the smallest cluster (Apple HIG tap target floor).
- **5 px ring thickness** — survives Retina rendering on top of the OSM tile noise.
- **15° minimum wedge per present bucket** — a one-of-fifty critical is still a visible red arc, not a 7° sliver.
- **Tap behaviour stays Leaflet default** — tap cluster → fly in + auto-uncluster (we already disable clustering at zoom 13, so a single tap walks you to individual pins).

---

## Files

- **Modify** `src/utils/clusterIcon.ts`
  - Replace `clusterTone` and the single-colour `makeClusterIcon` with `makeClusterIcon(count, buckets: Record<PinBucket, number>): L.DivIcon`.
  - New helper (private): `computeRingArcs(buckets)` returns an array of `{ color, startDeg, sweepDeg }` honouring the 15° minimum.
  - Size table updated to 44 / 48 / 56.

- **Create** `src/utils/pinBucket.ts`
  - `PinBucket` type + `bucketForStation` + `bucketForSite` per the rules in §2.

- **Modify** `src/components/field-ops/FieldOpsMap.tsx`
  - Add `disableClusteringAtZoom={13}` to the `<MarkerClusterGroup>` opening tag.
  - In `fmIcon` / `intIcon`, append `fo-bucket--${bucketForStation(s)}` / `fo-bucket--${bucketForSite(s)}` to the `className`.
  - Replace `iconCreateFunction={(c) => makeClusterIcon(c.getChildCount())}` with the tally-from-class-name version that calls `makeClusterIcon(count, buckets)`.

- **Modify** `src/__tests__/clusterIcon.test.ts` (if it exists; create otherwise as `src/__tests__/cluster-icon.test.ts`)
  - Drop assertions on `clusterTone` / size-based colour.
  - Add: `makeClusterIcon` produces an `iconSize` that hits the 44 / 48 / 56 table.
  - Add: `computeRingArcs` honours the 15° minimum and proportional split.

- **Create** `src/__tests__/pin-bucket.test.ts`
  - Cover each `bucketForStation` / `bucketForSite` branch: revoked-FM → critical, INT-critical-pending → critical, FM-inspected → inspected, etc.

- **Create** `src/__tests__/field-ops-map-cluster-zoom.test.tsx`
  - Source-string regression test (same pattern as `field-ops-map-no-chunked-loading.test.tsx`): asserts `<MarkerClusterGroup …>` contains `disableClusteringAtZoom={13}`. JSDOM can't render the actual cluster zoom behaviour, so pin the prop at the source.

---

## Testing

**Unit (Vitest):**
- `pin-bucket.test.ts` — every branch of `bucketForStation` / `bucketForSite`.
- `cluster-icon.test.ts` — size table, ring arc math (proportional split, 15° floor, single-bucket = full circle), no `clusterTone` references.
- `field-ops-map-cluster-zoom.test.tsx` — `disableClusteringAtZoom={13}` present in source.

**Manual (real device or Chrome DevTools throttled mobile):**
1. Load `/`, zoom out to province view. Confirm clusters render with ring + count.
2. Build a contrived data scenario (or just find a real one) where a cluster contains 1 critical + many inspected. Confirm the red arc is visible (≥ 15°).
3. Pinch / scroll to zoom 13 and beyond. Confirm no cluster bubbles, all individual pins.
4. Tap a cluster at low zoom. Confirm the map flies in and the cluster breaks apart correctly.
5. Repeat on a 390 px wide viewport with cursor / touch — confirm the smallest cluster is comfortable to tap.

---

## Risks / open items

- **Status-on-marker-className is implicit coupling.** If someone later changes `fmIcon`/`intIcon` and forgets to keep the `fo-bucket--*` class, clusters silently undercount that bucket. Mitigation: a tiny invariant test that mounts `<FieldOpsMap>` with one of each bucket and asserts the rendered markers carry the expected `fo-bucket--*` class. (Listed in the implementation plan.)
- **Ring rendering perf at 100+ clusters on screen.** Each cluster is a `divIcon` with an inline SVG. Should be fine — Leaflet renders these on the marker pane, not on canvas — but if profiling shows a regression we can pre-compute the ring SVG as one of N stringly-cached templates keyed by `(bucket-mix-shape, size)`.
- **Three-bucket coverage is opinionated.** The spec deliberately excludes off-air, law-paper-sent, and INT-major vs minor from the ring. If real users come back asking "I can't see law-paper-sent at a glance", that's a follow-up — not a reason to retro-fit a fourth colour into this design.
