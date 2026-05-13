// scripts/import-inspections-xlsx.ts
/* eslint-disable no-console */
/**
 * One-shot importer: seeds station_inspection + station_inspection_member from
 * an xlsx report that lists ChkID, inspection date (B.E.), station code, and
 * up to 4 inspector names.
 *
 *   npx tsx scripts/import-inspections-xlsx.ts <path-to.xlsx>           # dry-run
 *   npx tsx scripts/import-inspections-xlsx.ts <path-to.xlsx> --apply   # write
 *
 * Re-runnable: rows are deduped by (station_id, inspected_on, lead_user_id).
 */
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { INSPECTOR_MAP, normalizeName } from './inspector-map';

const IMPORT_SOURCE = 'xlsx_import_2026_05';

export interface XlsxInspectorRow {
  ChkID: string;
  'วันที่บันทึก': string;
  'วันที่ตรวจสอบ': string;
  'รหัสสถานี': string;
  'ชื่อสถานี': string;
  'ความถี่': string;
  'จังหวัด': string;
  'อำเภอ': string;
  'ตำบล': string;
  'ชื่อผู้ตรวจ (กสทช.) 1': string;
  'ชื่อผู้ตรวจ (กสทช.) 2': string;
  'ชื่อผู้ตรวจ (กสทช.) 3': string;
  'ชื่อผู้ตรวจ (กสทช.) 4': string;
}

export interface ParsedRow {
  chkId: string;
  stationId: number | null;
  stationName: string;
  inspectedOn: string;     // YYYY-MM-DD (C.E.)
  leadName: string;
  helperNames: string[];
}

function beToCe(ddmmYYYY: string): string | null {
  const m = ddmmYYYY?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyyBE] = m;
  const ce = parseInt(yyyyBE, 10) - 543;
  return `${ce}-${mm}-${dd}`;
}

export function parseXlsxRows(rows: XlsxInspectorRow[]): ParsedRow[] {
  return rows.map((r) => {
    const stationIdRaw = (r['รหัสสถานี'] ?? '').toString().trim();
    const stationId = stationIdRaw ? parseInt(stationIdRaw, 10) : null;
    const leadName = normalizeName(r['ชื่อผู้ตรวจ (กสทช.) 1'] ?? '');
    const helperNames = [
      r['ชื่อผู้ตรวจ (กสทช.) 2'],
      r['ชื่อผู้ตรวจ (กสทช.) 3'],
      r['ชื่อผู้ตรวจ (กสทช.) 4'],
    ]
      .map((x) => normalizeName(x ?? ''))
      .filter((x) => x.length > 0);
    return {
      chkId: r.ChkID,
      stationId: Number.isFinite(stationId as number) ? (stationId as number) : null,
      stationName: r['ชื่อสถานี'] ?? '',
      inspectedOn: beToCe(r['วันที่ตรวจสอบ']) ?? '',
      leadName,
      helperNames,
    };
  });
}

export interface ValidateContext {
  existingStationIds: Set<number>;
  mappedUsers: Map<string, number>;  // username → user_id
}

export interface RowToInsert {
  chkId: string;
  stationId: number;
  inspectedOn: string;
  leadUserId: number;
  helperUserIds: number[];
}

export interface ValidationResult {
  unmappedNames: string[];
  missingStationIds: number[];
  skippedNoStationId: ParsedRow[];
  rowsToInsert: RowToInsert[];
}

export function validateRows(rows: ParsedRow[], ctx: ValidateContext): ValidationResult {
  const unmapped = new Set<string>();
  const missingIds = new Set<number>();
  const skippedNoStationId: ParsedRow[] = [];
  const rowsToInsert: RowToInsert[] = [];

  for (const row of rows) {
    if (row.stationId === null) { skippedNoStationId.push(row); continue; }
    if (!ctx.existingStationIds.has(row.stationId)) {
      missingIds.add(row.stationId);
      continue;
    }
    const leadUsername = INSPECTOR_MAP[row.leadName];
    if (!leadUsername) { unmapped.add(row.leadName); continue; }
    let allHelpersMapped = true;
    const helperUserIds: number[] = [];
    for (const h of row.helperNames) {
      const u = INSPECTOR_MAP[h];
      if (!u) { unmapped.add(h); allHelpersMapped = false; continue; }
      const uid = ctx.mappedUsers.get(u);
      if (uid === undefined) { unmapped.add(h); allHelpersMapped = false; continue; }
      if (helperUserIds.includes(uid)) continue;
      helperUserIds.push(uid);
    }
    if (!allHelpersMapped) continue;
    const leadUserId = ctx.mappedUsers.get(leadUsername);
    if (leadUserId === undefined) { unmapped.add(row.leadName); continue; }
    rowsToInsert.push({
      chkId: row.chkId,
      stationId: row.stationId,
      inspectedOn: row.inspectedOn,
      leadUserId,
      helperUserIds: helperUserIds.filter((id) => id !== leadUserId),
    });
  }

  return {
    unmappedNames: [...unmapped],
    missingStationIds: [...missingIds],
    skippedNoStationId,
    rowsToInsert,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const xlsxPath = args.find((a) => !a.startsWith('--')) ?? '';
  if (!xlsxPath) {
    console.error('Usage: import-inspections-xlsx.ts <path-to.xlsx> [--apply]');
    process.exit(2);
  }

  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<XlsxInspectorRow>(ws, { defval: '', raw: false });
  const parsed = parseXlsxRows(raw);

  const prisma = new PrismaClient();

  const ids = parsed.map((p) => p.stationId).filter((x): x is number => x !== null);
  const existingStations = await prisma.fm_station.findMany({
    where: { id_fm: { in: ids } },
    select: { id_fm: true },
  });
  const existingStationIds = new Set(existingStations.map((r) => r.id_fm));

  const mappedUsernames = [...new Set(Object.values(INSPECTOR_MAP))];
  const users = await prisma.user.findMany({
    where: { username: { in: mappedUsernames } },
    select: { id: true, username: true },
  });
  const mappedUsers = new Map(users.map((u) => [u.username, u.id]));

  const v = validateRows(parsed, { existingStationIds, mappedUsers });

  console.log(`xlsx rows: ${parsed.length}`);
  console.log(`rowsToInsert: ${v.rowsToInsert.length}`);
  console.log(`unmapped inspector names: ${v.unmappedNames.length}`);
  if (v.unmappedNames.length) console.log(' ', v.unmappedNames);
  console.log(`missing fm_station ids: ${v.missingStationIds.length}`);
  if (v.missingStationIds.length) console.log(' ', v.missingStationIds);
  console.log(`skipped (no station code in xlsx): ${v.skippedNoStationId.length}`);
  for (const r of v.skippedNoStationId) console.log(`  - ChkID ${r.chkId}: ${r.stationName}`);

  if (v.unmappedNames.length > 0) {
    console.error('Aborting: add the unmapped name(s) to scripts/inspector-map.ts then re-run.');
    await prisma.$disconnect();
    process.exit(1);
  }

  if (!apply) {
    console.log('Dry run. Re-run with --apply to write.');
    await prisma.$disconnect();
    return;
  }

  let inserted = 0;
  let skippedDuplicate = 0;
  const affectedStationIds = new Set<number>();

  for (const row of v.rowsToInsert) {
    const existing = await prisma.station_inspection.findFirst({
      where: {
        station_id: row.stationId,
        inspected_on: new Date(`${row.inspectedOn}T00:00:00Z`),
        lead_user_id: row.leadUserId,
      },
    });
    if (existing) { skippedDuplicate++; continue; }
    await prisma.$transaction(async (tx) => {
      const ins = await tx.station_inspection.create({
        data: {
          station_id: row.stationId,
          inspected_on: new Date(`${row.inspectedOn}T00:00:00Z`),
          lead_user_id: row.leadUserId,
          source: IMPORT_SOURCE,
        },
      });
      if (row.helperUserIds.length > 0) {
        await tx.station_inspection_member.createMany({
          data: row.helperUserIds.map((uid) => ({
            inspection_id: ins.id, user_id: uid, role: 'helper',
          })),
        });
      }
    });
    inserted++;
    affectedStationIds.add(row.stationId);
  }

  for (const stationId of affectedStationIds) {
    const agg = await prisma.station_inspection.aggregate({
      where: { station_id: stationId },
      _max: { inspected_on: true },
    });
    const count = await prisma.station_inspection.count({ where: { station_id: stationId } });
    await prisma.fm_station.update({
      where: { id_fm: stationId },
      data: {
        date_inspected: agg._max.inspected_on
          ? agg._max.inspected_on.toISOString().slice(0, 10)
          : null,
        inspection_69: count > 0,
      },
    });
  }

  console.log(`inserted: ${inserted}`);
  console.log(`skipped (duplicate): ${skippedDuplicate}`);
  console.log(`stations whose date_inspected was recomputed: ${affectedStationIds.size}`);
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
