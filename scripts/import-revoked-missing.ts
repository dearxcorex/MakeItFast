/* eslint-disable no-console */
/**
 * One-off importer for stations that appear in an NBTC revoke notice but are
 * missing from the local fm_station table. Inserts them with revoked=true,
 * on_air=false, and lat/long=null (xlsx does not provide coordinates).
 *
 * Default xlsx + provinces match scripts/audit-offair.ts.
 *
 *   npx tsx scripts/import-revoked-missing.ts                # dry-run report
 *   npx tsx scripts/import-revoked-missing.ts --apply        # actually insert
 *   npx tsx scripts/import-revoked-missing.ts --apply --note "OTHER NOTE"
 */
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import {
  TARGET_PROVINCES,
  parseXlsxRows,
  filterByProvinces,
  buildAuditRecords,
  type RawXlsxRow,
  type DbStationRow,
} from '../src/utils/offairAudit';

const POSITIONAL = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const NEXT_AFTER_NOTE = (() => {
  const i = process.argv.indexOf('--note');
  return i >= 0 ? i + 1 : -1;
})();
const POSITIONAL_PATHS = process.argv
  .slice(2)
  .filter((a, i) => !a.startsWith('--') && i + 2 !== NEXT_AFTER_NOTE);
const XLSX_PATH = POSITIONAL_PATHS[0]
  ?? POSITIONAL[0]
  ?? '/Users/deardevx/Downloads/สทช2304_266_2569-20.xlsx';

const APPLY = process.argv.includes('--apply');
const NOTE_INDEX = process.argv.indexOf('--note');
const NOTE = NOTE_INDEX >= 0 && process.argv[NOTE_INDEX + 1]
  ? process.argv[NOTE_INDEX + 1]
  : 'NBTC สทช2304/266/2569';

async function main(): Promise<void> {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<RawXlsxRow>(ws, { defval: null });
  const parsed = parseXlsxRows(raw);
  const filtered = filterByProvinces(parsed, TARGET_PROVINCES);

  const prisma = new PrismaClient();
  const dbRows = await prisma.fm_station.findMany({
    where: { province: { in: [...TARGET_PROVINCES] } },
    select: { id_fm: true, name: true, province: true, district: true, freq: true, on_air: true },
  }) as DbStationRow[];

  const records = buildAuditRecords(filtered, dbRows);
  const missing = records.filter((r) => r.classification === 'MISSING_IN_DB');
  console.log(
    `xlsx in 3 provinces=${filtered.length}, db rows=${dbRows.length}, missing=${missing.length}`
  );

  if (missing.length === 0) {
    console.log('nothing to import.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nMISSING_IN_DB to import (top 20):');
  for (const m of missing.slice(0, 20)) {
    console.log(`  ${m.idFm}  ${m.xlsxFreq.toFixed(2).padStart(7)}  ${m.xlsxProvince.padEnd(10)}  ${m.xlsxDistrict.padEnd(16)}  ${m.xlsxName}`);
  }

  if (!APPLY) {
    console.log('\n(dry-run only — re-run with --apply to insert)');
    await prisma.$disconnect();
    return;
  }

  // Pull the parsed xlsx row alongside each MISSING record so we have the type column.
  const parsedById = new Map<number, typeof filtered[number]>();
  for (const p of filtered) parsedById.set(p.idFm, p);

  const data = missing.map((m) => {
    const p = parsedById.get(m.idFm);
    const noteTrimmed = (p?.note ?? '').trim();
    return {
      id_fm: m.idFm,
      name: p?.name || m.xlsxName,
      freq: m.xlsxFreq,
      lat: null,
      long: null,
      district: m.xlsxDistrict,
      province: m.xlsxProvince,
      type: p?.type || null,
      inspection_68: false,
      inspection_69: false,
      on_air: false,
      submit_a_request: false,
      revoked: true,
      revoked_note: NOTE,
      permit: noteTrimmed.length > 0 ? noteTrimmed : null,
    };
  });

  const result = await prisma.fm_station.createMany({
    data,
    skipDuplicates: true, // idempotent re-runs (no-op on existing id_fm)
  });
  console.log(`\ninserted: ${result.count} rows (skipped ${data.length - result.count} duplicates)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
