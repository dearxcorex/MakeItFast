export const TARGET_PROVINCES = ['นครราชสีมา', 'ชัยภูมิ', 'บุรีรัมย์'] as const;
export type TargetProvince = (typeof TARGET_PROVINCES)[number];

/** Shape of one row as SheetJS returns it from the xlsx file (header → cell). */
export interface RawXlsxRow {
  'ลำดับ': number | string | null;
  'รหัสสถานี': string | number | null;
  'ชื่อสถานี': string | null;
  'ประเภท': string | null;
  'คลื่นความถี่เดิม': number | string | null;
  'จังหวัด': string | null;
  'เขต/อำเภอ': string | null;
  'ผู้ทดลองออกอากาศเดิม': string | null;
  'หมายเหตุ': string | null;
}

export interface ParsedXlsxRow {
  idFm: number;
  stationCodeRaw: string;
  name: string;
  province: string;
  district: string;
  freq: number;
  type: string;
  note: string;
}

/** Subset of fm_station fields the audit needs — keeps the function decoupled from PrismaClient typings. */
export interface DbStationRow {
  id_fm: number;
  name: string | null;
  province: string | null;
  district: string | null;
  freq: number | null;
  on_air: boolean | null;
}

export type Classification =
  | 'STILL_ON_AIR'      // on_air === true
  | 'ALREADY_OFF_AIR'   // on_air === false
  | 'ON_AIR_UNKNOWN'    // matched in DB but on_air is null — needs human review
  | 'MISSING_IN_DB';    // no matching id_fm in DB

export interface AuditRecord {
  idFm: number;
  stationCodeRaw: string;
  xlsxName: string;
  xlsxProvince: string;
  xlsxDistrict: string;
  xlsxFreq: number;
  foundInDb: boolean;
  dbName: string | null;
  dbProvince: string | null;
  dbFreq: number | null;
  dbOnAir: boolean | null;
  classification: Classification;
  warnings: string[];
}

export function parseXlsxRows(rows: RawXlsxRow[]): ParsedXlsxRow[] {
  const out: ParsedXlsxRow[] = [];
  for (const r of rows) {
    const codeCell = r['รหัสสถานี'];
    if (codeCell === null || codeCell === undefined || codeCell === '') continue;
    const codeStr = String(codeCell).trim();
    const idFm = Number.parseInt(codeStr, 10);
    if (!Number.isFinite(idFm) || idFm <= 0) continue;
    const freqCell = r['คลื่นความถี่เดิม'];
    const freq = typeof freqCell === 'number'
      ? freqCell
      : Number.parseFloat(String(freqCell ?? '0'));
    out.push({
      idFm,
      stationCodeRaw: codeStr,
      name: (r['ชื่อสถานี'] ?? '').toString().trim(),
      province: (r['จังหวัด'] ?? '').toString().trim(),
      district: (r['เขต/อำเภอ'] ?? '').toString().trim(),
      freq: Number.isFinite(freq) ? freq : 0,
      type: (r['ประเภท'] ?? '').toString().trim(),
      note: (r['หมายเหตุ'] ?? '').toString(),
    });
  }
  return out;
}

export function filterByProvinces(
  rows: ParsedXlsxRow[],
  provinces: readonly string[],
): ParsedXlsxRow[] {
  const set = new Set(provinces);
  return rows.filter((r) => set.has(r.province));
}

export function buildAuditRecords(
  xlsxRows: ParsedXlsxRow[],
  dbRows: DbStationRow[],
): AuditRecord[] {
  const dbByIdFm = new Map<number, DbStationRow>();
  for (const d of dbRows) dbByIdFm.set(d.id_fm, d);

  return xlsxRows.map((x) => {
    const db = dbByIdFm.get(x.idFm);
    const warnings: string[] = [];
    if (db) {
      if (db.province && x.province && db.province !== x.province) warnings.push('province-mismatch');
      if (db.name && x.name && db.name !== x.name) warnings.push('name-mismatch');
    }
    let classification: Classification;
    if (!db) classification = 'MISSING_IN_DB';
    else if (db.on_air === true) classification = 'STILL_ON_AIR';
    else if (db.on_air === false) classification = 'ALREADY_OFF_AIR';
    else classification = 'ON_AIR_UNKNOWN';

    return {
      idFm: x.idFm,
      stationCodeRaw: x.stationCodeRaw,
      xlsxName: x.name,
      xlsxProvince: x.province,
      xlsxDistrict: x.district,
      xlsxFreq: x.freq,
      foundInDb: !!db,
      dbName: db?.name ?? null,
      dbProvince: db?.province ?? null,
      dbFreq: db?.freq ?? null,
      dbOnAir: db?.on_air ?? null,
      classification,
      warnings,
    };
  });
}
