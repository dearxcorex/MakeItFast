import type { NextConfig } from "next";

// Minimal defense-in-depth headers applied to every response. CSP is
// deliberately omitted — Leaflet pulls tiles from OSM + CARTO + cartocdn, and
// shipping a strict CSP without auditing those origins risks breaking the map.
// Add a CSP in a follow-up once tile origins are pinned.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  // /api/cell-sites reads this CSV at runtime; make sure the serverless bundle
  // ships it rather than relying on tracing to spot the path.join.
  outputFileTracingIncludes: {
    "/api/cell-sites": ["./data/cell-sites/cell-sites-clean.csv"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
