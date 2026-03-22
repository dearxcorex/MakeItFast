import { describe, it, expect } from 'vitest';
import { mapCsvRowToRecord } from '@/utils/importMapper';

describe('mapCsvRowToRecord', () => {
  // Mock row with actual CSV column names from the 2600 AWN spreadsheet
  const csvRow = {
    'Site': 'CCSDM',
    'Site name': 'ชุมชนศรีดอกจาน',
    'Lat': 14.87862,
    'Long': 103.4815,
    'MC_ZONE': 'SRN',
    'CHANGWAT': 'สุรินทร์',
    'Cell Name': 'CCSDMN2613',
    'Sector name': 'CCSDM_3',
    'Direction': 120,
    'Average NI of Carrier': -79.04,
    'Day time': -77,
    'Night time': -79.29,
    'Latitude source': 14.878764,
    'Longitude source': 103.481064,
    'Estimate Distance (m.)': 50.09,
    'Ranking': 'Critical',
    'Status': 'High interference',
    'NBTC Area': 'NBTC-22',
    'AWN Contact': 'ฝน 0632381515',
    'Lot': 'Oct-25',
    'On Site scan by': 'NBTC',
    'On Site SCAN Date': '14/11/2025',
    'Check Real time': 'Clear by NBTC',
    'สถานที่เจอ # 1': 'ร้านค้าข้างสถานี',
    'สถานที่เจอ # 2': 'อาคารพาณิชย์',
    'Camera Model # 1': 'Hikvision DS-2CD2143',
    'Camera Model #2': 'Dahua IPC-HFW2431',
    'หมายเหตุ': 'ตรวจสอบแล้ว',
  };

  it('maps Site to site_code', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.site_code).toBe('CCSDM');
  });

  it('maps Site name to site_name', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.site_name).toBe('ชุมชนศรีดอกจาน');
  });

  it('maps Lat/Long correctly', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.lat).toBe(14.87862);
    expect(result.long).toBe(103.4815);
  });

  it('maps MC_ZONE to mc_zone', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.mc_zone).toBe('SRN');
  });

  it('maps CHANGWAT to changwat', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.changwat).toBe('สุรินทร์');
  });

  it('maps Sector name to sector_name', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.sector_name).toBe('CCSDM_3');
  });

  it('maps Average NI of Carrier to avg_ni_carrier as float', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.avg_ni_carrier).toBe(-79.04);
  });

  it('maps Day time / Night time to floats', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.day_time).toBe(-77);
    expect(result.night_time).toBe(-79.29);
  });

  it('maps Latitude source / Longitude source to source_lat / source_long', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.source_lat).toBe(14.878764);
    expect(result.source_long).toBe(103.481064);
  });

  it('converts Estimate Distance from meters to km', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.estimate_distance).toBeCloseTo(0.05009, 5);
  });

  it('maps On Site scan by correctly', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.on_site_scan_by).toBe('NBTC');
  });

  it('maps On Site SCAN Date correctly', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.on_site_scan_date).toBe('14/11/2025');
  });

  it('maps Check Real time to check_realtime', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.check_realtime).toBe('Clear by NBTC');
  });

  it('maps Thai column สถานที่เจอ # 1 to source_location_1', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.source_location_1).toBe('ร้านค้าข้างสถานี');
  });

  it('maps Thai column สถานที่เจอ # 2 to source_location_2', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.source_location_2).toBe('อาคารพาณิชย์');
  });

  it('maps Camera Model # 1 and Camera Model #2', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.camera_model_1).toBe('Hikvision DS-2CD2143');
    expect(result.camera_model_2).toBe('Dahua IPC-HFW2431');
  });

  it('maps หมายเหตุ to notes', () => {
    const result = mapCsvRowToRecord(csvRow);
    expect(result.notes).toBe('ตรวจสอบแล้ว');
  });

  it('handles empty/missing values as null', () => {
    const emptyRow = { 'Site': '', 'Lat': '', 'Direction': '' };
    const result = mapCsvRowToRecord(emptyRow);
    expect(result.site_code).toBeNull();
    expect(result.lat).toBeNull();
    expect(result.direction).toBeNull();
  });

  it('handles zero values correctly (does not map 0 to null)', () => {
    const zeroRow = { 'Lat': 0, 'Long': 0, 'Direction': 0 };
    const result = mapCsvRowToRecord(zeroRow);
    expect(result.lat).toBe(0);
    expect(result.long).toBe(0);
    expect(result.direction).toBe(0);
  });

  it('handles Estimate Distance of 0 meters correctly', () => {
    const zeroDistRow = { 'Estimate Distance (m.)': 0 };
    const result = mapCsvRowToRecord(zeroDistRow);
    expect(result.estimate_distance).toBe(0);
  });

  it('handles completely empty row gracefully', () => {
    const result = mapCsvRowToRecord({});
    expect(result.site_code).toBeNull();
    expect(result.site_name).toBeNull();
    expect(result.lat).toBeNull();
    expect(result.long).toBeNull();
    expect(result.ranking).toBeNull();
    expect(result.estimate_distance).toBeNull();
  });
});
