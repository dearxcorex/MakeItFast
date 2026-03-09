import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
const mockFmFindMany = vi.fn();
const mockFmFindUnique = vi.fn();
const mockFmUpdate = vi.fn();
const mockInterfereFindMany = vi.fn();
const mockInterfereFindUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    fm_station: {
      findMany: (...args: unknown[]) => mockFmFindMany(...args),
      findUnique: (...args: unknown[]) => mockFmFindUnique(...args),
      update: (...args: unknown[]) => mockFmUpdate(...args),
    },
    interference_site: {
      findMany: (...args: unknown[]) => mockInterfereFindMany(...args),
      findUnique: (...args: unknown[]) => mockInterfereFindUnique(...args),
    },
  },
}));

import {
  convertToFMStation,
  fetchFMStations,
  fetchFMStationById,
  groupStationsByCoordinates,
  updateFMStation,
} from '@/services/stationService';

import {
  convertToInterferenceSite,
  fetchInterferenceSites,
  fetchInterferenceSiteById,
  getDistinctChangwats,
  getDistinctRankings,
  getDistinctMcZones,
  getDistinctNbtcAreas,
} from '@/services/interferenceService';

beforeEach(() => {
  vi.clearAllMocks();
});

// ==========================================
// stationService
// ==========================================
describe('stationService', () => {
  const mockDbRow = {
    id_fm: 42,
    name: 'Test Station',
    freq: 98.5,
    lat: 13.75,
    long: 100.5,
    district: 'Bangkok Noi',
    province: 'Bangkok',
    type: ' FM ',
    inspection_68: true,
    inspection_69: false,
    date_inspected: '2026-01-15',
    note: '#deviation',
    on_air: true,
    submit_a_request: true,
  };

  describe('convertToFMStation', () => {
    it('converts database row correctly', () => {
      const result = convertToFMStation(mockDbRow as never);
      expect(result.id).toBe(42);
      expect(result.name).toBe('Test Station');
      expect(result.frequency).toBe(98.5);
      expect(result.latitude).toBe(13.75);
      expect(result.longitude).toBe(100.5);
      expect(result.city).toBe('Bangkok Noi');
      expect(result.state).toBe('Bangkok');
      expect(result.genre).toBe('FM');
      expect(result.inspection68).toBe('ตรวจแล้ว');
      expect(result.inspection69).toBe('ยังไม่ตรวจ');
      expect(result.onAir).toBe(true);
      expect(result.submitRequest).toBe('ยื่น');
      expect(result.details).toBe('#deviation');
      expect(result.dateInspected).toBe('2026-01-15');
    });

    it('handles null/empty fields', () => {
      const row = {
        id_fm: 1,
        name: null,
        freq: null,
        lat: null,
        long: null,
        district: null,
        province: null,
        type: null,
        inspection_68: false,
        inspection_69: false,
        date_inspected: null,
        note: null,
        on_air: false,
        submit_a_request: false,
      };
      const result = convertToFMStation(row as never);
      expect(result.name).toBe('');
      expect(result.frequency).toBe(0);
      expect(result.genre).toBe('');
      expect(result.inspection68).toBe('ยังไม่ตรวจ');
      expect(result.submitRequest).toBe('ไม่ยื่น');
      expect(result.dateInspected).toBeUndefined();
      expect(result.details).toBeUndefined();
    });
  });

  describe('fetchFMStations', () => {
    it('returns converted stations', async () => {
      mockFmFindMany.mockResolvedValue([mockDbRow]);
      const result = await fetchFMStations();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Station');
      expect(mockFmFindMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    });

    it('throws on database error', async () => {
      mockFmFindMany.mockRejectedValue(new Error('DB error'));
      await expect(fetchFMStations()).rejects.toThrow('DB error');
    });
  });

  describe('fetchFMStationById', () => {
    it('returns station when found', async () => {
      mockFmFindUnique.mockResolvedValue(mockDbRow);
      const result = await fetchFMStationById(42);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(42);
    });

    it('returns null when not found', async () => {
      mockFmFindUnique.mockResolvedValue(null);
      const result = await fetchFMStationById(999);
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockFmFindUnique.mockRejectedValue(new Error('DB error'));
      const result = await fetchFMStationById(42);
      expect(result).toBeNull();
    });
  });

  describe('updateFMStation', () => {
    it('updates and returns converted station', async () => {
      mockFmUpdate.mockResolvedValue(mockDbRow);
      const result = await updateFMStation(42, { on_air: false } as never);
      expect(result.id).toBe(42);
      expect(mockFmUpdate).toHaveBeenCalledWith({
        where: { id_fm: 42 },
        data: { on_air: false },
      });
    });

    it('throws on error', async () => {
      mockFmUpdate.mockRejectedValue(new Error('Update failed'));
      await expect(updateFMStation(42, {} as never)).rejects.toThrow('Update failed');
    });
  });

  describe('groupStationsByCoordinates', () => {
    it('groups stations at same coordinates', () => {
      const stations = [
        { id: '1', name: 'A', frequency: 88, latitude: 13.75, longitude: 100.5, city: 'BKK', state: 'BKK', genre: 'FM' },
        { id: '2', name: 'B', frequency: 99, latitude: 13.75, longitude: 100.5, city: 'BKK', state: 'BKK', genre: 'FM' },
        { id: '3', name: 'C', frequency: 101, latitude: 14.0, longitude: 101.0, city: 'CNX', state: 'CNX', genre: 'FM' },
      ];
      const groups = groupStationsByCoordinates(stations as never);
      expect(groups.size).toBe(2);
      expect(groups.get('13.75,100.5')!.length).toBe(2);
      expect(groups.get('14,101')!.length).toBe(1);
    });
  });
});

// ==========================================
// interferenceService
// ==========================================
describe('interferenceService', () => {
  const mockDbRow = {
    id: 1,
    site_code: 'AWN-001',
    site_name: 'Test Site',
    lat: 13.75,
    long: 100.5,
    mc_zone: 'Zone1',
    changwat: 'กรุงเทพ',
    cell_name: 'Cell-A',
    sector_name: 'Sector-1',
    direction: 120,
    avg_ni_carrier: -85.5,
    day_time: -82.0,
    night_time: -88.0,
    source_lat: 13.76,
    source_long: 100.51,
    estimate_distance: 1.5,
    ranking: 'Critical',
    status: 'Active',
    nbtc_area: 'Area1',
    awn_contact: 'Contact1',
    lot: 'Lot1',
    on_site_scan_by: 'Scanner1',
    on_site_scan_date: 'Date1',
    check_realtime: 'Yes',
    source_location_1: 'Loc1',
    source_location_2: 'Loc2',
    camera_model_1: 'Cam1',
    camera_model_2: 'Cam2',
    notes: 'Test notes',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-02'),
  };

  describe('convertToInterferenceSite', () => {
    it('converts database row correctly', () => {
      const result = convertToInterferenceSite(mockDbRow as never);
      expect(result.id).toBe(1);
      expect(result.siteCode).toBe('AWN-001');
      expect(result.siteName).toBe('Test Site');
      expect(result.lat).toBe(13.75);
      expect(result.long).toBe(100.5);
      expect(result.changwat).toBe('กรุงเทพ');
      expect(result.ranking).toBe('Critical');
      expect(result.notes).toBe('Test notes');
    });
  });

  describe('fetchInterferenceSites', () => {
    it('returns sites without filter', async () => {
      mockInterfereFindMany.mockResolvedValue([mockDbRow]);
      const result = await fetchInterferenceSites();
      expect(result).toHaveLength(1);
      expect(result[0].siteCode).toBe('AWN-001');
    });

    it('applies changwat filter', async () => {
      mockInterfereFindMany.mockResolvedValue([]);
      await fetchInterferenceSites({ changwat: 'กรุงเทพ' });
      expect(mockInterfereFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ changwat: 'กรุงเทพ' }),
        })
      );
    });

    it('applies ranking filter', async () => {
      mockInterfereFindMany.mockResolvedValue([]);
      await fetchInterferenceSites({ ranking: 'Critical' });
      expect(mockInterfereFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ranking: 'Critical' }),
        })
      );
    });

    it('applies mcZone filter', async () => {
      mockInterfereFindMany.mockResolvedValue([]);
      await fetchInterferenceSites({ mcZone: 'Zone1' });
      expect(mockInterfereFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ mc_zone: 'Zone1' }),
        })
      );
    });

    it('applies nbtcArea filter', async () => {
      mockInterfereFindMany.mockResolvedValue([]);
      await fetchInterferenceSites({ nbtcArea: 'Area1' });
      expect(mockInterfereFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ nbtc_area: 'Area1' }),
        })
      );
    });

    it('applies hasSource filter', async () => {
      mockInterfereFindMany.mockResolvedValue([]);
      await fetchInterferenceSites({ hasSource: true });
      expect(mockInterfereFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            source_lat: { not: null },
            source_long: { not: null },
          }),
        })
      );
    });

    it('applies search filter', async () => {
      mockInterfereFindMany.mockResolvedValue([]);
      await fetchInterferenceSites({ search: 'test' });
      expect(mockInterfereFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({ site_name: { contains: 'test', mode: 'insensitive' } }),
                ]),
              }),
            ]),
          }),
        })
      );
    });

    it('applies status filter for inspected sites', async () => {
      mockInterfereFindMany.mockResolvedValue([]);
      await fetchInterferenceSites({ status: 'ตรวจแล้ว' });
      expect(mockInterfereFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ตรวจแล้ว',
          }),
        })
      );
    });

    it('applies status filter for non-inspected sites including nulls', async () => {
      mockInterfereFindMany.mockResolvedValue([]);
      await fetchInterferenceSites({ status: 'ยังไม่ตรวจ' });
      expect(mockInterfereFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  { status: null },
                  { status: { not: 'ตรวจแล้ว' } },
                ]),
              }),
            ]),
          }),
        })
      );
    });

    it('combines search and status filters using AND', async () => {
      mockInterfereFindMany.mockResolvedValue([]);
      await fetchInterferenceSites({ search: 'test', status: 'ยังไม่ตรวจ' });
      const call = mockInterfereFindMany.mock.calls[0][0];
      expect(call.where.AND).toHaveLength(2);
      // First AND entry: search OR
      expect(call.where.AND[0].OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ site_name: { contains: 'test', mode: 'insensitive' } }),
        ])
      );
      // Second AND entry: status OR (null + not inspected)
      expect(call.where.AND[1].OR).toEqual(
        expect.arrayContaining([{ status: null }, { status: { not: 'ตรวจแล้ว' } }])
      );
    });

    it('applies noise range filter', async () => {
      mockInterfereFindMany.mockResolvedValue([]);
      await fetchInterferenceSites({ noiseMin: -90, noiseMax: -80 });
      expect(mockInterfereFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            avg_ni_carrier: { gte: -90, lte: -80 },
          }),
        })
      );
    });
  });

  describe('fetchInterferenceSiteById', () => {
    it('returns site when found', async () => {
      mockInterfereFindUnique.mockResolvedValue(mockDbRow);
      const result = await fetchInterferenceSiteById(1);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
    });

    it('returns null when not found', async () => {
      mockInterfereFindUnique.mockResolvedValue(null);
      const result = await fetchInterferenceSiteById(999);
      expect(result).toBeNull();
    });
  });

  describe('getDistinctChangwats', () => {
    it('returns distinct changwats', async () => {
      mockInterfereFindMany.mockResolvedValue([
        { changwat: 'กรุงเทพ' },
        { changwat: 'เชียงใหม่' },
      ]);
      const result = await getDistinctChangwats();
      expect(result).toEqual(['กรุงเทพ', 'เชียงใหม่']);
    });
  });

  describe('getDistinctRankings', () => {
    it('returns distinct rankings', async () => {
      mockInterfereFindMany.mockResolvedValue([
        { ranking: 'Critical' },
        { ranking: 'Major' },
      ]);
      const result = await getDistinctRankings();
      expect(result).toEqual(['Critical', 'Major']);
    });
  });

  describe('getDistinctMcZones', () => {
    it('returns distinct mc zones', async () => {
      mockInterfereFindMany.mockResolvedValue([
        { mc_zone: 'Zone1' },
        { mc_zone: 'Zone2' },
      ]);
      const result = await getDistinctMcZones();
      expect(result).toEqual(['Zone1', 'Zone2']);
    });
  });

  describe('getDistinctNbtcAreas', () => {
    it('returns distinct nbtc areas', async () => {
      mockInterfereFindMany.mockResolvedValue([
        { nbtc_area: 'Area1' },
        { nbtc_area: 'Area2' },
      ]);
      const result = await getDistinctNbtcAreas();
      expect(result).toEqual(['Area1', 'Area2']);
    });
  });
});
