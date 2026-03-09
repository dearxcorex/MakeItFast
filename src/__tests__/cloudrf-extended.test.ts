import { describe, it, expect } from 'vitest';
import { hashRequest, buildAreaPayload, convertBoundsToLeaflet } from '@/utils/cloudrf';
import type { InterferenceSite } from '@/types/interference';

const mockSite: InterferenceSite = {
  id: 1,
  siteCode: 'TEST01',
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

describe('hashRequest edge cases', () => {
  it('handles empty object', () => {
    const hash = hashRequest({});
    expect(hash).toBeTruthy();
    expect(hash.length).toBe(64); // SHA-256 hex length
  });

  it('handles nested objects', () => {
    const a = { site: { lat: 14.87 }, output: { rad: 5 } };
    const hash = hashRequest(a);
    expect(hash.length).toBe(64);
  });

  it('handles numeric values including zero', () => {
    const a = hashRequest({ val: 0 });
    const b = hashRequest({ val: 1 });
    expect(a).not.toBe(b);
  });

  it('handles null values', () => {
    const hash = hashRequest({ key: null });
    expect(hash).toBeTruthy();
  });
});

describe('buildAreaPayload comprehensive', () => {
  it('uses siteCode as site name', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.site).toBe('TEST01');
  });

  it('falls back to SITE-{id} when no siteCode', () => {
    const noCode = { ...mockSite, siteCode: null };
    const payload = buildAreaPayload(noCode);
    expect(payload.site).toBe('SITE-1');
  });

  it('sets 2600 MHz frequency for all sites', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter.frq).toBe(2600);
  });

  it('sets receiver sensitivity to -100 dBm (3GPP LTE UE)', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.receiver.rxs).toBe(-100);
  });

  it('sets vertical polarization', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter.pol).toBe('v');
  });

  it('sets 30m resolution', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.output.res).toBe(30);
  });

  it('uses metric units', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.output.units).toBe('m');
  });

  it('includes RAINBOW.dBm color scheme', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.output.col).toBe('RAINBOW.dBm');
  });

  it('sets environment to Tropical climate (Thailand)', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.environment.clt).toBe('Tropical.clt');
  });

  it('includes all required CloudRF v2 fields', () => {
    const payload = buildAreaPayload(mockSite);
    // Required top-level
    expect(payload).toHaveProperty('site');
    expect(payload).toHaveProperty('network');
    expect(typeof payload.site).toBe('string');
    expect(typeof payload.network).toBe('string');
    // Required transmitter fields
    expect(payload.transmitter).toHaveProperty('lat');
    expect(payload.transmitter).toHaveProperty('lon');
    expect(payload.transmitter).toHaveProperty('alt');
    expect(payload.transmitter).toHaveProperty('frq');
    expect(payload.transmitter).toHaveProperty('txw');
    // Required output fields
    expect(payload.output.mod).toBeGreaterThanOrEqual(1);
    expect(payload.output.ber).toBeGreaterThanOrEqual(1);
  });
});

describe('convertBoundsToLeaflet edge cases', () => {
  it('handles bounds crossing prime meridian', () => {
    const bounds: [number, number, number, number] = [52.0, 2.0, 50.0, -1.0];
    const result = convertBoundsToLeaflet(bounds);
    expect(result).toEqual([[50.0, -1.0], [52.0, 2.0]]);
  });

  it('handles equatorial bounds', () => {
    const bounds: [number, number, number, number] = [1.0, 104.0, -1.0, 102.0];
    const result = convertBoundsToLeaflet(bounds);
    expect(result[0][0]).toBeLessThan(0); // South is negative
    expect(result[1][0]).toBeGreaterThan(0); // North is positive
  });

  it('preserves decimal precision', () => {
    const bounds: [number, number, number, number] = [14.925094, 103.527974, 14.832146, 103.435026];
    const result = convertBoundsToLeaflet(bounds);
    expect(result[0][0]).toBe(14.832146);
    expect(result[0][1]).toBe(103.435026);
    expect(result[1][0]).toBe(14.925094);
    expect(result[1][1]).toBe(103.527974);
  });
});
