import { haversineDistanceKm } from './distance';

export interface HeadingState {
  heading: number | null;
  stale: boolean;
  lastSampleAt: number;
  lastPosition: { lat: number; lng: number } | null;
}

export interface HeadingSample {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
}

const MIN_SPEED_MS = 0.5;
const MIN_BEARING_DISTANCE_M = 5;
const EMA_ALPHA = 0.3;

export function initialHeadingState(): HeadingState {
  return {
    heading: null,
    stale: false,
    lastSampleAt: 0,
    lastPosition: null,
  };
}

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function emaAngle(prev: number, next: number, alpha: number): number {
  let delta = next - prev;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return normalizeAngle(prev + alpha * delta);
}

function bearingDeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dLambda = toRad(b.lng - a.lng);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return normalizeAngle(toDeg(Math.atan2(y, x)));
}

export function updateHeading(
  prev: HeadingState,
  sample: HeadingSample,
  now: number = Date.now()
): HeadingState {
  const newPosition = { lat: sample.lat, lng: sample.lng };

  if (sample.heading != null && (sample.speed ?? 0) >= MIN_SPEED_MS) {
    const smoothed =
      prev.heading == null
        ? normalizeAngle(sample.heading)
        : emaAngle(prev.heading, sample.heading, EMA_ALPHA);
    return {
      heading: smoothed,
      stale: false,
      lastSampleAt: now,
      lastPosition: newPosition,
    };
  }

  if (sample.heading == null && prev.lastPosition) {
    const distM =
      haversineDistanceKm(
        prev.lastPosition.lat,
        prev.lastPosition.lng,
        newPosition.lat,
        newPosition.lng
      ) * 1000;
    if (distM >= MIN_BEARING_DISTANCE_M) {
      const bearing = bearingDeg(prev.lastPosition, newPosition);
      const smoothed =
        prev.heading == null
          ? bearing
          : emaAngle(prev.heading, bearing, EMA_ALPHA);
      return {
        heading: smoothed,
        stale: false,
        lastSampleAt: now,
        lastPosition: newPosition,
      };
    }
  }

  return {
    heading: prev.heading,
    stale: prev.heading != null,
    lastSampleAt: prev.lastSampleAt,
    lastPosition: newPosition,
  };
}
