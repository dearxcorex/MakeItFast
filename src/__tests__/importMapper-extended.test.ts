import { describe, it, expect } from 'vitest';
import { mapCsvRowToRecord } from '@/utils/importMapper';

describe('mapCsvRowToRecord - distance conversion', () => {
  it('converts 50.09 meters to 0.05009 km', () => {
    const row = { 'Estimate Distance (m.)': 50.09 };
    const result = mapCsvRowToRecord(row);
    expect(result.estimate_distance).toBeCloseTo(0.05009, 5);
  });

  it('converts 1000 meters to 1 km', () => {
    const row = { 'Estimate Distance (m.)': 1000 };
    const result = mapCsvRowToRecord(row);
    expect(result.estimate_distance).toBe(1);
  });

  it('converts string distance value', () => {
    const row = { 'Estimate Distance (m.)': '250.5' };
    const result = mapCsvRowToRecord(row);
    expect(result.estimate_distance).toBeCloseTo(0.2505, 4);
  });
});

describe('mapCsvRowToRecord - fallback column names', () => {
  it('accepts alternative column name formats (Site Code)', () => {
    const row = { 'Site Code': 'ALT01' };
    const result = mapCsvRowToRecord(row);
    expect(result.site_code).toBe('ALT01');
  });

  it('accepts snake_case column names', () => {
    const row = { site_code: 'SNAKE', site_name: 'Snake Name' };
    const result = mapCsvRowToRecord(row);
    expect(result.site_code).toBe('SNAKE');
    expect(result.site_name).toBe('Snake Name');
  });

  it('prefers actual CSV column names over fallbacks', () => {
    const row = { 'Site': 'PRIMARY', 'Site Code': 'FALLBACK' };
    const result = mapCsvRowToRecord(row);
    expect(result.site_code).toBe('PRIMARY');
  });
});

describe('mapCsvRowToRecord - numeric edge cases', () => {
  it('handles NaN string values as null', () => {
    const row = { 'Lat': 'not-a-number', 'Direction': 'N/A' };
    const result = mapCsvRowToRecord(row);
    expect(result.lat).toBeNull();
    expect(result.direction).toBeNull();
  });

  it('handles negative coordinates', () => {
    const row = { 'Lat': -14.5, 'Long': -103.2 };
    const result = mapCsvRowToRecord(row);
    expect(result.lat).toBe(-14.5);
    expect(result.long).toBe(-103.2);
  });

  it('handles negative noise values', () => {
    const row = { 'Average NI of Carrier': -98.5, 'Day time': -95, 'Night time': -101 };
    const result = mapCsvRowToRecord(row);
    expect(result.avg_ni_carrier).toBe(-98.5);
    expect(result.day_time).toBe(-95);
    expect(result.night_time).toBe(-101);
  });
});

describe('mapCsvRowToRecord - string sanitization', () => {
  it('converts non-string values to strings', () => {
    const row = { 'Site': 12345, 'Ranking': true };
    const result = mapCsvRowToRecord(row);
    expect(result.site_code).toBe('12345');
    expect(result.ranking).toBe('true');
  });

  it('preserves whitespace in string values', () => {
    const row = { 'Site name': '  Spaced Name  ' };
    const result = mapCsvRowToRecord(row);
    expect(result.site_name).toBe('  Spaced Name  ');
  });
});
