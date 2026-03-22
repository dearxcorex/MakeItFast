/**
 * Tests for hbw/vbw (horizontal/vertical beamwidth) fields added to CloudRF payloads,
 * and for the new convertBoundsToMapLibre function.
 */
import { describe, it, expect } from 'vitest';
import {
  buildAreaPayload,
  buildPathPayloadV2,
  buildMultisitePayload,
  convertBoundsToMapLibre,
} from '@/utils/cloudrf';
import type { InterferenceSite } from '@/types/interference';

// ---------------------------------------------------------------------------
// Shared mock site used across buildAreaPayload tests
// ---------------------------------------------------------------------------

const mockSite: InterferenceSite = {
  id: 42,
  siteCode: 'BKK01',
  siteName: 'Bangkok North',
  lat: 13.7563,
  long: 100.5018,
  mcZone: 'BKK',
  changwat: 'กรุงเทพมหานคร',
  cellName: 'BKK01N2613',
  sectorName: 'BKK01_1',
  direction: 60,
  avgNiCarrier: -80,
  dayTime: -78,
  nightTime: -81,
  sourceLat: 13.756,
  sourceLong: 100.502,
  estimateDistance: 0.1,
  ranking: 'Major',
  status: 'Medium interference',
  nbtcArea: 'NBTC-01',
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
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

// ---------------------------------------------------------------------------
// buildAreaPayload — hbw / vbw fields
// ---------------------------------------------------------------------------

describe('buildAreaPayload - hbw/vbw beamwidth fields', () => {
  it('includes hbw field in transmitter', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter).toHaveProperty('hbw');
  });

  it('includes vbw field in transmitter', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter).toHaveProperty('vbw');
  });

  it('defaults hbw to 65 (macro_urban profile default) when no options given', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter.hbw).toBe(65);
  });

  it('defaults vbw to 7 (macro_urban profile default) when no options given', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter.vbw).toBe(7);
  });

  it('allows overriding hbw via options', () => {
    const payload = buildAreaPayload(mockSite, { hbw: 90 });
    expect(payload.transmitter.hbw).toBe(90);
  });

  it('allows overriding vbw via options', () => {
    const payload = buildAreaPayload(mockSite, { vbw: 10 });
    expect(payload.transmitter.vbw).toBe(10);
  });

  it('uses macro_urban profile hbw (65) when profile is set', () => {
    const payload = buildAreaPayload(mockSite, { profile: 'macro_urban' });
    expect(payload.transmitter.hbw).toBe(65);
  });

  it('uses macro_urban profile vbw (7) when profile is set', () => {
    const payload = buildAreaPayload(mockSite, { profile: 'macro_urban' });
    expect(payload.transmitter.vbw).toBe(7);
  });

  it('uses macro_suburban profile hbw (65)', () => {
    const payload = buildAreaPayload(mockSite, { profile: 'macro_suburban' });
    expect(payload.transmitter.hbw).toBe(65);
  });

  it('uses macro_suburban profile vbw (7)', () => {
    const payload = buildAreaPayload(mockSite, { profile: 'macro_suburban' });
    expect(payload.transmitter.vbw).toBe(7);
  });

  it('uses macro_rural profile hbw (65)', () => {
    const payload = buildAreaPayload(mockSite, { profile: 'macro_rural' });
    expect(payload.transmitter.hbw).toBe(65);
  });

  it('uses macro_rural profile vbw (6)', () => {
    const payload = buildAreaPayload(mockSite, { profile: 'macro_rural' });
    expect(payload.transmitter.vbw).toBe(6);
  });

  it('option hbw overrides profile hbw', () => {
    const payload = buildAreaPayload(mockSite, { profile: 'macro_rural', hbw: 45 });
    expect(payload.transmitter.hbw).toBe(45);
  });

  it('option vbw overrides profile vbw', () => {
    const payload = buildAreaPayload(mockSite, { profile: 'macro_rural', vbw: 3 });
    expect(payload.transmitter.vbw).toBe(3);
  });

  it('hbw and vbw are numbers (not undefined or null)', () => {
    const payload = buildAreaPayload(mockSite);
    expect(typeof payload.transmitter.hbw).toBe('number');
    expect(typeof payload.transmitter.vbw).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// buildPathPayloadV2 — hbw / vbw fields
// ---------------------------------------------------------------------------

describe('buildPathPayloadV2 - hbw/vbw beamwidth fields', () => {
  const from = { lat: 13.7563, lon: 100.5018 };
  const to = { lat: 13.76, lon: 100.51 };

  it('includes hbw field in transmitter', () => {
    const payload = buildPathPayloadV2(from, to);
    expect(payload.transmitter).toHaveProperty('hbw');
  });

  it('includes vbw field in transmitter', () => {
    const payload = buildPathPayloadV2(from, to);
    expect(payload.transmitter).toHaveProperty('vbw');
  });

  it('defaults hbw to 65 when no profile specified', () => {
    const payload = buildPathPayloadV2(from, to);
    expect(payload.transmitter.hbw).toBe(65);
  });

  it('defaults vbw to 7 when no profile specified', () => {
    const payload = buildPathPayloadV2(from, to);
    expect(payload.transmitter.vbw).toBe(7);
  });

  it('uses profile hbw for macro_urban', () => {
    const payload = buildPathPayloadV2(from, to, { profile: 'macro_urban' });
    expect(payload.transmitter.hbw).toBe(65);
  });

  it('uses profile vbw for macro_urban', () => {
    const payload = buildPathPayloadV2(from, to, { profile: 'macro_urban' });
    expect(payload.transmitter.vbw).toBe(7);
  });

  it('uses profile vbw for macro_rural (6)', () => {
    const payload = buildPathPayloadV2(from, to, { profile: 'macro_rural' });
    expect(payload.transmitter.vbw).toBe(6);
  });

  it('hbw and vbw are numbers', () => {
    const payload = buildPathPayloadV2(from, to);
    expect(typeof payload.transmitter.hbw).toBe('number');
    expect(typeof payload.transmitter.vbw).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// buildMultisitePayload — hbw / vbw fields
// ---------------------------------------------------------------------------

describe('buildMultisitePayload - hbw/vbw beamwidth fields', () => {
  const sites = [
    { lat: 13.7, lon: 100.5, azi: 0 },
    { lat: 13.8, lon: 100.6, azi: 120 },
    { lat: 13.9, lon: 100.7, azi: 240 },
  ];

  it('each transmitter includes hbw field', () => {
    const payload = buildMultisitePayload(sites);
    payload.transmitters.forEach((tx) => {
      expect(tx).toHaveProperty('hbw');
    });
  });

  it('each transmitter includes vbw field', () => {
    const payload = buildMultisitePayload(sites);
    payload.transmitters.forEach((tx) => {
      expect(tx).toHaveProperty('vbw');
    });
  });

  it('defaults hbw to 65 for all transmitters when no profile', () => {
    const payload = buildMultisitePayload(sites);
    payload.transmitters.forEach((tx) => {
      expect(tx.hbw).toBe(65);
    });
  });

  it('defaults vbw to 7 for all transmitters when no profile', () => {
    const payload = buildMultisitePayload(sites);
    payload.transmitters.forEach((tx) => {
      expect(tx.vbw).toBe(7);
    });
  });

  it('uses per-site profile hbw for macro_urban', () => {
    const sitesWithProfile = [{ lat: 13.7, lon: 100.5, profile: 'macro_urban' as const }];
    const payload = buildMultisitePayload(sitesWithProfile);
    expect(payload.transmitters[0].hbw).toBe(65);
  });

  it('uses per-site profile vbw for macro_rural (6)', () => {
    const sitesWithProfile = [{ lat: 13.7, lon: 100.5, profile: 'macro_rural' as const }];
    const payload = buildMultisitePayload(sitesWithProfile);
    expect(payload.transmitters[0].vbw).toBe(6);
  });

  it('hbw and vbw are numbers for every transmitter', () => {
    const payload = buildMultisitePayload(sites);
    payload.transmitters.forEach((tx) => {
      expect(typeof tx.hbw).toBe('number');
      expect(typeof tx.vbw).toBe('number');
    });
  });

  it('handles single-site multisite payload with correct beamwidth', () => {
    const payload = buildMultisitePayload([{ lat: 13.7, lon: 100.5 }]);
    expect(payload.transmitters[0].hbw).toBe(65);
    expect(payload.transmitters[0].vbw).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// convertBoundsToMapLibre
// ---------------------------------------------------------------------------

describe('convertBoundsToMapLibre', () => {
  // CloudRF bounds format: [north, east, south, west]
  const cloudRFBounds: [number, number, number, number] = [16.0, 104.0, 14.0, 102.0];

  it('returns an array of exactly 4 corner coordinates', () => {
    const result = convertBoundsToMapLibre(cloudRFBounds);
    expect(result).toHaveLength(4);
  });

  it('each corner is a [lng, lat] pair (length 2)', () => {
    const result = convertBoundsToMapLibre(cloudRFBounds);
    result.forEach((corner) => {
      expect(corner).toHaveLength(2);
    });
  });

  it('top-left corner is [west, north]', () => {
    const result = convertBoundsToMapLibre(cloudRFBounds);
    expect(result[0]).toEqual([102.0, 16.0]); // [west, north]
  });

  it('top-right corner is [east, north]', () => {
    const result = convertBoundsToMapLibre(cloudRFBounds);
    expect(result[1]).toEqual([104.0, 16.0]); // [east, north]
  });

  it('bottom-right corner is [east, south]', () => {
    const result = convertBoundsToMapLibre(cloudRFBounds);
    expect(result[2]).toEqual([104.0, 14.0]); // [east, south]
  });

  it('bottom-left corner is [west, south]', () => {
    const result = convertBoundsToMapLibre(cloudRFBounds);
    expect(result[3]).toEqual([102.0, 14.0]); // [west, south]
  });

  it('top-left and top-right share the same latitude (north)', () => {
    const result = convertBoundsToMapLibre(cloudRFBounds);
    expect(result[0][1]).toBe(result[1][1]); // lat is index 1 in [lng, lat]
  });

  it('bottom-left and bottom-right share the same latitude (south)', () => {
    const result = convertBoundsToMapLibre(cloudRFBounds);
    expect(result[2][1]).toBe(result[3][1]);
  });

  it('top-left and bottom-left share the same longitude (west)', () => {
    const result = convertBoundsToMapLibre(cloudRFBounds);
    expect(result[0][0]).toBe(result[3][0]); // lng is index 0 in [lng, lat]
  });

  it('top-right and bottom-right share the same longitude (east)', () => {
    const result = convertBoundsToMapLibre(cloudRFBounds);
    expect(result[1][0]).toBe(result[2][0]);
  });

  it('north > south (top corners have larger lat than bottom corners)', () => {
    const result = convertBoundsToMapLibre(cloudRFBounds);
    expect(result[0][1]).toBeGreaterThan(result[3][1]);
    expect(result[1][1]).toBeGreaterThan(result[2][1]);
  });

  it('east > west (right corners have larger lng than left corners)', () => {
    const result = convertBoundsToMapLibre(cloudRFBounds);
    expect(result[1][0]).toBeGreaterThan(result[0][0]);
    expect(result[2][0]).toBeGreaterThan(result[3][0]);
  });

  it('handles negative coordinates (crossing prime meridian / equator)', () => {
    const negativeBounds: [number, number, number, number] = [1.0, 0.5, -1.0, -0.5];
    const result = convertBoundsToMapLibre(negativeBounds);
    expect(result[0]).toEqual([-0.5, 1.0]);  // top-left [west, north]
    expect(result[1]).toEqual([0.5, 1.0]);   // top-right [east, north]
    expect(result[2]).toEqual([0.5, -1.0]);  // bottom-right [east, south]
    expect(result[3]).toEqual([-0.5, -1.0]); // bottom-left [west, south]
  });

  it('handles Thailand-region bounds correctly', () => {
    // Typical CloudRF response bounds for a site in northern Thailand
    const thBounds: [number, number, number, number] = [19.5, 99.5, 18.5, 98.5];
    const result = convertBoundsToMapLibre(thBounds);
    expect(result[0]).toEqual([98.5, 19.5]);
    expect(result[1]).toEqual([99.5, 19.5]);
    expect(result[2]).toEqual([99.5, 18.5]);
    expect(result[3]).toEqual([98.5, 18.5]);
  });

  it('output format differs from convertBoundsToLeaflet (MapLibre uses [lng,lat] pairs)', () => {
    // MapLibre uses [[lng,lat], ...] while Leaflet uses [[lat,lng], ...]
    // Top-left for MapLibre: [west, north] → lng first
    const result = convertBoundsToMapLibre(cloudRFBounds);
    const topLeft = result[0];
    // lng (west=102) < lat (north=16) in this test case, so topLeft[0] < topLeft[1]
    expect(topLeft[0]).toBe(102.0); // west (longitude)
    expect(topLeft[1]).toBe(16.0);  // north (latitude)
  });

  it('works with equal-magnitude bounds (square region)', () => {
    const squareBounds: [number, number, number, number] = [10.0, 10.0, 0.0, 0.0];
    const result = convertBoundsToMapLibre(squareBounds);
    expect(result[0]).toEqual([0.0, 10.0]);
    expect(result[2]).toEqual([10.0, 0.0]);
  });
});
