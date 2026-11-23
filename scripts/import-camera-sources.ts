// scripts/import-camera-sources.ts
/* eslint-disable no-console */
/**
 * Loads the interference-camera sheet into `camera_source`.
 *
 *   npx tsx scripts/import-camera-sources.ts <path-to.xlsx>           # dry-run
 *   npx tsx scripts/import-camera-sources.ts <path-to.xlsx> --apply   # write
 *
 * Re-runnable, keyed on Code: adds new rows and updates changed ones. It never
 * touches inspected status, and rows missing from a newer file are reported,
 * not deleted. The dry-run reads the database only when DATABASE_URL is set.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { parseCellSitesCsv } from '../src/utils/cellSites';
import {
  findCameraCellSite,
  parseCameraRows,
  planCameraImport,
  type RawCameraRow,
} from '../src/utils/cameraSources';
import { haversineDistanceKm } from '../src/utils/distance';

const FAR_LINK_KM = 10;

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) throw new Error('usage: import-camera-sources.ts <path-to.xlsx> [--apply]');
  if (apply && !process.env.DATABASE_URL) throw new Error('--apply needs DATABASE_URL');

  const workbook = XLSX.read(readFileSync(file));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const { cameras, skipped } = parseCameraRows(XLSX.utils.sheet_to_json<RawCameraRow>(sheet));

  const csvPath = path.join(process.cwd(), 'data', 'cell-sites', 'cell-sites-clean.csv');
  const sites = parseCellSitesCsv(readFileSync(csvPath, 'utf8'));
  // A camera this far from its cell site usually means a wrong code or
  // coordinate, so it keeps its pin but gets no link until someone checks it.
  const farLinks: string[] = [];
  const linked = new Map(
    cameras.map((c) => {
      const cell = findCameraCellSite(c.code, sites);
      if (!cell) return [c.code, null] as const;
      const km = haversineDistanceKm(c.lat, c.lng, cell.lat, cell.lng);
      if (km <= FAR_LINK_KM) return [c.code, cell] as const;
      farLinks.push(`${c.code}: ${km.toFixed(1)} km from ${cell.code}`);
      return [c.code, null] as const;
    })
  );
  const unlinked = cameras
    .filter((c) => !linked.get(c.code) && !farLinks.some((f) => f.startsWith(`${c.code}:`)))
    .map((c) => c.code);

  console.log(`valid cameras: ${cameras.length}`);
  console.log(`linked to a cell site: ${cameras.length - unlinked.length - farLinks.length}`);
  console.log(`no cell site match: ${unlinked.join(', ') || 'none'}`);
  for (const s of skipped) console.log(`skipped ${s.code}: ${s.reason}`);
  for (const f of farLinks) console.log(`link hidden, check ${f}`);

  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not set: parsed only, nothing compared or written.');
    return;
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.camera_source.findMany({ select: { code: true } });
    const plan = planCameraImport(cameras, existing.map((e) => e.code));
    console.log(`to add: ${plan.toAdd.length}, to update: ${plan.toUpdate.length}`);
    console.log(`in database but not in this file (kept): ${plan.missingFromFile.join(', ') || 'none'}`);

    if (!apply) {
      console.log('Dry run. Re-run with --apply to write.');
      return;
    }

    await prisma.$transaction(
      cameras.map((c) => {
        const cell = linked.get(c.code) ?? null;
        // Deliberately no status / inspected_* here: a re-import keeps them.
        const data = {
          lat: c.lat,
          long: c.lng,
          found_on: new Date(`${c.foundOn}T00:00:00.000Z`),
          district: c.district,
          province: c.province,
          landmark: c.landmark,
          cell_site_code: cell?.code ?? null,
          cell_site_name: cell?.name ?? null,
          cell_site_lat: cell?.lat ?? null,
          cell_site_long: cell?.lng ?? null,
          cell_site_operators: cell ? cell.operators.join('|') : null,
        };
        return prisma.camera_source.upsert({
          where: { code: c.code },
          create: { code: c.code, ...data },
          update: data,
        });
      })
    );
    console.log(`written: ${cameras.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
