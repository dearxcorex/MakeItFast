/* eslint-disable no-console */
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
import * as fs from 'node:fs';
import * as path from 'node:path';

const XLSX_PATH = process.argv[2]
  ?? '/Users/deardevx/Downloads/สทช2304_266_2569-20.xlsx';
const APPLY = process.argv.includes('--apply');
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
    const targets = records
      .filter((r) => r.classification === 'STILL_ON_AIR')
      .map((r) => r.idFm);
    console.log(`\n--apply: setting on_air=false for ${targets.length} ids`);
    if (targets.length > 0) {
      const result = await prisma.fm_station.updateMany({
        where: { id_fm: { in: targets } },
        data: { on_air: false },
      });
      console.log(`updated ${result.count} rows`);
    }
  } else {
    console.log('\n(dry-run only — re-run with --apply to flip on_air=false)');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
