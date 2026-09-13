import { describe, it, expect } from 'vitest';
import { convertToFMStation } from '@/services/stationService';

// Mock Prisma row type
function makeDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id_fm: 1,
    name: 'Test FM',
    freq: 98.5,
    lat: 13.75,
    long: 100.5,
    district: 'Bangna',
    province: 'Bangkok',
    type: ' สถานีหลัก ',
    note: 'Test note',
    on_air: true,
    submit_a_request: true,
    inspection_68: true,
    inspection_69: false,
    date_inspected: '2024-01-01',
    revoked: false,
    revoked_note: null,
    permit: null,
    nbtc_code: null,
    source: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  } as Parameters<typeof convertToFMStation>[0];
}

describe('convertToFMStation', () => {
  it('maps id_fm to id', () => {
    const result = convertToFMStation(makeDbRow({ id_fm: 42 }));
    expect(result.id).toBe(42);
  });

  it('maps freq to frequency', () => {
    const result = convertToFMStation(makeDbRow({ freq: 101.5 }));
    expect(result.frequency).toBe(101.5);
  });

  it('maps lat/long to latitude/longitude', () => {
    const result = convertToFMStation(makeDbRow({ lat: 14.0, long: 101.0 }));
    expect(result.latitude).toBe(14.0);
    expect(result.longitude).toBe(101.0);
  });

  it('maps district to city and province to state', () => {
    const result = convertToFMStation(makeDbRow({ district: 'Sathorn', province: 'BKK' }));
    expect(result.city).toBe('Sathorn');
    expect(result.state).toBe('BKK');
  });

  it('trims type field', () => {
    const result = convertToFMStation(makeDbRow({ type: ' สถานีหลัก ' }));
    expect(result.genre).toBe('สถานีหลัก');
    expect(result.type).toBe('สถานีหลัก');
  });

  it('maps inspection booleans to Thai strings', () => {
    const inspected = convertToFMStation(makeDbRow({ inspection_68: true, inspection_69: true }));
    expect(inspected.inspection68).toBe('ตรวจแล้ว');
    expect(inspected.inspection69).toBe('ตรวจแล้ว');

    const notInspected = convertToFMStation(makeDbRow({ inspection_68: false, inspection_69: false }));
    expect(notInspected.inspection68).toBe('ยังไม่ตรวจ');
    expect(notInspected.inspection69).toBe('ยังไม่ตรวจ');
  });

  it('maps submit_a_request to Thai strings', () => {
    const submitted = convertToFMStation(makeDbRow({ submit_a_request: true }));
    expect(submitted.submitRequest).toBe('ยื่น');

    const notSubmitted = convertToFMStation(makeDbRow({ submit_a_request: false }));
    expect(notSubmitted.submitRequest).toBe('ไม่ยื่น');
  });

  it('maps on_air correctly', () => {
    expect(convertToFMStation(makeDbRow({ on_air: true })).onAir).toBe(true);
    expect(convertToFMStation(makeDbRow({ on_air: false })).onAir).toBe(false);
  });

  it('maps note to details', () => {
    const result = convertToFMStation(makeDbRow({ note: 'Some note' }));
    expect(result.details).toBe('Some note');
  });

  it('handles null name', () => {
    const result = convertToFMStation(makeDbRow({ name: null }));
    expect(result.name).toBe('');
  });

  it('handles null freq', () => {
    const result = convertToFMStation(makeDbRow({ freq: null }));
    expect(result.frequency).toBe(0);
  });

  it('returns NaN for null lat/long so map filters skip the row', () => {
    const result = convertToFMStation(makeDbRow({ lat: null, long: null }));
    expect(Number.isNaN(result.latitude)).toBe(true);
    expect(Number.isNaN(result.longitude)).toBe(true);
  });

  it('handles null type', () => {
    const result = convertToFMStation(makeDbRow({ type: null }));
    expect(result.genre).toBe('');
    expect(result.type).toBe('');
  });

  it('handles null note', () => {
    const result = convertToFMStation(makeDbRow({ note: null }));
    expect(result.details).toBeUndefined();
  });

  it('handles null date_inspected', () => {
    const result = convertToFMStation(makeDbRow({ date_inspected: null }));
    expect(result.dateInspected).toBeUndefined();
  });

  it('builds description from type and location', () => {
    const result = convertToFMStation(makeDbRow({ type: 'FM', district: 'Sathorn', province: 'Bangkok' }));
    expect(result.description).toBe('FM radio station in Sathorn, Bangkok');
  });

  it('maps row.permit to FMStation.permit', () => {
    const result = convertToFMStation(makeDbRow({ permit: 'ห้างหุ้นส่วนจำกัด ABC' }));
    expect(result.permit).toBe('ห้างหุ้นส่วนจำกัด ABC');
  });

  it('returns undefined permit when row.permit is null', () => {
    const result = convertToFMStation(makeDbRow({ permit: null }));
    expect(result.permit).toBeUndefined();
  });
});
