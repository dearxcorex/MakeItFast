/* eslint-disable no-console */
/**
 * Sync harvested NBTC register rows into fm_station.
 *
 *   --types=business  ประเภทกิจการทางธุรกิจ ระดับท้องถิ่น rows, compared with every DB row
 *   --types=other     every other type, licence not expired, FM band only, compared with
 *                     the DB rows the business rows do not already claim
 *
 *   - Same station in the DB  -> overwrite name / freq / lat / long / district / nbtc_code / id_fm
 *   - Not in the DB           -> insert, tagged source=SOURCE_TAG, so it plots as a pending pin
 *
 * A freq+district hit on a *revoked* DB row is a new licensee on the old slot, not the
 * same station: every such row carries "<org> เป็นผู้รับใบอนุญาต…รายใหม่" in permit, and
 * that org is the register row's org. The revoked row keeps its history and the new
 * licensee is inserted beside it. Inspection, on_air, revoked and permit are never touched.
 *
 *   npx tsx scripts/sync-register.ts --types=other            # dry-run
 *   npx tsx scripts/sync-register.ts --types=other --apply
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

const APPLY = process.argv.includes('--apply');
const TYPES = process.argv.find((a) => a.startsWith('--types='))?.slice('--types='.length);
const BUSINESS = 'ประเภทกิจการทางธุรกิจ ระดับท้องถิ่น';
const MAIN = 'สถานีวิทยุหลัก';
const SOURCE_TAG = 'nbtc_oper_2569_09';
const RAW_DIR = path.join(process.cwd(), 'data', 'nbtc-raw');
const FILES = ['stations-ชัยภูมิ.json', 'stations-นครราชสีมา.json'];
const TODAY = new Date().toISOString().slice(0, 10);
// The register lists AM stations (567, 729, 1008 kHz …) under the same type.
const FM_BAND: [number, number] = [87.5, 108];

const prisma = new PrismaClient();

type TypedRow = RegisterRow & { stnType: string | null; licenceExpires: string | null; updated: string | null };

function loadRows(): TypedRow[] {
  const out: TypedRow[] = [];
  for (const file of FILES) {
    const raw = JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), 'utf8')) as Record<string, unknown>[];
    for (const r of raw) {
      const stationId = Number(String(r.station_id ?? '').trim());
      const lat = r.lat == null ? null : Number(r.lat);
      const lng = r.lng == null ? null : Number(r.lng);
      out.push({
        stationId: Number.isSafeInteger(stationId) && stationId > 0 ? stationId : null,
        nbtcCode: r.nbtc_code ? String(r.nbtc_code).trim() : null,
        name: String(r.name ?? '').trim(),
        org: r.org ? String(r.org).trim() : null,
        licenceNo: r.licence_no ? String(r.licence_no).trim() : null,
        freq: parseFreq(r.freq as number | string | null) ?? 0,
        province: String(r.province ?? '').trim(),
        district: String(r.district ?? '').trim(),
        tambon: r.tambon ? String(r.tambon).trim() : null,
        address: r.address ? String(r.address).trim() : null,
        lat: lat !== null && Number.isFinite(lat) ? lat : null,
        lng: lng !== null && Number.isFinite(lng) ? lng : null,
        stnType: r.stn_type ? String(r.stn_type) : null,
        licenceExpires: r.licence_expires ? String(r.licence_expires) : null,
        updated: r.updated ? String(r.updated) : null,
      });
    }
  }
  return filterToCoverage(out) as TypedRow[];
}

const slot = (r: RegisterRow) => `${r.freq}|${stripThaiGeoPrefix(r.district)}`;

const isSameStation = (r: DiffRecord) => r.matchedOn === 'station-id' || !r.dbRevoked;

/** A few register rows carry the licensee company in the name field; keep the DB name then. */
const isOrgName = (name: string) => /^(ห้างหุ้นส่วน|บริษัท)/.test(name);

/** fm_station.type is a comparison value in the UI, so only the existing vocabulary is used. */
const dbTypeFor = (r: TypedRow) =>
  r.stnType === MAIN || /^B[1I]-/.test(r.licenceNo ?? '') ? 'สถานีหลัก' : 'บริการธุรกิจ';

async function main(): Promise<void> {
  if (TYPES !== 'business' && TYPES !== 'other') {
    console.error('usage: npx tsx scripts/sync-register.ts --types=business|other [--apply]');
    process.exit(1);
  }

  const all = loadRows();
  const business = all.filter((r) => r.stnType === BUSINESS);
  const provinces = [...new Set(all.map((r) => stripThaiGeoPrefix(r.province)))];
  const db: DbStationRow[] = (await prisma.fm_station.findMany({
    where: { province: { in: provinces }, register_station_id: { not: null } },
    select: { register_station_id: true, name: true, province: true, district: true, freq: true, lat: true, long: true, revoked: true },
  })).filter((r): r is DbStationRow => r.register_station_id !== null);

  let register: TypedRow[];
  let pool: DbStationRow[];
  if (TYPES === 'business') {
    register = business;
    pool = db;
  } else {
    const others = all.filter((r) => r.stnType !== BUSINESS);
    const skipped: [string, TypedRow][] = [];
    const businessKeys = new Set(business.flatMap((r) => [slot(r), r.nbtcCode, r.licenceNo].filter(Boolean)));
    const bySlot = new Map<string, TypedRow>();
    for (const r of others) {
      if (!r.licenceExpires) skipped.push(['no expiry date', r]);
      else if (r.licenceExpires < TODAY) skipped.push(['expired', r]);
      else if (r.freq < FM_BAND[0] || r.freq > FM_BAND[1]) skipped.push(['not FM (AM kHz)', r]);
      else if ([slot(r), r.nbtcCode, r.licenceNo].some((k) => k && businessKeys.has(k))) skipped.push(['same slot/licence as a business row', r]);
      else {
        const prev = bySlot.get(slot(r));
        if (prev && (prev.updated ?? '') >= (r.updated ?? '')) skipped.push(['duplicate register row', r]);
        else {
          if (prev) skipped.push(['duplicate register row', prev]);
          bySlot.set(slot(r), r);
        }
      }
    }
    register = [...bySlot.values()];

    const counts = skipped.reduce<Record<string, number>>((a, [why]) => ((a[why] = (a[why] ?? 0) + 1), a), {});
    console.log(`other-type rows: ${others.length}   kept: ${register.length}   skipped:`, counts);
    for (const [why, r] of skipped.filter(([w]) => w !== 'expired')) {
      console.log(`  skip (${why})  ${r.freq}  ${stripThaiGeoPrefix(r.district)}  ${r.name}  exp=${r.licenceExpires ?? '-'}`);
    }

    // Never let an other-type row take over a station the business register already claims.
    const claimed = new Set(
      buildDiff(business, db).filter((r) => r.kind !== 'MISSING_ON_SITE' && r.idFm !== null).map((r) => r.idFm),
    );
    pool = db.filter((d) => !claimed.has(d.register_station_id));
    console.log(`db rows: ${db.length}   not claimed by business rows: ${pool.length}\n`);
  }

  const records = buildDiff(register, pool).filter((r) => r.kind !== 'MISSING_ON_SITE');

  // Recover the full register row (province, coords, type) behind each diff record.
  const source = (r: DiffRecord) =>
    register.find((x) => x.nbtcCode === r.nbtcCode && x.name === r.siteName && x.freq === r.siteFreq)!;

  const matched = records.filter((r) => r.idFm !== null && r.kind !== 'LIKELY_SAME');
  const updates = matched.filter(isSameStation);
  const newLicensees = matched.filter((r) => !isSameStation(r));
  const inserts = [...records.filter((r) => r.idFm === null || r.kind === 'LIKELY_SAME'), ...newLicensees];

  const dupes = updates.map((r) => r.idFm).filter((id, i, a) => a.indexOf(id) !== i);
  if (dupes.length) throw new Error(`two register rows map onto StationID ${dupes.join(', ')}`);

  console.log(`register rows: ${register.length}   db rows compared: ${pool.length}`);
  console.log(`update ${updates.length}   insert ${inserts.length} (${newLicensees.length} new licensees beside a revoked row)\n`);

  const changes = updates.map((r) => {
    const s = source(r);
    const data: Record<string, unknown> = {
      ...(isOrgName(s.name) ? {} : { name: s.name }),
      freq: s.freq,
      district: stripThaiGeoPrefix(s.district),
      nbtc_code: s.nbtcCode,
      // The code is also the identifier the UI prints, so it lands in id_fm too;
      // a row without one keeps the StationID digits it already has.
      ...(s.nbtcCode ? { id_fm: s.nbtcCode } : {}),
      ...(s.lat !== null && s.lng !== null ? { lat: s.lat, long: s.lng } : {}),
    };
    const before = db.find((d) => d.register_station_id === r.idFm)!;
    const diff = Object.entries(data).filter(([k, v]) => {
      const old = (before as unknown as Record<string, unknown>)[k];
      return k === 'nbtc_code' || k === 'id_fm' ? true : old !== v;
    });
    return { idFm: r.idFm!, data, before, diff, record: r };
  });

  console.log('UPDATE (fields that change):');
  for (const c of changes) {
    const shown = c.diff.filter(([k]) => k !== 'nbtc_code' && k !== 'id_fm' && k !== 'long')
      .map(([k, v]) => (k === 'lat' ? `coords ${Math.round(c.record.distanceM ?? 0)}m` : `${k} ${(c.before as unknown as Record<string, unknown>)[k]} → ${v}`));
    console.log(`  ${String(c.idFm).padEnd(8)} ${c.before.name}${c.before.revoked ? ' [revoked]' : ''}  ${shown.join('; ') || '(code only)'}`);
  }

  const insertData = inserts.map((r) => {
    const s = source(r);
    return {
      name: s.name,
      freq: s.freq,
      lat: s.lat,
      long: s.lng,
      district: stripThaiGeoPrefix(s.district),
      province: stripThaiGeoPrefix(s.province),
      type: dbTypeFor(s),
      // Newly licensed and not yet inspected: the pending bucket, not a confirmed OFF AIR pin.
      on_air: true,
      revoked: false,
      inspection_68: false,
      inspection_69: false,
      nbtc_code: s.nbtcCode,
      // No StationID on a results-table row: register_station_id stays NULL and
      // id_fm carries the NBTC code, which is what the UI prints as ID.
      id_fm: s.nbtcCode,
      source: SOURCE_TAG,
      created_at: new Date(),
    };
  });
  console.log('\nINSERT:');
  for (const [i, d] of insertData.entries()) {
    const r = inserts[i];
    const why = r.idFm ? `new licensee beside StationID ${r.idFm} ${r.dbName} [revoked]` : 'not in db';
    console.log(`  ${d.freq.toFixed(2).padStart(6)}  ${d.province}/${d.district}  ${d.name}  [${d.type}]  (${why})${d.lat === null ? '  NO COORDS' : ''}`);
  }

  if (!APPLY) {
    console.log('\n(dry-run — re-run with --apply)');
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = path.join(RAW_DIR, `pre-sync-${TYPES}-snapshot-${stamp}.json`);
  const snapshot = await prisma.fm_station.findMany({ where: { register_station_id: { in: changes.map((c) => c.idFm) } } });
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`\nsnapshot of ${snapshot.length} rows: ${snapshotPath}`);

  const [inserted, ...updated] = await prisma.$transaction([
    prisma.fm_station.createMany({ data: insertData }),
    ...changes.map((c) => prisma.fm_station.update({ where: { register_station_id: c.idFm }, data: c.data })),
  ]);
  console.log(`updated ${updated.length}, inserted ${(inserted as { count: number }).count}`);
  console.log(`undo updates: restore from ${path.basename(snapshotPath)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
