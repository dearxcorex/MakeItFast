import { describe, it, expect } from 'vitest';
import { hashRequest, buildAreaPayload, convertBoundsToLeaflet } from '@/utils/cloudrf';
import type { InterferenceSite } from '@/types/interference';

describe('hashRequest', () => {
  it('produces consistent hash for same input', () => {
    const params = { lat: 14.87, lon: 103.48, frq: 2600 };
    expect(hashRequest(params)).toBe(hashRequest(params));
  });

  it('produces different hash for different input', () => {
    const a = { lat: 14.87, lon: 103.48 };
    const b = { lat: 15.00, lon: 104.00 };
    expect(hashRequest(a)).not.toBe(hashRequest(b));
  });

  it('produces same hash regardless of key order', () => {
    const a = { lat: 14.87, lon: 103.48 };
    const b = { lon: 103.48, lat: 14.87 };
    expect(hashRequest(a)).toBe(hashRequest(b));
  });
});

describe('buildAreaPayload', () => {
  const mockSite: InterferenceSite = {
    id: 1,
    siteCode: 'TEST',
    siteName: 'Test Site',
    lat: 14.87862,
    long: 103.4815,
    mcZone: 'SRN',
    changwat: 'สุรินทร์',
    cellName: 'TESTN2613',
    sectorName: 'TEST_3',
    direction: 120,
    avgNiCarrier: -79.04,
    dayTime: -77,
    nightTime: -79.29,
    sourceLat: 14.878764,
    sourceLong: 103.481064,
    estimateDistance: 0.05,
    ranking: 'Critical',
    status: 'High interference',
    nbtcArea: 'NBTC-22',
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

  it('uses site lat/long in transmitter', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter.lat).toBe(14.87862);
    expect(payload.transmitter.lon).toBe(103.4815);
  });

  it('sets site as string identifier', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.site).toBe('TEST');
  });

  it('includes network field', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.network).toBe('AWN-2600');
  });

  it('uses site direction as azimuth', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter.azi).toBe(120);
  });

  it('defaults to 30m height (macro_urban default)', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter.alt).toBe(30);
  });

  it('uses 2600 MHz frequency', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter.frq).toBe(2600);
  });

  it('uses ITM/Longley-Rice propagation model (pm: 7) for 2600 MHz', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.model.pm).toBe(7);
  });

  it('uses valid mod (1-11) and ber (1-6) values', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.output.mod).toBeGreaterThanOrEqual(1);
    expect(payload.output.mod).toBeLessThanOrEqual(11);
    expect(payload.output.ber).toBeGreaterThanOrEqual(1);
    expect(payload.output.ber).toBeLessThanOrEqual(6);
  });

  it('respects option overrides', () => {
    const payload = buildAreaPayload(mockSite, { alt: 80, txw: 40, rad: 10, azi: 90 });
    expect(payload.transmitter.alt).toBe(80);
    expect(payload.transmitter.txw).toBe(40);
    expect(payload.output.rad).toBe(10);
    expect(payload.transmitter.azi).toBe(90);
  });

  it('defaults direction to 0 if site has no direction', () => {
    const noDir = { ...mockSite, direction: null };
    const payload = buildAreaPayload(noDir);
    expect(payload.transmitter.azi).toBe(0);
  });
});

describe('convertBoundsToLeaflet', () => {
  it('converts CloudRF [N,E,S,W] to Leaflet [[S,W],[N,E]]', () => {
    const cloudrf: [number, number, number, number] = [16.0, 104.0, 14.0, 102.0];
    const leaflet = convertBoundsToLeaflet(cloudrf);
    expect(leaflet).toEqual([
      [14.0, 102.0],
      [16.0, 104.0],
    ]);
  });

  it('handles cached bounds (must still convert correctly)', () => {
    // Cached bounds are stored as raw CloudRF [N,E,S,W]
    // They must be converted to Leaflet format on output
    const cachedRaw: [number, number, number, number] = [15.5, 103.9, 14.5, 102.9];
    const leaflet = convertBoundsToLeaflet(cachedRaw);
    expect(leaflet[0][0]).toBeLessThan(leaflet[1][0]); // S < N
    expect(leaflet[0][1]).toBeLessThan(leaflet[1][1]); // W < E
  });
});
