/* eslint-disable no-console */
/**
 * One-off destructive removal of บุรีรัมย์ from the tracker.
 *
 * บุรีรัมย์ left this office's coverage area (see CONTEXT.md, "Coverage area"),
 * so its rows are deleted outright rather than filtered at the query layer —
 * a permanent allow-list on every read is a tax somebody eventually forgets to pay.
 *
 * Order matters: station_inspection.station_id has no onDelete: Cascade, so
 * deleting fm_station first is refused by the FK. Children go first.
 *
 * Always dumps every doomed row to reports/ before deleting. The dump is
 * gitignored — it is a machine-local rollback aid, not a repo artefact.
 *
 *   npx tsx scripts/delete-buriram.ts            # dry-run: dump + report, no delete
 *   npx tsx scripts/delete-buriram.ts --apply    # dump, then delete
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const PROVINCE = 'บุรีรัมย์';
const APPLY = process.argv.includes('--apply');

const prisma = new PrismaClient();

async function main() {
  // --- Gather everything doomed, before touching a thing -------------------
  const stations = await prisma.fm_station.findMany({ where: { province: PROVINCE } });
  const sites = await prisma.interference_site.findMany({ where: { changwat: PROVINCE } });

  // station_inspection.station_id references fm_station.id (the surrogate key),
  // not the register StationID -- see ADR 0003.
  const stationIds = stations.map((s) => s.id);
  const siteIds = sites.map((s) => s.id);

  const stationInspections = stationIds.length
    ? await prisma.station_inspection.findMany({ where: { station_id: { in: stationIds } } })
    : [];
  const stationInspectionIds = stationInspections.map((i) => i.id);
  const stationMembers = stationInspectionIds.length
    ? await prisma.station_inspection_member.findMany({
        where: { inspection_id: { in: stationInspectionIds } },
      })
    : [];

  const intInspections = siteIds.length
    ? await prisma.interference_inspection.findMany({ where: { interference_id: { in: siteIds } } })
    : [];
  const intInspectionIds = intInspections.map((i) => i.id);
  const intMembers = intInspectionIds.length
    ? await prisma.interference_inspection_member.findMany({
        where: { inspection_id: { in: intInspectionIds } },
      })
    : [];

  const before = {
    fm_station: await prisma.fm_station.count(),
    interference_site: await prisma.interference_site.count(),
    station_inspection: await prisma.station_inspection.count(),
    station_inspection_member: await prisma.station_inspection_member.count(),
    interference_inspection: await prisma.interference_inspection.count(),
    interference_inspection_member: await prisma.interference_inspection_member.count(),
  };

  console.log(`\nบุรีรัมย์ rows found:`);
  console.log(`  fm_station                     ${stations.length}`);
  console.log(`  interference_site              ${sites.length}`);
  console.log(`  station_inspection             ${stationInspections.length}`);
  console.log(`  station_inspection_member      ${stationMembers.length}`);
  console.log(`  interference_inspection        ${intInspections.length}`);
  console.log(`  interference_inspection_member ${intMembers.length}`);

  // --- Dump, unconditionally, before any delete ---------------------------
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  mkdirSync('reports', { recursive: true });
  const dumpPath = `reports/buriram-pre-delete-${ts}.json`;
  writeFileSync(
    dumpPath,
    JSON.stringify(
      {
        province: PROVINCE,
        dumped_at: new Date().toISOString(),
        applied: APPLY,
        counts_before: before,
        fm_station: stations,
        interference_site: sites,
        station_inspection: stationInspections,
        station_inspection_member: stationMembers,
        interference_inspection: intInspections,
        interference_inspection_member: intMembers,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\nDump written: ${dumpPath}`);

  if (!APPLY) {
    console.log('\nDry run — nothing deleted. Re-run with --apply.\n');
    return;
  }

  // --- Delete, children first ---------------------------------------------
  await prisma.$transaction(async (tx) => {
    if (stationInspectionIds.length) {
      await tx.station_inspection_member.deleteMany({
        where: { inspection_id: { in: stationInspectionIds } },
      });
      await tx.station_inspection.deleteMany({ where: { id: { in: stationInspectionIds } } });
    }
    if (intInspectionIds.length) {
      await tx.interference_inspection_member.deleteMany({
        where: { inspection_id: { in: intInspectionIds } },
      });
      await tx.interference_inspection.deleteMany({ where: { id: { in: intInspectionIds } } });
    }
    if (stationIds.length) {
      await tx.fm_station.deleteMany({ where: { id: { in: stationIds } } });
    }
    if (siteIds.length) {
      await tx.interference_site.deleteMany({ where: { id: { in: siteIds } } });
    }
  });

  const after = {
    fm_station: await prisma.fm_station.count(),
    interference_site: await prisma.interference_site.count(),
    station_inspection: await prisma.station_inspection.count(),
    station_inspection_member: await prisma.station_inspection_member.count(),
    interference_inspection: await prisma.interference_inspection.count(),
    interference_inspection_member: await prisma.interference_inspection_member.count(),
  };

  console.log('\nTable                            before -> after');
  for (const k of Object.keys(before) as (keyof typeof before)[]) {
    console.log(`  ${k.padEnd(32)} ${String(before[k]).padStart(4)} -> ${String(after[k]).padStart(4)}`);
  }

  const leftoverFm = await prisma.fm_station.count({ where: { province: PROVINCE } });
  const leftoverInt = await prisma.interference_site.count({ where: { changwat: PROVINCE } });
  console.log(`\nRemaining ${PROVINCE} rows: fm_station=${leftoverFm} interference_site=${leftoverInt}`);

  const provinces = await prisma.fm_station.groupBy({ by: ['province'], _count: { _all: true } });
  console.log('Provinces now in fm_station:', provinces.map((p) => `${p.province}=${p._count._all}`).join(' '));
  console.log();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
