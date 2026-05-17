/* eslint-disable no-console */
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import {
  TARGET_PROVINCES,
  parseXlsxRows,
  filterByProvinces,
  buildAuditRecords,
  chooseApplyTargets,
  type RawXlsxRow,
  type DbStationRow,
} from '../src/utils/offairAudit';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
const REPORT_DIR = path.join(process.cwd(), 'reports');

async function main(): Promise<void> {
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`xlsx not found: ${XLSX_PATH}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(XLSX_PATH);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<RawXlsxRow>(ws, { defval: null });

  const parsed = parseXlsxRows(raw);
  const filtered = filterByProvinces(parsed, TARGET_PROVINCES);
  console.log(`xlsx rows total=${parsed.length}, filtered to 3 provinces=${filtered.length}`);

  const prisma = new PrismaClient();
  const dbRows = await prisma.fm_station.findMany({
    where: { province: { in: [...TARGET_PROVINCES] } },
    select: { id_fm: true, name: true, province: true, district: true, freq: true, on_air: true },
  }) as DbStationRow[];
  console.log(`db rows in 3 provinces=${dbRows.length}`);

  const records = buildAuditRecords(filtered, dbRows);
  const counts = {
    STILL_ON_AIR: records.filter((r) => r.classification === 'STILL_ON_AIR').length,
    ALREADY_OFF_AIR: records.filter((r) => r.classification === 'ALREADY_OFF_AIR').length,
    ON_AIR_UNKNOWN: records.filter((r) => r.classification === 'ON_AIR_UNKNOWN').length,
    MISSING_IN_DB: records.filter((r) => r.classification === 'MISSING_IN_DB').length,
  };
  console.log('classification counts:', counts);

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const csvPath = path.join(REPORT_DIR, `offair-audit-${stamp}.csv`);
  const header = [
    'idFm', 'stationCodeRaw', 'xlsxName', 'xlsxProvince', 'xlsxDistrict', 'xlsxFreq',
    'foundInDb', 'dbName', 'dbProvince', 'dbFreq', 'dbOnAir',
    'classification', 'warnings',
  ].join(',');
  const csvEscape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = records.map((r) => [
    r.idFm, r.stationCodeRaw, r.xlsxName, r.xlsxProvince, r.xlsxDistrict, r.xlsxFreq,
    r.foundInDb, r.dbName, r.dbProvince, r.dbFreq, r.dbOnAir,
    r.classification, r.warnings.join('|'),
  ].map(csvEscape).join(','));
  fs.writeFileSync(csvPath, [header, ...lines].join('\n'), 'utf8');
  console.log(`wrote: ${csvPath}`);

  console.log('\nSTILL_ON_AIR (top 20):');
  for (const r of records.filter((x) => x.classification === 'STILL_ON_AIR').slice(0, 20)) {
    console.log(`  ${r.idFm}  ${r.xlsxFreq.toFixed(2).padStart(7)}  ${r.xlsxProvince.padEnd(10)}  ${r.xlsxName}`);
  }

  if (APPLY) {
    const { revokeIds, offAirIds } = chooseApplyTargets(records);
    console.log(
      `\n--apply: revoking ${revokeIds.length} ids; setting on_air=false on ${offAirIds.length} of those`
    );
    console.log(`note tag: "${NOTE}"`);
    if (revokeIds.length > 0) {
      const [revokeRes, offairRes] = await prisma.$transaction([
        prisma.fm_station.updateMany({
          where: { id_fm: { in: revokeIds } },
          data: { revoked: true, revoked_note: NOTE },
        }),
        prisma.fm_station.updateMany({
          where: { id_fm: { in: offAirIds } },
          data: { on_air: false },
        }),
      ]);
      console.log(`revoked rows updated: ${revokeRes.count}`);
      console.log(`on_air flipped: ${offairRes.count}`);
    }
  } else {
    console.log('\n(dry-run only — re-run with --apply to revoke + flip on_air=false)');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
