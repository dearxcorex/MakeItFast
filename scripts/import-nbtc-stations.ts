/* eslint-disable no-console */
/**
 * Diff the NBTC OPER station register against fm_station, and (only with --apply)
 * insert the stations that are genuinely new.
 *
 * Input is the JSON written by automate_download/harvest_stations.py — the register
 * is behind a Cloudflare managed challenge and an authenticated ASP.NET form, so the
 * fetching stays in that project and this script never touches the network.
 *
 * A detail-page harvest carries station_id (= register_station_id), so most rows join exactly; see
 * docs/adr/0002-station-id-is-the-register-join-key.md. Rows without it fall back to
 * the composite freq/name/coordinate passes.
 *
 *   npx tsx scripts/import-nbtc-stations.ts data/nbtc-raw/stations-chaiyaphum.json
 *   npx tsx scripts/import-nbtc-stations.ts <file> --apply
 *
 * Dry-run by default: writes reports/nbtc-register-diff-<date>.csv and nothing else.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildDiff,
  filterToCoverage,
  chooseInsertTargets,
  parseFreq,
  stripThaiGeoPrefix,
  type RegisterRow,
  type DbStationRow,
  type DiffRecord,
} from '../src/utils/nbtcRegisterDiff';
import { TARGET_PROVINCES } from '../src/utils/offairAudit';

const JSON_PATH = process.argv.slice(2).find((a) => !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
const REPORT_DIR = path.join(process.cwd(), 'reports');

const prisma = new PrismaClient();

/** Accept the harvester's raw JSON loosely — it is scraped, so nothing is guaranteed. */
function parseRegisterJson(raw: unknown): RegisterRow[] {
  if (!Array.isArray(raw)) throw new Error('expected a JSON array of stations');
  const out: RegisterRow[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const freq = parseFreq(r.freq as string | number | null);
    const lat = r.lat === null || r.lat === undefined ? null : Number(r.lat);
    const lng = r.lng === null || r.lng === undefined ? null : Number(r.lng);
    const name = String(r.name ?? '').trim();
    if (!name && freq === null) continue; // nothing identifiable — skip
    // '05520331' and 5520331 are the same StationID; the register zero-pads it.
    const stationId = Number(String(r.station_id ?? '').trim());
    out.push({
      stationId: Number.isSafeInteger(stationId) && stationId > 0 ? stationId : null,
      nbtcCode: r.nbtc_code ? String(r.nbtc_code).trim() : null,
      name,
      org: r.org ? String(r.org).trim() : null,
      licenceNo: r.licence_no ? String(r.licence_no).trim() : null,
      freq: freq ?? 0,
      province: String(r.province ?? '').trim(),
      district: String(r.district ?? '').trim(),
      tambon: r.tambon ? String(r.tambon).trim() : null,
      address: r.address ? String(r.address).trim() : null,
      lat: lat !== null && Number.isFinite(lat) ? lat : null,
      lng: lng !== null && Number.isFinite(lng) ? lng : null,
    });
  }
  return out;
}

const csvEscape = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function writeCsv(records: DiffRecord[]): string {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const csvPath = path.join(REPORT_DIR, `nbtc-register-diff-${stamp}.csv`);
  const header = [
    'kind', 'matchedOn', 'stationId',
    'nbtcCode', 'siteName', 'siteFreq', 'siteDistrict', 'siteLat', 'siteLng',
    'licenceNo', 'org', 'address',
    'idFm', 'dbName', 'dbFreq', 'dbDistrict', 'dbLat', 'dbLong', 'dbRevoked',
    'distanceM', 'notes',
  ].join(',');
  const lines = records.map((r) => [
    r.kind, r.matchedOn ?? '', r.stationId ?? '',
    r.nbtcCode, r.siteName, r.siteFreq, r.siteDistrict, r.siteLat, r.siteLng,
    r.licenceNo, r.org, r.address,
    r.idFm, r.dbName, r.dbFreq, r.dbDistrict, r.dbLat, r.dbLong, r.dbRevoked,
    r.distanceM === null ? '' : Math.round(r.distanceM), r.notes.join('|'),
  ].map(csvEscape).join(','));
  fs.writeFileSync(csvPath, [header, ...lines].join('\n'), 'utf8');
  return csvPath;
}

async function main(): Promise<void> {
  if (!JSON_PATH || !fs.existsSync(JSON_PATH)) {
    console.error(`usage: npx tsx scripts/import-nbtc-stations.ts <stations.json> [--apply]`);
    console.error(JSON_PATH ? `not found: ${JSON_PATH}` : 'no input file given');
    process.exit(1);
  }

  const parsed = parseRegisterJson(JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')));
  const registerRows = filterToCoverage(parsed);
  const dropped = parsed.length - registerRows.length;
  console.log(`register rows: ${parsed.length} (${dropped} outside ${TARGET_PROVINCES.join('/')})`);

  // Compare only against the provinces actually present in the harvest, so a
  // single-province run does not report every other province as MISSING_ON_SITE.
  const provinces = [...new Set(registerRows.map((r) => stripThaiGeoPrefix(r.province)))];
  const dbRows: DbStationRow[] = (await prisma.fm_station.findMany({
    where: { province: { in: provinces }, register_station_id: { not: null } },
    select: {
      register_station_id: true, name: true, province: true, district: true,
      freq: true, lat: true, long: true, revoked: true,
    },
  })).filter((r): r is DbStationRow => r.register_station_id !== null);
  console.log(`db rows in ${provinces.join('/')}: ${dbRows.length}`);

  const records = buildDiff(registerRows, dbRows);
  const counts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log('\ndiff counts:', counts);

  const byBasis = records.reduce<Record<string, number>>((acc, r) => {
    const k = r.matchedOn ?? 'unmatched';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  console.log('matched on:', byBasis);

  const csvPath = writeCsv(records);
  console.log(`wrote: ${csvPath}`);

  for (const kind of ['NEW', 'FREQ_CHANGED', 'COORD_MOVED', 'LIKELY_SAME'] as const) {
    const hits = records.filter((r) => r.kind === kind);
    if (hits.length === 0) continue;
    console.log(`\n${kind} (${hits.length}):`);
    for (const r of hits.slice(0, 20)) {
      const freq = (r.siteFreq ?? r.dbFreq ?? 0).toFixed(2).padStart(7);
      console.log(`  ${freq}  ${(r.siteDistrict ?? r.dbDistrict ?? '').padEnd(14)}  ${r.siteName ?? r.dbName}  ${r.notes.join('; ')}`);
    }
  }

  const toInsert = chooseInsertTargets(records);

  if (!APPLY) {
    console.log(`\n(dry-run — ${toInsert.length} station(s) would be inserted; re-run with --apply)`);
    await prisma.$disconnect();
    return;
  }

  // register_station_id is left NULL: these stations are inserted from the results
  // table, which carries no StationID. id_fm takes the NBTC code instead, so the row
  // still has the identifier the UI prints.
  const now = new Date();
  const data = toInsert.map((r) => ({
    name: r.siteName,
    freq: r.siteFreq,
    lat: r.siteLat,
    long: r.siteLng,
    district: r.siteDistrict,
    province: stripThaiGeoPrefix(
      (r.stationId !== null
        ? registerRows.find((x) => x.stationId === r.stationId)
        : registerRows.find((x) => x.nbtcCode === r.nbtcCode && x.name === r.siteName)
      )?.province ?? '',
    ),
    // A newly-licensed station is "on air, not yet inspected" — the pending bucket.
    // on_air:false would render it as a confirmed OFF AIR pin, which asserts more
    // than we know. submit_a_request stays at its default and means "unknown", not "no".
    on_air: true,
    revoked: false,
    inspection_69: false,
    // The NBTC code is the identifier the UI prints; there is no separate
    // nbtc_code column since 2026-09-20-drop-nbtc-code-and-source.
    id_fm: r.nbtcCode,
    created_at: now,
  }));

  console.log(`\n--apply: inserting ${data.length} station(s)`);
  const created = await prisma.fm_station.createManyAndReturn({ data, select: { id: true } });
  console.log(`inserted: ${created.length}`);
  // An id list is an exact undo. The old `source` tag was shared by every run,
  // so undoing one import took the previous one with it.
  console.log(`undo: DELETE FROM fm_station WHERE id IN (${created.map((s) => s.id).join(', ')});`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
