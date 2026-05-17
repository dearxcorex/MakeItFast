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
  genre: 'ทั่วไป',
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

describe('computeKpis (pure tally over pre-filtered arrays)', () => {
  const stations: FMStation[] = [fmInspected(1), fmInspected(2), fmPending(3), fmPending(4)];
  const interference: InterferenceSite[] = [
    intRanked(1, 'Critical', 'ตรวจแล้ว'),
    intRanked(2, 'Critical'),
    intRanked(3, 'Major', 'ตรวจแล้ว'),
    intRanked(4, 'Minor'),
    intRanked(5, 'Minor'),
  ];

  it('type=ALL totals the visible slice and counts critical from INT; target = total', () => {
    const k = computeKpis(stations, interference, 'ALL');
    expect(k.total).toBe(9);
    expect(k.inspected).toBe(4);
    expect(k.pending).toBe(5);
    expect(k.critical).toBe(2);
    expect(k.target).toBe(9);
    expect(k.pct).toBe(Math.round((4 / 9) * 100));
  });

  it('type=FM uses dynamic target=total; critical=null', () => {
    const k = computeKpis(stations, [], 'FM');
    expect(k.total).toBe(4);
    expect(k.inspected).toBe(2);
    expect(k.pending).toBe(2);
    expect(k.critical).toBeNull();
    expect(k.target).toBe(4);
    expect(k.pct).toBe(Math.round((2 / 4) * 100));
  });

  it('type=INT uses dynamic target=total and includes critical', () => {
    const k = computeKpis([], interference, 'INT');
    expect(k.total).toBe(5);
    expect(k.inspected).toBe(2);
    expect(k.pending).toBe(3);
    expect(k.critical).toBe(2);
    expect(k.target).toBe(5);
    expect(k.pct).toBe(Math.round((2 / 5) * 100));
  });

  it('handles empty datasets gracefully', () => {
    const k = computeKpis([], [], 'ALL');
    expect(k).toEqual({ total: 0, inspected: 0, pending: 0, critical: 0, target: 0, pct: 0 });
  });

  it('FM-only with empty stations still returns critical=null and target=0', () => {
    const k = computeKpis([], [], 'FM');
    expect(k.critical).toBeNull();
    expect(k.target).toBe(0);
    expect(k.pct).toBe(0);
  });

  it('STATUS=PENDING slice: caller passes only pending rows; INSPECTED collapses to 0', () => {
    const pendingFM = stations.filter((s) => s.inspection69 !== 'ตรวจแล้ว');
    const pendingINT = interference.filter((s) => s.status !== 'ตรวจแล้ว');
    const k = computeKpis(pendingFM, pendingINT, 'ALL');
    expect(k.total).toBe(pendingFM.length + pendingINT.length);
    expect(k.inspected).toBe(0);
    expect(k.pending).toBe(k.total);
    expect(k.pct).toBe(0);
    expect(k.critical).toBe(1); // only INT id=2 is Critical+pending
  });

  it('STATUS=INSPECTED slice on INT: pct rounds to 100 (capped)', () => {
    const inspectedINT = interference.filter((s) => s.status === 'ตรวจแล้ว');
    const k = computeKpis([], inspectedINT, 'INT');
    expect(k.total).toBe(inspectedINT.length);
    expect(k.inspected).toBe(inspectedINT.length);
    expect(k.pending).toBe(0);
    expect(k.pct).toBe(100);
    expect(k.target).toBe(inspectedINT.length);
  });

  it('FM target cap: pct never exceeds 100 even if inspected > 200', () => {
    const fakeStations = Array.from({ length: 250 }, (_, i) => fmInspected(i));
    const k = computeKpis(fakeStations, [], 'FM');
    expect(k.pct).toBe(100);
  });
});
