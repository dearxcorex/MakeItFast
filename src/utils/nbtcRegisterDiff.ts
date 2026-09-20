import { TARGET_PROVINCES } from './offairAudit';

/**
 * Diff the NBTC OPER station register against fm_station.
 *
 * The register shows two codes, and only one of them identifies a station here.
 * The station code in the results table (RFXL680018) belongs to a different code
 * system than register_station_id and is blank for some rows. But the inspection
 * detail page carries StationID -- '05520331' -- which IS register_station_id
 * 5520331, verified field by
 * field against a live row. When a harvest supplies it, pass 0 joins on it exactly
 * and no inference is needed.
 *
 * Everything below pass 0 is the fallback for rows harvested without a StationID
 * (a results-table or Excel harvest, or a register row where it is blank). Across
 * all 61 ชัยภูมิ stations, freq+district has zero collisions -- six frequencies
 * repeat within the province, never inside the same อำเภอ -- which makes it a safe
 * secondary pass but not a sufficient one:
 *
 *   A station whose frequency was reassigned matches nothing on freq+district, so
 *   it would surface as a new station AND as a vanished one. Two later passes
 *   (name, then coordinates) reunite those pairs before anything is called new.
 */

/** One station as harvested from the NBTC add-inspection form. */
export interface RegisterRow {
  /** The detail page's StationID, which is register_station_id. Null when harvested without it. */
  stationId: number | null;     // 5520331
  nbtcCode: string | null;      // 'RFXL680018' — blank for some register rows
  name: string;
  org: string | null;           // ชื่อหน่วยงาน — licence holder, not stored in DB
  licenceNo: string | null;     // 'BF-S10033-1642-68'
  freq: number;
  province: string;             // as sent: 'จ.ชัยภูมิ'
  district: string;             // as sent: 'อ.หนองบัวแดง'
  tambon: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/** Subset of fm_station the diff needs — keeps this decoupled from PrismaClient typings. */
export interface DbStationRow {
  register_station_id: number;
  name: string | null;
  province: string | null;
  district: string | null;
  freq: number | null;
  lat: number | null;
  long: number | null;
  revoked: boolean | null;
}

export type DiffKind =
  | 'MATCHED'           // same station, same freq+district
  | 'COORD_MOVED'       // matched, but the register's พิกัด is far from ours
  | 'FREQ_CHANGED'      // same name, different frequency — a reassignment
  | 'LIKELY_SAME'       // freq and name both differ, but within metres of each other
  | 'NEW'               // on the register, nothing in the DB resembles it
  | 'MISSING_ON_SITE';  // in the DB, absent from the register

/** Which pass claimed the pair — the difference between knowing and inferring. */
export type MatchBasis = 'station-id' | 'freq-district' | 'name' | 'coords';

export interface DiffRecord {
  kind: DiffKind;
  /** null for NEW and MISSING_ON_SITE: nothing was matched. */
  matchedOn: MatchBasis | null;
  // Register side (null for MISSING_ON_SITE)
  stationId: number | null;
  nbtcCode: string | null;
  siteName: string | null;
  siteFreq: number | null;
  siteDistrict: string | null;
  siteLat: number | null;
  siteLng: number | null;
  licenceNo: string | null;
  org: string | null;
  address: string | null;
  // DB side (null for NEW)
  idFm: number | null;
  dbName: string | null;
  dbFreq: number | null;
  dbDistrict: string | null;
  dbLat: number | null;
  dbLong: number | null;
  dbRevoked: boolean | null;
  /** Metres between the two coordinate pairs, when both sides have one. */
  distanceM: number | null;
  notes: string[];
}

/** Coordinate drift beyond this on a matched pair is worth a human look. */
export const COORD_DRIFT_LIMIT_M = 500;

/** The register prefixes จังหวัด/อำเภอ/ตำบล; fm_station stores them bare. */
export function stripThaiGeoPrefix(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().replace(/^(จ\.|อ\.|ต\.|จังหวัด|อำเภอ|ตำบล)\s*/, '').trim();
}

/** '103.00MHz' | '103.00' | 103 → 103. Returns null when there is no number. */
export function parseFreq(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const m = String(value).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number.parseFloat(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Station names differ cosmetically between the two systems — the register writes
 * 'เพชรนิรันดิ์ เรดิโอ' where we store 'เพชรนิรันดิ์ เรดิโ'. Compare on a squashed
 * form so a stray space or ๆ does not split a real pair.
 */
export function normaliseName(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

/** Great-circle distance in metres. */
export function distanceMetres(
  aLat: number, aLng: number, bLat: number, bLng: number,
): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function keyOf(freq: number | null, district: string): string {
  return `${freq ?? 'null'}@${district}`;
}

function pairDistance(r: RegisterRow, d: DbStationRow): number | null {
  if (r.lat == null || r.lng == null || d.lat == null || d.long == null) return null;
  return distanceMetres(r.lat, r.lng, d.lat, d.long);
}

/**
 * Keep only register rows inside this office's coverage. Second gate: the caller
 * already queries the site per-province, but บุรีรัมย์ must not be able to re-enter
 * through a mis-set filter. See TARGET_PROVINCES.
 */
export function filterToCoverage(rows: RegisterRow[]): RegisterRow[] {
  const allowed = new Set<string>(TARGET_PROVINCES);
  return rows.filter((r) => allowed.has(stripThaiGeoPrefix(r.province)));
}

export function buildDiff(
  registerRows: RegisterRow[],
  dbRows: DbStationRow[],
): DiffRecord[] {
  const out: DiffRecord[] = [];
  const unmatchedSite = [...registerRows];
  const unmatchedDb = [...dbRows];

  const take = <T>(arr: T[], item: T) => {
    const i = arr.indexOf(item);
    if (i >= 0) arr.splice(i, 1);
  };

  const record = (
    kind: DiffKind, r: RegisterRow | null, d: DbStationRow | null, notes: string[],
    matchedOn: MatchBasis | null = null,
  ): DiffRecord => ({
    kind,
    matchedOn,
    stationId: r?.stationId ?? null,
    nbtcCode: r?.nbtcCode ?? null,
    siteName: r?.name ?? null,
    siteFreq: r?.freq ?? null,
    siteDistrict: r ? stripThaiGeoPrefix(r.district) : null,
    siteLat: r?.lat ?? null,
    siteLng: r?.lng ?? null,
    licenceNo: r?.licenceNo ?? null,
    org: r?.org ?? null,
    address: r?.address ?? null,
    idFm: d?.register_station_id ?? null,
    dbName: d?.name ?? null,
    dbFreq: d?.freq ?? null,
    dbDistrict: d?.district ?? null,
    dbLat: d?.lat ?? null,
    dbLong: d?.long ?? null,
    dbRevoked: d?.revoked ?? null,
    distanceM: r && d ? pairDistance(r, d) : null,
    notes,
  });

  // Pass 0 — StationID, which is register_station_id. An exact key: when both sides carry it, a
  // difference in frequency or position is a change to a known station, never a new
  // one, so this pass must run before any heuristic can guess otherwise.
  const dbById = new Map<number, DbStationRow>();
  for (const d of unmatchedDb) dbById.set(d.register_station_id, d);
  for (const r of [...unmatchedSite]) {
    if (r.stationId == null) continue;
    const d = dbById.get(r.stationId);
    if (!d || !unmatchedDb.includes(d)) continue;
    const dist = pairDistance(r, d);
    const notes = ['matched-on-station-id'];
    if (normaliseName(r.name) !== normaliseName(d.name)) notes.push('name-differs');
    if (d.revoked) notes.push('db-row-is-revoked-but-still-on-register');

    let kind: DiffKind = 'MATCHED';
    if (r.freq !== d.freq) {
      kind = 'FREQ_CHANGED';
      notes.push(`freq ${d.freq ?? '?'} → ${r.freq}`);
    } else if (dist !== null && dist > COORD_DRIFT_LIMIT_M) {
      kind = 'COORD_MOVED';
      notes.push(`coords-differ-by-${Math.round(dist)}m`);
    }
    out.push(record(kind, r, d, notes, 'station-id'));
    take(unmatchedSite, r);
    take(unmatchedDb, d);
  }

  // Pass 1 — freq + district. Zero collisions in the live data, so this is exact.
  const dbByKey = new Map<string, DbStationRow[]>();
  for (const d of unmatchedDb) {
    const k = keyOf(d.freq, stripThaiGeoPrefix(d.district));
    const list = dbByKey.get(k) ?? [];
    list.push(d);
    dbByKey.set(k, list);
  }
  for (const r of [...unmatchedSite]) {
    const bucket = dbByKey.get(keyOf(r.freq, stripThaiGeoPrefix(r.district)));
    const d = bucket?.find((c) => unmatchedDb.includes(c));
    if (!d) continue;
    const dist = pairDistance(r, d);
    const notes: string[] = [];
    if (normaliseName(r.name) !== normaliseName(d.name)) notes.push('name-differs');
    if (d.revoked) notes.push('db-row-is-revoked-but-still-on-register');
    // A genuinely new station could share freq+district with an existing one and be
    // swallowed here. Coordinate drift is the tell, so it is surfaced, never merged away.
    const moved = dist !== null && dist > COORD_DRIFT_LIMIT_M;
    if (moved) notes.push(`coords-differ-by-${Math.round(dist)}m`);
    out.push(record(moved ? 'COORD_MOVED' : 'MATCHED', r, d, notes, 'freq-district'));
    take(unmatchedSite, r);
    take(unmatchedDb, d);
  }

  // Pass 2 — same name, different frequency: a reassignment, not a new station.
  for (const r of [...unmatchedSite]) {
    const n = normaliseName(r.name);
    if (!n) continue;
    const d = unmatchedDb.find((c) => normaliseName(c.name) === n);
    if (!d) continue;
    out.push(record('FREQ_CHANGED', r, d, [
      `freq ${d.freq ?? '?'} → ${r.freq}`,
    ], 'name'));
    take(unmatchedSite, r);
    take(unmatchedDb, d);
  }

  // Pass 3 — neither freq nor name matches, but they sit on the same mast.
  for (const r of [...unmatchedSite]) {
    if (r.lat == null || r.lng == null) continue;
    let best: { row: DbStationRow; m: number } | null = null;
    for (const c of unmatchedDb) {
      const m = pairDistance(r, c);
      if (m === null || m > COORD_DRIFT_LIMIT_M) continue;
      if (!best || m < best.m) best = { row: c, m };
    }
    if (!best) continue;
    out.push(record('LIKELY_SAME', r, best.row, [
      `same location (${Math.round(best.m)}m) but freq and name both differ — review by hand`,
    ], 'coords'));
    take(unmatchedSite, r);
    take(unmatchedDb, best.row);
  }

  // Whatever is left really is new / really is gone.
  for (const r of unmatchedSite) out.push(record('NEW', r, null, []));
  for (const d of unmatchedDb) {
    out.push(record('MISSING_ON_SITE', null, d, [
      d.revoked ? 'already revoked in DB — expected to be absent' : 'not on the register',
    ]));
  }

  return out;
}

/** Only NEW rows are ever written. Everything else is report-only, by design. */
export function chooseInsertTargets(records: DiffRecord[]): DiffRecord[] {
  return records.filter((r) => r.kind === 'NEW');
}
