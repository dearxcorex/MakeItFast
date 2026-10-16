import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { fm_station: { findMany: vi.fn() } },
}));

vi.mock('@/lib/deepseek', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/deepseek')>()),
  searchWeb: vi.fn(),
}));

import prisma from '@/lib/prisma';
import { searchWeb } from '@/lib/deepseek';
import { TOOL_DEFINITIONS, runTool } from '@/services/askTools';

// นครราชสีมา city centre-ish, used as the "near" reference below.
const KORAT = { lat: 14.9799, long: 102.0977 };

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    id_fm: 'NM-001',
    register_station_id: 1001,
    name: 'สถานีทดสอบ',
    freq: 100.0,
    lat: KORAT.lat,
    long: KORAT.long,
    district: 'เมืองนครราชสีมา',
    province: 'นครราชสีมา',
    type: 'สถานีหลัก',
    inspection_69: true,
    on_air: true,
    submit_a_request: true,
    date_inspected: '2026-09-01',
    revoked: false,
    revoked_note: null,
    permit: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('TOOL_DEFINITIONS', () => {
  it('exposes exactly the five tools the agent is allowed to call', () => {
    expect(TOOL_DEFINITIONS.map((t) => t.name).sort()).toEqual([
      'count_oper_inspections',
      'find_oper_stations',
      'find_stations',
      'path_loss',
      'web_search',
    ]);
  });

  it('gives every tool a description and an object schema', () => {
    for (const t of TOOL_DEFINITIONS) {
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.input_schema.type).toBe('object');
    }
  });
});

describe('runTool — unknown names', () => {
  it('refuses a tool that is not on the list', async () => {
    await expect(runTool('drop_everything', {})).rejects.toThrow('unknown tool');
    expect(prisma.fm_station.findMany).not.toHaveBeenCalled();
  });
});

describe('find_stations', () => {
  it('matches a frequency within ±0.05 MHz', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([row()] as never);
    await runTool('find_stations', { frequency: 100 });
    const args = vi.mocked(prisma.fm_station.findMany).mock.calls[0][0]!;
    expect(args.where).toEqual({ freq: { gte: 99.95, lte: 100.05 } });
  });

  it('never returns coordinates', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([row()] as never);
    const out = (await runTool('find_stations', {})) as { stations: Record<string, unknown>[] };
    expect(JSON.stringify(out)).not.toContain('102.09');
    expect(out.stations[0]).not.toHaveProperty('lat');
    expect(out.stations[0]).not.toHaveProperty('long');
  });

  it('shapes a row into the summary the model sees', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([row()] as never);
    const out = (await runTool('find_stations', {})) as { stations: Record<string, unknown>[] };
    expect(out.stations[0]).toEqual({
      idFm: 'NM-001',
      name: 'สถานีทดสอบ',
      freqMHz: 100,
      district: 'เมืองนครราชสีมา',
      province: 'นครราชสีมา',
      type: 'สถานีหลัก',
      onAir: true,
      revoked: false,
      inspected: true,
      distanceKm: undefined,
    });
  });

  it('returns a derived distance instead of coordinates for a geographic query', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([
      row({ id: 1, name: 'ใกล้' }),
      row({ id: 2, name: 'ไกล', lat: 15.5, long: 102.6 }),
    ] as never);
    const out = (await runTool('find_stations', {
      nearLat: KORAT.lat,
      nearLong: KORAT.long,
      radiusKm: 10,
    })) as { matched: number; stations: Array<{ name: string; distanceKm: number }> };
    expect(out.stations).toHaveLength(1);
    expect(out.stations[0].name).toBe('ใกล้');
    expect(out.stations[0].distanceKm).toBe(0);
    expect(out.matched).toBe(1);
  });

  it('sorts a geographic query nearest first', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([
      row({ id: 1, name: 'ไกล', lat: 15.05, long: 102.15 }),
      row({ id: 2, name: 'ใกล้' }),
    ] as never);
    const out = (await runTool('find_stations', { nearLat: KORAT.lat, nearLong: KORAT.long })) as {
      stations: Array<{ name: string }>;
    };
    expect(out.stations.map((s) => s.name)).toEqual(['ใกล้', 'ไกล']);
  });

  it('skips a station with no coordinates rather than reporting NaN km', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([row({ lat: null, long: null })] as never);
    const out = (await runTool('find_stations', { nearLat: KORAT.lat, nearLong: KORAT.long })) as {
      stations: unknown[];
    };
    expect(out.stations).toEqual([]);
  });

  it('caps the row count however large a limit the model asks for', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([] as never);
    await runTool('find_stations', { limit: 500 });
    expect(vi.mocked(prisma.fm_station.findMany).mock.calls[0][0]!.take).toBe(25);
  });

  it('tells the model which band the answer is actually backed by', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([] as never);
    const out = (await runTool('find_stations', {})) as { note: string };
    expect(out.note).toContain('87.5–108 MHz');
  });
});

describe('path_loss', () => {
  it('computes free-space path loss', async () => {
    const out = (await runTool('path_loss', { distanceKm: 10, frequencyMHz: 100 })) as {
      freeSpacePathLossDb: number;
    };
    // FSPL = 20log10(10) + 20log10(100) + 32.45 = 92.45 dB, reported to 0.1 dB
    expect(out.freeSpacePathLossDb).toBe(92.5);
  });

  it('rejects a zero or negative distance instead of returning -Infinity', async () => {
    await expect(runTool('path_loss', { distanceKm: 0, frequencyMHz: 100 })).rejects.toThrow(
      'greater than zero',
    );
  });

  it('rejects a missing argument', async () => {
    await expect(runTool('path_loss', { distanceKm: 10 })).rejects.toThrow('are required');
  });
});

describe('web_search', () => {
  it('passes the query through and returns what DeepSeek found', async () => {
    vi.mocked(searchWeb).mockResolvedValue('พบว่าเป็นย่าน land mobile');
    const out = await runTool('web_search', { query: 'Thailand 145 MHz allocation' });
    expect(searchWeb).toHaveBeenCalledWith('Thailand 145 MHz allocation');
    expect(out).toEqual({ query: 'Thailand 145 MHz allocation', result: 'พบว่าเป็นย่าน land mobile' });
  });

  it('refuses an empty query', async () => {
    await expect(runTool('web_search', { query: '   ' })).rejects.toThrow('query is required');
    expect(searchWeb).not.toHaveBeenCalled();
  });
});

describe('OPER tools', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('OPER_API_URL', 'http://127.0.0.1:8787/');
    vi.stubEnv('OPER_API_TOKEN', 'secret');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function respond(status: number, body: unknown) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
  }

  function sent() {
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    return { url, headers: init.headers, body: JSON.parse(init.body) };
  }

  it('find_oper_stations posts the filters with the bearer token', async () => {
    respond(200, { total: 1, shown: 1, stations: [{ stn_id: '9', name: 'ทดสอบ', frequency_mhz: 91.75 }] });
    const out = (await runTool('find_oper_stations', { province: 'ชัยภูมิ', frequency: 91.75, details: true })) as {
      total: number;
      note: string;
    };
    const { url, headers, body } = sent();
    expect(url).toBe('http://127.0.0.1:8787/find-stations');
    expect(headers.Authorization).toBe('Bearer secret');
    expect(body).toEqual({ province: 'ชัยภูมิ', frequency: 91.75, limit: 10, details: true });
    expect(out.total).toBe(1);
    expect(out.note).toContain('OPER');
  });

  it('find_oper_stations caps the limit and drops an unknown source', async () => {
    respond(200, { total: 0, stations: [] });
    await runTool('find_oper_stations', { name: 'คน', limit: 500, source: 'BOGUS' });
    expect(sent().body).toEqual({ name: 'คน', limit: 25 });
  });

  it('find_oper_stations refuses a query with no filter before calling out', async () => {
    await expect(runTool('find_oper_stations', { subdistrict: 'ในเมือง' })).rejects.toThrow('ต้องระบุ');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('count_oper_inspections maps the dates to the wrapper fields', async () => {
    respond(200, { inspections: 40, stations: 31, complete: true, inspected_from: '2026-01-01', inspected_to: '2026-10-16' });
    const out = (await runTool('count_oper_inspections', {
      inspectedFrom: '2026-01-01',
      inspectedTo: '2026-10-16',
      province: 'นครราชสีมา',
    })) as { stations: number };
    expect(sent().url).toBe('http://127.0.0.1:8787/count-stations');
    expect(sent().body).toEqual({ inspected_from: '2026-01-01', inspected_to: '2026-10-16', province: 'นครราชสีมา' });
    expect(out.stations).toBe(31);
  });

  it('count_oper_inspections passes a result filter through and drops anything else', async () => {
    respond(200, { inspections: 8, stations: 8, complete: true });
    await runTool('count_oper_inspections', { inspectedFrom: '2026-01-01', inspectedTo: '2026-10-16', result: 'ไม่ตรงตามมาตรฐาน' });
    expect(sent().body).toEqual({ inspected_from: '2026-01-01', inspected_to: '2026-10-16', result: 'ไม่ตรงตามมาตรฐาน' });
    respond(200, { inspections: 126, stations: 122, complete: true });
    await runTool('count_oper_inspections', { inspectedFrom: '2026-01-01', inspectedTo: '2026-10-16', result: 'ผ่าน' });
    expect(sent().body).toEqual({ inspected_from: '2026-01-01', inspected_to: '2026-10-16' });
  });

  it('count_oper_inspections tells the model inspections are the headline', async () => {
    respond(200, { inspections: 126, stations: 122, by_result: {}, complete: true });
    const out = (await runTool('count_oper_inspections', { inspectedFrom: '2026-01-01', inspectedTo: '2026-10-16' })) as {
      note: string;
    };
    expect(out.note).toContain('ตัวเลขหลัก');
    expect(out.note).toContain('by_result');
  });

  it('count_oper_inspections rejects a malformed date', async () => {
    await expect(runTool('count_oper_inspections', { inspectedFrom: '1/1/2569', inspectedTo: '2026-10-16' })).rejects.toThrow(
      'YYYY-MM-DD',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces the wrapper error kind so the model can say what failed', async () => {
    respond(503, { error: 'cloudflare', detail: 'challenged' });
    await expect(runTool('find_oper_stations', { province: 'ชัยภูมิ' })).rejects.toThrow('OPER cloudflare: challenged');
  });

  it('a timeout says so, with one narrowing tip and no other advice', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    await expect(runTool('find_oper_stations', { district: 'เมืองนครราชสีมา', source: 'BCS' })).rejects.toMatchObject({
      message: 'ระบบ OPER ไม่ตอบภายในเวลาที่กำหนด (หมดเวลา) — ลองระบุตำบลหรือความถี่เพื่อให้ค้นแคบลง',
    });
  });

  it('a count timeout tips a shorter date range', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('aborted', 'TimeoutError'));
    await expect(
      runTool('count_oper_inspections', { inspectedFrom: '2026-01-01', inspectedTo: '2026-10-16' }),
    ).rejects.toThrow('ลองใช้ช่วงวันที่ที่สั้นลง');
  });

  it('an unreachable wrapper says it could not connect', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(runTool('find_oper_stations', { province: 'ชัยภูมิ' })).rejects.toThrow('ติดต่อระบบ OPER ไม่ได้: fetch failed');
  });

  it('passes BCS through as an exact source, not a name', async () => {
    respond(200, { total: 0, stations: [] });
    await runTool('find_oper_stations', { province: 'นครราชสีมา', district: 'เมืองนครราชสีมา', source: 'BCS' });
    expect(sent().body).toEqual({ province: 'นครราชสีมา', district: 'เมืองนครราชสีมา', source: 'BCS', limit: 10 });
  });

  it('says it is not set up when the env is missing', async () => {
    vi.stubEnv('OPER_API_URL', '');
    await expect(runTool('find_oper_stations', { province: 'ชัยภูมิ' })).rejects.toThrow('ยังไม่ได้ตั้งค่า');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
