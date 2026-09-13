/**
 * Cell sites: mobile-network base-station licences from the NBTC ASMS export
 * (`_Export.xlsx`), cleaned down to what the Cell Sites map needs.
 *
 * The export has one row per licence. A tower carrying several operators or bands
 * appears once per licence at the same coordinate, so rows are merged into one
 * site per exact lat/lng — one site is one map pin.
 */

/** Shape of one row as SheetJS returns it from the export (header → cell). Only the columns we read. */
export interface RawCellSiteRow {
  'ชื่อ': string | null;
  'ที่ตั้ง': string | null;
  lat: string | number | null;
  long: string | number | null;
  'เลขที่ใบอนุญาต': string | number | null;
  'รหัสสถานี': string | number | null;
}

/** One licence row from the export, before merging. */
export interface CellSiteRow {
  /** Operator code: AWN, NT, TUC, or the export's asterisk variants NT* / AWN*. */
  name: string;
  province: string | null;
  lat: number;
  lng: number;
  licenseNo: string | null;
  stationCode: string | null;
}

export const CELL_OPERATORS = ['AWN', 'NT', 'TUC'] as const;
export type CellOperator = (typeof CELL_OPERATORS)[number];

export interface CellLicence {
  licenseNo: string | null;
  stationCode: string | null;
}

/** Every licence at one exact coordinate. */
export interface CellSite {
  province: string | null;
  lat: number;
  lng: number;
  /** Operators present, asterisk variants kept (e.g. `['AWN', 'NT*']`). */
  operators: string[];
  /** Licences filed under the operator without its asterisk. */
  licences: Record<CellOperator, CellLicence[]>;
}

export interface CleanCellSitesResult {
  sites: CellSite[];
  /** Locations where no row has a licence or a station code — nothing identifies them. */
  rejects: CellSite[];
  licenceRows: number;
  outsideCoverage: number;
}

// dtac's network (DTN) now belongs to True, so the map shows one operator for both.
const OPERATOR_ALIASES: Record<string, string> = { DTN: 'TUC' };

export function normaliseOperator(name: string): string {
  const trimmed = name.trim();
  return OPERATOR_ALIASES[trimmed] ?? trimmed;
}

export const baseOperator = (name: string): string => name.replace(/\*+$/, '');

const isCellOperator = (name: string): name is CellOperator =>
  (CELL_OPERATORS as readonly string[]).includes(name);

export function parseProvince(address: string | null): string | null {
  const match = address?.match(/จังหวัด(\S+)/);
  return match ? match[1] : null;
}

const text = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const coordinate = (v: unknown): number => {
  const s = text(v);
  return s === null ? NaN : Number(s);
};

export function parseCellSiteRows(raw: RawCellSiteRow[]): CellSiteRow[] {
  const out: CellSiteRow[] = [];
  for (const r of raw) {
    const lat = coordinate(r.lat);
    const lng = coordinate(r.long);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      name: normaliseOperator(String(r['ชื่อ'] ?? '')),
      province: parseProvince(r['ที่ตั้ง']),
      lat,
      lng,
      licenseNo: text(r['เลขที่ใบอนุญาต']),
      stationCode: text(r['รหัสสถานี']),
    });
  }
  return out;
}

// Sorts AWN, AWN*, NT, NT*, TUC: by base operator, plain before asterisk.
const operatorOrder = (a: string, b: string): number =>
  CELL_OPERATORS.indexOf(baseOperator(a) as CellOperator) - CELL_OPERATORS.indexOf(baseOperator(b) as CellOperator)
  || a.length - b.length;

export function mergeByLocation(rows: CellSiteRow[]): { sites: CellSite[]; rejects: CellSite[] } {
  const byLocation = new Map<string, CellSite>();
  for (const r of rows) {
    const operator = baseOperator(r.name);
    if (!isCellOperator(operator)) {
      throw new Error(`unknown cell operator "${r.name}" at ${r.lat},${r.lng}`);
    }
    const key = `${r.lat},${r.lng}`;
    let site = byLocation.get(key);
    if (!site) {
      site = { province: r.province, lat: r.lat, lng: r.lng, operators: [], licences: { AWN: [], NT: [], TUC: [] } };
      byLocation.set(key, site);
    }
    if (!site.operators.includes(r.name)) site.operators.push(r.name);
    if (r.licenseNo !== null || r.stationCode !== null) {
      site.licences[operator].push({ licenseNo: r.licenseNo, stationCode: r.stationCode });
    }
  }

  const sites: CellSite[] = [];
  const rejects: CellSite[] = [];
  for (const site of byLocation.values()) {
    site.operators.sort(operatorOrder);
    const identified = CELL_OPERATORS.some((op) => site.licences[op].length > 0);
    (identified ? sites : rejects).push(site);
  }
  return { sites, rejects };
}

export function cleanCellSites(
  raw: RawCellSiteRow[],
  provinces: readonly string[],
): CleanCellSitesResult {
  const parsed = parseCellSiteRows(raw);
  const inCoverage = parsed.filter((r) => r.province !== null && provinces.includes(r.province));
  const { sites, rejects } = mergeByLocation(inCoverage);
  return {
    sites,
    rejects,
    licenceRows: inCoverage.length,
    outsideCoverage: parsed.length - inCoverage.length,
  };
}

const CSV_HEADER = [
  'province', 'lat', 'lng', 'operators',
  ...CELL_OPERATORS.flatMap((op) => [`${op.toLowerCase()}_license_no`, `${op.toLowerCase()}_station_code`]),
];

const csvEscape = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Joins with `|`; licence and code columns share positions, so a blank keeps its slot. */
const joinValues = (values: (string | null)[]): string =>
  values
    .map((v) => {
      if (v?.includes('|')) throw new Error(`value contains the | separator: ${v}`);
      return v ?? '';
    })
    .join('|');

export function cellSitesToCsv(sites: CellSite[]): string {
  const lines = sites.map((s) =>
    [
      s.province,
      s.lat,
      s.lng,
      joinValues(s.operators),
      ...CELL_OPERATORS.flatMap((op) => [
        joinValues(s.licences[op].map((l) => l.licenseNo)),
        joinValues(s.licences[op].map((l) => l.stationCode)),
      ]),
    ]
      .map(csvEscape)
      .join(','),
  );
  return [CSV_HEADER.join(','), ...lines].join('\n') + '\n';
}

/** RFC 4180 fields: quoted fields may hold commas, doubled quotes and newlines. */
function splitCsv(input: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  const s = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { record.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

const blankToNull = (v: string | undefined): string | null => (v === undefined || v === '' ? null : v);

/** Inverse of joinValues for one operator's licence/code column pair. */
function splitLicences(licenseNos: string, stationCodes: string): CellLicence[] {
  if (licenseNos === '' && stationCodes === '') return [];
  const nos = licenseNos.split('|');
  const codes = stationCodes.split('|');
  return Array.from({ length: Math.max(nos.length, codes.length) }, (_, i) => ({
    licenseNo: blankToNull(nos[i]),
    stationCode: blankToNull(codes[i]),
  }));
}

export function parseCellSitesCsv(csv: string): CellSite[] {
  const [header, ...records] = splitCsv(csv);
  if (!header || header.join(',') !== CSV_HEADER.join(',')) {
    throw new Error(`unexpected cell site CSV header: ${header?.join(',')}`);
  }
  return records
    .filter((f) => f.length > 1)
    .map(([province, lat, lng, operators, awnNos, awnCodes, ntNos, ntCodes, tucNos, tucCodes]) => ({
      province: blankToNull(province),
      lat: Number(lat),
      lng: Number(lng),
      operators: operators === '' ? [] : operators.split('|'),
      licences: {
        AWN: splitLicences(awnNos, awnCodes),
        NT: splitLicences(ntNos, ntCodes),
        TUC: splitLicences(tucNos, tucCodes),
      },
    }));
}
