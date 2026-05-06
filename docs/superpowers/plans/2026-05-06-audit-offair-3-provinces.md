# Off-Air Audit (Northeast 3 Provinces) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cross-reference the NBTC xlsx (`/Users/deardevx/Downloads/สทช2304_266_2569-20.xlsx`) against `fm_station` rows in three Northeast provinces (นครราชสีมา, ชัยภูมิ, บุรีรัมย์) and produce a report of every station that is still flagged `on_air = true` in the DB but appears in the xlsx — i.e. the rows the user wants to verify "must be off-air."

**Architecture:** Two-layer one-off script under `scripts/audit-offair.ts`:
1. **Pure logic** lives in `src/utils/offairAudit.ts` (parsing, filtering, joining, classifying). This is unit-tested with vitest.
2. **I/O wrapper** lives in `scripts/audit-offair.ts`. It loads the xlsx via the already-installed `xlsx` (SheetJS) package, queries Prisma for the three provinces, calls the pure functions, and prints/writes a report.

Phase 2 (gated) provides an `--apply` flag that runs `on_air = false` for every matched id_fm inside a Prisma transaction, only after the user has reviewed the dry-run report.

**Tech Stack:** TypeScript, Prisma 5, SheetJS (`xlsx@^0.18`), vitest, `tsx` for ad-hoc Node scripts (already used by `scripts/`).

**Verified before planning:**
- Schema: `fm_station.on_air: Boolean?` (default false) — "off air" means `on_air = false`. Match key: `int(xlsx['รหัสสถานี'])` equals `fm_station.id_fm` (verified: xlsx code `'05520117'` → DB `id_fm = 5520117`).
- xlsx headers: `ลำดับ, รหัสสถานี, ชื่อสถานี, ประเภท, คลื่นความถี่เดิม, จังหวัด, เขต/อำเภอ, ผู้ทดลองออกอากาศเดิม, หมายเหตุ` (sheet `เอกสารแนบ`, 1790 data rows).
- xlsx target-province counts: ชัยภูมิ 27, นครราชสีมา 51, บุรีรัมย์ 26 — total **104 rows** to audit.
- DB province totals (today): นครราชสีมา 127 (112 on_air), ชัยภูมิ 61 (46 on_air), บุรีรัมย์ 67 (58 on_air).
- vitest config picks up only `src/**/*.test.{ts,tsx}` — pure logic must live under `src/` to be tested.

---

## Task 1: Pure audit functions + types

**Files:**
- Create: `src/utils/offairAudit.ts`
- Test:   `src/__tests__/offairAudit.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/offairAudit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  TARGET_PROVINCES,
  parseXlsxRows,
  filterByProvinces,
  buildAuditRecords,
  type RawXlsxRow,
  type DbStationRow,
} from '@/utils/offairAudit';

describe('TARGET_PROVINCES', () => {
  it('contains the three Northeast provinces', () => {
    expect(TARGET_PROVINCES).toEqual(['นครราชสีมา', 'ชัยภูมิ', 'บุรีรัมย์']);
  });
});

describe('parseXlsxRows', () => {
  it('parses station code "05520117" to numeric id 5520117', () => {
    const rows: RawXlsxRow[] = [{
      'ลำดับ': 1,
      'รหัสสถานี': '05520117',
      'ชื่อสถานี': 'เสียงชนเสรี',
      'ประเภท': 'ธุรกิจ',
      'คลื่นความถี่เดิม': 106,
      'จังหวัด': 'นครราชสีมา',
      'เขต/อำเภอ': 'คง',
      'ผู้ทดลองออกอากาศเดิม': 'ห้างหุ้นส่วนจำกัด เสียงชนเสรี',
      'หมายเหตุ': ' ',
    }];
    const parsed = parseXlsxRows(rows);
    expect(parsed).toEqual([{
      idFm: 5520117,
      stationCodeRaw: '05520117',
      name: 'เสียงชนเสรี',
      province: 'นครราชสีมา',
      district: 'คง',
      freq: 106,
      type: 'ธุรกิจ',
      note: ' ',
    }]);
  });

  it('skips rows with no station code or non-numeric code', () => {
    const rows: RawXlsxRow[] = [
      { 'ลำดับ': 1, 'รหัสสถานี': null, 'ชื่อสถานี': 'X', 'ประเภท': '', 'คลื่นความถี่เดิม': 0, 'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
      { 'ลำดับ': 2, 'รหัสสถานี': 'ABC', 'ชื่อสถานี': 'Y', 'ประเภท': '', 'คลื่นความถี่เดิม': 0, 'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
      { 'ลำดับ': 3, 'รหัสสถานี': '05520117', 'ชื่อสถานี': 'OK', 'ประเภท': '', 'คลื่นความถี่เดิม': 88, 'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
    ];
    const parsed = parseXlsxRows(rows);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].idFm).toBe(5520117);
  });

  it('accepts numeric station code (some xlsx cells are numbers, not strings)', () => {
    const rows: RawXlsxRow[] = [{
      'ลำดับ': 1, 'รหัสสถานี': 5520117 as unknown as string,
      'ชื่อสถานี': 'X', 'ประเภท': '', 'คลื่นความถี่เดิม': 0,
      'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '',
    }];
    expect(parseXlsxRows(rows)[0].idFm).toBe(5520117);
  });
});

describe('filterByProvinces', () => {
  it('keeps only rows whose province is in the target set', () => {
    const parsed = parseXlsxRows([
      { 'ลำดับ': 1, 'รหัสสถานี': '05520001', 'ชื่อสถานี': 'A', 'ประเภท': '', 'คลื่นความถี่เดิม': 88, 'จังหวัด': 'กระบี่', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
      { 'ลำดับ': 2, 'รหัสสถานี': '05520002', 'ชื่อสถานี': 'B', 'ประเภท': '', 'คลื่นความถี่เดิม': 89, 'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
      { 'ลำดับ': 3, 'รหัสสถานี': '05520003', 'ชื่อสถานี': 'C', 'ประเภท': '', 'คลื่นความถี่เดิม': 90, 'จังหวัด': 'ชัยภูมิ',   'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
      { 'ลำดับ': 4, 'รหัสสถานี': '05520004', 'ชื่อสถานี': 'D', 'ประเภท': '', 'คลื่นความถี่เดิม': 91, 'จังหวัด': 'บุรีรัมย์', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
    ]);
    const out = filterByProvinces(parsed, TARGET_PROVINCES);
    expect(out.map((r) => r.province)).toEqual(['นครราชสีมา', 'ชัยภูมิ', 'บุรีรัมย์']);
  });
});

describe('buildAuditRecords', () => {
  const xlsxRows = parseXlsxRows([
    { 'ลำดับ': 1, 'รหัสสถานี': '05520117', 'ชื่อสถานี': 'เสียงชนเสรี',  'ประเภท': '', 'คลื่นความถี่เดิม': 106,  'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': 'คง', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
    { 'ลำดับ': 2, 'รหัสสถานี': '05520154', 'ชื่อสถานี': 'วัดบ้านหมัน', 'ประเภท': '', 'คลื่นความถี่เดิม': 88.25, 'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': 'คง', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
    { 'ลำดับ': 3, 'รหัสสถานี': '05520999', 'ชื่อสถานี': 'GHOST',         'ประเภท': '', 'คลื่นความถี่เดิม': 99,    'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': 'X', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
  ]);

  const dbRows: DbStationRow[] = [
    { id_fm: 5520117, name: 'เสียงชนเสรี',  province: 'นครราชสีมา', district: 'คง', freq: 106,    on_air: true  },
    { id_fm: 5520154, name: 'วัดบ้านหมัน', province: 'นครราชสีมา', district: 'คง', freq: 88.25, on_air: false },
  ];

  const records = buildAuditRecords(xlsxRows, dbRows);

  it('flags an on_air=true match as STILL_ON_AIR', () => {
    const r = records.find((x) => x.idFm === 5520117)!;
    expect(r.classification).toBe('STILL_ON_AIR');
    expect(r.dbOnAir).toBe(true);
    expect(r.foundInDb).toBe(true);
  });

  it('flags an on_air=false match as ALREADY_OFF_AIR', () => {
    const r = records.find((x) => x.idFm === 5520154)!;
    expect(r.classification).toBe('ALREADY_OFF_AIR');
    expect(r.dbOnAir).toBe(false);
  });

  it('flags an xlsx row with no DB row as MISSING_IN_DB', () => {
    const r = records.find((x) => x.idFm === 5520999)!;
    expect(r.classification).toBe('MISSING_IN_DB');
    expect(r.foundInDb).toBe(false);
    expect(r.dbOnAir).toBeNull();
  });

  it('returns one record per xlsx row, in input order', () => {
    expect(records.map((r) => r.idFm)).toEqual([5520117, 5520154, 5520999]);
  });

  it('warns when DB province/name disagrees with xlsx for the same id_fm', () => {
    const xlsx = parseXlsxRows([
      { 'ลำดับ': 1, 'รหัสสถานี': '05520117', 'ชื่อสถานี': 'A', 'ประเภท': '', 'คลื่นความถี่เดิม': 100, 'จังหวัด': 'นครราชสีมา', 'เขต/อำเภอ': '', 'ผู้ทดลองออกอากาศเดิม': '', 'หมายเหตุ': '' },
    ]);
    const db: DbStationRow[] = [
      { id_fm: 5520117, name: 'B-DIFFERENT', province: 'ขอนแก่น', district: '', freq: 100, on_air: true },
    ];
    const r = buildAuditRecords(xlsx, db)[0];
    expect(r.warnings).toContain('province-mismatch');
    expect(r.warnings).toContain('name-mismatch');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/offairAudit.test.ts
```

Expected: FAIL with "Cannot find module '@/utils/offairAudit'".

- [ ] **Step 3: Implement the pure functions**

Create `src/utils/offairAudit.ts`:

```ts
export const TARGET_PROVINCES = ['นครราชสีมา', 'ชัยภูมิ', 'บุรีรัมย์'] as const;
export type TargetProvince = (typeof TARGET_PROVINCES)[number];

/** Shape of one row as SheetJS returns it from the xlsx file (header → cell). */
export interface RawXlsxRow {
  'ลำดับ': number | string | null;
  'รหัสสถานี': string | number | null;
  'ชื่อสถานี': string | null;
  'ประเภท': string | null;
  'คลื่นความถี่เดิม': number | string | null;
  'จังหวัด': string | null;
  'เขต/อำเภอ': string | null;
  'ผู้ทดลองออกอากาศเดิม': string | null;
  'หมายเหตุ': string | null;
}

export interface ParsedXlsxRow {
  idFm: number;
  stationCodeRaw: string;
  name: string;
  province: string;
  district: string;
  freq: number;
  type: string;
  note: string;
}

/** Subset of fm_station fields the audit needs — keeps the function decoupled from PrismaClient typings. */
export interface DbStationRow {
  id_fm: number;
  name: string | null;
  province: string | null;
  district: string | null;
  freq: number | null;
  on_air: boolean | null;
}

export type Classification =
  | 'STILL_ON_AIR'      // xlsx row is in DB and on_air=true (the audit target)
  | 'ALREADY_OFF_AIR'   // xlsx row is in DB and on_air=false (no action needed)
  | 'MISSING_IN_DB';    // xlsx row has no matching id_fm in DB

export interface AuditRecord {
  idFm: number;
  stationCodeRaw: string;
  xlsxName: string;
  xlsxProvince: string;
  xlsxDistrict: string;
  xlsxFreq: number;
  foundInDb: boolean;
  dbName: string | null;
  dbProvince: string | null;
  dbFreq: number | null;
  dbOnAir: boolean | null;
  classification: Classification;
  warnings: string[];
}

export function parseXlsxRows(rows: RawXlsxRow[]): ParsedXlsxRow[] {
  const out: ParsedXlsxRow[] = [];
  for (const r of rows) {
    const codeCell = r['รหัสสถานี'];
    if (codeCell === null || codeCell === undefined || codeCell === '') continue;
    const codeStr = String(codeCell).trim();
    const idFm = Number.parseInt(codeStr, 10);
    if (!Number.isFinite(idFm) || idFm <= 0) continue;
    const freqCell = r['คลื่นความถี่เดิม'];
    const freq = typeof freqCell === 'number'
      ? freqCell
      : Number.parseFloat(String(freqCell ?? '0'));
    out.push({
      idFm,
      stationCodeRaw: codeStr,
      name: (r['ชื่อสถานี'] ?? '').toString().trim(),
      province: (r['จังหวัด'] ?? '').toString().trim(),
      district: (r['เขต/อำเภอ'] ?? '').toString().trim(),
      freq: Number.isFinite(freq) ? freq : 0,
      type: (r['ประเภท'] ?? '').toString().trim(),
      note: (r['หมายเหตุ'] ?? '').toString().trim(),
    });
  }
  return out;
}

export function filterByProvinces(
  rows: ParsedXlsxRow[],
  provinces: readonly string[],
): ParsedXlsxRow[] {
  const set = new Set(provinces);
  return rows.filter((r) => set.has(r.province));
}

export function buildAuditRecords(
  xlsxRows: ParsedXlsxRow[],
  dbRows: DbStationRow[],
): AuditRecord[] {
  const dbByIdFm = new Map<number, DbStationRow>();
  for (const d of dbRows) dbByIdFm.set(d.id_fm, d);

  return xlsxRows.map((x) => {
    const db = dbByIdFm.get(x.idFm);
    const warnings: string[] = [];
    if (db) {
      if (db.province && x.province && db.province !== x.province) warnings.push('province-mismatch');
      if (db.name && x.name && db.name !== x.name) warnings.push('name-mismatch');
    }
    let classification: Classification;
    if (!db) classification = 'MISSING_IN_DB';
    else if (db.on_air === true) classification = 'STILL_ON_AIR';
    else classification = 'ALREADY_OFF_AIR';

    return {
      idFm: x.idFm,
      stationCodeRaw: x.stationCodeRaw,
      xlsxName: x.name,
      xlsxProvince: x.province,
      xlsxDistrict: x.district,
      xlsxFreq: x.freq,
      foundInDb: !!db,
      dbName: db?.name ?? null,
      dbProvince: db?.province ?? null,
      dbFreq: db?.freq ?? null,
      dbOnAir: db?.on_air ?? null,
      classification,
      warnings,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/offairAudit.test.ts
```

Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/offairAudit.ts src/__tests__/offairAudit.test.ts
git commit -m "feat(audit): pure offair-audit logic for xlsx vs fm_station cross-check"
```

---

## Task 2: I/O wrapper script (dry-run report)

**Files:**
- Create: `scripts/audit-offair.ts`

- [ ] **Step 1: Implement the script**

Create `scripts/audit-offair.ts`:

```ts
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
```

- [ ] **Step 2: Verify the script compiles**

```bash
npx tsc --noEmit -p tsconfig.json scripts/audit-offair.ts || npx tsc --noEmit scripts/audit-offair.ts
```

Expected: zero errors. (If `tsconfig.json` excludes `scripts/`, the second invocation type-checks the file standalone — it must still resolve `@prisma/client` and the `../src/utils/offairAudit` import.)

- [ ] **Step 3: Commit**

```bash
git add scripts/audit-offair.ts
git commit -m "feat(audit): add scripts/audit-offair.ts dry-run wrapper for offair audit"
```

---

## Task 3: Run dry-run audit and review

**Files:**
- Generates: `reports/offair-audit-2026-05-06.csv`

- [ ] **Step 1: Execute the dry run**

```bash
npx tsx scripts/audit-offair.ts
```

Expected output (counts will vary slightly based on current DB state but should be close):

```
xlsx rows total=1790, filtered to 3 provinces=104
db rows in 3 provinces=255
classification counts: { STILL_ON_AIR: <N>, ALREADY_OFF_AIR: <M>, MISSING_IN_DB: <K> }
wrote: <repo>/reports/offair-audit-2026-05-06.csv
STILL_ON_AIR (top 20):
  5520117   106.00  นครราชสีมา  เสียงชนเสรี
  ...
(dry-run only — re-run with --apply to flip on_air=false)
```

Sanity check: `STILL_ON_AIR + ALREADY_OFF_AIR + MISSING_IN_DB === 104`.

- [ ] **Step 2: Inspect the report**

```bash
column -s, -t < reports/offair-audit-2026-05-06.csv | less -S
# or
head -5 reports/offair-audit-2026-05-06.csv
wc -l reports/offair-audit-2026-05-06.csv
```

Confirm:
- Total data rows = 104 (header excluded).
- Every `STILL_ON_AIR` row has `dbOnAir=true` and a non-empty `dbName`.
- Every `MISSING_IN_DB` row has empty db fields.
- `warnings` column shows `province-mismatch` / `name-mismatch` only for known oddities — investigate any that appear unexpectedly.

- [ ] **Step 3: Stop here and report numbers to the user**

Print the three counts and the CSV path. **Do not run `--apply` without explicit confirmation** — flipping on_air for ~100 rows is a destructive write and the user must approve after seeing the dry-run.

---

## Task 4 (gated): Apply the off-air flip

**Only after the user has reviewed the CSV and explicitly says "apply" / "go ahead" / equivalent.**

**Files:**
- No new files.

- [ ] **Step 1: Snapshot the rows that will change**

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
const p = new PrismaClient();
(async () => {
  const rows = await p.fm_station.findMany({
    where: { province: { in: ['นครราชสีมา','ชัยภูมิ','บุรีรัมย์'] }, on_air: true },
    select: { id_fm: true, name: true, province: true, freq: true, on_air: true },
  });
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/offair-snapshot-pre-apply.json', JSON.stringify(rows, null, 2));
  console.log('snapshot rows=', rows.length);
  await p.\$disconnect();
})();
"
```

Expected: writes `reports/offair-snapshot-pre-apply.json` with the pre-apply on_air=true rows so a revert is trivial.

- [ ] **Step 2: Run the apply**

```bash
npx tsx scripts/audit-offair.ts --apply
```

Expected output ends with:

```
--apply: setting on_air=false for <N> ids
updated <N> rows
```

`<N>` should equal the `STILL_ON_AIR` count from the dry run.

- [ ] **Step 3: Verify post-state**

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  for (const prov of ['นครราชสีมา','ชัยภูมิ','บุรีรัมย์']) {
    const c = await p.fm_station.count({ where: { province: prov, on_air: true } });
    console.log(prov, 'on_air=true after apply:', c);
  }
  await p.\$disconnect();
})();
"
```

Expected: each on_air count drops by exactly the per-province `STILL_ON_AIR` figure from the dry run. (No new on_air=true should appear.)

- [ ] **Step 4: Commit the report artifacts (NOT the snapshot — it contains DB state)**

```bash
echo "reports/offair-snapshot-*.json" >> .gitignore
git add .gitignore reports/offair-audit-2026-05-06.csv
git commit -m "chore(audit): commit offair audit report; ignore DB snapshots"
```

(The snapshot stays on disk for rollback but is git-ignored.)

- [ ] **Step 5: Rollback recipe (kept here for reference, do NOT run unless rolling back)**

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
const p = new PrismaClient();
(async () => {
  const snap = JSON.parse(fs.readFileSync('reports/offair-snapshot-pre-apply.json','utf8'));
  const ids = snap.map((r: { id_fm: number }) => r.id_fm);
  const r = await p.fm_station.updateMany({
    where: { id_fm: { in: ids } },
    data: { on_air: true },
  });
  console.log('reverted', r.count);
  await p.\$disconnect();
})();
"
```

---

## Out of scope

- Schema changes — none.
- API/UI changes — this is a one-off offline audit; no app surface is modified.
- Fuzzy name/freq matching — id_fm is an exact key (verified). Not needed.
- The other 27 provinces in the xlsx — explicitly filtered out per the user's request.
- Updating `inspection_68` / `inspection_69` / `submit_a_request` — only `on_air` is in scope.

## Self-review notes

- **Spec coverage**: filter province (Task 2 + 3) ✓, three named provinces (TARGET_PROVINCES constant + tests) ✓, "have to be off air in my db" (STILL_ON_AIR classification + Task 4 apply) ✓.
- **Placeholders**: every step shows the actual code or command. No "TBD" / "implement later".
- **Type consistency**: `RawXlsxRow`, `ParsedXlsxRow`, `DbStationRow`, `AuditRecord`, `Classification`, `TARGET_PROVINCES` are defined in Task 1 and re-used unchanged in Task 2.
- **Destructive guardrail**: `--apply` is opt-in, gated behind a snapshot in Task 4 Step 1, and a documented rollback in Step 5.
