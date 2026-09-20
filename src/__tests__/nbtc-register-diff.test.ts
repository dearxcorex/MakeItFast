import { describe, it, expect } from 'vitest';
import {
  stripThaiGeoPrefix,
  parseFreq,
  normaliseName,
  distanceMetres,
  filterToCoverage,
  buildDiff,
  chooseInsertTargets,
  type RegisterRow,
  type DbStationRow,
} from '../utils/nbtcRegisterDiff';

const site = (over: Partial<RegisterRow> = {}): RegisterRow => ({
  // Defaults to null: most tests exercise the fallback passes, which is what a
  // harvest without a detail page (results table / Excel) actually produces.
  stationId: null,
  nbtcCode: 'RFXL680018',
  name: 'พัฒนาและส่งเสริมการเรียนรู้ชุมชนวังชมภู',
  org: 'ห้างหุ้นส่วนจำกัด เอ็กซ์-อาย เรดิโอ',
  licenceNo: 'BF-S10033-1642-68',
  freq: 103,
  province: 'จ.ชัยภูมิ',
  district: 'อ.หนองบัวแดง',
  tambon: 'ต.วังชมภู',
  address: '326 หมู่ 11 บ้านไทรงาม',
  lat: 16.125997,
  lng: 101.622221,
  ...over,
});

const db = (over: Partial<DbStationRow> = {}): DbStationRow => ({
  register_station_id: 5550002,
  name: 'พัฒนาและส่งเสริมการเรียนรู้ชุมชนวังชมภู',
  province: 'ชัยภูมิ',
  district: 'หนองบัวแดง',
  freq: 103,
  lat: 16.125997,
  long: 101.622221,
  revoked: false,
  ...over,
});

describe('stripThaiGeoPrefix', () => {
  it('strips the register prefixes fm_station does not store', () => {
    expect(stripThaiGeoPrefix('จ.ชัยภูมิ')).toBe('ชัยภูมิ');
    expect(stripThaiGeoPrefix('อ.หนองบัวแดง')).toBe('หนองบัวแดง');
    expect(stripThaiGeoPrefix('ต.วังชมภู')).toBe('วังชมภู');
    expect(stripThaiGeoPrefix('จังหวัดชัยภูมิ')).toBe('ชัยภูมิ');
  });

  it('leaves an already-bare name alone', () => {
    expect(stripThaiGeoPrefix('ชัยภูมิ')).toBe('ชัยภูมิ');
    expect(stripThaiGeoPrefix(null)).toBe('');
  });
});

describe('parseFreq', () => {
  it('reads the MHz suffix the register renders', () => {
    expect(parseFreq('103.00MHz')).toBe(103);
    expect(parseFreq('90.25MHz')).toBe(90.25);
    expect(parseFreq('87.75')).toBe(87.75);
    expect(parseFreq(101.25)).toBe(101.25);
  });

  it('returns null rather than 0 when there is no number', () => {
    expect(parseFreq('')).toBeNull();
    expect(parseFreq(null)).toBeNull();
    expect(parseFreq('ไม่ระบุ')).toBeNull();
  });
});

describe('normaliseName', () => {
  it('ignores the spacing differences between the two systems', () => {
    expect(normaliseName('เพชรนิรันดิ์ เรดิโอ')).toBe(normaliseName('เพชรนิรันดิ์เรดิโอ'));
  });
});

describe('distanceMetres', () => {
  it('is zero for identical coordinates', () => {
    expect(distanceMetres(16.125997, 101.622221, 16.125997, 101.622221)).toBeCloseTo(0, 5);
  });

  it('matches the known 4.4km gap between two หนองบัวแดง stations', () => {
    const m = distanceMetres(16.125997, 101.622221, 16.162479, 101.63886);
    expect(m).toBeGreaterThan(4_000);
    expect(m).toBeLessThan(4_800);
  });
});

describe('filterToCoverage', () => {
  it('keeps the two covered provinces', () => {
    const rows = [site(), site({ province: 'จ.นครราชสีมา' })];
    expect(filterToCoverage(rows)).toHaveLength(2);
  });

  it('drops บุรีรัมย์ — it must not re-enter through the register', () => {
    const rows = [site(), site({ province: 'จ.บุรีรัมย์' })];
    const kept = filterToCoverage(rows);
    expect(kept).toHaveLength(1);
    expect(kept[0].province).toBe('จ.ชัยภูมิ');
  });
});

describe('buildDiff', () => {
  it('matches on freq + district across the prefix difference', () => {
    const [r] = buildDiff([site()], [db()]);
    expect(r.kind).toBe('MATCHED');
    expect(r.idFm).toBe(5550002);
    expect(r.distanceM).toBeCloseTo(0, 3);
  });

  it('matches a register row whose station code is blank', () => {
    const [r] = buildDiff([site({ nbtcCode: null, name: 'ข้าวเหนียวเรดิโอ', freq: 90.5, district: 'อ.แก้งคร้อ' })],
      [db({ register_station_id: 5520469, name: 'ข้าวเหนียวเรดิโอ', freq: 90.5, district: 'แก้งคร้อ' })]);
    expect(r.kind).toBe('MATCHED');
    expect(r.nbtcCode).toBeNull();
  });

  it('flags a matched pair whose coordinates drifted past the limit', () => {
    const [r] = buildDiff([site()], [db({ lat: 16.2, long: 101.7 })]);
    expect(r.kind).toBe('COORD_MOVED');
    expect(r.notes.join()).toMatch(/coords-differ-by-\d+m/);
  });

  it('reports a frequency reassignment as one record, not new + vanished', () => {
    const records = buildDiff([site({ freq: 104.5 })], [db()]);
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe('FREQ_CHANGED');
    expect(records[0].notes.join()).toContain('103');
  });

  it('reunites a pair that moved frequency AND changed name, by location', () => {
    const records = buildDiff([site({ freq: 104.5, name: 'ชื่อใหม่' })], [db()]);
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe('LIKELY_SAME');
  });

  it('calls a genuinely unrelated register row NEW', () => {
    const records = buildDiff(
      [site({ nbtcCode: 'RFXL689999', name: 'สถานีใหม่', freq: 95.5, district: 'อ.จัตุรัส', lat: 15.5, lng: 101.8 })],
      [db()],
    );
    expect(records.find((r) => r.kind === 'NEW')?.siteName).toBe('สถานีใหม่');
    expect(records.find((r) => r.kind === 'MISSING_ON_SITE')?.idFm).toBe(5550002);
  });

  it('notes that a DB row absent from the register was already revoked', () => {
    const records = buildDiff([], [db({ revoked: true })]);
    expect(records[0].kind).toBe('MISSING_ON_SITE');
    expect(records[0].notes.join()).toContain('already revoked');
  });

  it('does not reuse one DB row for two register rows', () => {
    const records = buildDiff([site(), site({ nbtcCode: 'RFXL680019' })], [db()]);
    expect(records.filter((r) => r.idFm === 5550002)).toHaveLength(1);
    expect(records.filter((r) => r.kind === 'NEW')).toHaveLength(1);
  });
});

describe('buildDiff — pass 0, the exact StationID join', () => {
  it('joins on station id when every heuristic would fail', () => {
    // Different frequency, different อำเภอ, different name: no other pass could
    // pair these, and every one of them would have called it NEW + MISSING_ON_SITE.
    const recs = buildDiff(
      [site({ stationId: 5520331, freq: 88.5, district: 'อ.บ้านด่าน', name: 'ชื่ออื่น' })],
      [db({ register_station_id: 5520331, freq: 103, district: 'หนองบัวแดง' })],
    );
    expect(recs).toHaveLength(1);
    expect(recs[0].matchedOn).toBe('station-id');
    expect(recs[0].idFm).toBe(5520331);
    expect(recs[0].stationId).toBe(5520331);
  });

  it('calls an id-matched frequency change FREQ_CHANGED, not NEW', () => {
    const recs = buildDiff(
      [site({ stationId: 5550002, freq: 106.75 })],
      [db({ register_station_id: 5550002, freq: 103 })],
    );
    expect(recs).toHaveLength(1);
    expect(recs[0].kind).toBe('FREQ_CHANGED');
    expect(recs[0].notes).toContain('freq 103 → 106.75');
    expect(recs[0].notes).toContain('matched-on-station-id');
  });

  it('flags coordinate drift on an id-matched pair', () => {
    const recs = buildDiff(
      [site({ stationId: 5550002, lat: 16.2, lng: 101.7 })],
      [db({ register_station_id: 5550002 })],
    );
    expect(recs[0].kind).toBe('COORD_MOVED');
    expect(recs[0].matchedOn).toBe('station-id');
    expect(recs[0].distanceM).toBeGreaterThan(500);
  });

  it('takes the id-matched row, not the one sharing freq + district', () => {
    // The decoy would win pass 1. Pass 0 must have consumed the real one first.
    const recs = buildDiff(
      [site({ stationId: 5550002 })],
      [db({ register_station_id: 5550099, name: 'สถานีอื่นที่ความถี่ชนกัน' }), db({ register_station_id: 5550002 })],
    );
    const matched = recs.find((r) => r.matchedOn === 'station-id');
    expect(matched?.idFm).toBe(5550002);
    expect(recs.filter((r) => r.kind === 'MISSING_ON_SITE').map((r) => r.idFm))
      .toEqual([5550099]);
  });

  it('falls back to the heuristics when the id is not in the DB', () => {
    // A station harvested with an id we have never seen, but which is plainly
    // the row we already hold — the composite pass still has to catch it.
    const recs = buildDiff([site({ stationId: 5559999 })], [db({ register_station_id: 5550002 })]);
    expect(recs).toHaveLength(1);
    expect(recs[0].kind).toBe('MATCHED');
    expect(recs[0].matchedOn).toBe('freq-district');
  });

  it('leaves matchedOn null on the rows that matched nothing', () => {
    const recs = buildDiff(
      // Far enough away that the coordinate pass cannot reunite them either.
      [site({
        stationId: 5559999, freq: 91.25, district: 'อ.เมืองชัยภูมิ', name: 'ใหม่',
        lat: 15.806, lng: 102.031,
      })],
      [db({ register_station_id: 5550002 })],
    );
    expect(recs.map((r) => [r.kind, r.matchedOn])).toEqual([
      ['NEW', null],
      ['MISSING_ON_SITE', null],
    ]);
  });

  it('does not let two register rows claim one DB row by id', () => {
    const recs = buildDiff(
      [site({ stationId: 5550002 }), site({ stationId: 5550002, name: 'ซ้ำ' })],
      [db({ register_station_id: 5550002 })],
    );
    expect(recs.filter((r) => r.matchedOn === 'station-id')).toHaveLength(1);
    expect(recs.filter((r) => r.kind === 'NEW')).toHaveLength(1);
  });
});

describe('chooseInsertTargets', () => {
  it('writes NEW only — every other category is report-only', () => {
    const records = buildDiff(
      [site(), site({ nbtcCode: 'RFXL689999', name: 'สถานีใหม่', freq: 95.5, district: 'อ.จัตุรัส', lat: 15.5, lng: 101.8 })],
      [db()],
    );
    const targets = chooseInsertTargets(records);
    expect(targets).toHaveLength(1);
    expect(targets[0].siteName).toBe('สถานีใหม่');
  });
});
