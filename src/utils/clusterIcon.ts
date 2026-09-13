import L from "leaflet";
import type { PinBucket } from "./pinBucket";
import { PIN_BUCKET_ORDER, PIN_COLORS, PIN_INK } from "./pinTokens";

/**
 * Per-bucket child counts. Partial so callers can pass only the buckets they
 * actually saw; missing keys count as zero.
 */
export type BucketCounts = Partial<Record<PinBucket, number>>;

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
 *   Arcs are emitted in PIN_BUCKET_ORDER (critical → pending → offair →
 *   inspected), contiguous, starting at 0° (12 o'clock once the SVG is
 *   rotated -90°).
 */
export function computeRingArcs(buckets: BucketCounts): RingArc[] {
  return computeSegmentArcs(bucketSegments(buckets));
}

/** One coloured share of a cluster ring. */
export interface RingSegment {
  color: string;
  count: number;
}

const bucketSegments = (buckets: BucketCounts): RingSegment[] =>
  PIN_BUCKET_ORDER.map((b) => ({ color: PIN_COLORS[b], count: buckets[b] ?? 0 }));

/**
 * Pure: the ring-arc rule of `computeRingArcs` for any coloured segments, so
 * a ring can summarise something other than pin buckets (the Cell Sites map
 * splits it by operator). Arcs follow the order segments are given in.
 */
export function computeSegmentArcs(segments: RingSegment[]): RingArc[] {
  const present = segments.filter((s) => s.count > 0);
  const total = present.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return [];

  if (present.length === 1) {
    return [{ color: present[0].color, startDeg: 0, sweepDeg: 360 }];
  }

  const floorTotal = present.length * MIN_SWEEP_DEG;
  const remaining = 360 - floorTotal;

  let cursor = 0;
  const out: RingArc[] = [];
  for (const s of present) {
    const sweep = MIN_SWEEP_DEG + (s.count / total) * remaining;
    out.push({ color: s.color, startDeg: cursor, sweepDeg: sweep });
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
  buckets: BucketCounts
): L.DivIcon {
  return makeSegmentClusterIcon(count, bucketSegments(buckets));
}

/** `makeClusterIcon` with the ring split by arbitrary coloured segments. */
export function makeSegmentClusterIcon(
  count: number,
  segments: RingSegment[]
): L.DivIcon {
  const size = sizeForCount(count);
  const ringStroke = 5;
  const r = (size - ringStroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const fontSize = count > 999 ? 12 : count > 99 ? 13 : 14;

  const arcs = computeSegmentArcs(segments);
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

  const innerR = r - ringStroke;
  const html = `
    <div style="width:${size}px;height:${size}px;position:relative;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"
        style="position:absolute;inset:0;overflow:visible;">
        ${ringSvg}
        <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="${PIN_INK}"
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
