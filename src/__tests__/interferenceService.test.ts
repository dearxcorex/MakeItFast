import { describe, it, expect } from 'vitest';
import { convertToInterferenceSite } from '@/services/interferenceService';

describe('convertToInterferenceSite', () => {
  const mockRow = {
    id: 1,
    site_code: 'CCSDM',
    site_name: 'ชุมชนศรีดอกจาน',
    lat: 14.87862,
    long: 103.4815,
    mc_zone: 'SRN',
    changwat: 'สุรินทร์',
    cell_name: 'CCSDMN2613',
    sector_name: 'CCSDM_3',
    direction: 120,
    avg_ni_carrier: -79.04,
    day_time: -77,
    night_time: -79.29,
    source_lat: 14.878764,
    source_long: 103.481064,
    estimate_distance: 0.05009,
    ranking: 'Critical',
    status: 'High interference',
    nbtc_area: 'NBTC-22',
    awn_contact: 'ฝน 0632381515',
    lot: 'Oct-25',
    on_site_scan_by: 'NBTC',
    on_site_scan_date: '14/11/2025',
    check_realtime: 'Clear by NBTC',
    source_location_1: 'ร้านค้า',
    source_location_2: null,
    camera_model_1: 'Hikvision',
    camera_model_2: null,
    notes: 'test note',
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-02'),
  };

  it('maps all snake_case fields to camelCase', () => {
    // Cast to satisfy the Prisma type requirement
    const result = convertToInterferenceSite(mockRow as Parameters<typeof convertToInterferenceSite>[0]);

    expect(result.id).toBe(1);
    expect(result.siteCode).toBe('CCSDM');
    expect(result.siteName).toBe('ชุมชนศรีดอกจาน');
    expect(result.lat).toBe(14.87862);
    expect(result.long).toBe(103.4815);
    expect(result.mcZone).toBe('SRN');
    expect(result.changwat).toBe('สุรินทร์');
    expect(result.cellName).toBe('CCSDMN2613');
    expect(result.sectorName).toBe('CCSDM_3');
    expect(result.direction).toBe(120);
    expect(result.avgNiCarrier).toBe(-79.04);
    expect(result.dayTime).toBe(-77);
    expect(result.nightTime).toBe(-79.29);
    expect(result.sourceLat).toBe(14.878764);
    expect(result.sourceLong).toBe(103.481064);
    expect(result.estimateDistance).toBeCloseTo(0.05009);
    expect(result.ranking).toBe('Critical');
    expect(result.status).toBe('High interference');
    expect(result.nbtcArea).toBe('NBTC-22');
    expect(result.awnContact).toBe('ฝน 0632381515');
    expect(result.lot).toBe('Oct-25');
    expect(result.onSiteScanBy).toBe('NBTC');
    expect(result.onSiteScanDate).toBe('14/11/2025');
    expect(result.checkRealtime).toBe('Clear by NBTC');
    expect(result.sourceLocation1).toBe('ร้านค้า');
    expect(result.sourceLocation2).toBeNull();
    expect(result.cameraModel1).toBe('Hikvision');
    expect(result.cameraModel2).toBeNull();
    expect(result.notes).toBe('test note');
  });
});
