import { describe, it, expect } from 'vitest';
import { haversineDistanceKm } from '@/utils/distance';

describe('haversineDistanceKm', () => {
  it('returns 0 km for the same point', () => {
    expect(haversineDistanceKm(13.7563, 100.5018, 13.7563, 100.5018)).toBe(0);
  });

  it('approximates 111 km per degree along the equator', () => {
    const km = haversineDistanceKm(0, 0, 0, 1);
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });

  it('matches BKK -> CNX reference distance ~581 km within 5 km', () => {
    const km = haversineDistanceKm(13.7563, 100.5018, 18.7883, 98.9853);
    expect(km).toBeGreaterThan(576);
    expect(km).toBeLessThan(586);
  });

  it('is symmetric A->B == B->A', () => {
    const ab = haversineDistanceKm(13.7, 100.5, 18.8, 98.9);
    const ba = haversineDistanceKm(18.8, 98.9, 13.7, 100.5);
    expect(Math.abs(ab - ba)).toBeLessThan(1e-9);
  });

  it('returns NaN when any input is NaN', () => {
    expect(haversineDistanceKm(NaN, 0, 0, 0)).toBeNaN();
    expect(haversineDistanceKm(0, NaN, 0, 0)).toBeNaN();
    expect(haversineDistanceKm(0, 0, NaN, 0)).toBeNaN();
    expect(haversineDistanceKm(0, 0, 0, NaN)).toBeNaN();
  });
});
