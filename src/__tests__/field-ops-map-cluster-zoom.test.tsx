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
