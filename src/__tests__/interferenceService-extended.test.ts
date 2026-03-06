import { describe, it, expect } from 'vitest';
import { convertToInterferenceSite } from '@/services/interferenceService';

describe('convertToInterferenceSite edge cases', () => {
  const baseRow = {
    id: 99,
    site_code: null,
    site_name: null,
    lat: null,
    long: null,
    mc_zone: null,
    changwat: null,
    cell_name: null,
    sector_name: null,
    direction: null,
    avg_ni_carrier: null,
    day_time: null,
    night_time: null,
    source_lat: null,
    source_long: null,
    estimate_distance: null,
    ranking: null,
    status: null,
    nbtc_area: null,
    awn_contact: null,
    lot: null,
    on_site_scan_by: null,
    on_site_scan_date: null,
    check_realtime: null,
    source_location_1: null,
    source_location_2: null,
    camera_model_1: null,
    camera_model_2: null,
    notes: null,
    created_at: new Date('2025-06-01'),
    updated_at: new Date('2025-06-02'),
  };

  it('handles all-null fields gracefully', () => {
    const result = convertToInterferenceSite(baseRow as Parameters<typeof convertToInterferenceSite>[0]);
    expect(result.id).toBe(99);
    expect(result.siteCode).toBeNull();
    expect(result.siteName).toBeNull();
    expect(result.lat).toBeNull();
    expect(result.long).toBeNull();
    expect(result.direction).toBeNull();
    expect(result.avgNiCarrier).toBeNull();
    expect(result.sourceLat).toBeNull();
    expect(result.sourceLong).toBeNull();
    expect(result.ranking).toBeNull();
  });

  it('preserves Date objects for createdAt/updatedAt', () => {
    const result = convertToInterferenceSite(baseRow as Parameters<typeof convertToInterferenceSite>[0]);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe('2025-06-01T00:00:00.000Z');
  });

  it('handles zero numeric values correctly', () => {
    const zeroRow = {
      ...baseRow,
      lat: 0,
      long: 0,
      direction: 0,
      avg_ni_carrier: 0,
      estimate_distance: 0,
    };
    const result = convertToInterferenceSite(zeroRow as Parameters<typeof convertToInterferenceSite>[0]);
    expect(result.lat).toBe(0);
    expect(result.long).toBe(0);
    expect(result.direction).toBe(0);
    expect(result.avgNiCarrier).toBe(0);
    expect(result.estimateDistance).toBe(0);
  });

  it('handles Thai text in string fields', () => {
    const thaiRow = {
      ...baseRow,
      site_name: 'สี่แยกตลาดใหม่พิมาย',
      changwat: 'นครราชสีมา',
      source_location_1: 'บ้านเลขที่ 444 หมู่ 1',
    };
    const result = convertToInterferenceSite(thaiRow as Parameters<typeof convertToInterferenceSite>[0]);
    expect(result.siteName).toBe('สี่แยกตลาดใหม่พิมาย');
    expect(result.changwat).toBe('นครราชสีมา');
    expect(result.sourceLocation1).toBe('บ้านเลขที่ 444 หมู่ 1');
  });

  it('maps negative dBm values correctly', () => {
    const noiseRow = {
      ...baseRow,
      avg_ni_carrier: -98.5,
      day_time: -95.2,
      night_time: -101.8,
    };
    const result = convertToInterferenceSite(noiseRow as Parameters<typeof convertToInterferenceSite>[0]);
    expect(result.avgNiCarrier).toBe(-98.5);
    expect(result.dayTime).toBe(-95.2);
    expect(result.nightTime).toBe(-101.8);
  });
});
