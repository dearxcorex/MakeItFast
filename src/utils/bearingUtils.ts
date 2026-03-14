import type { InterferenceSite } from '@/types/interference';
import type { BearingValidation } from '@/types/interference';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Calculate forward azimuth (bearing) from point 1 to point 2.
 * Returns degrees 0-360 (0 = North, 90 = East, 180 = South, 270 = West).
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = lat1 * DEG2RAD;
  const φ2 = lat2 * DEG2RAD;
  const Δλ = (lon2 - lon1) * DEG2RAD;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return ((θ * RAD2DEG) + 360) % 360;
}

/**
 * Convert degrees (0-360) to 8-point compass direction.
 */
export function getCompassDirection(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

/**
 * Calculate shortest angular difference between two bearings.
 * Handles wraparound (e.g., 350° vs 10° = 20°). Returns 0-180.
 */
export function angularDifference(a: number, b: number): number {
  const diff = Math.abs(((a - b + 180) % 360 + 360) % 360 - 180);
  return diff;
}

/**
 * Calculate destination point given start, bearing, and distance.
 * Returns [lat, lon] in degrees.
 */
export function calculateEndpoint(lat: number, lon: number, bearingDeg: number, distanceKm: number): [number, number] {
  const R = 6371; // Earth radius km
  const δ = distanceKm / R;
  const θ = bearingDeg * DEG2RAD;
  const φ1 = lat * DEG2RAD;
  const λ1 = lon * DEG2RAD;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
  );

  return [φ2 * RAD2DEG, λ2 * RAD2DEG];
}

/**
 * Validate whether the stored antenna direction matches the calculated
 * bearing from cell site to interference source.
 * Returns null if data is insufficient.
 */
export function validateBearing(site: InterferenceSite, toleranceDeg: number = 30): BearingValidation | null {
  if (site.direction == null) return null;
  if (site.lat == null || site.long == null) return null;
  if (site.sourceLat == null || site.sourceLong == null) return null;

  // Skip if source and cell are at identical coordinates
  if (site.lat === site.sourceLat && site.long === site.sourceLong) return null;

  const calculatedBearing = calculateBearing(site.lat, site.long, site.sourceLat, site.sourceLong);
  const storedDirection = ((site.direction % 360) + 360) % 360; // normalize
  const diff = angularDifference(calculatedBearing, storedDirection);
  const compass = getCompassDirection(calculatedBearing);

  return {
    calculatedBearing: Math.round(calculatedBearing * 10) / 10,
    storedDirection: Math.round(storedDirection * 10) / 10,
    angularDifference: Math.round(diff * 10) / 10,
    compassDirection: `${compass} (${Math.round(calculatedBearing)}°)`,
    isMatch: diff <= toleranceDeg,
    toleranceDeg,
  };
}
