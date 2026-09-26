// Tools the /ask bot may call. Every number the bot is allowed to state comes
// from here — the model routes, these compute.
//
// Data governance: DeepSeek is hosted outside Thailand, so these tools return
// summaries, never raw rows. Coordinates in particular never leave: a
// geographic question gets a derived distance back, not a lat/long pair.

import prisma from '@/lib/prisma';
import { searchWeb, type ToolDefinition } from '@/lib/deepseek';
import { convertToFMStation } from '@/services/stationService';
import { haversineDistanceKm } from '@/utils/distance';
import {
  assessInterferenceRisk,
  calculatePathLoss,
  findPairsForTargetFrequency,
} from '@/utils/intermodCalculations';

const MAX_STATIONS = 25;
const MAX_PAIRS = 10;

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'find_stations',
    description:
      'ค้นหาสถานีวิทยุ FM ที่ได้รับอนุญาต ในฐานข้อมูลของสำนักงาน (เฉพาะ 87.5–108 MHz ' +
      'จังหวัดนครราชสีมาและชัยภูมิ) กรองตามความถี่ ช่วงความถี่ ชื่อ อำเภอ จังหวัด หรือระยะห่างจากพิกัด ' +
      'คืนค่าเป็นรายการย่อและจำนวนรวม ไม่คืนพิกัด',
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
    name: 'scan_intermod',
    description:
      'หาคู่สถานี FM ที่ผสมกันแล้วเกิดอินเตอร์มอดอันดับสาม (2f1−f2, 2f2−f1) ตกที่ความถี่เป้าหมาย ' +
      'ใช้เมื่อมีเรื่องร้องเรียนการรบกวนที่ความถี่หนึ่ง ๆ โดยเฉพาะย่านการบิน 108–137 MHz ' +
      'คำนวณจากสถานีจริงในฐานข้อมูล',
    input_schema: {
      type: 'object',
      properties: {
        targetFrequency: { type: 'number', description: 'ความถี่ที่ถูกรบกวน (MHz)' },
        toleranceMHz: { type: 'number', description: 'ความคลาดเคลื่อนที่ยอมรับ (MHz) ค่าเริ่มต้น 0.1' },
      },
      required: ['targetFrequency'],
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

async function scanIntermod(input: Record<string, unknown>) {
  const targetFrequency = num(input, 'targetFrequency');
  if (targetFrequency === undefined) throw new Error('targetFrequency is required');
  const tolerance = num(input, 'toleranceMHz') ?? 0.1;

  const rows = await prisma.fm_station.findMany();
  const all = rows.map(convertToFMStation);
  // Pairs are reported with a separation distance, so a station without
  // coordinates cannot take part; count them so the answer can say so.
  const located = all.filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));

  const result = findPairsForTargetFrequency(located, targetFrequency, tolerance);
  const risks = assessInterferenceRisk(result.dangerousPairs, { frequency: targetFrequency });

  const pairs = result.dangerousPairs
    .slice()
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_PAIRS)
    .map((p) => ({
      station1: { idFm: p.station1.idFm ?? null, name: p.station1.name, freqMHz: p.station1.frequency, district: p.station1.city },
      station2: { idFm: p.station2.idFm ?? null, name: p.station2.name, freqMHz: p.station2.frequency, district: p.station2.city },
      separationKm: Math.round(p.distance * 10) / 10,
      products: p.aviationProducts.map((a) => ({
        type: a.type,
        frequencyMHz: Math.round(a.frequency * 1000) / 1000,
        deltaMHz: Math.round(Math.abs(a.frequency - targetFrequency) * 1000) / 1000,
        affectedService: a.affectedService ?? null,
      })),
    }));

  return {
    targetFrequencyMHz: targetFrequency,
    toleranceMHz: tolerance,
    stationsScanned: located.length,
    stationsSkippedNoCoordinates: all.length - located.length,
    dangerousPairsFound: result.dangerousPairs.length,
    highestRiskLevel: risks[0]?.riskLevel ?? null,
    note:
      'คู่ที่ใกล้กันมีโอกาสผสมกันจริงสูงกว่า เรียงจากใกล้ไปไกล ' +
      'ผลนี้เป็นการคัดกรองทางคณิตศาสตร์ ยังไม่ใช่การยืนยันว่าเกิดการรบกวนจริง',
    pairs,
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
 * Run one tool call. Throwing is fine — the agent turns a throw into a
 * tool_result with is_error, so the model can recover or say it could not.
 */
export async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  if (!TOOL_NAMES.has(name)) throw new Error(`unknown tool: ${name}`);
  switch (name) {
    case 'find_stations':
      return findStations(input);
    case 'scan_intermod':
      return scanIntermod(input);
    case 'path_loss':
      return pathLoss(input);
    case 'web_search': {
      const query = str(input, 'query');
      if (!query) throw new Error('query is required');
      return { query, result: await searchWeb(query) };
    }
    default:
      throw new Error(`unhandled tool: ${name}`);
  }
}
