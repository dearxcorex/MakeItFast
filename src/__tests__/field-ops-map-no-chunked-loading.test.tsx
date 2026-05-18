import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the "all pins disappear on filter change" bug.
 *
 * react-leaflet-cluster@4.1.3 + chunkedLoading races with React updates:
 * when the user rapidly toggles filters, Leaflet's chunked addLayers can
 * still be running when React fires the next remove/add round, leaving the
 * cluster's internal feature group empty. Removing the prop is the fix; this
 * test pins that decision so it survives future "perf" cleanups.
 *
 * We assert against the source string rather than mounting the component
 * because jsdom doesn't exercise the cluster's chunker — there's no
 * runtime symptom to assert on.
 */
describe("FieldOpsMap — chunkedLoading guard", () => {
  it("must NOT pass chunkedLoading to MarkerClusterGroup", () => {
    const src = readFileSync(
      resolve(__dirname, "../components/field-ops/FieldOpsMap.tsx"),
      "utf8"
    );
    const clusterBlock = src.match(/<MarkerClusterGroup[\s\S]*?>/);
    expect(clusterBlock, "MarkerClusterGroup tag not found").not.toBeNull();
    expect(clusterBlock![0]).not.toMatch(/\bchunkedLoading\b/);
  });
});
