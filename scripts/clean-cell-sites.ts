/* eslint-disable no-console */
/**
 * Clean the NBTC ASMS cell-site export down to what the Cell Sites map reads:
 * coverage provinces only, DTN folded into TUC, one row per exact location.
 *
 *   npx tsx scripts/clean-cell-sites.ts ~/Downloads/_Export.xlsx
 *
 * Writes data/cell-sites/cell-sites-clean.csv (committed, overwritten on each run)
 * and a git-ignored report of locations where no row has a licence or a code.
 * Never touches the database.
 */
import * as XLSX from 'xlsx';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TARGET_PROVINCES } from '../src/utils/offairAudit';
import {
  CELL_OPERATORS,
  cleanCellSites,
  cellSitesToCsv,
  type CellSite,
  type RawCellSiteRow,
} from '../src/utils/cellSites';

const XLSX_PATH = process.argv.slice(2).find((a) => !a.startsWith('--'));
const OUT_PATH = path.join(process.cwd(), 'data', 'cell-sites', 'cell-sites-clean.csv');
const REPORT_DIR = path.join(process.cwd(), 'reports');

const countBy = (sites: CellSite[], key: (s: CellSite) => string | null) =>
  sites.reduce<Record<string, number>>((acc, s) => {
    const k = key(s) ?? '(none)';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

function main(): void {
  if (!XLSX_PATH || !fs.existsSync(XLSX_PATH)) {
    console.error('usage: npx tsx scripts/clean-cell-sites.ts <_Export.xlsx>');
    console.error(XLSX_PATH ? `not found: ${XLSX_PATH}` : 'no input file given');
    process.exit(1);
  }

  const wb = XLSX.readFile(XLSX_PATH);
  const raw = XLSX.utils.sheet_to_json<RawCellSiteRow>(wb.Sheets[wb.SheetNames[0]], { defval: null });
  const { sites, rejects, licenceRows, outsideCoverage } = cleanCellSites(raw, TARGET_PROVINCES);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, cellSitesToCsv(sites), 'utf8');

  const stamp = new Date().toISOString().slice(0, 10);
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const rejectsPath = path.join(REPORT_DIR, `cell-site-rejects-${stamp}.csv`);
  fs.writeFileSync(rejectsPath, cellSitesToCsv(rejects), 'utf8');

  const licences = sites.reduce((n, s) => n + CELL_OPERATORS.reduce((m, op) => m + s.licences[op].length, 0), 0);
  console.log(`export rows:       ${raw.length}`);
  console.log(`outside coverage:  ${outsideCoverage} (keeping ${TARGET_PROVINCES.join(', ')})`);
  console.log(`in coverage:       ${licenceRows} licence rows`);
  console.log(`sites:             ${sites.length} locations holding ${licences} licences → ${path.relative(process.cwd(), OUT_PATH)}`);
  console.log(`  by province:     ${JSON.stringify(countBy(sites, (s) => s.province))}`);
  console.log(`  operator mix:    ${JSON.stringify(countBy(sites, (s) => s.operators.join('+')))}`);
  console.log(`rejected:          ${rejects.length} locations → ${path.relative(process.cwd(), rejectsPath)}`);
}

main();
