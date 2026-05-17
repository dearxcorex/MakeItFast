/**
 * Pure great-circle distance (Haversine) in kilometers.
 * Returns NaN if any input is NaN — caller filters.
 */
const EARTH_RADIUS_KM = 6371.0088;

export function haversineDistanceKm(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number
): number {
  if (
    !Number.isFinite(latA) ||
    !Number.isFinite(lonA) ||
    !Number.isFinite(latB) ||
    !Number.isFinite(lonB)
  ) {
    return NaN;
  }
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const lat1 = toRad(latA);
  const lat2 = toRad(latB);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return EARTH_RADIUS_KM * c;
}
