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
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
