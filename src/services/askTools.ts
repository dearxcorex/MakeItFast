// Tools the /ask bot may call. Every number the bot is allowed to state comes
// from here — the model routes, these compute.
//
// Data governance: DeepSeek is hosted outside Thailand, so these tools return
// summaries, never raw rows. Coordinates in particular never leave: a
// geographic question gets a derived distance back, not a lat/long pair.

import prisma from '@/lib/prisma';
import { searchWeb, type ToolDefinition } from '@/lib/deepseek';
import { haversineDistanceKm } from '@/utils/distance';
import { operRequest, operTimeoutMessage } from '@/lib/operApi';
import { calculatePathLoss } from '@/utils/intermodCalculations';

const MAX_STATIONS = 25;
const OPER_SOURCES = ['ASMS', 'WEB', 'BCS', 'BCS2', 'BCS3', 'OPER'] as const;
const OPER_RESULTS = ['ตรงตามมาตรฐาน', 'ไม่ตรงตามมาตรฐาน'] as const;

/** The one narrowing hint each OPER tool's timeout carries. */
const OPER_NARROWING_TIP: Record<string, string> = {
  find_oper_stations: 'ลองระบุตำบลหรือความถี่เพื่อให้ค้นแคบลง',
  count_oper_inspections: 'ลองใช้ช่วงวันที่ที่สั้นลง',
};

/** What a timed-out OPER tool reports; undefined for every other tool. */
export function operToolTimeout(name: string): string | undefined {
  const tip = OPER_NARROWING_TIP[name];
  return tip ? operTimeoutMessage(tip) : undefined;
}
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'find_stations',
    description:
      'ค้นหาสถานีวิทยุ FM ที่ได้รับอนุญาต ในฐานข้อมูลของสำนักงาน (เฉพาะ 87.5–108 MHz ' +
      'จังหวัดนครราชสีมาและชัยภูมิ) กรองตามความถี่ ช่วงความถี่ ชื่อ อำเภอ จังหวัด หรือระยะห่างจากพิกัด ' +
      'คืนค่าเป็นรายการย่อ (รวมสถานะตรวจแล้ว ออกอากาศ เพิกถอน) และจำนวนรวม ไม่คืนพิกัด',
    input_schema: {
      type: 'object',
      properties: {
        frequency: { type: 'number', description: 'ความถี่ที่ต้องการ (MHz) จับคู่แบบ ±0.05 MHz' },
        freqMin: { type: 'number', description: 'ขอบล่างของช่วงความถี่ (MHz)' },
        freqMax: { type: 'number', description: 'ขอบบนของช่วงความถี่ (MHz)' },
        name: { type: 'string', description: 'ชื่อสถานี (บางส่วนได้)' },
        district: { type: 'string', description: 'อำเภอ' },
        province: { type: 'string', description: 'จังหวัด' },
        nearLat: { type: 'number', description: 'ละติจูดจุดอ้างอิง ใช้คู่กับ nearLong' },
        nearLong: { type: 'number', description: 'ลองจิจูดจุดอ้างอิง ใช้คู่กับ nearLat' },
        radiusKm: { type: 'number', description: 'รัศมีเป็นกิโลเมตรจากจุดอ้างอิง ค่าเริ่มต้น 30' },
        limit: { type: 'number', description: `จำนวนสูงสุดที่ส่งกลับ (สูงสุด ${MAX_STATIONS})` },
      },
    },
  },
  {
    name: 'path_loss',
    description:
      'คำนวณการสูญเสียในเส้นทางแบบ free-space (FSPL) เป็น dB จากระยะทางและความถี่ ' +
      'ใช้ประเมินคร่าว ๆ ว่าสัญญาณที่ระยะหนึ่งควรแรงเท่าไร ไม่รวมภูมิประเทศและสิ่งกีดขวาง',
    input_schema: {
      type: 'object',
      properties: {
        distanceKm: { type: 'number', description: 'ระยะทาง (กิโลเมตร)' },
        frequencyMHz: { type: 'number', description: 'ความถี่ (MHz)' },
      },
      required: ['distanceKm', 'frequencyMHz'],
    },
  },
  {
    name: 'web_search',
    description:
      'ค้นเว็บ ใช้เมื่อต้องการข้อมูลที่ไม่ได้อยู่ในฐานข้อมูลของสำนักงาน เช่น ย่านความถี่นี้จัดสรรให้บริการอะไร ' +
      'อุปกรณ์รุ่นใดใช้ความถี่นี้ สเปกเครื่องมือ หรือแนวปฏิบัติของหน่วยงานกำกับดูแล',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'คำค้น ใช้ภาษาอังกฤษจะได้ผลดีกว่า' } },
      required: ['query'],
    },
  },
  {
    name: 'find_oper_stations',
    description:
      'ค้นทะเบียนสถานีวิทยุกระจายเสียงของ กสทช. (ระบบ OPER สำเนาที่บันทึกทุกเดือน ค้นสดเมื่อสำเนาไม่ครอบคลุม) รวมสถานีที่ยังไม่เคยตรวจ ' +
      'และสถานีที่ไม่มีในฐานข้อมูลของสำนักงาน กรองตามจังหวัด อำเภอ ตำบล ความถี่ (ตรงตัว) ชื่อ หรือแหล่งข้อมูล ' +
      'ต้องระบุอย่างน้อยหนึ่งอย่างจาก จังหวัด อำเภอ ความถี่ ชื่อ  ' +
      'BCS BCS2 BCS3 WEB OPER ASMS เป็นชื่อแหล่งข้อมูล (source) ของทะเบียน ไม่ใช่ชื่อสถานีหรือผู้ประกอบการ ' +
      'ห้ามใส่ใน name  details=true เพิ่มเลขใบอนุญาต วันหมดอายุ ' +
      'และผู้ประกอบการ (ช้ากว่า สูงสุด 10 สถานี) ไม่คืนพิกัดและเบอร์โทร (ระบบแสดงต่อท้ายคำตอบให้เอง) ช้ากว่า find_stations หลายวินาที',
    input_schema: {
      type: 'object',
      properties: {
        province: { type: 'string', description: 'จังหวัด เช่น ชัยภูมิ' },
        district: {
          type: 'string',
          description: 'อำเภอ เช่น ภูเขียว ใส่ province ด้วยเมื่อรู้ (อ.เมืองนครราชสีมา → province นครราชสีมา)',
        },
        subdistrict: { type: 'string', description: 'ตำบล ต้องระบุอำเภอด้วย' },
        frequency: { type: 'number', description: 'ความถี่ MHz แบบตรงตัว เช่น 91.75' },
        name: { type: 'string', description: 'ชื่อสถานี (บางส่วนได้)' },
        source: {
          type: 'string',
          enum: [...OPER_SOURCES],
          description:
            'แหล่งข้อมูลของทะเบียน (SrcData) ตรงตัว: BCS คือ BCS เท่านั้น ไม่รวม BCS2/BCS3 ' +
            'ไม่ระบุ = BCS  OPER คือทะเบียนใบอนุญาต',
        },
        limit: { type: 'number', description: `จำนวนสูงสุดที่ส่งกลับ (สูงสุด ${MAX_STATIONS})` },
        details: { type: 'boolean', description: 'เพิ่มเลขใบอนุญาต วันหมดอายุ ผู้ประกอบการ' },
      },
    },
  },
  {
    name: 'count_oper_inspections',
    description:
      'นับการตรวจสถานีวิทยุที่บันทึกในระบบ OPER ของ กสทช. (ข้อมูลสด) ในช่วงวันที่ตรวจ ' +
      'คืนจำนวนครั้งที่ตรวจ (inspections) จำนวนสถานีที่ไม่ซ้ำ (stations) ' +
      'และแยกตามผลตรวจ (by_result) กรองตามจังหวัด อำเภอ ผลตรวจได้ ใช้ปี ค.ศ. ช่วงยิ่งยาวยิ่งช้า',
    input_schema: {
      type: 'object',
      properties: {
        inspectedFrom: { type: 'string', description: 'วันแรก YYYY-MM-DD (ค.ศ.)' },
        inspectedTo: { type: 'string', description: 'วันสุดท้าย YYYY-MM-DD (ค.ศ.)' },
        province: { type: 'string', description: 'จังหวัด' },
        district: { type: 'string', description: 'อำเภอ' },
        result: {
          type: 'string',
          enum: [...OPER_RESULTS],
          description:
            'ผลตรวจ ใส่เฉพาะเมื่อถามถึงผลตรวจ: ผ่าน → ตรงตามมาตรฐาน, ไม่ผ่าน → ไม่ตรงตามมาตรฐาน ' +
            'ไม่ระบุ = ทุกผล (คืน by_result ให้แยกเอง)',
        },
      },
      required: ['inspectedFrom', 'inspectedTo'],
    },
  },
];

const TOOL_NAMES = new Set(TOOL_DEFINITIONS.map((t) => t.name));

function num(input: Record<string, unknown>, key: string): number | undefined {
  const v = input[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function str(input: Record<string, unknown>, key: string): string | undefined {
  const v = input[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

interface StationWhere {
  freq?: { gte?: number; lte?: number };
  name?: { contains: string; mode: 'insensitive' };
  district?: { contains: string };
  province?: { contains: string };
}

async function findStations(input: Record<string, unknown>) {
  const where: StationWhere = {};

  const frequency = num(input, 'frequency');
  const freqMin = num(input, 'freqMin');
  const freqMax = num(input, 'freqMax');
  if (frequency !== undefined) {
    where.freq = { gte: frequency - 0.05, lte: frequency + 0.05 };
  } else if (freqMin !== undefined || freqMax !== undefined) {
    where.freq = { ...(freqMin !== undefined && { gte: freqMin }), ...(freqMax !== undefined && { lte: freqMax }) };
  }

  const name = str(input, 'name');
  if (name) where.name = { contains: name, mode: 'insensitive' };
  const district = str(input, 'district');
  if (district) where.district = { contains: district };
  const province = str(input, 'province');
  if (province) where.province = { contains: province };

  const nearLat = num(input, 'nearLat');
  const nearLong = num(input, 'nearLong');
  const geo = nearLat !== undefined && nearLong !== undefined;
  const radiusKm = num(input, 'radiusKm') ?? 30;
  const limit = Math.min(Math.max(Math.trunc(num(input, 'limit') ?? 10), 1), MAX_STATIONS);

  const rows = await prisma.fm_station.findMany({
    where,
    select: {
      id_fm: true,
      name: true,
      freq: true,
      district: true,
      province: true,
      type: true,
      on_air: true,
      revoked: true,
      inspection_69: true,
      // Read only to derive distanceKm below; never returned to the model.
      lat: true,
      long: true,
    },
    orderBy: { freq: 'asc' },
    // A geographic query has to sort by a value the database does not hold, so
    // it pulls the filtered set and ranks in memory. 213 stations makes that free.
    ...(geo ? {} : { take: limit }),
  });

  const shaped = rows.map((r) => ({
    idFm: r.id_fm ?? null,
    name: r.name ?? null,
    freqMHz: r.freq ?? null,
    district: r.district ?? null,
    province: r.province ?? null,
    type: r.type ?? null,
    onAir: r.on_air ?? false,
    revoked: r.revoked === true,
    inspected: r.inspection_69 === true,
    distanceKm:
      geo && r.lat != null && r.long != null
        ? Math.round(haversineDistanceKm(nearLat, nearLong, r.lat, r.long) * 10) / 10
        : undefined,
  }));

  const stations = geo
    ? shaped
        .filter((s) => s.distanceKm !== undefined && s.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm! - b.distanceKm!)
        .slice(0, limit)
    : shaped;

  return {
    matched: geo ? shaped.filter((s) => s.distanceKm !== undefined && s.distanceKm <= radiusKm).length : rows.length,
    returned: stations.length,
    note: 'ฐานข้อมูลนี้มีเฉพาะสถานี FM ที่ได้รับอนุญาต 87.5–108 MHz ในนครราชสีมาและชัยภูมิ',
    stations,
  };
}

function pathLoss(input: Record<string, unknown>) {
  const distanceKm = num(input, 'distanceKm');
  const frequencyMHz = num(input, 'frequencyMHz');
  if (distanceKm === undefined || frequencyMHz === undefined) {
    throw new Error('distanceKm and frequencyMHz are required');
  }
  if (distanceKm <= 0 || frequencyMHz <= 0) throw new Error('distanceKm and frequencyMHz must be greater than zero');
  return {
    distanceKm,
    frequencyMHz,
    freeSpacePathLossDb: Math.round(calculatePathLoss(distanceKm, frequencyMHz) * 10) / 10,
    note: 'FSPL เท่านั้น ไม่รวมภูมิประเทศ สิ่งกีดขวาง หรืออัตราขยายสายอากาศ',
  };
}

/**
 * Where a station is and whom to call. Kept out of the model's view — DeepSeek
 * is hosted offshore — and printed under the answer by utils/askMessage.ts.
 */
export interface StationDetail {
  name: string | null;
  frequencyMHz: number | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  lat: number | null;
  lng: number | null;
  contactName: string | null;
  contactPhone: string | null;
}

/** A tool output's station details, under a symbol key: JSON.stringify, and so the model, never sees them. */
export const STATION_DETAILS = Symbol('stationDetails');

const PRIVATE_STATION_KEYS = new Set(['lat', 'lng', 'contact_name', 'contact_phone', 'contact_date']);

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function degrees(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v !== 0 ? v : null;
}

function stationDetail(s: Record<string, unknown>): StationDetail {
  return {
    name: text(s.name),
    frequencyMHz: typeof s.frequency_mhz === 'number' ? s.frequency_mhz : null,
    subdistrict: text(s.subdistrict),
    district: text(s.district),
    province: text(s.province),
    lat: degrees(s.lat),
    lng: degrees(s.lng),
    contactName: text(s.contact_name),
    contactPhone: text(s.contact_phone),
  };
}

async function findOperStations(input: Record<string, unknown>) {
  const body: Record<string, unknown> = {};
  for (const key of ['province', 'district', 'subdistrict', 'name'] as const) {
    const v = str(input, key);
    if (v) body[key] = v;
  }
  const frequency = num(input, 'frequency');
  if (frequency !== undefined) body.frequency = frequency;
  if (!body.province && !body.district && !body.name && body.frequency === undefined) {
    throw new Error('ต้องระบุอย่างน้อยหนึ่งอย่าง: province, district, frequency หรือ name');
  }
  const source = str(input, 'source');
  if (source && (OPER_SOURCES as readonly string[]).includes(source)) body.source = source;
  body.limit = Math.min(Math.max(Math.trunc(num(input, 'limit') ?? 10), 1), MAX_STATIONS);
  if (input.details === true) body.details = true;

  const out = (await operRequest('/find-stations', body, OPER_NARROWING_TIP.find_oper_stations)) as Record<string, unknown>;
  const notes = [
    'ทะเบียนสถานีระบบ OPER ของ กสทช. ที่ตั้ง พิกัด และเบอร์โทรของแต่ละสถานี ระบบแสดงต่อท้ายคำตอบให้แล้ว ' +
      'ห้ามเขียนหรือเดาพิกัดและเบอร์โทรเอง',
  ];
  if (out.as_of) notes.push('as_of = เวลาที่บันทึกทะเบียนไว้ (ระบบแสดงในท้ายคำตอบให้แล้ว)');
  if (out.complete === false) {
    notes.push(`รายการไม่ครบ (ค้นสดไม่ทันเวลา): บอกผู้ใช้ว่าแสดง ${String(out.shown)} จาก ${String(out.total)} สถานี`);
  }
  const rows = Array.isArray(out.stations) ? (out.stations as Record<string, unknown>[]) : [];
  return {
    ...out,
    stations: rows.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !PRIVATE_STATION_KEYS.has(k)))),
    note: notes.join(' '),
    [STATION_DETAILS]: rows.map(stationDetail),
  };
}

async function countOperInspections(input: Record<string, unknown>) {
  const inspectedFrom = str(input, 'inspectedFrom');
  const inspectedTo = str(input, 'inspectedTo');
  if (!inspectedFrom || !inspectedTo || !ISO_DATE.test(inspectedFrom) || !ISO_DATE.test(inspectedTo)) {
    throw new Error('inspectedFrom and inspectedTo are required as YYYY-MM-DD');
  }
  const body: Record<string, unknown> = { inspected_from: inspectedFrom, inspected_to: inspectedTo };
  const province = str(input, 'province');
  if (province) body.province = province;
  const district = str(input, 'district');
  if (district) body.district = district;
  const result = str(input, 'result');
  if (result && (OPER_RESULTS as readonly string[]).includes(result)) body.result = result;

  return {
    ...(await operRequest('/count-stations', body, OPER_NARROWING_TIP.count_oper_inspections) as Record<string, unknown>),
    note:
      'นับจากบันทึกการตรวจในระบบ OPER ของ กสทช. inspections = จำนวนครั้งที่ตรวจ (ตรงกับจำนวนแถวในระบบ OPER ใช้เป็นตัวเลขหลัก), ' +
      'by_result = แยกตามผลตรวจ, stations = สถานีไม่ซ้ำ (ไม่ต้องใส่ในคำตอบ เว้นแต่ถูกถามว่ากี่สถานี)',
  };
}

/**
 * Run one tool call. Throwing is fine — the agent turns a throw into a
 * tool_result with is_error, so the model can recover or say it could not.
 */
export async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  if (!TOOL_NAMES.has(name)) throw new Error(`unknown tool: ${name}`);
  switch (name) {
    case 'find_stations':
      return findStations(input);
    case 'path_loss':
      return pathLoss(input);
    case 'web_search': {
      const query = str(input, 'query');
      if (!query) throw new Error('query is required');
      return { query, result: await searchWeb(query) };
    }
    case 'find_oper_stations':
      return findOperStations(input);
    case 'count_oper_inspections':
      return countOperInspections(input);
    default:
      throw new Error(`unhandled tool: ${name}`);
  }
}
