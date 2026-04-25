import { describe, it, expect } from 'vitest';
import { computeKpis } from '@/utils/fieldOpsKpi';
import type { FMStation } from '@/types/station';
import type { InterferenceSite } from '@/types/interference';

const fmInspected = (id: number): FMStation => ({
  id,
  name: `FM ${id}`,
  frequency: 88 + id * 0.1,
  latitude: 13.7,
  longitude: 100.5,
  city: 'X',
  state: 'Y',
  inspection69: 'ตรวจแล้ว',
  onAir: true,
});

const fmPending = (id: number): FMStation => ({
  ...fmInspected(id),
  inspection69: 'ยังไม่ตรวจ',
});

const intRanked = (id: number, ranking: string, status = 'ยังไม่ตรวจ'): InterferenceSite => ({
  id,
  siteCode: `S${id}`,
  siteName: `Site ${id}`,
  lat: 13.7,
  long: 100.5,
  mcZone: null,
  changwat: 'X',
  cellName: null,
  sectorName: null,
  direction: null,
  avgNiCarrier: null,
  dayTime: null,
  nightTime: null,
  sourceLat: null,
  sourceLong: null,
  estimateDistance: null,
  ranking,
  status,
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
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('computeKpis', () => {
  const stations: FMStation[] = [fmInspected(1), fmInspected(2), fmPending(3), fmPending(4)];
  const interference: InterferenceSite[] = [
    intRanked(1, 'Critical', 'ตรวจแล้ว'),
    intRanked(2, 'Critical'),
    intRanked(3, 'Major', 'ตรวจแล้ว'),
    intRanked(4, 'Minor'),
    intRanked(5, 'Minor'),
  ];

  it('type=ALL totals across both datasets and counts critical from INT', () => {
    const k = computeKpis(stations, interference, 'ALL');
    expect(k.total).toBe(9);                  // 4 FM + 5 INT
    expect(k.inspected).toBe(2 + 2);          // 2 FM + 2 INT inspected
    expect(k.pending).toBe(9 - 4);
    expect(k.critical).toBe(2);               // 2 INT with ranking Critical
  });

  it('type=FM counts FM only and reports critical=null (FM has no Critical concept)', () => {
    const k = computeKpis(stations, interference, 'FM');
    expect(k.total).toBe(4);
    expect(k.inspected).toBe(2);
    expect(k.pending).toBe(2);
    expect(k.critical).toBeNull();
  });

  it('type=INT counts interference only and includes critical from INT', () => {
    const k = computeKpis(stations, interference, 'INT');
    expect(k.total).toBe(5);
    expect(k.inspected).toBe(2);
    expect(k.pending).toBe(3);
    expect(k.critical).toBe(2);
  });

  it('handles empty datasets gracefully', () => {
    const k = computeKpis([], [], 'ALL');
    expect(k).toEqual({ total: 0, inspected: 0, pending: 0, critical: 0, pct: 0 });
  });

  it('exposes pct as integer percent of inspected/total', () => {
    const k = computeKpis(stations, interference, 'ALL');
    expect(k.pct).toBe(Math.round((4 / 9) * 100));
  });
});
