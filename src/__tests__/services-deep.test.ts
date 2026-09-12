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
  fetchFMStationById,
} from '@/services/stationService';

import {
  convertToInterferenceSite,
  fetchInterferenceSiteById,
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

});
