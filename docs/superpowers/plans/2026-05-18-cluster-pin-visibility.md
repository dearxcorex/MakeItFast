# Cluster Pin Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make grouped pins on the field-ops map easier to read on mobile — stop clustering aggressively at workflow zooms, and when a cluster does form, show what's inside at a glance.

**Architecture:** Three small, isolated changes that compose: (1) a new pure `pinBucket` utility that classifies any FM station or INT site into one of three status buckets — critical / pending / inspected; (2) a rewrite of `clusterIcon.makeClusterIcon` that takes the per-bucket counts and renders an inner count disc + an outer segmented ring with a 15° minimum sweep per present bucket; (3) wiring in `FieldOpsMap.tsx` that (a) appends the bucket as a `fo-bucket--*` className on each marker's `divIcon`, (b) tallies child markers' buckets inside `iconCreateFunction`, and (c) adds `disableClusteringAtZoom={13}` so the cluster layer is silent at neighbourhood zoom.

**Tech Stack:** TypeScript, React 19, Next.js 15, react-leaflet 5.0.0, react-leaflet-cluster 4.1.3, leaflet 1.9.4, leaflet.markercluster 1.5.3, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-18-cluster-pin-visibility-design.md` — re-read it once before starting.

---

## File map (locked in before tasks)

- **Create** `src/utils/pinBucket.ts` — pure: `PinBucket` type + `bucketForStation(s: FMStation)` + `bucketForSite(s: InterferenceSite)`. No Leaflet, no React. ~30 LoC.
- **Create** `src/__tests__/pin-bucket.test.ts` — unit tests for every branch of the two bucket fns.
- **Modify** `src/utils/clusterIcon.ts` — replace `clusterTone` + count-only `makeClusterIcon` with the bucket-aware version + private `computeRingArcs` helper. Update size table to 44/48/56.
- **Modify** `src/__tests__/cluster-icon.test.ts` — drop `clusterTone` tests; add tests for size table, `computeRingArcs` (proportional split, 15° floor, single-bucket = 360°).
- **Modify** `src/components/field-ops/FieldOpsMap.tsx` — (a) add `disableClusteringAtZoom={13}`, (b) append `fo-bucket--${bucket}` to `fmIcon`/`intIcon` className, (c) swap `iconCreateFunction` to tally buckets from child markers.
- **Create** `src/__tests__/field-ops-map-cluster-zoom.test.tsx` — source-string regression that pins `disableClusteringAtZoom={13}` (jsdom can't run the cluster's zoom math, so we assert the prop is present, same pattern as `field-ops-map-no-chunked-loading.test.tsx`).
- **Create** `src/__tests__/field-ops-map-bucket-classname.test.tsx` — invariant test (called out in spec §Risks): render `FieldOpsMap` with one FM and one INT of each bucket; assert every rendered `.fo-marker` element carries an `fo-bucket--*` class. This prevents future edits to `fmIcon`/`intIcon` from silently dropping the bucket signal that the cluster tally depends on.

---

### Task 1: `pinBucket.ts` — the pure classifier

**Files:**
- Create: `src/utils/pinBucket.ts`
- Test: `src/__tests__/pin-bucket.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/pin-bucket.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { bucketForStation, bucketForSite } from "@/utils/pinBucket";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

function makeFM(o: Partial<FMStation> = {}): FMStation {
  return {
    id: 1,
    name: "T",
    frequency: 100,
    latitude: 13.7,
    longitude: 100.5,
    city: "C",
    state: "S",
    genre: "",
    inspection69: "ยังไม่ตรวจ",
    onAir: true,
    revoked: false,
    ...o,
  } as FMStation;
}

function makeINT(o: Partial<InterferenceSite> = {}): InterferenceSite {
  return {
    id: 1,
    siteName: null,
    siteCode: null,
    cellName: null,
    sectorName: null,
    changwat: null,
    lat: 13.7,
    long: 100.5,
    sourceLat: null,
    sourceLong: null,
    estimateDistance: null,
    ranking: null,
    status: "ยังไม่ตรวจ",
    direction: null,
    lawPaperSent: false,
    updatedAt: null,
    ...o,
  } as unknown as InterferenceSite;
}

describe("bucketForStation", () => {
  it("revoked FM → critical, even if inspected", () => {
    expect(bucketForStation(makeFM({ revoked: true }))).toBe("critical");
    expect(
      bucketForStation(makeFM({ revoked: true, inspection69: "ตรวจแล้ว" }))
    ).toBe("critical");
  });

  it("inspected non-revoked FM → inspected", () => {
    expect(
      bucketForStation(makeFM({ inspection69: "ตรวจแล้ว", revoked: false }))
    ).toBe("inspected");
  });

  it("non-revoked, not-yet-inspected FM → pending", () => {
    expect(
      bucketForStation(makeFM({ inspection69: "ยังไม่ตรวจ", revoked: false }))
    ).toBe("pending");
  });
});

describe("bucketForSite", () => {
  it("inspected INT → inspected, regardless of ranking", () => {
    expect(
      bucketForSite(makeINT({ status: "ตรวจแล้ว", ranking: "Critical" }))
    ).toBe("inspected");
    expect(
      bucketForSite(makeINT({ status: "ตรวจแล้ว", ranking: "Minor" }))
    ).toBe("inspected");
  });

  it("pending Critical INT → critical (case-insensitive on ranking)", () => {
    expect(
      bucketForSite(makeINT({ status: "ยังไม่ตรวจ", ranking: "Critical" }))
    ).toBe("critical");
    expect(
      bucketForSite(makeINT({ status: "ยังไม่ตรวจ", ranking: "critical" }))
    ).toBe("critical");
  });

  it("pending non-Critical INT → pending", () => {
    expect(
      bucketForSite(makeINT({ status: "ยังไม่ตรวจ", ranking: "Major" }))
    ).toBe("pending");
    expect(
      bucketForSite(makeINT({ status: "ยังไม่ตรวจ", ranking: null }))
    ).toBe("pending");
  });
});
```

- [ ] **Step 2: Run the test — expect failure (module not found)**

Run: `npx vitest run src/__tests__/pin-bucket.test.ts`

Expected: FAIL — `Cannot find module '@/utils/pinBucket'` (or similar import error).

- [ ] **Step 3: Implement `pinBucket.ts`**

Create `src/utils/pinBucket.ts`:

```ts
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

export type PinBucket = "critical" | "pending" | "inspected";

/**
 * Classify an FM station for cluster visualization.
 *
 * Precedence: revoked → critical (overrides inspection — revoked stations are
 * a legal-risk signal regardless of inspection state). Otherwise inspected
 * wins over pending. Mirrors the per-pin colour priority in `fmIcon`.
 */
export function bucketForStation(s: FMStation): PinBucket {
  if (s.revoked === true) return "critical";
  if (s.inspection69 === "ตรวจแล้ว") return "inspected";
  return "pending";
}

/**
 * Classify an interference site for cluster visualization.
 *
 * Precedence: inspected wins over critical (a finished critical is no longer
 * urgent work). For pending sites, ranking === "Critical" promotes to the
 * critical bucket. Ranking comparison is case-insensitive because upstream
 * data has mixed casing.
 */
export function bucketForSite(s: InterferenceSite): PinBucket {
  if (s.status === "ตรวจแล้ว") return "inspected";
  if ((s.ranking ?? "").toLowerCase() === "critical") return "critical";
  return "pending";
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run src/__tests__/pin-bucket.test.ts`

Expected: PASS, 3 describe / 6+ assertions green.

- [ ] **Step 5: Lint + commit**

Run: `npx eslint src/utils/pinBucket.ts src/__tests__/pin-bucket.test.ts`
Expected: clean.

DO NOT commit yet — controller will batch commit at end. Proceed to Task 2.

---

### Task 2: `clusterIcon.ts` — bucket-aware ring renderer

**Files:**
- Modify: `src/utils/clusterIcon.ts` (full rewrite, ~80 LoC)
- Modify: `src/__tests__/cluster-icon.test.ts`

- [ ] **Step 1: Write the new failing tests**

Replace the entire contents of `src/__tests__/cluster-icon.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { computeRingArcs, sizeForCount, makeClusterIcon } from "@/utils/clusterIcon";

describe("sizeForCount", () => {
  it("44px for small clusters (≤10)", () => {
    expect(sizeForCount(1)).toBe(44);
    expect(sizeForCount(10)).toBe(44);
  });
  it("48px for medium clusters (11..50)", () => {
    expect(sizeForCount(11)).toBe(48);
    expect(sizeForCount(50)).toBe(48);
  });
  it("56px for large clusters (>50)", () => {
    expect(sizeForCount(51)).toBe(56);
    expect(sizeForCount(500)).toBe(56);
  });
});

describe("computeRingArcs", () => {
  it("returns empty array when nothing in any bucket", () => {
    expect(computeRingArcs({ critical: 0, pending: 0, inspected: 0 })).toEqual([]);
  });

  it("renders a single 360° arc when only one bucket is present", () => {
    const arcs = computeRingArcs({ critical: 0, pending: 0, inspected: 5 });
    expect(arcs).toHaveLength(1);
    expect(arcs[0].sweepDeg).toBe(360);
    expect(arcs[0].startDeg).toBe(0);
    expect(arcs[0].color).toBe("#00684a");
  });

  it("enforces a 15° minimum sweep per present bucket", () => {
    // 1 critical + 49 inspected would naturally be 7.2°/352.8° — floor lifts it.
    const arcs = computeRingArcs({ critical: 1, pending: 0, inspected: 49 });
    expect(arcs).toHaveLength(2);
    const critArc = arcs.find((a) => a.color === "#ff5b4a")!;
    expect(critArc.sweepDeg).toBeGreaterThanOrEqual(15);
  });

  it("arcs sum to 360° for any multi-bucket mix", () => {
    const arcs = computeRingArcs({ critical: 3, pending: 5, inspected: 12 });
    const total = arcs.reduce((s, a) => s + a.sweepDeg, 0);
    expect(total).toBeCloseTo(360, 5);
  });

  it("arc start positions are contiguous (each starts where previous ended)", () => {
    const arcs = computeRingArcs({ critical: 2, pending: 2, inspected: 2 });
    let cursor = 0;
    for (const a of arcs) {
      expect(a.startDeg).toBeCloseTo(cursor, 5);
      cursor += a.sweepDeg;
    }
  });

  it("orders arcs critical → pending → inspected (so the red is always at 12 o'clock)", () => {
    const arcs = computeRingArcs({ critical: 1, pending: 1, inspected: 1 });
    expect(arcs.map((a) => a.color)).toEqual(["#ff5b4a", "#ffb800", "#00684a"]);
  });
});

describe("makeClusterIcon", () => {
  it("produces a DivIcon with iconSize matching sizeForCount", () => {
    const icon = makeClusterIcon(5, { critical: 1, pending: 2, inspected: 2 });
    expect(icon.options.iconSize).toEqual([44, 44]);
  });

  it("html contains the total count as text", () => {
    const icon = makeClusterIcon(17, { critical: 5, pending: 5, inspected: 7 });
    const html = String(icon.options.html);
    expect(html).toContain(">17<");
  });

  it("html contains an SVG circle for each present bucket", () => {
    const icon = makeClusterIcon(3, { critical: 1, pending: 1, inspected: 1 });
    const html = String(icon.options.html);
    // 3 buckets → 3 stroked circles in the ring
    const circleMatches = html.match(/<circle\s[^>]*stroke="#(ff5b4a|ffb800|00684a)"/g) ?? [];
    expect(circleMatches.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run: `npx vitest run src/__tests__/cluster-icon.test.ts`

Expected: FAIL — `sizeForCount` / `computeRingArcs` / new `makeClusterIcon` signature not exported.

- [ ] **Step 3: Rewrite `clusterIcon.ts`**

Replace the entire contents of `src/utils/clusterIcon.ts` with:

```ts
import L from "leaflet";
import type { PinBucket } from "./pinBucket";

const COLORS: Record<PinBucket, string> = {
  critical: "#ff5b4a",
  pending: "#ffb800",
  inspected: "#00684a",
};

// Always render critical first (top of ring) so the most urgent colour sits at
// 12 o'clock — that's where the eye lands.
const ORDER: PinBucket[] = ["critical", "pending", "inspected"];

const MIN_SWEEP_DEG = 15;

/**
 * Pure: map cluster child count to a diameter (px). Bumped from 36/42/48 to
 * 44/48/56 so the smallest cluster clears Apple's 44px tap-target floor.
 */
export function sizeForCount(count: number): number {
  if (count <= 10) return 44;
  if (count <= 50) return 48;
  return 56;
}

export interface RingArc {
  color: string;
  startDeg: number;
  sweepDeg: number;
}

/**
 * Pure: turn per-bucket counts into a sequence of ring arcs.
 *
 * - 0 total → no arcs (caller should not draw a ring).
 * - 1 present bucket → one 360° arc in that bucket's colour.
 * - 2+ present buckets → each gets at least MIN_SWEEP_DEG (15°). The
 *   remaining 360 − N*MIN sweep is split proportionally to bucket counts.
 *   Arcs are emitted in critical → pending → inspected order, contiguous,
 *   starting at 0° (12 o'clock once the SVG is rotated -90°).
 */
export function computeRingArcs(
  buckets: Record<PinBucket, number>
): RingArc[] {
  const total = buckets.critical + buckets.pending + buckets.inspected;
  if (total === 0) return [];

  const present = ORDER.filter((b) => buckets[b] > 0);
  if (present.length === 1) {
    return [{ color: COLORS[present[0]], startDeg: 0, sweepDeg: 360 }];
  }

  const floorTotal = present.length * MIN_SWEEP_DEG;
  const remaining = 360 - floorTotal;

  let cursor = 0;
  const out: RingArc[] = [];
  for (const b of present) {
    const sweep = MIN_SWEEP_DEG + (buckets[b] / total) * remaining;
    out.push({ color: COLORS[b], startDeg: cursor, sweepDeg: sweep });
    cursor += sweep;
  }
  return out;
}

/**
 * Build the Leaflet divIcon for a cluster bubble:
 *   inner disc (count) + 5px segmented outer ring (status mix).
 */
export function makeClusterIcon(
  count: number,
  buckets: Record<PinBucket, number>
): L.DivIcon {
  const size = sizeForCount(count);
  const ringStroke = 5;
  const r = (size - ringStroke) / 2; // circle radius (centerline of stroke)
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const fontSize = count > 999 ? 12 : count > 99 ? 13 : 14;

  // Each arc is rendered as a single full-circle <circle> with stroke-dasharray
  // = (arcLength, circumference - arcLength) and stroke-dashoffset positioning
  // the dash. transform="rotate(-90 cx cy)" rotates the start point to 12 o'clock.
  const arcs = computeRingArcs(buckets);
  const ringSvg = arcs
    .map((a) => {
      const arcLen = (a.sweepDeg / 360) * circumference;
      const offset = -((a.startDeg / 360) * circumference);
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${a.color}" stroke-width="${ringStroke}"
        stroke-dasharray="${arcLen.toFixed(3)} ${(circumference - arcLen).toFixed(3)}"
        stroke-dashoffset="${offset.toFixed(3)}"
        transform="rotate(-90 ${cx} ${cy})"/>`;
    })
    .join("");

  const innerR = r - ringStroke; // inner disc sits inside the ring
  const html = `
    <div style="width:${size}px;height:${size}px;position:relative;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
        style="position:absolute;inset:0;overflow:visible;">
        ${ringSvg}
        <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#001e2b"
          stroke="rgba(0,30,43,0.25)" stroke-width="1"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
          fill="#ffffff" font-family="'Source Code Pro', ui-monospace, monospace"
          font-weight="700" font-size="${fontSize}"
          style="letter-spacing:0.04em;">${count}</text>
      </svg>
    </div>
  `;

  return L.divIcon({
    className: `fo-cluster`,
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
```

- [ ] **Step 4: Run the test — expect pass**

Run: `npx vitest run src/__tests__/cluster-icon.test.ts`

Expected: PASS — `sizeForCount`, `computeRingArcs`, `makeClusterIcon` all green (~9 assertions).

- [ ] **Step 5: Lint + typecheck (touched files only)**

Run: `npx eslint src/utils/clusterIcon.ts src/__tests__/cluster-icon.test.ts && npx tsc --noEmit`

Expected: clean on the touched files. Pre-existing tsc errors in unrelated files (analytics test, etc.) can be ignored — note them but don't fix.

Proceed to Task 3.

---

### Task 3: Wire it into `FieldOpsMap.tsx`

**Files:**
- Modify: `src/components/field-ops/FieldOpsMap.tsx` (3 edits)

- [ ] **Step 1: Import the bucket helper**

Add to the top imports of `src/components/field-ops/FieldOpsMap.tsx` (after the existing imports for `makeClusterIcon`):

```tsx
import { bucketForStation, bucketForSite } from "@/utils/pinBucket";
```

- [ ] **Step 2: Append the bucket className inside `fmIcon`**

Inside `fmIcon` (search for `function fmIcon(`), find the `return L.divIcon({` block at the bottom (currently:

```tsx
  return L.divIcon({
    className: `fo-marker fo-marker--fm ${main ? "is-main" : ""} ${selected ? "is-selected" : ""}`,
    html,
```

Change the `className` line to:

```tsx
    className: `fo-marker fo-marker--fm fo-bucket--${bucketForStation(station)} ${main ? "is-main" : ""} ${selected ? "is-selected" : ""}`,
```

- [ ] **Step 3: Append the bucket className inside `intIcon`**

Inside `intIcon` (search for `function intIcon(`), find the `return L.divIcon({` block at the bottom (currently:

```tsx
  return L.divIcon({
    className: `fo-marker fo-marker--int ${selected ? "is-selected" : ""}`,
    html,
```

Change the `className` line to:

```tsx
    className: `fo-marker fo-marker--int fo-bucket--${bucketForSite(site)} ${selected ? "is-selected" : ""}`,
```

- [ ] **Step 4: Add `disableClusteringAtZoom={13}` and swap `iconCreateFunction` to tally buckets**

Find the `<MarkerClusterGroup>` opening tag (currently around line 476 — there's a NOTE comment above it about `chunkedLoading`). Replace the entire opening tag with:

```tsx
      <MarkerClusterGroup
        maxClusterRadius={45}
        disableClusteringAtZoom={13}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        iconCreateFunction={(c: {
          getChildCount: () => number;
          getAllChildMarkers: () => Array<{ options: { icon?: { options?: { className?: string } } } }>;
        }) => {
          const buckets = { critical: 0, pending: 0, inspected: 0 };
          for (const m of c.getAllChildMarkers()) {
            const cn = m.options.icon?.options?.className ?? "";
            const match = cn.match(/fo-bucket--(critical|pending|inspected)/);
            if (match) buckets[match[1] as keyof typeof buckets]++;
          }
          return makeClusterIcon(c.getChildCount(), buckets);
        }}
      >
```

(Keep the existing `chunkedLoading`-warning comment block intact, immediately above this tag.)

- [ ] **Step 5: Lint + typecheck**

Run: `npx eslint src/components/field-ops/FieldOpsMap.tsx && npx tsc --noEmit 2>&1 | grep "FieldOpsMap"`

Expected: eslint clean; tsc shows zero errors mentioning `FieldOpsMap.tsx`. Pre-existing tsc errors in unrelated files are fine.

Proceed to Task 4.

---

### Task 4: Source-string regression test for `disableClusteringAtZoom`

We can't run the cluster's zoom math in jsdom. Pin the prop at the source so a future PR can't silently revert.

**Files:**
- Create: `src/__tests__/field-ops-map-cluster-zoom.test.tsx`

- [ ] **Step 1: Write the test**

Create `src/__tests__/field-ops-map-cluster-zoom.test.tsx` with:

```tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the "clusters form too aggressively at workflow zooms"
 * complaint. At zoom ≥ 13 the cluster layer must be silent so individual pins
 * render normally. We assert against source because jsdom can't simulate the
 * cluster's zoom math (same approach as `field-ops-map-no-chunked-loading`).
 */
describe("FieldOpsMap — clustering zoom guard", () => {
  it("MarkerClusterGroup must set disableClusteringAtZoom={13}", () => {
    const src = readFileSync(
      resolve(__dirname, "../components/field-ops/FieldOpsMap.tsx"),
      "utf8"
    );
    const clusterBlock = src.match(/<MarkerClusterGroup[\s\S]*?>/);
    expect(clusterBlock, "MarkerClusterGroup tag not found").not.toBeNull();
    expect(clusterBlock![0]).toMatch(/disableClusteringAtZoom=\{13\}/);
  });
});
```

- [ ] **Step 2: Run the test — expect pass**

Run: `npx vitest run src/__tests__/field-ops-map-cluster-zoom.test.tsx`

Expected: PASS.

- [ ] **Step 3: Sanity-check the test would catch a regression**

Temporarily delete the `disableClusteringAtZoom={13}` line from `FieldOpsMap.tsx`. Re-run the test. Expected: FAIL. Restore the line and re-run. Expected: PASS. (Do not leave the prop removed.)

Proceed to Task 5.

---

### Task 5: Marker className invariant test

The cluster tally in Task 3 depends on every marker carrying its `fo-bucket--*` class. If someone later edits `fmIcon`/`intIcon` and drops the class, clusters silently undercount that bucket. This test guards against that.

**Files:**
- Create: `src/__tests__/field-ops-map-bucket-classname.test.tsx`

- [ ] **Step 1: Write the test**

Create `src/__tests__/field-ops-map-bucket-classname.test.tsx` with:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { FieldOpsMap } from "@/components/field-ops/FieldOpsMap";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

// Stub react-leaflet primitives to a flat tree of children so we can inspect
// the divIcon classNames Leaflet was handed without booting Leaflet itself.
// We capture every Marker's icon.options.className into a global registry.
const capturedClassNames: string[] = [];

vi.mock("react-leaflet", () => {
  return {
    MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TileLayer: () => null,
    Marker: ({ icon }: { icon?: { options?: { className?: string } } }) => {
      if (icon?.options?.className) capturedClassNames.push(icon.options.className);
      return null;
    },
    Polyline: () => null,
    useMap: () => ({
      flyTo: vi.fn(),
      setView: vi.fn(),
      getZoom: () => 13,
      getContainer: () => ({ style: { cursor: "" } }),
    }),
    useMapEvents: () => null,
  };
});

vi.mock("react-leaflet-cluster", () => {
  return { default: ({ children }: { children: ReactNode }) => <>{children}</> };
});

function makeFM(o: Partial<FMStation> = {}): FMStation {
  return {
    id: 1,
    name: "T",
    frequency: 100,
    latitude: 13.7,
    longitude: 100.5,
    city: "C",
    state: "S",
    genre: "",
    inspection69: "ยังไม่ตรวจ",
    onAir: true,
    revoked: false,
    ...o,
  } as FMStation;
}

function makeINT(o: Partial<InterferenceSite> = {}): InterferenceSite {
  return {
    id: 1,
    siteName: null,
    siteCode: null,
    cellName: null,
    sectorName: null,
    changwat: null,
    lat: 13.7,
    long: 100.5,
    sourceLat: null,
    sourceLong: null,
    estimateDistance: null,
    ranking: null,
    status: "ยังไม่ตรวจ",
    direction: null,
    lawPaperSent: false,
    updatedAt: null,
    ...o,
  } as unknown as InterferenceSite;
}

describe("FieldOpsMap — marker fo-bucket--* invariant", () => {
  it("every rendered FM marker carries its fo-bucket--* class", () => {
    capturedClassNames.length = 0;
    const stations: FMStation[] = [
      makeFM({ id: 1, latitude: 13.7, longitude: 100.5, revoked: true }), // critical
      makeFM({ id: 2, latitude: 14.0, longitude: 100.7, inspection69: "ตรวจแล้ว" }), // inspected
      makeFM({ id: 3, latitude: 14.3, longitude: 100.9 }), // pending
    ];
    render(
      <FieldOpsMap
        stations={stations}
        interference={[]}
        selection={null}
        onSelect={vi.fn()}
        flyTarget={null}
      />
    );
    const fmClassNames = capturedClassNames.filter((c) => c.includes("fo-marker--fm"));
    expect(fmClassNames).toHaveLength(3);
    expect(fmClassNames.some((c) => c.includes("fo-bucket--critical"))).toBe(true);
    expect(fmClassNames.some((c) => c.includes("fo-bucket--inspected"))).toBe(true);
    expect(fmClassNames.some((c) => c.includes("fo-bucket--pending"))).toBe(true);
  });

  it("every rendered INT marker carries its fo-bucket--* class", () => {
    capturedClassNames.length = 0;
    const sites: InterferenceSite[] = [
      makeINT({ id: 1, lat: 13.7, long: 100.5, status: "ยังไม่ตรวจ", ranking: "Critical" }),
      makeINT({ id: 2, lat: 14.0, long: 100.7, status: "ยังไม่ตรวจ", ranking: "Minor" }),
      makeINT({ id: 3, lat: 14.3, long: 100.9, status: "ตรวจแล้ว", ranking: "Critical" }),
    ];
    render(
      <FieldOpsMap
        stations={[]}
        interference={sites}
        selection={null}
        onSelect={vi.fn()}
        flyTarget={null}
      />
    );
    const intClassNames = capturedClassNames.filter((c) => c.includes("fo-marker--int"));
    expect(intClassNames).toHaveLength(3);
    expect(intClassNames.some((c) => c.includes("fo-bucket--critical"))).toBe(true);
    expect(intClassNames.some((c) => c.includes("fo-bucket--pending"))).toBe(true);
    expect(intClassNames.some((c) => c.includes("fo-bucket--inspected"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test — expect pass**

Run: `npx vitest run src/__tests__/field-ops-map-bucket-classname.test.tsx`

Expected: PASS (both `it` blocks). If a className assertion fails, re-check that Task 3 Steps 2 & 3 actually appended the bucket class.

Proceed to Task 6.

---

### Task 6: Full test suite + lint + typecheck

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: net **higher** passing count vs the baseline you locked in before starting this work (this plan adds ~21 new `it()` blocks across `pin-bucket`, the rewritten `cluster-icon`, `cluster-zoom`, and `bucket-classname`; removes 3 old `clusterTone` tests). Pre-existing failure count (26 at baseline, in `analytics.test.tsx`, `intermod-calculator-deep.test.tsx`, `field-ops-drawer.test.tsx`, `login-spinner.test.tsx`, `components-batch4.test.tsx`) must be unchanged. If failures grow, find the new failing test and fix.

- [ ] **Step 2: Project lint**

Run: `npm run lint`

Expected: no new warnings vs baseline.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "pinBucket|clusterIcon|FieldOpsMap|pin-bucket|cluster-icon|cluster-zoom|bucket-classname"`

Expected: no output (clean on the files this plan touched).

Proceed to Task 7.

---

### Task 7: Manual verification in a real browser

Spec §Testing manual checklist. jsdom can't render the actual ring SVG against tile imagery, so a real-device pass is the only way to validate visual correctness.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

Expected: dev server boots at `http://localhost:3000`.

- [ ] **Step 2: Verify on a 390 px mobile viewport (Chrome DevTools iPhone 13 preset is fine)**

Open `http://localhost:3000`. Log in if prompted. On the field-ops map:

1. **Zoom out** to province scale. Clusters should render as a count-disc + segmented ring. Confirm by eye that the colours match what you'd expect (clusters in a mostly-inspected area look mostly green; areas with open criticals show a visible red arc).
2. **Find or contrive a cluster with mixed buckets.** A cluster with at least 1 critical mixed in with many inspected should show the red arc clearly (the 15° minimum). If you can't find one in real data, toggle a station's status via the bottom sheet to create the mix.
3. **Zoom in past zoom 13.** Confirm all clusters dissolve and individual pins appear. Pan around — no clusters should re-appear at this zoom or above.
4. **Tap a cluster** at low zoom. Confirm the map flies in and the cluster breaks apart.
5. **Smallest-cluster tap target.** Find a cluster of 2-3 pins. The bubble should be 44 px wide. Tap it with your thumb / cursor in DevTools touch mode — it should respond on the first try, no need to aim.

- [ ] **Step 3: Verify on desktop (≥ 900 px wide)**

Resize to a desktop viewport. Same map. Confirm the new cluster bubbles render correctly at this size (the SVG is resolution-independent — they should just look the same).

- [ ] **Step 4: Stage and commit (DO NOT push — per CLAUDE.md)**

Files changed by this plan:

```bash
git add \
  src/utils/pinBucket.ts \
  src/utils/clusterIcon.ts \
  src/components/field-ops/FieldOpsMap.tsx \
  src/__tests__/pin-bucket.test.ts \
  src/__tests__/cluster-icon.test.ts \
  src/__tests__/field-ops-map-cluster-zoom.test.tsx \
  src/__tests__/field-ops-map-bucket-classname.test.tsx \
  docs/superpowers/specs/2026-05-18-cluster-pin-visibility-design.md \
  docs/superpowers/plans/2026-05-18-cluster-pin-visibility.md

git commit -m "$(cat <<'EOF'
feat: declutter map pins — disable cluster ≥ zoom 13 + segmented ring

User feedback: grouped pins on the field-ops map are hard to read.
Two complaints — clusters form too aggressively at the workflow zoom,
and even when a cluster is right, the count-only bubble hides
priority.

- Add disableClusteringAtZoom={13}. At neighbourhood scale the
  cluster layer is silent and every pin renders individually.
- Replace the count-only cluster bubble with a count disc + 5px
  segmented outer ring. Each present status bucket (critical /
  pending / inspected) gets ≥ 15° so a single critical pin in a
  cluster of fifty doesn't disappear.
- Bump smallest cluster from 36 → 44px to clear Apple's tap-target
  floor on mobile.
- Pin both decisions with regression tests: disableClusteringAtZoom
  prop guard + per-marker fo-bucket--* className invariant.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: hooks pass, commit succeeds. `git status` afterwards: clean except for any pre-existing untracked files unrelated to this work.

---

## Notes for the executor

- **Do NOT push or open a PR.** CLAUDE.md is explicit: "Do not commit and push to GitHub. Wait for explicit command." Stop after the local commit.
- **Do NOT commit between tasks.** The plan batches everything into one commit at the end (Task 7). If you're using subagent-driven execution, tell each implementer subagent the same thing.
- **Pre-existing test failures.** The baseline before this work is `26 failed | 1233 passed | 1 skipped`. Most failures are in `analytics.test.tsx`, `intermod-calculator-deep.test.tsx`, `field-ops-drawer.test.tsx`, `login-spinner.test.tsx`, `components-batch4.test.tsx`. They are unrelated to this plan — don't try to fix them.
- **If Task 7 visual check reveals the ring colours look wrong**, the bug is almost certainly in `bucketForStation` / `bucketForSite` (Task 1). Run those tests first; if green, look at the className tally in `iconCreateFunction` (Task 3 Step 4).
- **If a real cluster shows wedges that don't sum to a full ring**, `computeRingArcs` has a rounding bug. Re-run its tests; the sum-to-360 assertion should catch it.
- **Spec change requests during implementation:** if you discover the spec is wrong (e.g., a bucket rule doesn't match reality), STOP, surface to the human, and update the spec before continuing. Do not silently deviate.
