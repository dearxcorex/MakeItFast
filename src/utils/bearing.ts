/**
 * Bearing helpers — pure, no DOM, no leaflet.
 *
 * Bearings are degrees clockwise from north (0 = N, 90 = E, 180 = S, 270 = W).
 * Coordinates are decimal degrees. Distance in kilometers.
 */

const EARTH_RADIUS_KM = 6371.0088;

export function normalizeBearing(deg: number): number {
  const m = ((deg % 360) + 360) % 360;
  return m;
}

const ROSE_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

const ROSE_16 = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

/** Map a bearing in degrees to the 8-rose cardinal label (N/NE/E/SE/...). */
export function bearingToCardinal(deg: number): string {
  const n = normalizeBearing(deg);
  const idx = Math.round(n / 45) % 8;
  return ROSE_8[idx];
}

/** Same idea but with the finer 16-rose (NNE / ENE / ESE / ...). */
export function bearingToCardinal16(deg: number): string {
  const n = normalizeBearing(deg);
  const idx = Math.round(n / 22.5) % 16;
  return ROSE_16[idx];
}

/** "045° NE" — three-digit zero-padded angle plus 8-rose cardinal. */
export function formatBearing(deg: number): string {
  const n = normalizeBearing(deg);
  const padded = Math.round(n).toString().padStart(3, "0");
  return `${padded}° ${bearingToCardinal(n)}`;
}

/**
 * Forward Haversine: project a starting coord along a bearing/distance and
 * return the destination coord. Accurate to ~0.1 % over distances ≤ 30 km.
 */
export function computeDestination(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceKm: number
): { lat: number; lng: number } {
  if (distanceKm === 0) return { lat, lng };

  const δ = distanceKm / EARTH_RADIUS_KM; // angular distance in radians
  const θ = (normalizeBearing(bearingDeg) * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180,
  };
}
