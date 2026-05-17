/* eslint-disable no-console */
/**
 * Backfill fm_station.permit from the xlsx หมายเหตุ column for the 3 target
 * provinces. Skips rows whose note is blank or whitespace-only.
 *
 *   npx tsx scripts/backfill-permit-from-xlsx.ts            # dry-run
 *   npx tsx scripts/backfill-permit-from-xlsx.ts --apply
 */
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import {
  TARGET_PROVINCES,
  parseXlsxRows,
  filterByProvinces,
  type RawXlsxRow,
} from '../src/utils/offairAudit';

const POSITIONAL = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const XLSX_PATH = POSITIONAL[0]
  ?? '/Users/deardevx/Downloads/สทช2304_266_2569-20.xlsx';
const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<RawXlsxRow>(ws, { defval: null });
  const filtered = filterByProvinces(parseXlsxRows(raw), TARGET_PROVINCES);

  const permitByIdFm = new Map<number, string>();
  for (const r of filtered) {
    const trimmed = r.note.trim();
    if (trimmed.length > 0) permitByIdFm.set(r.idFm, trimmed);
  }
  console.log(`xlsx rows in 3 provinces=${filtered.length}; with non-blank note=${permitByIdFm.size}`);

  const prisma = new PrismaClient();

  const present = await prisma.fm_station.findMany({
    where: { id_fm: { in: Array.from(permitByIdFm.keys()) } },
    select: { id_fm: true, permit: true, name: true },
  });
  console.log(`db rows that exist: ${present.length}/${permitByIdFm.size}`);

  for (const s of present.slice(0, 10)) {
    const newP = permitByIdFm.get(s.id_fm)!;
    console.log(`  ${s.id_fm}  ${s.name}\n    OLD: ${s.permit ?? '(null)'}\n    NEW: ${newP}`);
  }

  if (!APPLY) {
    console.log('\n(dry-run only — re-run with --apply to write)');
    await prisma.$disconnect();
    return;
  }

  let written = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of present) {
      const newP = permitByIdFm.get(row.id_fm)!;
      if (row.permit === newP) continue;
      await tx.fm_station.update({ where: { id_fm: row.id_fm }, data: { permit: newP } });
      written++;
    }
  });
  console.log(`\nupdated ${written} rows`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
