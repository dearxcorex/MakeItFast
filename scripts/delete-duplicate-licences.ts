/* eslint-disable no-console */
/**
 * Removes the superseded half of a stacked licence pair.
 *
 * sync-register inserts a new licensee *beside* the revoked row it replaces
 * (see the header of scripts/sync-register.ts), so a transmitter whose licence
 * changed hands ends up as two fm_station rows on identical freq + lat + long:
 * the revoked old licence, and the live new one carrying the NBTC code. The
 * live row is the station now, so the revoked twin is deleted outright rather
 * than filtered at the query layer -- the same reasoning as delete-buriram.ts.
 *
 * Only a twin is ever touched. A revoked row with no live row on its exact
 * coordinates is a genuinely dead station and is left alone; there are 38 of
 * those and they must stay on the map as red pins.
 *
 * Three guards, each of which aborts the whole run:
 *   1. a coordinate group that is not exactly one revoked + one live row --
 *      three-way stacks and revoked-vs-revoked pairs are not this script's call
 *   2. a doomed register_station_id still carried by an unexpired register row
 *      in data/nbtc-raw -- deleting it would let the next sync-register run
 *      re-insert it as NEW, i.e. on-air and uninspected, which is worse than
 *      the duplicate it replaced
 *   3. a doomed row that is not revoked
 *
 * Inspection history on the doomed row goes with it. It is history of the
 * *old licensee*, and moving it onto the live row would credit a new licence
 * with a section-69 inspection that never examined it. The pre-delete dump in
 * reports/ is the record; it is gitignored, a machine-local rollback aid.
 *
 * Discord embeds announcing a doomed inspection are retracted too, so the
 * channel does not keep an inspection notice for a station that no longer
 * exists. Needs DISCORD_INSPECTION_WEBHOOK_URL, hence --env-file=.env.
 *
 *   npx tsx --env-file=.env scripts/delete-duplicate-licences.ts           # dry run
 *   npx tsx --env-file=.env scripts/delete-duplicate-licences.ts --apply
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const RAW_DIR = path.join(process.cwd(), 'data', 'nbtc-raw');
const RAW_FILES = ['stations-ชัยภูมิ.json', 'stations-นครราชสีมา.json'];
const TODAY = new Date().toISOString().slice(0, 10);

const prisma = new PrismaClient();

/** StationIDs the register still lists on an unexpired licence. */
function liveRegisterStationIds(): Set<number> {
  const out = new Set<number>();
  for (const file of RAW_FILES) {
    const rows = JSON.parse(readFileSync(path.join(RAW_DIR, file), 'utf8')) as Record<string, unknown>[];
    for (const r of rows) {
      const id = Number(String(r.station_id ?? '').trim());
      if (!Number.isSafeInteger(id) || id <= 0) continue;
      const expires = r.licence_expires ? String(r.licence_expires) : null;
      // No expiry date is treated as live: sync-register skips such rows today,
      // but a guard that trusts a missing field is not a guard.
      if (expires === null || expires >= TODAY) out.add(id);
    }
  }
  return out;
}

async function main() {
  const stations = await prisma.fm_station.findMany({
    where: { lat: { not: null }, long: { not: null }, freq: { not: null } },
  });

  // --- Find the stacks -----------------------------------------------------
  const groups = new Map<string, typeof stations>();
  for (const s of stations) {
    const key = `${s.freq}|${s.lat}|${s.long}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  const problems: string[] = [];
  const doomed: typeof stations = [];
  const survivors = new Map<number, (typeof stations)[number]>(); // doomed id -> live twin

  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const revoked = group.filter((s) => s.revoked === true);
    const live = group.filter((s) => s.revoked !== true);
    if (group.length !== 2 || revoked.length !== 1 || live.length !== 1) {
      problems.push(
        `${key}: ${group.length} rows (${revoked.length} revoked, ${live.length} live) — ` +
          group.map((s) => `${s.id}:${s.id_fm ?? '-'}`).join(' '),
      );
      continue;
    }
    doomed.push(revoked[0]);
    survivors.set(revoked[0].id, live[0]);
  }

  // --- Guard 2: would the register resurrect any of them? ------------------
  const liveIds = liveRegisterStationIds();
  for (const s of doomed) {
    if (s.register_station_id !== null && liveIds.has(s.register_station_id)) {
      problems.push(
        `${s.id}:${s.id_fm ?? '-'} — StationID ${s.register_station_id} is still on an unexpired ` +
          `register row; sync-register would re-insert it as on-air`,
      );
    }
    // Guard 3 — belt and braces; the grouping above already enforces it.
    if (s.revoked !== true) problems.push(`${s.id}:${s.id_fm ?? '-'} — not revoked, refusing`);
  }

  if (problems.length) {
    console.error('\nRefusing to delete. Resolve these by hand first:\n');
    for (const p of problems) console.error(`  ${p}`);
    console.error();
    process.exitCode = 1;
    return;
  }

  if (!doomed.length) {
    console.log('\nNo stacked licence pairs found — nothing to do.\n');
    return;
  }

  // --- Gather the children, before touching a thing ------------------------
  const doomedIds = doomed.map((s) => s.id);
  const inspections = await prisma.station_inspection.findMany({
    where: { station_id: { in: doomedIds } },
  });
  const inspectionIds = inspections.map((i) => i.id);
  const members = inspectionIds.length
    ? await prisma.station_inspection_member.findMany({
        where: { inspection_id: { in: inspectionIds } },
      })
    : [];

  console.log(`\n${doomed.length} stacked pairs — deleting the revoked half of each:\n`);
  for (const s of doomed) {
    const live = survivors.get(s.id)!;
    const insp = inspections.filter((i) => i.station_id === s.id).length;
    console.log(
      `  ${String(s.freq).padStart(6)} ${(s.district ?? '').padEnd(16)} ` +
        `delete ${String(s.id).padStart(3)}:${(s.id_fm ?? '-').padEnd(10)} ${s.name ?? ''}` +
        `${insp ? `  (+${insp} inspection${insp > 1 ? 's' : ''})` : ''}`,
    );
    console.log(`         ${' '.repeat(16)}   keep ${String(live.id).padStart(3)}:${(live.id_fm ?? '-').padEnd(10)} ${live.name ?? ''}`);
  }
  console.log(`\n  station_inspection        ${inspections.length}`);
  console.log(`  station_inspection_member ${members.length}`);

  // --- Dump, unconditionally, before any delete ----------------------------
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  mkdirSync('reports', { recursive: true });
  const dumpPath = `reports/duplicate-licences-pre-delete-${ts}.json`;
  writeFileSync(
    dumpPath,
    JSON.stringify(
      {
        dumped_at: new Date().toISOString(),
        applied: APPLY,
        pairs: doomed.map((s) => ({ deleted: s, kept: survivors.get(s.id) })),
        station_inspection: inspections,
        station_inspection_member: members,
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

  const before = await prisma.fm_station.count();

  // --- Delete, children first ----------------------------------------------
  // station_inspection.station_id has no onDelete: Cascade, so fm_station last.
  await prisma.$transaction(async (tx) => {
    if (inspectionIds.length) {
      await tx.station_inspection_member.deleteMany({
        where: { inspection_id: { in: inspectionIds } },
      });
      await tx.station_inspection.deleteMany({ where: { id: { in: inspectionIds } } });
    }
    await tx.fm_station.deleteMany({ where: { id: { in: doomedIds } } });
  });

  console.log(`\nfm_station ${before} -> ${await prisma.fm_station.count()}`);

  // --- Retract the Discord notices for inspections that no longer exist -----
  const webhook = process.env.DISCORD_INSPECTION_WEBHOOK_URL;
  const orphaned = inspections.filter((i) => i.discord_message_id);
  if (orphaned.length && !webhook) {
    console.warn(
      `\nDISCORD_INSPECTION_WEBHOOK_URL unset — ${orphaned.length} embed(s) left in the channel: ` +
        orphaned.map((i) => i.discord_message_id).join(' '),
    );
  } else {
    for (const i of orphaned) {
      const res = await fetch(`${webhook}/messages/${i.discord_message_id}`, { method: 'DELETE' });
      console.log(
        res.ok || res.status === 404
          ? `  discord message ${i.discord_message_id} retracted`
          : `  discord message ${i.discord_message_id} FAILED (${res.status})`,
      );
    }
  }

  const left = await prisma.fm_station.findMany({
    where: { lat: { not: null }, long: { not: null } },
    select: { freq: true, lat: true, long: true },
  });
  const seen = new Set<string>();
  const stillStacked = left.filter((s) => {
    const k = `${s.freq}|${s.lat}|${s.long}`;
    return seen.has(k) ? true : (seen.add(k), false);
  });
  console.log(`\nRemaining freq+coordinate stacks: ${stillStacked.length}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
