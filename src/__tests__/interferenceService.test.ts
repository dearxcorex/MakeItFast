import { describe, it, expect } from 'vitest';
import { convertToInterferenceSite } from '@/services/interferenceService';

describe('convertToInterferenceSite', () => {
  const mockRow = {
    id: 1,
    site_code: 'CCSDM',
    site_name: 'ชุมชนศรีดอกจาน',
    lat: 14.87862,
    long: 103.4815,
    changwat: 'สุรินทร์',
    cell_name: 'CCSDMN2613',
    sector_name: 'CCSDM_3',
    direction: 120,
    avg_ni_carrier: -79.04,
    source_lat: 14.878764,
    source_long: 103.481064,
    estimate_distance: 0.05009,
    ranking: 'Critical',
    status: 'High interference',
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
    expect(result.changwat).toBe('สุรินทร์');
    expect(result.cellName).toBe('CCSDMN2613');
    expect(result.sectorName).toBe('CCSDM_3');
    expect(result.direction).toBe(120);
    expect(result.avgNiCarrier).toBe(-79.04);
    expect(result.sourceLat).toBe(14.878764);
    expect(result.sourceLong).toBe(103.481064);
    expect(result.estimateDistance).toBeCloseTo(0.05009);
    expect(result.ranking).toBe('Critical');
    expect(result.status).toBe('High interference');
  });
});
