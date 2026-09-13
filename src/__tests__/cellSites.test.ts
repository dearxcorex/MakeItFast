import { describe, it, expect } from 'vitest';
import {
  normaliseOperator,
  parseProvince,
  parseCellSiteRows,
  mergeByLocation,
  cleanCellSites,
  cellSitesToCsv,
  parseCellSitesCsv,
  type RawCellSiteRow,
  type CellSiteRow,
  type CellSite,
} from '../utils/cellSites';

const raw = (over: Partial<RawCellSiteRow> = {}): RawCellSiteRow => ({
  'ชื่อ': 'AWN',
  'ที่ตั้ง': 'ตำบลตะขบ อำเภอปักธงชัย จังหวัดนครราชสีมา',
  lat: '14.654444',
  long: '101.865833',
  'เลขที่ใบอนุญาต': '060365103247',
  'รหัสสถานี': '808924 จิมทอมป์สันฟาร์ม',
  ...over,
});

const row = (over: Partial<CellSiteRow> = {}): CellSiteRow => ({
  name: 'AWN',
  province: 'นครราชสีมา',
  lat: 14.654444,
  lng: 101.865833,
  licenseNo: '060365103247',
  stationCode: '808924',
  ...over,
});

const site = (over: Partial<CellSite> = {}): CellSite => ({
  province: 'นครราชสีมา',
  lat: 14.654444,
  lng: 101.865833,
  operators: ['AWN'],
  licences: { AWN: [{ licenseNo: '060365103247', stationCode: '808924' }], NT: [], TUC: [] },
  ...over,
});

describe('normaliseOperator', () => {
  it('folds DTN into TUC', () => {
    expect(normaliseOperator('DTN')).toBe('TUC');
  });

  it('keeps the asterisk variants as they are', () => {
    expect(normaliseOperator('NT*')).toBe('NT*');
    expect(normaliseOperator('AWN*')).toBe('AWN*');
  });

  it('trims whitespace', () => {
    expect(normaliseOperator(' NT ')).toBe('NT');
  });
});

describe('parseProvince', () => {
  it('reads the word after จังหวัด', () => {
    expect(parseProvince('ตำบลในเมือง อำเภอเมืองชัยภูมิ จังหวัดชัยภูมิ')).toBe('ชัยภูมิ');
  });

  it('returns null when the address carries no province', () => {
    expect(parseProvince('เลขที่ 12 หมู่ 3')).toBeNull();
    expect(parseProvince(null)).toBeNull();
  });
});

describe('parseCellSiteRows', () => {
  it('keeps only the wanted fields, with the licence number as text', () => {
    expect(parseCellSiteRows([raw()])).toEqual([
      {
        name: 'AWN',
        province: 'นครราชสีมา',
        lat: 14.654444,
        lng: 101.865833,
        licenseNo: '060365103247',
        stationCode: '808924 จิมทอมป์สันฟาร์ม',
      },
    ]);
  });

  it('trims station codes and treats blank cells as null', () => {
    const [a, b] = parseCellSiteRows([
      raw({ 'รหัสสถานี': '  870424 ' }),
      raw({ 'รหัสสถานี': '  ', 'เลขที่ใบอนุญาต': null }),
    ]);
    expect(a.stationCode).toBe('870424');
    expect(b.stationCode).toBeNull();
    expect(b.licenseNo).toBeNull();
  });

  it('drops rows whose coordinates do not parse', () => {
    expect(parseCellSiteRows([raw({ lat: '' }), raw({ long: 'n/a' })])).toEqual([]);
  });
});

describe('mergeByLocation', () => {
  it('merges every licence at the exact same coordinate into one site', () => {
    const { sites } = mergeByLocation([
      row({ name: 'AWN', licenseNo: 'A1', stationCode: '870163' }),
      row({ name: 'NT', licenseNo: 'N1', stationCode: 'NMA0319-L23' }),
      row({ name: 'AWN', licenseNo: 'A2', stationCode: '870163 เขาใหญ่' }),
      row({ name: 'TUC', licenseNo: 'T1', stationCode: 'NMA0319-U21' }),
    ]);
    expect(sites).toEqual([
      site({
        operators: ['AWN', 'NT', 'TUC'],
        licences: {
          AWN: [
            { licenseNo: 'A1', stationCode: '870163' },
            { licenseNo: 'A2', stationCode: '870163 เขาใหญ่' },
          ],
          NT: [{ licenseNo: 'N1', stationCode: 'NMA0319-L23' }],
          TUC: [{ licenseNo: 'T1', stationCode: 'NMA0319-U21' }],
        },
      }),
    ]);
  });

  it('keeps sites at different coordinates apart, even a metre away', () => {
    const { sites } = mergeByLocation([row(), row({ lat: 14.654445 })]);
    expect(sites).toHaveLength(2);
  });

  it('lists operators in a fixed order whatever order the rows came in', () => {
    const { sites } = mergeByLocation([row({ name: 'TUC' }), row({ name: 'NT*' }), row({ name: 'AWN' })]);
    expect(sites[0].operators).toEqual(['AWN', 'NT*', 'TUC']);
  });

  it('files NT* licences under NT but keeps the asterisk in operators', () => {
    const { sites } = mergeByLocation([row({ name: 'NT*', licenseNo: 'N1', stationCode: null })]);
    expect(sites[0].operators).toEqual(['NT*']);
    expect(sites[0].licences.NT).toEqual([{ licenseNo: 'N1', stationCode: null }]);
  });

  it('counts a row with no licence and no code toward the operators only', () => {
    const { sites, rejects } = mergeByLocation([
      row({ name: 'AWN' }),
      row({ name: 'TUC', licenseNo: null, stationCode: null }),
    ]);
    expect(sites[0].operators).toEqual(['AWN', 'TUC']);
    expect(sites[0].licences.TUC).toEqual([]);
    expect(rejects).toEqual([]);
  });

  it('rejects a location where nothing identifies any row', () => {
    const { sites, rejects } = mergeByLocation([row({ name: 'TUC', licenseNo: null, stationCode: null })]);
    expect(sites).toEqual([]);
    expect(rejects).toHaveLength(1);
    expect(rejects[0].operators).toEqual(['TUC']);
  });

  it('throws on an operator it has no column for', () => {
    expect(() => mergeByLocation([row({ name: 'XYZ' })])).toThrow(/XYZ/);
  });
});

describe('cleanCellSites', () => {
  const provinces = ['นครราชสีมา', 'ชัยภูมิ'];

  it('drops rows outside the coverage provinces', () => {
    const result = cleanCellSites(
      [raw(), raw({ lat: '15.2', 'ที่ตั้ง': 'ตำบลอิสาณ อำเภอเมืองบุรีรัมย์ จังหวัดบุรีรัมย์' })],
      provinces,
    );
    expect(result.sites).toHaveLength(1);
    expect(result.outsideCoverage).toBe(1);
  });

  it('folds DTN into TUC', () => {
    const { sites } = cleanCellSites(
      [raw({ 'ชื่อ': 'DTN', 'รหัสสถานี': 'NMA0759-L23' }), raw({ 'ชื่อ': 'TUC', 'รหัสสถานี': 'NMA0759-U21' })],
      provinces,
    );
    expect(sites[0].operators).toEqual(['TUC']);
    expect(sites[0].licences.TUC).toHaveLength(2);
  });

  it('reports how many licences it read', () => {
    expect(cleanCellSites([raw(), raw({ 'ชื่อ': 'NT' })], provinces).licenceRows).toBe(2);
  });
});

describe('CSV round trip', () => {
  it('writes the agreed header', () => {
    expect(cellSitesToCsv([]).split('\n')[0]).toBe(
      'province,lat,lng,operators,awn_license_no,awn_station_code,nt_license_no,nt_station_code,tuc_license_no,tuc_station_code',
    );
  });

  it('joins several values with | and keeps licences and codes in step', () => {
    const csv = cellSitesToCsv([
      site({
        operators: ['AWN', 'NT'],
        licences: {
          AWN: [
            { licenseNo: 'A1', stationCode: null },
            { licenseNo: 'A2', stationCode: '870163' },
          ],
          NT: [{ licenseNo: null, stationCode: 'NMA0319' }],
          TUC: [],
        },
      }),
    ]);
    expect(csv.split('\n')[1]).toBe('นครราชสีมา,14.654444,101.865833,AWN|NT,A1|A2,|870163,,NMA0319,,');
  });

  it('reads back what it wrote, including commas, quotes and blanks', () => {
    const sites = [
      site(),
      site({
        lat: 15.1,
        operators: ['AWN', 'NT*', 'TUC'],
        licences: {
          AWN: [{ licenseNo: '060365103281', stationCode: 'มหาชน)บริเวณ "พรีโม", เขาใหญ่' }],
          NT: [
            { licenseNo: '030347006957', stationCode: null },
            { licenseNo: null, stationCode: 'NMA044/บ้านด่านเกวียน' },
          ],
          TUC: [],
        },
      }),
    ];
    expect(parseCellSitesCsv(cellSitesToCsv(sites))).toEqual(sites);
  });

  it('refuses to write a value that contains the | separator', () => {
    expect(() =>
      cellSitesToCsv([site({ licences: { AWN: [{ licenseNo: 'A|B', stationCode: null }], NT: [], TUC: [] } })]),
    ).toThrow(/\|/);
  });
});
