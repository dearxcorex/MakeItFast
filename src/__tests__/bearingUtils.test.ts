import { describe, it, expect } from 'vitest';
import {
  calculateBearing,
  getCompassDirection,
  angularDifference,
  calculateEndpoint,
  validateBearing,
} from '@/utils/bearingUtils';
import type { InterferenceSite } from '@/types/interference';

describe('calculateBearing', () => {
  it('returns ~0 for due north', () => {
    const bearing = calculateBearing(13.0, 100.0, 14.0, 100.0);
    expect(bearing).toBeCloseTo(0, 0);
  });

  it('returns ~90 for due east', () => {
    const bearing = calculateBearing(13.0, 100.0, 13.0, 101.0);
    expect(bearing).toBeCloseTo(90, 0);
  });

  it('returns ~180 for due south', () => {
    const bearing = calculateBearing(14.0, 100.0, 13.0, 100.0);
    expect(bearing).toBeCloseTo(180, 0);
  });

  it('returns ~270 for due west', () => {
    const bearing = calculateBearing(13.0, 101.0, 13.0, 100.0);
    expect(bearing).toBeCloseTo(270, 0);
  });

  it('returns ~45 for northeast', () => {
    const bearing = calculateBearing(13.0, 100.0, 14.0, 101.0);
    expect(bearing).toBeGreaterThan(30);
    expect(bearing).toBeLessThan(60);
  });

  it('returns 0-360 range', () => {
    const bearing = calculateBearing(13.0, 100.0, 12.0, 99.0);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });

  // Bangkok to Chiang Mai is roughly north (~350°)
  it('Bangkok to Chiang Mai is roughly north', () => {
    const bearing = calculateBearing(13.7563, 100.5018, 18.7883, 98.9853);
    expect(bearing).toBeGreaterThan(330);
  });
});

describe('getCompassDirection', () => {
  it('returns N for 0 degrees', () => {
    expect(getCompassDirection(0)).toBe('N');
  });

  it('returns N for 350 degrees', () => {
    expect(getCompassDirection(350)).toBe('N');
  });

  it('returns NE for 45 degrees', () => {
    expect(getCompassDirection(45)).toBe('NE');
  });

  it('returns E for 90 degrees', () => {
    expect(getCompassDirection(90)).toBe('E');
  });

  it('returns SE for 135 degrees', () => {
    expect(getCompassDirection(135)).toBe('SE');
  });

  it('returns S for 180 degrees', () => {
    expect(getCompassDirection(180)).toBe('S');
  });

  it('returns SW for 225 degrees', () => {
    expect(getCompassDirection(225)).toBe('SW');
  });

  it('returns W for 270 degrees', () => {
    expect(getCompassDirection(270)).toBe('W');
  });

  it('returns NW for 315 degrees', () => {
    expect(getCompassDirection(315)).toBe('NW');
  });

  it('handles negative degrees', () => {
    expect(getCompassDirection(-90)).toBe('W');
  });

  it('handles degrees > 360', () => {
    expect(getCompassDirection(450)).toBe('E');
  });
});

describe('angularDifference', () => {
  it('returns 0 for identical angles', () => {
    expect(angularDifference(90, 90)).toBe(0);
  });

  it('returns 180 for opposite angles', () => {
    expect(angularDifference(0, 180)).toBe(180);
  });

  it('handles wraparound: 350 vs 10 = 20', () => {
    expect(angularDifference(350, 10)).toBe(20);
  });

  it('is symmetric', () => {
    expect(angularDifference(30, 100)).toBe(angularDifference(100, 30));
  });

  it('returns correct diff for 0 vs 270 = 90', () => {
    expect(angularDifference(0, 270)).toBe(90);
  });

  it('returns correct diff for 10 vs 350 = 20', () => {
    expect(angularDifference(10, 350)).toBe(20);
  });
});

describe('calculateEndpoint', () => {
  it('returns point to the north', () => {
    const [lat, lon] = calculateEndpoint(13.0, 100.0, 0, 10);
    expect(lat).toBeGreaterThan(13.0);
    expect(lon).toBeCloseTo(100.0, 1);
  });

  it('returns point to the east', () => {
    const [lat, lon] = calculateEndpoint(13.0, 100.0, 90, 10);
    expect(lat).toBeCloseTo(13.0, 1);
    expect(lon).toBeGreaterThan(100.0);
  });

  it('returns point to the south', () => {
    const [lat, lon] = calculateEndpoint(13.0, 100.0, 180, 10);
    expect(lat).toBeLessThan(13.0);
    expect(lon).toBeCloseTo(100.0, 1);
  });

  it('returns original point for 0 distance', () => {
    const [lat, lon] = calculateEndpoint(13.0, 100.0, 45, 0);
    expect(lat).toBeCloseTo(13.0, 5);
    expect(lon).toBeCloseTo(100.0, 5);
  });
});

describe('validateBearing', () => {
  const baseSite: InterferenceSite = {
    id: 1,
    siteCode: 'TEST',
    siteName: 'Test Site',
    lat: 13.0,
    long: 100.0,
    mcZone: null,
    changwat: null,
    cellName: null,
    sectorName: null,
    direction: 0, // pointing north
    avgNiCarrier: null,
    dayTime: null,
    nightTime: null,
    sourceLat: 14.0, // source is to the north
    sourceLong: 100.0,
    estimateDistance: null,
    ranking: null,
    status: null,
    nbtcArea: null,
    awnContact: null,
    lot: null,
    onSiteScanBy: null,
    onSiteScanDate: null,
    checkRealtime: null,
    sourceLocation1: null,
    sourceLocation2: null,
    cameraModel1: null,
    cameraModel2: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('returns match when direction points toward source', () => {
    const result = validateBearing(baseSite);
    expect(result).not.toBeNull();
    expect(result!.isMatch).toBe(true);
    expect(result!.angularDifference).toBeLessThan(5);
  });

  it('returns mismatch when direction is opposite to source', () => {
    const site = { ...baseSite, direction: 180 };
    const result = validateBearing(site);
    expect(result).not.toBeNull();
    expect(result!.isMatch).toBe(false);
    expect(result!.angularDifference).toBeGreaterThan(170);
  });

  it('returns null when direction is null', () => {
    const site = { ...baseSite, direction: null };
    expect(validateBearing(site)).toBeNull();
  });

  it('returns null when source coordinates are null', () => {
    const site = { ...baseSite, sourceLat: null, sourceLong: null };
    expect(validateBearing(site)).toBeNull();
  });

  it('returns null when cell coordinates are null', () => {
    const site = { ...baseSite, lat: null, long: null };
    expect(validateBearing(site)).toBeNull();
  });

  it('returns null when source and cell are identical', () => {
    const site = { ...baseSite, sourceLat: 13.0, sourceLong: 100.0 };
    expect(validateBearing(site)).toBeNull();
  });

  it('respects custom tolerance', () => {
    // Source is to the NE (~45°), direction is 0 (north)
    const site = { ...baseSite, sourceLat: 14.0, sourceLong: 101.0 };
    const strict = validateBearing(site, 10);
    const loose = validateBearing(site, 60);
    expect(strict!.isMatch).toBe(false);
    expect(loose!.isMatch).toBe(true);
  });

  it('includes compass direction string', () => {
    const result = validateBearing(baseSite);
    expect(result!.compassDirection).toMatch(/N/);
    expect(result!.compassDirection).toMatch(/°/);
  });

  it('normalizes stored direction > 360', () => {
    const site = { ...baseSite, direction: 360 };
    const result = validateBearing(site);
    expect(result!.storedDirection).toBe(0);
  });
});
