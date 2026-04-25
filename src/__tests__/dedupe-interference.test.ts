import { describe, it, expect } from 'vitest';
import { dedupeInterferenceSites } from '@/utils/dedupeInterference';
import type { InterferenceSite } from '@/types/interference';

const base = (overrides: Partial<InterferenceSite>): InterferenceSite => ({
  id: 0,
  siteCode: 'X',
  siteName: 'X',
  lat: 0,
  long: 0,
  mcZone: null,
  changwat: null,
  cellName: null,
  sectorName: null,
  direction: null,
  avgNiCarrier: null,
  dayTime: null,
  nightTime: null,
  sourceLat: null,
  sourceLong: null,
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
  lawPaperSent: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('dedupeInterferenceSites', () => {
  it('keeps a single row for a unique cellsite/sector/direction', () => {
    const out = dedupeInterferenceSites([
      base({ id: 1, siteCode: 'A', cellName: 'AC1', sectorName: 'A_1', direction: 0 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1);
  });

  it('merges duplicates and prefers the inspected sibling as the representative', () => {
    const sites = [
      base({
        id: 786,
        siteCode: 'NBRWM',
        cellName: 'NBRWMN2611',
        sectorName: 'NBRWM_1',
        direction: 0,
        status: 'High interference',
      }),
      base({
        id: 892,
        siteCode: 'NBRWM',
        cellName: 'NBRWMN2611',
        sectorName: 'NBRWM_1',
        direction: 0,
        status: 'ตรวจแล้ว',
      }),
    ];
    const out = dedupeInterferenceSites(sites);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(892);
    expect(out[0].status).toBe('ตรวจแล้ว');
  });

  it('without an inspected sibling, picks the newest by updatedAt', () => {
    const sites = [
      base({
        id: 1,
        siteCode: 'X',
        cellName: 'XC1',
        sectorName: 'X_1',
        direction: 90,
        status: 'High interference',
        updatedAt: new Date('2026-01-01'),
      }),
      base({
        id: 2,
        siteCode: 'X',
        cellName: 'XC1',
        sectorName: 'X_1',
        direction: 90,
        status: 'None',
        updatedAt: new Date('2026-04-25'),
      }),
    ];
    const out = dedupeInterferenceSites(sites);
    expect(out[0].id).toBe(2);
  });

  it('OR-merges lawPaperSent across siblings', () => {
    const sites = [
      base({
        id: 1,
        siteCode: 'X',
        cellName: 'XC1',
        sectorName: 'X_1',
        direction: 0,
        status: 'High interference',
        lawPaperSent: true,
      }),
      base({
        id: 2,
        siteCode: 'X',
        cellName: 'XC1',
        sectorName: 'X_1',
        direction: 0,
        status: 'ตรวจแล้ว',
        lawPaperSent: false,
      }),
    ];
    const out = dedupeInterferenceSites(sites);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('ตรวจแล้ว');
    expect(out[0].lawPaperSent).toBe(true);
  });

  it('does NOT merge rows that share siteCode but differ on direction (different sectors)', () => {
    const sites = [
      base({ id: 1, siteCode: 'NBRWM', cellName: 'NBRWMN2611', sectorName: 'NBRWM_1', direction: 0, status: 'ตรวจแล้ว' }),
      base({ id: 2, siteCode: 'NBRWM', cellName: 'NBRWMN2616', sectorName: 'NBRWM_6', direction: 50, status: 'High interference' }),
    ];
    const out = dedupeInterferenceSites(sites);
    expect(out).toHaveLength(2);
  });

  it('rows missing all of (siteCode, cellName, sectorName, direction) never merge', () => {
    const sites = [
      base({ id: 1, siteCode: '' }),
      base({ id: 2, siteCode: '' }),
    ];
    const out = dedupeInterferenceSites(sites);
    expect(out).toHaveLength(2);
  });
});
