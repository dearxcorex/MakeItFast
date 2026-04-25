import { describe, it, expect } from 'vitest';
import {
  bearingToCardinal,
  formatBearing,
  computeDestination,
} from '@/utils/bearing';

describe('bearingToCardinal', () => {
  it('maps the cardinal directions', () => {
    expect(bearingToCardinal(0)).toBe('N');
    expect(bearingToCardinal(90)).toBe('E');
    expect(bearingToCardinal(180)).toBe('S');
    expect(bearingToCardinal(270)).toBe('W');
  });

  it('maps inter-cardinals using the 8-rose', () => {
    expect(bearingToCardinal(45)).toBe('NE');
    expect(bearingToCardinal(135)).toBe('SE');
    expect(bearingToCardinal(225)).toBe('SW');
    expect(bearingToCardinal(315)).toBe('NW');
  });

  it('wraps values outside 0..360', () => {
    expect(bearingToCardinal(360)).toBe('N');
    expect(bearingToCardinal(-90)).toBe('W');
    expect(bearingToCardinal(720)).toBe('N');
  });
});

describe('formatBearing', () => {
  it('zero-pads to three digits and appends 8-rose cardinal', () => {
    expect(formatBearing(45)).toBe('045° NE');
    expect(formatBearing(0)).toBe('000° N');
    expect(formatBearing(180)).toBe('180° S');
    expect(formatBearing(99)).toBe('099° E');
  });
});

describe('computeDestination', () => {
  const start = { lat: 13.75, lng: 100.5 };

  it('moves due north when bearing=0', () => {
    const d = computeDestination(start.lat, start.lng, 0, 1);
    // 1 km ~= 0.009 degrees latitude
    expect(d.lat).toBeGreaterThan(start.lat);
    expect(d.lat - start.lat).toBeCloseTo(0.009, 2);
    expect(d.lng).toBeCloseTo(start.lng, 4);
  });

  it('moves due east when bearing=90 (longitude grows)', () => {
    const d = computeDestination(start.lat, start.lng, 90, 1);
    expect(d.lng).toBeGreaterThan(start.lng);
    expect(d.lat).toBeCloseTo(start.lat, 3);
  });

  it('moves south when bearing=180 by ~5 km (latitude drops by ~0.045°)', () => {
    const d = computeDestination(start.lat, start.lng, 180, 5);
    expect(start.lat - d.lat).toBeCloseTo(0.045, 2);
  });

  it('round-trip: forward + reverse returns near origin', () => {
    const a = computeDestination(start.lat, start.lng, 60, 8);
    const back = computeDestination(a.lat, a.lng, 240, 8);
    expect(back.lat).toBeCloseTo(start.lat, 3);
    expect(back.lng).toBeCloseTo(start.lng, 3);
  });

  it('zero distance returns the origin', () => {
    const d = computeDestination(start.lat, start.lng, 137, 0);
    expect(d.lat).toBeCloseTo(start.lat, 6);
    expect(d.lng).toBeCloseTo(start.lng, 6);
  });
});
