/* eslint-disable no-console */
/**
 * Read-only: compare the harvested register against fm_station in two steps.
 *
 *   1. Only ประเภทกิจการทางธุรกิจ ระดับท้องถิ่น rows vs every DB row.
 *   2. Every other register type vs the DB rows step 1 left unmatched.
 *
 * Writes reports/register-by-type-<date>.csv. Never writes to the database.
 *
 *   npx tsx scripts/compare-register-by-type.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildDiff,
  filterToCoverage,
  parseFreq,
  stripThaiGeoPrefix,
  type DbStationRow,
  type DiffRecord,
  type RegisterRow,
} from '../src/utils/nbtcRegisterDiff';

const BUSINESS = 'ประเภทกิจการทางธุรกิจ ระดับท้องถิ่น';
const FILES = ['stations-ชัยภูมิ.json', 'stations-นครราชสีมา.json'];
const RAW_DIR = path.join(process.cwd(), 'data', 'nbtc-raw');

type TypedRow = RegisterRow & { stnType: string };

function load(): TypedRow[] {
  const out: TypedRow[] = [];
  for (const file of FILES) {
    const raw = JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), 'utf8')) as Record<string, unknown>[];
    for (const r of raw) {
      const stationId = Number(String(r.station_id ?? '').trim());
      const lat = r.lat == null ? null : Number(r.lat);
      const lng = r.lng == null ? null : Number(r.lng);
      out.push({
        stationId: Number.isSafeInteger(stationId) && stationId > 0 ? stationId : null,
        nbtcCode: r.nbtc_code ? String(r.nbtc_code) : null,
        name: String(r.name ?? '').trim(),
        org: r.org ? String(r.org) : null,
        licenceNo: r.licence_no ? String(r.licence_no) : null,
        freq: parseFreq(r.freq as number | string | null) ?? 0,
        province: String(r.province ?? ''),
        district: String(r.district ?? ''),
        tambon: r.tambon ? String(r.tambon) : null,
        address: r.address ? String(r.address) : null,
        lat: lat !== null && Number.isFinite(lat) ? lat : null,
        lng: lng !== null && Number.isFinite(lng) ? lng : null,
        stnType: String(r.stn_type ?? '(ไม่ระบุ)'),
      });
    }
  }
  return out;
}

const tally = (records: DiffRecord[]) =>
  records.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] ?? 0) + 1;
    return acc;
  }, {});

const csvEscape = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function line(step: string, r: DiffRecord, stnType: string | null): string {
  return [
    step, r.kind, r.matchedOn ?? '', stnType ?? '', r.stationId ?? '', r.nbtcCode,
    r.siteName, r.siteFreq, r.siteDistrict, r.licenceNo,
    r.idFm, r.dbName, r.dbFreq, r.dbDistrict, r.dbRevoked,
    r.distanceM === null ? '' : Math.round(r.distanceM), r.notes.join('|'),
  ].map(csvEscape).join(',');
}

function show(title: string, records: DiffRecord[], kinds: string[]): void {
  for (const kind of kinds) {
    const hits = records.filter((r) => r.kind === kind);
    if (!hits.length) continue;
    console.log(`\n  ${title} ${kind} (${hits.length}):`);
    for (const r of hits) {
      const freq = (r.siteFreq ?? r.dbFreq ?? 0).toFixed(2).padStart(7);
      const district = (r.siteDistrict ?? r.dbDistrict ?? '').padEnd(16);
      const who = r.kind === 'MISSING_ON_SITE'
        ? `id_fm ${r.idFm} ${r.dbName}${r.dbRevoked ? ' [revoked]' : ''}`
        : `${r.siteName}${r.idFm ? ` ↔ id_fm ${r.idFm} ${r.dbName}` : ''}`;
      console.log(`   ${freq}  ${district}  ${who}  ${r.notes.join('; ')}`);
    }
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const all = filterToCoverage(load()) as TypedRow[];
  const typeOf = new Map(all.map((r) => [r, r.stnType]));
  const findType = (rec: DiffRecord) =>
    all.find((r) => r.name === rec.siteName && r.freq === rec.siteFreq && stripThaiGeoPrefix(r.district) === rec.siteDistrict)?.stnType ?? null;

  const provinces = [...new Set(all.map((r) => stripThaiGeoPrefix(r.province)))];
  const db: DbStationRow[] = await prisma.fm_station.findMany({
    where: { province: { in: provinces } },
    select: { id_fm: true, name: true, province: true, district: true, freq: true, lat: true, long: true, revoked: true },
  });
  await prisma.$disconnect();

  const business = all.filter((r) => typeOf.get(r) === BUSINESS);
  const others = all.filter((r) => typeOf.get(r) !== BUSINESS);
  console.log(`register: ${all.length} (${business.length} ${BUSINESS}, ${others.length} other types)`);
  console.log(`db: ${db.length} rows in ${provinces.join('/')}`);

  // Step 1
  const step1 = buildDiff(business, db);
  console.log(`\n=== STEP 1: ${BUSINESS} vs all DB rows ===`);
  console.log('  ', tally(step1));
  show('step1', step1, ['NEW', 'FREQ_CHANGED', 'LIKELY_SAME', 'COORD_MOVED']);

  // Step 2 — the DB rows step 1 could not account for
  const leftoverIds = new Set(step1.filter((r) => r.kind === 'MISSING_ON_SITE').map((r) => r.idFm));
  const leftoverDb = db.filter((d) => leftoverIds.has(d.id_fm));
  const step2 = buildDiff(others, leftoverDb);
  console.log(`\n=== STEP 2: other types vs the ${leftoverDb.length} DB rows step 1 left over ===`);
  const byType = others.reduce<Record<string, number>>((a, r) => ((a[r.stnType] = (a[r.stnType] ?? 0) + 1), a), {});
  console.log('   register types:', byType);
  console.log('  ', tally(step2));
  show('step2', step2, ['FREQ_CHANGED', 'LIKELY_SAME', 'COORD_MOVED', 'MISSING_ON_SITE']);

  // Per-type match counts in step 2
  const perType: Record<string, Record<string, number>> = {};
  for (const r of step2) {
    if (r.kind === 'MISSING_ON_SITE') continue;
    const t = findType(r) ?? '?';
    perType[t] ??= {};
    perType[t][r.kind] = (perType[t][r.kind] ?? 0) + 1;
  }
  console.log('\n   step 2 by type:', perType);

  const stamp = new Date().toISOString().slice(0, 10);
  const csvPath = path.join(process.cwd(), 'reports', `register-by-type-${stamp}.csv`);
  fs.mkdirSync(path.dirname(csvPath), { recursive: true });
  const header = 'step,kind,matchedOn,stnType,stationId,nbtcCode,siteName,siteFreq,siteDistrict,licenceNo,idFm,dbName,dbFreq,dbDistrict,dbRevoked,distanceM,notes';
  fs.writeFileSync(csvPath, [
    header,
    ...step1.map((r) => line('1-business', r, r.kind === 'MISSING_ON_SITE' ? null : findType(r))),
    ...step2.map((r) => line('2-other', r, r.kind === 'MISSING_ON_SITE' ? null : findType(r))),
  ].join('\n'), 'utf8');
  console.log(`\nwrote: ${csvPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
