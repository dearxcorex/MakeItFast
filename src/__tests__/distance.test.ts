import { describe, it, expect } from 'vitest';
import { haversineDistanceKm, initialBearingDeg } from '@/utils/distance';

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

describe('initialBearingDeg', () => {
  it('points due north, east, south and west along the axes', () => {
    expect(initialBearingDeg(14, 102, 15, 102)).toBeCloseTo(0, 3);
    expect(initialBearingDeg(0, 102, 0, 103)).toBeCloseTo(90, 3);
    expect(initialBearingDeg(15, 102, 14, 102)).toBeCloseTo(180, 3);
    expect(initialBearingDeg(0, 103, 0, 102)).toBeCloseTo(270, 3);
  });

  it('always lands in [0, 360)', () => {
    const b = initialBearingDeg(14.97, 102.1, 14.9, 102.0);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
    expect(b).toBeGreaterThan(180);
  });

  it('returns NaN on non-finite input', () => {
    expect(initialBearingDeg(NaN, 102, 15, 102)).toBeNaN();
  });
});
