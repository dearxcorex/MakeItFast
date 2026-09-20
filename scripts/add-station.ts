/* eslint-disable no-console */
/**
 * Add a single fm_station row.
 *
 * fm_station.register_station_id has no default since ADR 0003 -- it is the NBTC
 * register's StationID, not a number a sequence is allowed to invent. A station
 * we are tracking before it appears in the register simply has none, and is
 * inserted with it NULL until a register sync fills it in.
 *
 * id_fm is the identifier the UI prints: the NBTC code when there is one, else
 * the StationID as digits, else NULL.
 *
 * This is the supported way to create a station. Hand-written SQL is how the
 * eight สถานีหลัก rows ended up numbered 1-11.
 *
 *   npx tsx scripts/add-station.ts --name "สถานีตัวอย่าง" --freq 95.5 \
 *     --province นครราชสีมา --district เมือง --type บริการธุรกิจ
 *
 *   ... --station-id 5520999     # StationID, when the station is in the register
 *   ... --nbtc-code RFXL680018   # official NBTC code, when it has one
 *   ... --lat 14.97 --long 102.1
 *   ... --apply                  # without this it is a dry run
 */
import { PrismaClient } from '@prisma/client';
import { TARGET_PROVINCES } from '../src/utils/offairAudit';

const STATION_TYPES = ['บริการธุรกิจ', 'บริการสาธารณะ', 'บริการชุมชน', 'สถานีหลัก'] as const;

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : undefined;
}

const APPLY = process.argv.includes('--apply');

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

async function main() {
  const name = flag('name') ?? fail('--name is required');
  const freqRaw = flag('freq') ?? fail('--freq is required');
  const province = flag('province') ?? fail('--province is required');
  const district = flag('district') ?? fail('--district is required');
  const type = flag('type') ?? fail('--type is required');

  const freq = Number(freqRaw);
  if (!Number.isFinite(freq) || freq < 87 || freq > 108) {
    fail(`--freq ${freqRaw} is not an FM frequency (87-108 MHz)`);
  }
  if (!(TARGET_PROVINCES as readonly string[]).includes(province)) {
    fail(`--province must be one of ${TARGET_PROVINCES.join(', ')} -- this office tracks no others`);
  }
  if (!(STATION_TYPES as readonly string[]).includes(type)) {
    fail(`--type must be one of ${STATION_TYPES.join(', ')} (these are compared in logic, not displayed)`);
  }

  const idFmRaw = flag('station-id') ?? flag('id-fm');
  let idFm: number | null = null;
  if (idFmRaw !== undefined) {
    idFm = Number(idFmRaw);
    if (!Number.isInteger(idFm)) fail(`--station-id ${idFmRaw} is not an integer`);
    // Real StationIDs are seven digits. A small number here means someone is
    // hand-numbering again, which is the thing ADR 0003 exists to stop.
    if (idFm < 1_000_000) {
      fail(`--station-id ${idFm} is not a register StationID (they are 7 digits). Omit it instead -- NULL means "not in the register yet".`);
    }
  }

  const nbtcCode = flag('nbtc-code') ?? null;
  const latRaw = flag('lat');
  const longRaw = flag('long');
  const lat = latRaw === undefined ? null : Number(latRaw);
  const long = longRaw === undefined ? null : Number(longRaw);
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) fail(`--lat ${latRaw} out of range`);
  if (long !== null && (!Number.isFinite(long) || long < -180 || long > 180)) fail(`--long ${longRaw} out of range`);

  const prisma = new PrismaClient();

  if (idFm !== null) {
    const clash = await prisma.fm_station.findUnique({ where: { register_station_id: idFm } });
    if (clash) fail(`StationID ${idFm} already belongs to "${clash.name}" (id ${clash.id})`);
  }
  if (nbtcCode) {
    const clash = await prisma.fm_station.findUnique({ where: { id_fm: nbtcCode } });
    if (clash) fail(`NBTC code ${nbtcCode} already belongs to "${clash.name}" (id ${clash.id})`);
  }

  const sameSlot = await prisma.fm_station.findFirst({
    where: { freq, province, district, revoked: false },
  });
  if (sameSlot) {
    console.warn(`warning: ${freq} MHz in ${district}, ${province} is already held by "${sameSlot.name}" (id ${sameSlot.id})`);
  }

  const data = {
    register_station_id: idFm,
    // The NBTC code wins; the StationID is the fallback the UI prints as FM-<n>.
    id_fm: nbtcCode ?? (idFm === null ? null : String(idFm)),
    name,
    freq,
    lat,
    long,
    district,
    province,
    type,
    // Newly licensed and not yet inspected: the pending bucket, not a confirmed
    // OFF AIR pin. Matches what sync-register does for its inserts.
    on_air: true,
    inspection_69: false,
    submit_a_request: false,
    revoked: false,
  };

  console.log(JSON.stringify(data, null, 2));

  if (!APPLY) {
    console.log('\n(dry run -- re-run with --apply to insert)');
    await prisma.$disconnect();
    return;
  }

  const created = await prisma.fm_station.create({ data });
  console.log(`\ninserted id ${created.id}${idFm === null ? ' (no StationID yet)' : ` / StationID ${idFm}`}`);
  console.log(`undo: DELETE FROM fm_station WHERE id = ${created.id};`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
