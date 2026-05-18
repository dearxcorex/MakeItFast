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
    const circleMatches = html.match(/<circle\s[^>]*stroke="#(ff5b4a|ffb800|00684a)"/g) ?? [];
    expect(circleMatches.length).toBe(3);
  });
});
