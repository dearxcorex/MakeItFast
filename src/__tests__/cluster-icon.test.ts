import { describe, it, expect } from "vitest";
import {
  computeRingArcs,
  computeSegmentArcs,
  sizeForCount,
  makeClusterIcon,
  makeSegmentClusterIcon,
} from "@/utils/clusterIcon";
import { PIN_COLORS } from "@/utils/pinTokens";

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

  it("counts an offair bucket and orders it after pending", () => {
    const arcs = computeRingArcs({ critical: 1, pending: 1, offair: 1, inspected: 1 });
    expect(arcs).toHaveLength(4);
    expect(arcs.map((a) => a.color)).toEqual([
      PIN_COLORS.critical,
      PIN_COLORS.pending,
      PIN_COLORS.offair,
      PIN_COLORS.inspected,
    ]);
  });

  it("treats omitted buckets as zero", () => {
    expect(computeRingArcs({})).toEqual([]);
    expect(computeRingArcs({ offair: 4 })).toEqual([
      { color: PIN_COLORS.offair, startDeg: 0, sweepDeg: 360 },
    ]);
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
    const circleMatches = html.match(/<circle\s[^>]*stroke="#(ff5b4a|ffb800|00684a)"/g) ?? [];
    expect(circleMatches.length).toBe(3);
  });
});

describe("computeSegmentArcs", () => {
  it("draws arcs for arbitrary coloured segments, skipping empty ones, in the order given", () => {
    const arcs = computeSegmentArcs([
      { color: "#111111", count: 3 },
      { color: "#222222", count: 0 },
      { color: "#333333", count: 1 },
    ]);
    expect(arcs.map((a) => a.color)).toEqual(["#111111", "#333333"]);
    expect(arcs.reduce((s, a) => s + a.sweepDeg, 0)).toBeCloseTo(360, 6);
  });

  it("gives computeRingArcs the same result for the same counts", () => {
    const buckets = { critical: 2, pending: 5, inspected: 9 };
    expect(computeRingArcs(buckets)).toEqual(
      computeSegmentArcs([
        { color: PIN_COLORS.critical, count: 2 },
        { color: PIN_COLORS.pending, count: 5 },
        { color: PIN_COLORS.offair, count: 0 },
        { color: PIN_COLORS.inspected, count: 9 },
      ])
    );
  });
});

describe("makeSegmentClusterIcon", () => {
  it("draws one ring arc per non-empty segment around the count", () => {
    const icon = makeSegmentClusterIcon(12, [
      { color: "#aa0000", count: 7 },
      { color: "#00aa00", count: 5 },
    ]);
    const html = String(icon.options.html);
    expect(html).toContain(">12<");
    expect(html).toContain('stroke="#aa0000"');
    expect(html).toContain('stroke="#00aa00"');
  });
});
