// src/__tests__/inspection-import-xlsx.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseXlsxRows,
  validateRows,
  type XlsxInspectorRow,
} from '../../scripts/import-inspections-xlsx';

const sampleRow: XlsxInspectorRow = {
  ChkID: '52390',
  'วันที่บันทึก': '02/02/2569',
  'วันที่ตรวจสอบ': '28/01/2569',
  'รหัสสถานี': '05520458',
  'ชื่อสถานี': 'แฟมิลี่ เรดิโอ',
  'ความถี่': '93.2500',
  'จังหวัด': 'จ.ชัยภูมิ',
  'อำเภอ': 'อ.เมืองชัยภูมิ',
  'ตำบล': 'ต.ในเมือง',
  'ชื่อผู้ตรวจ (กสทช.) 1': 'นางสาว ปิยาพัชร  เกิดไพบูลย์(เจ้าหน้าที่ตรวจสอบและปฏิบัติการ)',
  'ชื่อผู้ตรวจ (กสทช.) 2': 'นาย ธีราทร  ภิรมย์ไกรภักดิ์(ลูกจ้างประจำ)',
  'ชื่อผู้ตรวจ (กสทช.) 3': '',
  'ชื่อผู้ตรวจ (กสทช.) 4': '',
};

describe('parseXlsxRows', () => {
  it('converts B.E. dates to C.E. and pulls lead + helpers', () => {
    const parsed = parseXlsxRows([sampleRow]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      chkId: '52390',
      stationId: 5520458,
      inspectedOn: '2026-01-28',
      leadName: 'นางสาว ปิยาพัชร เกิดไพบูลย์(เจ้าหน้าที่ตรวจสอบและปฏิบัติการ)',
      helperNames: ['นาย ธีราทร ภิรมย์ไกรภักดิ์(ลูกจ้างประจำ)'],
    });
  });

  it('emits null stationId when รหัสสถานี is blank (state stations)', () => {
    const blank = { ...sampleRow, 'รหัสสถานี': '' };
    const parsed = parseXlsxRows([blank]);
    expect(parsed[0].stationId).toBeNull();
  });
});

describe('validateRows', () => {
  it('reports unmapped inspector names', () => {
    const row = { ...sampleRow, 'ชื่อผู้ตรวจ (กสทช.) 1': 'นาย ลึกลับ' };
    const parsed = parseXlsxRows([row]);
    const result = validateRows(parsed, {
      existingStationIds: new Set([5520458]),
      mappedUsers: new Map([['daf', 6]]),
    });
    expect(result.unmappedNames).toEqual(['นาย ลึกลับ']);
  });

  it('reports missing stationIds', () => {
    const parsed = parseXlsxRows([sampleRow]);
    const result = validateRows(parsed, {
      existingStationIds: new Set(),
      mappedUsers: new Map([['iff', 3], ['daf', 6]]),
    });
    expect(result.missingStationIds).toEqual([5520458]);
  });

  it('returns no issues when everything maps', () => {
    const parsed = parseXlsxRows([sampleRow]);
    const result = validateRows(parsed, {
      existingStationIds: new Set([5520458]),
      mappedUsers: new Map([['iff', 3], ['daf', 6]]),
    });
    expect(result.unmappedNames).toEqual([]);
    expect(result.missingStationIds).toEqual([]);
    expect(result.rowsToInsert).toHaveLength(1);
    expect(result.rowsToInsert[0]).toMatchObject({
      stationId: 5520458,
      inspectedOn: '2026-01-28',
      leadUserId: 3,
      helperUserIds: [6],
    });
  });

  it('skips rows whose stationId is null (state stations) and reports them', () => {
    const blank = { ...sampleRow, 'รหัสสถานี': '' };
    const parsed = parseXlsxRows([blank]);
    const result = validateRows(parsed, {
      existingStationIds: new Set(),
      mappedUsers: new Map([['iff', 3], ['daf', 6]]),
    });
    expect(result.rowsToInsert).toEqual([]);
    expect(result.skippedNoStationId).toHaveLength(1);
    expect(result.skippedNoStationId[0].chkId).toBe('52390');
  });
});
