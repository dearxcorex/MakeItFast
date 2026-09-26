import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  it('exposes exactly the four tools the agent is allowed to call', () => {
    expect(TOOL_DEFINITIONS.map((t) => t.name).sort()).toEqual([
      'find_stations',
      'path_loss',
      'scan_intermod',
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

describe('scan_intermod', () => {
  // 2 × 90.0 − 57.5 is out of band; use a real aviation-band case:
  // 2 × 107.9 − 93.3 = 122.5 MHz.
  const pairRows = [
    row({ id: 1, name: 'สถานี A', freq: 107.9, lat: 14.98, long: 102.1 }),
    row({ id: 2, name: 'สถานี B', freq: 93.3, lat: 14.99, long: 102.11 }),
  ];

  it('finds the pair whose third-order product lands on the target', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue(pairRows as never);
    const out = (await runTool('scan_intermod', { targetFrequency: 122.5 })) as {
      dangerousPairsFound: number;
      pairs: Array<{ products: Array<{ frequencyMHz: number; type: string }> }>;
    };
    expect(out.dangerousPairsFound).toBe(1);
    expect(out.pairs[0].products[0].frequencyMHz).toBeCloseTo(122.5, 3);
    expect(out.pairs[0].products[0].type).toBe('2f1-f2');
  });

  it('reports how many stations it could not scan for want of coordinates', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([
      ...pairRows,
      row({ id: 3, lat: null, long: null }),
    ] as never);
    const out = (await runTool('scan_intermod', { targetFrequency: 122.5 })) as {
      stationsScanned: number;
      stationsSkippedNoCoordinates: number;
    };
    expect(out.stationsScanned).toBe(2);
    expect(out.stationsSkippedNoCoordinates).toBe(1);
  });

  it('finds nothing when no pair mixes onto the target', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue(pairRows as never);
    const out = (await runTool('scan_intermod', { targetFrequency: 130.0 })) as {
      dangerousPairsFound: number;
      highestRiskLevel: string | null;
    };
    expect(out.dangerousPairsFound).toBe(0);
    expect(out.highestRiskLevel).toBeNull();
  });

  it('refuses to run without a target frequency', async () => {
    await expect(runTool('scan_intermod', {})).rejects.toThrow('targetFrequency is required');
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
