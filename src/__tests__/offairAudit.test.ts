import { describe, it, expect } from 'vitest';
import {
  TARGET_PROVINCES,
  parseXlsxRows,
  filterByProvinces,
  buildAuditRecords,
  type RawXlsxRow,
  type DbStationRow,
} from '@/utils/offairAudit';

describe('TARGET_PROVINCES', () => {
  it('contains the three Northeast provinces', () => {
    expect(TARGET_PROVINCES).toEqual(['นครราชสีมา', 'ชัยภูมิ', 'บุรีรัมย์']);
  });
});

describe('parseXlsxRows', () => {
  it('parses station code "05520117" to numeric id 5520117', () => {
    const rows: RawXlsxRow[] = [{
      'ลำดับ': 1,
      'รหัสสถานี': '05520117',
      'ชื่อสถานี': 'เสียงชนเสรี',
      'ประเภท': 'ธุรกิจ',
      'คลื่นความถี่เดิม': 106,
      'จังหวัด': 'นครราชสีมา',
      'เขต/อำเภอ': 'คง',
      'ผู้ทดลองออกอากาศเดิม': 'ห้างหุ้นส่วนจำกัด เสียงชนเสรี',
      'หมายเหตุ': ' ',
    }];
    const parsed = parseXlsxRows(rows);
    expect(parsed).toEqual([{
      idFm: 5520117,
      stationCodeRaw: '05520117',
      name: 'เสียงชนเสรี',
      province: 'นครราชสีมา',
      district: 'คง',
      freq: 106,
      type: 'ธุรกิจ',
      note: ' ',
    }]);
  });

  it('skips rows with no station code or non-numeric code', () => {
    const rows: RawXlsxRow[] = [
      { 'ลำดับ': 1, 'รหัสสถานี': null, 'ชื่อสถานี': 'X', 'ประเภท': '', 'คลื่นความถี่เดิม': 0, 'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
      { 'ลำดับ': 2, 'รหัสสถานี': 'ABC', 'ชื่อสถานี': 'Y', 'ประเภท': '', 'คลื่นความถี่เดิม': 0, 'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
      { 'ลำดับ': 3, 'รหัสสถานี': '05520117', 'ชื่อสถานี': 'OK', 'ประเภท': '', 'คลื่นความถี่เดิม': 88, 'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
    ];
    const parsed = parseXlsxRows(rows);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].idFm).toBe(5520117);
  });

  it('accepts numeric station code (some xlsx cells are numbers, not strings)', () => {
    const rows: RawXlsxRow[] = [{
      'ลำดับ': 1, 'รหัสสถานี': 5520117 as unknown as string,
      'ชื่อสถานี': 'X', 'ประเภท': '', 'คลื่นความถี่เดิม': 0,
      'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '',
    }];
    expect(parseXlsxRows(rows)[0].idFm).toBe(5520117);
  });
});

describe('filterByProvinces', () => {
  it('keeps only rows whose province is in the target set', () => {
    const parsed = parseXlsxRows([
      { 'ลำดับ': 1, 'รหัสสถานี': '05520001', 'ชื่อสถานี': 'A', 'ประเภท': '', 'คลื่นความถี่เดิม': 88, 'จังหวัด': 'กระบี่', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
      { 'ลำดับ': 2, 'รหัสสถานี': '05520002', 'ชื่อสถานี': 'B', 'ประเภท': '', 'คลื่นความถี่เดิม': 89, 'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
      { 'ลำดับ': 3, 'รหัสสถานี': '05520003', 'ชื่อสถานี': 'C', 'ประเภท': '', 'คลื่นความถี่เดิม': 90, 'จังหวัด': 'ชัยภูมิ',   'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
      { 'ลำดับ': 4, 'รหัสสถานี': '05520004', 'ชื่อสถานี': 'D', 'ประเภท': '', 'คลื่นความถี่เดิม': 91, 'จังหวัด': 'บุรีรัมย์', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
    ]);
    const out = filterByProvinces(parsed, TARGET_PROVINCES);
    expect(out.map((r) => r.province)).toEqual(['นครราชสีมา', 'ชัยภูมิ', 'บุรีรัมย์']);
  });
});

describe('buildAuditRecords', () => {
  const xlsxRows = parseXlsxRows([
    { 'ลำดับ': 1, 'รหัสสถานี': '05520117', 'ชื่อสถานี': 'เสียงชนเสรี',  'ประเภท': '', 'คลื่นความถี่เดิม': 106,  'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': 'คง', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
    { 'ลำดับ': 2, 'รหัสสถานี': '05520154', 'ชื่อสถานี': 'วัดบ้านหมัน', 'ประเภท': '', 'คลื่นความถี่เดิม': 88.25, 'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': 'คง', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
    { 'ลำดับ': 3, 'รหัสสถานี': '05520999', 'ชื่อสถานี': 'GHOST',         'ประเภท': '', 'คลื่นความถี่เดิม': 99,    'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': 'X', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
  ]);

  const dbRows: DbStationRow[] = [
    { id_fm: 5520117, name: 'เสียงชนเสรี',  province: 'นครราชสีมา', district: 'คง', freq: 106,    on_air: true  },
    { id_fm: 5520154, name: 'วัดบ้านหมัน', province: 'นครราชสีมา', district: 'คง', freq: 88.25, on_air: false },
  ];

  const records = buildAuditRecords(xlsxRows, dbRows);

  it('flags an on_air=true match as STILL_ON_AIR', () => {
    const r = records.find((x) => x.idFm === 5520117)!;
    expect(r.classification).toBe('STILL_ON_AIR');
    expect(r.dbOnAir).toBe(true);
    expect(r.foundInDb).toBe(true);
  });

  it('flags an on_air=false match as ALREADY_OFF_AIR', () => {
    const r = records.find((x) => x.idFm === 5520154)!;
    expect(r.classification).toBe('ALREADY_OFF_AIR');
    expect(r.dbOnAir).toBe(false);
  });

  it('flags an xlsx row with no DB row as MISSING_IN_DB', () => {
    const r = records.find((x) => x.idFm === 5520999)!;
    expect(r.classification).toBe('MISSING_IN_DB');
    expect(r.foundInDb).toBe(false);
    expect(r.dbOnAir).toBeNull();
  });

  it('returns one record per xlsx row, in input order', () => {
    expect(records.map((r) => r.idFm)).toEqual([5520117, 5520154, 5520999]);
  });

  it('warns when DB province/name disagrees with xlsx for the same id_fm', () => {
    const xlsx = parseXlsxRows([
      { 'ลำดับ': 1, 'รหัสสถานี': '05520117', 'ชื่อสถานี': 'A', 'ประเภท': '', 'คลื่นความถี่เดิม': 100, 'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
    ]);
    const db: DbStationRow[] = [
      { id_fm: 5520117, name: 'B-DIFFERENT', province: 'ขอนแก่น', district: '', freq: 100, on_air: true },
    ];
    const r = buildAuditRecords(xlsx, db)[0];
    expect(r.warnings).toContain('province-mismatch');
    expect(r.warnings).toContain('name-mismatch');
  });
});
