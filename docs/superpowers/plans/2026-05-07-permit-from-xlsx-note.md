# Permit Field From xlsx หมายเหตุ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the xlsx `หมายเหตุ` column (license-transfer note for revoked stations) on the existing `FMStation.permit` field so the field-ops UI's `<Meter label="PERMIT" />` shows the new license holder instead of `—`.

**Architecture:**
1. Add a `permit String?` column on `fm_station` (additive migration).
2. Map `row.permit` → `FMStation.permit` in `convertToFMStation`.
3. Backfill: one-shot script reads the xlsx, joins by `id_fm` against the 3 provinces, and writes `permit` for the 35 rows that have non-blank `หมายเหตุ`. Skips blank/space-only notes.
4. Update the import script (`scripts/import-revoked-missing.ts`) so future re-runs also populate `permit`.
5. UI is unchanged — `<Meter label="PERMIT" value={station.permit || "—"} />` already exists in `FieldOpsCurrentFM`.

**Verified before planning (today):**
- 35 of the 104 xlsx rows in the 3 provinces have non-blank `หมายเหตุ`. The rest are a single space character — those will be skipped (treated as null).
- `FMStation.permit?: string` already exists on the type. `convertToFMStation` currently sets `permit: undefined` because there's no DB column.
- `FieldOpsCurrentFM` displays `<Meter label="PERMIT" value={station.permit || "—"} />` at line ~91.
- `parseXlsxRows` already returns `note` from the xlsx `หมายเหตุ` column (untrimmed, per the deliberate test-driven decision in RV-1 Task 1) — but for permit purposes we DO want trimmed (a single-space note is meaningless). The backfill script trims at the call site.

**Tech Stack:** Prisma 5 (`db push` against Neon), TypeScript, vitest, SheetJS.

**Out of scope:** UI changes (none needed), the 8th xlsx column (`ผู้ทดลองออกอากาศเดิม` — original broadcaster) — user only asked for `หมายเหตุ`.

---

## Task 1: Schema — add `permit` column

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/2026-05-07-add-permit/migration.sql`

- [ ] **Step 1: Edit `prisma/schema.prisma`**

In the `fm_station` model, add `permit` after `revoked_note`:

```prisma
  revoked          Boolean? @default(false)
  revoked_note     String?
  permit           String?

  @@index([revoked])
```

- [ ] **Step 2: Write the migration SQL**

`prisma/migrations/2026-05-07-add-permit/migration.sql`:

```sql
-- Add license-permit text (e.g. new license holder for revoked stations).
ALTER TABLE "fm_station" ADD COLUMN "permit" TEXT;
```

- [ ] **Step 3: Apply with `db push` and regenerate**

```bash
npx prisma db push
```

(Step also regenerates the Prisma client.)

- [ ] **Step 4: Verify**

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const c = await p.fm_station.count({ where: { permit: null } });
  console.log('rows with permit=null:', c);
  await p.\$disconnect();
})();
"
```

Expected: `rows with permit=null: 300` (the entire dataset starts null).

- [ ] **Step 5: Commit**

```bash
git add -f prisma/schema.prisma prisma/migrations/2026-05-07-add-permit/migration.sql
git commit -m "feat(schema): add fm_station.permit for license-holder text"
```

---

## Task 2: Map `permit` in `convertToFMStation`

**Files:**
- Modify: `src/services/stationService.ts`
- Modify: `src/__tests__/stationService.test.ts`

- [ ] **Step 1: Update the converter**

Replace the existing line `permit: undefined,` with:

```ts
    permit: row.permit ?? undefined,
```

- [ ] **Step 2: Update the test mock so tsc accepts the new field**

In `src/__tests__/stationService.test.ts`'s `makeDbRow` factory, add `permit: null` next to the other fields:

```ts
    revoked: false,
    revoked_note: null,
    permit: null,
    created_at: null,
    updated_at: null,
```

- [ ] **Step 3: Add one new test**

Inside the existing `describe('convertToFMStation', ...)`:

```ts
  it('maps row.permit to FMStation.permit', () => {
    const result = convertToFMStation(makeDbRow({ permit: 'ห้างหุ้นส่วนจำกัด ABC' }));
    expect(result.permit).toBe('ห้างหุ้นส่วนจำกัด ABC');
  });

  it('returns undefined permit when row.permit is null', () => {
    const result = convertToFMStation(makeDbRow({ permit: null }));
    expect(result.permit).toBeUndefined();
  });
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/__tests__/stationService.test.ts
```

Expected: all PASS (was 19, now 21).

- [ ] **Step 5: Commit**

```bash
git add src/services/stationService.ts src/__tests__/stationService.test.ts
git commit -m "feat(station): map fm_station.permit → FMStation.permit"
```

---

## Task 3: Backfill script for the 104 revoked rows

**Files:**
- Create: `scripts/backfill-permit-from-xlsx.ts`

This is a small one-off. Pure I/O — no unit test needed.

- [ ] **Step 1: Write the script**

```ts
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

  // Build (idFm → trimmed permit) map, skipping blank/whitespace-only notes.
  const permitByIdFm = new Map<number, string>();
  for (const r of filtered) {
    const trimmed = r.note.trim();
    if (trimmed.length > 0) permitByIdFm.set(r.idFm, trimmed);
  }
  console.log(`xlsx rows in 3 provinces=${filtered.length}; with non-blank note=${permitByIdFm.size}`);

  const prisma = new PrismaClient();

  // Only update rows that actually exist in DB (id_fm match).
  const present = await prisma.fm_station.findMany({
    where: { id_fm: { in: [...permitByIdFm.keys()] } },
    select: { id_fm: true, permit: true, name: true },
  });
  console.log(`db rows that exist: ${present.length}/${permitByIdFm.size}`);

  const samples = present.slice(0, 10);
  for (const s of samples) {
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit scripts/backfill-permit-from-xlsx.ts
```

Expected: zero errors.

- [ ] **Step 3: Dry-run**

```bash
npx tsx scripts/backfill-permit-from-xlsx.ts
```

Expected:
- `xlsx rows in 3 provinces=104; with non-blank note=35`
- `db rows that exist: 35/35` (since import-revoked-missing landed all 45 missing rows, all 104 should now exist)
- 10 sample rows showing OLD `(null)` → NEW permit text
- Ends with `(dry-run only ...)`

- [ ] **Step 4: Apply**

```bash
npx tsx scripts/backfill-permit-from-xlsx.ts --apply
```

Expected: ends with `updated 35 rows`.

- [ ] **Step 5: Verify**

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const c = await p.fm_station.count({ where: { permit: { not: null } } });
  console.log('rows with permit set:', c);
  const sample = await p.fm_station.findFirst({ where: { permit: { not: null } } });
  console.log('sample:', { id_fm: sample?.id_fm, name: sample?.name, permit: sample?.permit });
  await p.\$disconnect();
})();
"
```

Expected: `rows with permit set: 35` and a sample showing readable Thai text.

- [ ] **Step 6: Commit**

```bash
git add scripts/backfill-permit-from-xlsx.ts
git commit -m "feat(audit): backfill fm_station.permit from xlsx หมายเหตุ for 3 provinces"
```

---

## Task 4: Update import script to set `permit` on future inserts

**Files:**
- Modify: `scripts/import-revoked-missing.ts`

- [ ] **Step 1: Add `permit` to the createMany payload**

In `scripts/import-revoked-missing.ts`, in the `data.map(...)` block, add `permit` next to the other fields:

```ts
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
```

(Just one new line: the `permit:` field, plus the `noteTrimmed` const above the return.)

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit scripts/import-revoked-missing.ts
```

Expected: zero errors.

- [ ] **Step 3: Dry-run to confirm idempotent (no rows to insert now)**

```bash
npx tsx scripts/import-revoked-missing.ts
```

Expected: `xlsx in 3 provinces=104, db rows=300, missing=0` and `nothing to import.` (Because Task 3's backfill ran on already-existing rows; new inserts only happen if there's a fresh missing row.)

- [ ] **Step 4: Commit**

```bash
git add scripts/import-revoked-missing.ts
git commit -m "feat(audit): import-missing also populates permit from xlsx note"
```

---

## Task 5: Visual smoke

- [ ] **Step 1: Confirm dev server is up**

```bash
tmux capture-pane -t dev -p | tail -5
```

Expected: shows `✓ Ready in ...` (it's been running since session start).

- [ ] **Step 2: Manual check**

Open http://localhost:3000 → Field Ops tab → filter to ชัยภูมิ → click any revoked station with a non-blank `หมายเหตุ` (e.g., `5520469 ลูกทุ่งไทยแลนด์`).

Expected:
- The PERMIT meter now shows the Thai license-holder text (instead of `—`).
- The `⚠ REVOKED` chip and alert banner are still rendered (no regression from RV-6).
- The card layout is unchanged — PERMIT is just populated.

If the PERMIT meter visibly overflows on long text, that's a follow-up styling issue (text wrapping in `<Meter>` is out of scope).

- [ ] **Step 3: No commit needed for this task.**

---

## Verification (end-to-end)

1. `npx vitest run` — all touched tests green; pre-existing unrelated failures unchanged.
2. `npx tsc --noEmit` — no NEW errors in `prisma/schema.prisma`-generated client, `stationService.ts`, or the two scripts.
3. Browser walk: PERMIT shows Thai text on revoked stations from ชัยภูมิ/นครราชสีมา/บุรีรัมย์ that have non-blank notes (35 rows). Stations without notes still show `—`.

## Self-review

- **Spec coverage**: "in xcel it have หมายเหตุ put the imformation to in PERMIT" → Task 3 backfill writes the trimmed `หมายเหตุ` into `permit`; Task 2 surfaces it as `FMStation.permit`; UI already renders. ✓
- **Placeholders**: every step has actual code or commands.
- **Type consistency**: `permit: String?` (DB) → `row.permit: string | null` → `permit: row.permit ?? undefined` → `FMStation.permit?: string`. Unbroken.
- **Dependency order**: 1 → 2 → 3 → 4. Task 5 needs all four.
- **Destructive guardrail**: Task 3 is gated behind `--apply`; the dry-run shows old/new diff for the first 10 rows so the user can sanity-check. Task 1 schema add is additive with safe NULL default.
