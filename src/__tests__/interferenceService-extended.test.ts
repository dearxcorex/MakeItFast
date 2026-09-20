import { describe, it, expect } from 'vitest';
import { convertToInterferenceSite } from '@/services/interferenceService';

describe('convertToInterferenceSite edge cases', () => {
  const baseRow = {
    id: 99,
    site_code: null,
    site_name: null,
    lat: null,
    long: null,
    changwat: null,
    cell_name: null,
    sector_name: null,
    direction: null,
    avg_ni_carrier: null,
    source_lat: null,
    source_long: null,
    estimate_distance: null,
    ranking: null,
    status: null,
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

  it('preserves the Date object for updatedAt', () => {
    const result = convertToInterferenceSite(baseRow as Parameters<typeof convertToInterferenceSite>[0]);
    expect(result.updatedAt).toBeInstanceOf(Date);
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
    };
    const result = convertToInterferenceSite(thaiRow as Parameters<typeof convertToInterferenceSite>[0]);
    expect(result.siteName).toBe('สี่แยกตลาดใหม่พิมาย');
    expect(result.changwat).toBe('นครราชสีมา');
  });

  it('maps negative dBm values correctly', () => {
    const noiseRow = {
      ...baseRow,
      avg_ni_carrier: -98.5,
    };
    const result = convertToInterferenceSite(noiseRow as Parameters<typeof convertToInterferenceSite>[0]);
    expect(result.avgNiCarrier).toBe(-98.5);
  });
});
