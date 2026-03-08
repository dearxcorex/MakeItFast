import { describe, it, expect } from 'vitest';
import { convertToInterferenceSite } from '@/services/interferenceService';

function makeDbRow(overrides: Record<string, unknown> = {}) {
  return {
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
    day_time: 'Day',
    night_time: 'Night',
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
    source_location_1: 'Location1',
    source_location_2: 'Location2',
    camera_model_1: 'Cam1',
    camera_model_2: 'Cam2',
    notes: 'Test notes',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-06-01'),
    ...overrides,
  } as Parameters<typeof convertToInterferenceSite>[0];
}

describe('convertToInterferenceSite', () => {
  it('maps all fields correctly', () => {
    const result = convertToInterferenceSite(makeDbRow());
    expect(result.id).toBe(1);
    expect(result.siteCode).toBe('AWN-001');
    expect(result.siteName).toBe('Test Site');
    expect(result.lat).toBe(13.75);
    expect(result.long).toBe(100.5);
    expect(result.mcZone).toBe('Zone1');
    expect(result.changwat).toBe('กรุงเทพ');
    expect(result.cellName).toBe('Cell-A');
    expect(result.sectorName).toBe('Sector-1');
    expect(result.direction).toBe(120);
    expect(result.avgNiCarrier).toBe(-85.5);
    expect(result.dayTime).toBe('Day');
    expect(result.nightTime).toBe('Night');
    expect(result.sourceLat).toBe(13.76);
    expect(result.sourceLong).toBe(100.51);
    expect(result.estimateDistance).toBe(1.5);
    expect(result.ranking).toBe('Critical');
    expect(result.status).toBe('Active');
    expect(result.nbtcArea).toBe('Area1');
    expect(result.awnContact).toBe('Contact1');
    expect(result.lot).toBe('Lot1');
    expect(result.onSiteScanBy).toBe('Scanner1');
    expect(result.onSiteScanDate).toBe('Date1');
    expect(result.checkRealtime).toBe('Yes');
    expect(result.sourceLocation1).toBe('Location1');
    expect(result.sourceLocation2).toBe('Location2');
    expect(result.cameraModel1).toBe('Cam1');
    expect(result.cameraModel2).toBe('Cam2');
    expect(result.notes).toBe('Test notes');
  });

  it('handles null fields', () => {
    const result = convertToInterferenceSite(
      makeDbRow({
        site_code: null,
        site_name: null,
        lat: null,
        long: null,
        source_lat: null,
        source_long: null,
        ranking: null,
        notes: null,
        changwat: null,
      })
    );
    expect(result.siteCode).toBeNull();
    expect(result.siteName).toBeNull();
    expect(result.lat).toBeNull();
    expect(result.long).toBeNull();
    expect(result.sourceLat).toBeNull();
    expect(result.sourceLong).toBeNull();
    expect(result.ranking).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.changwat).toBeNull();
  });

  it('preserves date objects', () => {
    const result = convertToInterferenceSite(makeDbRow());
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });
});
