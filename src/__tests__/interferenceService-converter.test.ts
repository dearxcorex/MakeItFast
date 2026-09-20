import { describe, it, expect } from 'vitest';
import { convertToInterferenceSite } from '@/services/interferenceService';

function makeDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    site_code: 'AWN-001',
    site_name: 'Test Site',
    lat: 13.75,
    long: 100.5,
    changwat: 'กรุงเทพ',
    cell_name: 'Cell-A',
    sector_name: 'Sector-1',
    direction: 120,
    avg_ni_carrier: -85.5,
    source_lat: 13.76,
    source_long: 100.51,
    estimate_distance: 1.5,
    ranking: 'Critical',
    status: 'Active',
    law_paper_sent: false,
    updated_at: new Date('2024-06-01'),
    ...overrides,
  } as unknown as Parameters<typeof convertToInterferenceSite>[0];
}

describe('convertToInterferenceSite', () => {
  it('maps all fields correctly', () => {
    const result = convertToInterferenceSite(makeDbRow());
    expect(result.id).toBe(1);
    expect(result.siteCode).toBe('AWN-001');
    expect(result.siteName).toBe('Test Site');
    expect(result.lat).toBe(13.75);
    expect(result.long).toBe(100.5);
    expect(result.changwat).toBe('กรุงเทพ');
    expect(result.cellName).toBe('Cell-A');
    expect(result.sectorName).toBe('Sector-1');
    expect(result.direction).toBe(120);
    expect(result.avgNiCarrier).toBe(-85.5);
    expect(result.sourceLat).toBe(13.76);
    expect(result.sourceLong).toBe(100.51);
    expect(result.estimateDistance).toBe(1.5);
    expect(result.ranking).toBe('Critical');
    expect(result.status).toBe('Active');
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
    expect(result.changwat).toBeNull();
  });

  it('preserves date objects', () => {
    const result = convertToInterferenceSite(makeDbRow());
    expect(result.updatedAt).toBeInstanceOf(Date);
  });
});
