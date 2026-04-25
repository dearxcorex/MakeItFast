import L from "leaflet";

/**
 * Pure: bucket a cluster's child count into a tone for icon coloring.
 * Used by `makeClusterIcon` and unit-tested independently.
 */
export type ClusterTone = "small" | "medium" | "large";

export function clusterTone(count: number): ClusterTone {
  if (count <= 10) return "small";
  if (count <= 50) return "medium";
  return "large";
}

const TONES: Record<ClusterTone, { fill: string; ring: string; text: string }> = {
  // Theme-stable in dark; pairs well on light tiles too.
  small: { fill: "#00684a", ring: "#00ed64", text: "#ffffff" },
  medium: { fill: "#ffb800", ring: "#ffd24a", text: "#001e2b" },
  large: { fill: "#ff5b4a", ring: "#ff8b7e", text: "#ffffff" },
};

/** Build a Leaflet `divIcon` for a cluster bubble. */
export function makeClusterIcon(count: number): L.DivIcon {
  const tone = clusterTone(count);
  const { fill, ring, text } = TONES[tone];
  const size = tone === "small" ? 36 : tone === "medium" ? 42 : 48;
  const fontSize = count > 999 ? 11 : count > 99 ? 12 : 13;

  const html = `
    <div style="
      width:${size}px;height:${size}px;
      display:flex;align-items:center;justify-content:center;
      border-radius:50%;
      background:${fill};
      border:2px solid ${ring};
      box-shadow:0 0 0 4px rgba(0,30,43,0.25), 0 2px 6px rgba(0,30,43,0.4);
      color:${text};
      font-family:'Source Code Pro', ui-monospace, monospace;
      font-weight:700;letter-spacing:0.04em;font-size:${fontSize}px;
    ">${count}</div>
  `;

  return L.divIcon({
    className: `fo-cluster fo-cluster--${tone}`,
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
