import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    fm_station: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
    },
    interference_site: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    cloudrf_cache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock cloudrf utils
vi.mock('@/utils/cloudrf', () => ({
  hashRequest: vi.fn(() => 'test-hash'),
  getCachedResult: vi.fn(() => null),
  setCachedResult: vi.fn(),
  buildAreaPayload: vi.fn(() => ({ test: 'area' })),
  buildPathPayloadV2: vi.fn(() => ({ test: 'path' })),
  buildMultisitePayload: vi.fn(() => ({ test: 'multi' })),
  convertBoundsToLeaflet: vi.fn(() => [[0, 0], [1, 1]]),
  callCloudRFArea: vi.fn(() => ({ PNG_Mercator: 'http://png.test', bounds: [1, 2, 3, 4] })),
  callCloudRFPath: vi.fn(() => ({ Path_loss: 120, Distance: 5 })),
  callCloudRFMultisite: vi.fn(() => ({ PNG_Mercator: 'http://multi.test', bounds: [1, 2, 3, 4] })),
  callCloudRFInterference: vi.fn(() => ({ result: 'interference' })),
}));

// Mock interferenceService
vi.mock('@/services/interferenceService', () => ({
  fetchInterferenceSites: vi.fn(() => []),
  fetchInterferenceSiteById: vi.fn(() => null),
  convertToInterferenceSite: vi.fn(),
}));

import prisma from '@/lib/prisma';

beforeEach(() => {
  vi.clearAllMocks();
  // Reset env
  process.env.CLOUDRF_API_KEY = 'test-key';
});

// ==================
// /api/health
// ==================
describe('GET /api/health', () => {
  it('returns healthy when DB works', async () => {
    vi.mocked(prisma.fm_station.findFirst).mockResolvedValue(null);
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.database.connected).toBe(true);
  });

  it('returns 500 on DB error', async () => {
    vi.mocked(prisma.fm_station.findFirst).mockRejectedValue(new Error('DB down'));
    const { GET } = await import('@/app/api/health/route');
    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.status).toBe('error');
  });
});

// ==================
// /api/stations
// ==================
describe('GET /api/stations', () => {
  it('returns stations', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([
      { id_fm: 1, name: 'Test' } as never,
    ]);
    const { GET } = await import('@/app/api/stations/route');
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.stations).toHaveLength(1);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.fm_station.findMany).mockRejectedValue(new Error('fail'));
    const { GET } = await import('@/app/api/stations/route');
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

// ==================
// /api/stations/recent
// ==================
describe('GET /api/stations/recent', () => {
  it('returns transformed updates', async () => {
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([
      { id_fm: 1, on_air: true, inspection_68: true, submit_a_request: false } as never,
    ]);
    const { GET } = await import('@/app/api/stations/recent/route');
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.updated[0].id).toBe(1);
    expect(data.updated[0].inspection68).toBe('ตรวจแล้ว');
    expect(data.updated[0].submitRequest).toBe('ไม่ยื่น');
    expect(data.count).toBe(1);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.fm_station.findMany).mockRejectedValue(new Error('fail'));
    const { GET } = await import('@/app/api/stations/recent/route');
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

// ==================
// /api/stations/[id] GET
// ==================
describe('GET /api/stations/[id]', () => {
  it('returns station by id', async () => {
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({ id_fm: 1, name: 'Test' } as never);
    const { GET } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost/api/stations/1');
    const res = await GET(req as never, { params: Promise.resolve({ id: '1' }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.station.id_fm).toBe(1);
  });

  it('returns 400 for invalid id', async () => {
    const { GET } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost/api/stations/abc');
    const res = await GET(req as never, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 for missing station', async () => {
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);
    const { GET } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost/api/stations/999');
    const res = await GET(req as never, { params: Promise.resolve({ id: '999' }) });
    expect(res.status).toBe(404);
  });
});

// ==================
// /api/stations/[id] PATCH
// ==================
describe('PATCH /api/stations/[id]', () => {
  it('returns 400 for invalid id', async () => {
    const { PATCH } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ onAir: true }),
    });
    const res = await PATCH(req as never, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty update', async () => {
    const { PATCH } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const res = await PATCH(req as never, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(400);
  });

  it('updates details field', async () => {
    vi.mocked(prisma.fm_station.update).mockResolvedValue({ id_fm: 1 } as never);
    const { PATCH } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ details: 'new note' }),
    });
    const res = await PATCH(req as never, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    expect(prisma.fm_station.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ note: 'new note' }),
      })
    );
  });

  it('blocks onAir=true without request', async () => {
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({ submit_a_request: false } as never);
    const { PATCH } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ onAir: true }),
    });
    const res = await PATCH(req as never, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(400);
  });

  it('allows onAir=true with request', async () => {
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({ submit_a_request: true } as never);
    vi.mocked(prisma.fm_station.update).mockResolvedValue({ id_fm: 1 } as never);
    const { PATCH } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ onAir: true }),
    });
    const res = await PATCH(req as never, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
  });

  it('sets date_inspected when inspection69 is true', async () => {
    vi.mocked(prisma.fm_station.update).mockResolvedValue({ id_fm: 1 } as never);
    const { PATCH } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ inspection69: 'ตรวจแล้ว' }),
    });
    const res = await PATCH(req as never, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    expect(prisma.fm_station.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inspection_69: true,
          date_inspected: expect.any(String),
        }),
      })
    );
  });

  it('clears date_inspected when inspection69 is false', async () => {
    vi.mocked(prisma.fm_station.update).mockResolvedValue({ id_fm: 1 } as never);
    const { PATCH } = await import('@/app/api/stations/[id]/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ inspection69: false }),
    });
    const res = await PATCH(req as never, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    expect(prisma.fm_station.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inspection_69: false,
          date_inspected: null,
        }),
      })
    );
  });
});

// ==================
// /api/interference
// ==================
describe('GET /api/interference', () => {
  it('returns sites', async () => {
    const { fetchInterferenceSites } = await import('@/services/interferenceService');
    vi.mocked(fetchInterferenceSites).mockResolvedValue([]);
    const { GET } = await import('@/app/api/interference/route');
    const req = new NextRequest('http://localhost/api/interference');
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.sites).toEqual([]);
    expect(data.total).toBe(0);
  });

  it('passes query params as filters', async () => {
    const { fetchInterferenceSites } = await import('@/services/interferenceService');
    vi.mocked(fetchInterferenceSites).mockResolvedValue([]);
    const { GET } = await import('@/app/api/interference/route');
    const req = new NextRequest('http://localhost/api/interference?changwat=Bangkok&ranking=Critical');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(fetchInterferenceSites).toHaveBeenCalledWith(
      expect.objectContaining({ changwat: 'Bangkok', ranking: 'Critical' })
    );
  });

  it('returns 500 on error', async () => {
    const { fetchInterferenceSites } = await import('@/services/interferenceService');
    vi.mocked(fetchInterferenceSites).mockRejectedValue(new Error('fail'));
    const { GET } = await import('@/app/api/interference/route');
    const req = new NextRequest('http://localhost/api/interference');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ==================
// /api/interference/[id]
// ==================
describe('/api/interference/[id]', () => {
  it('GET returns 400 for invalid id', async () => {
    const { GET } = await import('@/app/api/interference/[id]/route');
    const req = new Request('http://localhost');
    const res = await GET(req as never, { params: Promise.resolve({ id: 'xyz' }) });
    expect(res.status).toBe(400);
  });

  it('GET returns 404 when not found', async () => {
    const { fetchInterferenceSiteById } = await import('@/services/interferenceService');
    vi.mocked(fetchInterferenceSiteById).mockResolvedValue(null);
    const { GET } = await import('@/app/api/interference/[id]/route');
    const req = new Request('http://localhost');
    const res = await GET(req as never, { params: Promise.resolve({ id: '999' }) });
    expect(res.status).toBe(404);
  });

  it('GET returns site when found', async () => {
    const { fetchInterferenceSiteById } = await import('@/services/interferenceService');
    vi.mocked(fetchInterferenceSiteById).mockResolvedValue({ id: 1, siteName: 'Test' } as never);
    const { GET } = await import('@/app/api/interference/[id]/route');
    const req = new Request('http://localhost');
    const res = await GET(req as never, { params: Promise.resolve({ id: '1' }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.site.id).toBe(1);
  });

  it('PATCH returns 400 for invalid id', async () => {
    const { PATCH } = await import('@/app/api/interference/[id]/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'test' }),
    });
    const res = await PATCH(req as never, { params: Promise.resolve({ id: 'abc' }) });
    expect(res.status).toBe(400);
  });

  it('PATCH updates allowed fields', async () => {
    vi.mocked(prisma.interference_site.update).mockResolvedValue({ id: 1 } as never);
    const { PATCH } = await import('@/app/api/interference/[id]/route');
    const req = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'updated', ranking: 'Major', status: 'Resolved' }),
    });
    const res = await PATCH(req as never, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(200);
    expect(prisma.interference_site.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { notes: 'updated', ranking: 'Major', status: 'Resolved' },
    });
  });
});

// ==================
// /api/interference/stats
// ==================
describe('GET /api/interference/stats', () => {
  it('returns stats', async () => {
    vi.mocked(prisma.interference_site.count)
      .mockResolvedValueOnce(100 as never) // total
      .mockResolvedValueOnce(50 as never);  // withSource
    vi.mocked(prisma.interference_site.aggregate).mockResolvedValue({
      _avg: { avg_ni_carrier: -85 },
    } as never);
    vi.mocked(prisma.interference_site.groupBy)
      .mockResolvedValueOnce([
        { ranking: 'Critical', _count: 10 },
        { ranking: 'Major', _count: 20 },
      ] as never)
      .mockResolvedValueOnce([
        { changwat: 'Bangkok', _count: 30 },
      ] as never);

    const { GET } = await import('@/app/api/interference/stats/route');
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.total).toBe(100);
    expect(data.withSource).toBe(50);
    expect(data.avgNoise).toBe(-85);
    expect(data.byRanking.Critical).toBe(10);
    expect(data.byProvince.Bangkok).toBe(30);
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.interference_site.count).mockRejectedValue(new Error('fail'));
    const { GET } = await import('@/app/api/interference/stats/route');
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

// ==================
// /api/seed
// ==================
describe('POST /api/seed', () => {
  it('seeds data successfully', async () => {
    vi.mocked(prisma.fm_station.deleteMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.fm_station.createMany).mockResolvedValue({ count: 3 } as never);
    const { POST } = await import('@/app/api/seed/route');
    const res = await POST();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('3');
  });

  it('returns 500 on error', async () => {
    vi.mocked(prisma.fm_station.deleteMany).mockRejectedValue(new Error('fail'));
    const { POST } = await import('@/app/api/seed/route');
    const res = await POST();
    expect(res.status).toBe(500);
  });
});

// ==================
// /api/cloudrf/path
// ==================
describe('POST /api/cloudrf/path', () => {
  it('returns 500 without API key', async () => {
    delete process.env.CLOUDRF_API_KEY;
    const { POST } = await import('@/app/api/cloudrf/path/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ fromLat: 13, fromLon: 100, toLat: 14, toLon: 101 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('returns 400 without coords', async () => {
    const { POST } = await import('@/app/api/cloudrf/path/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid lat', async () => {
    const { POST } = await import('@/app/api/cloudrf/path/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ fromLat: 91, fromLon: 100, toLat: 14, toLon: 101 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid lon', async () => {
    const { POST } = await import('@/app/api/cloudrf/path/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ fromLat: 13, fromLon: 181, toLat: 14, toLon: 101 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns path analysis result', async () => {
    const { POST } = await import('@/app/api/cloudrf/path/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ fromLat: 13, fromLon: 100, toLat: 14, toLon: 101 }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.pathLoss).toBe(120);
    expect(data.cached).toBe(false);
  });
});

// ==================
// /api/cloudrf/multisite
// ==================
describe('POST /api/cloudrf/multisite', () => {
  it('returns 400 for empty sites', async () => {
    const { POST } = await import('@/app/api/cloudrf/multisite/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ sites: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for >20 sites', async () => {
    const sites = Array.from({ length: 21 }, (_, i) => ({ lat: 13 + i * 0.01, lon: 100 }));
    const { POST } = await import('@/app/api/cloudrf/multisite/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ sites }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid site coords', async () => {
    const { POST } = await import('@/app/api/cloudrf/multisite/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ sites: [{ lat: 91, lon: 100 }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns multisite result', async () => {
    const { POST } = await import('@/app/api/cloudrf/multisite/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ sites: [{ lat: 13, lon: 100 }] }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.pngUrl).toBe('http://multi.test');
    expect(data.siteCount).toBe(1);
    expect(data.cached).toBe(false);
  });
});

// ==================
// /api/cloudrf/area
// ==================
describe('POST /api/cloudrf/area', () => {
  it('returns 400 without siteId or coords', async () => {
    const { POST } = await import('@/app/api/cloudrf/area/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid lat', async () => {
    const { POST } = await import('@/app/api/cloudrf/area/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ lat: 91, lon: 100 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns area result with custom coords', async () => {
    const { POST } = await import('@/app/api/cloudrf/area/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ lat: 13, lon: 100 }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.pngUrl).toBe('http://png.test');
    expect(data.cached).toBe(false);
  });

  it('returns 500 without API key', async () => {
    delete process.env.CLOUDRF_API_KEY;
    const { POST } = await import('@/app/api/cloudrf/area/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ lat: 13, lon: 100 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

// ==================
// /api/cloudrf/interference
// ==================
describe('POST /api/cloudrf/interference', () => {
  it('returns 400 without signalSites', async () => {
    const { POST } = await import('@/app/api/cloudrf/interference/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ jammerSites: [{ lat: 13, lon: 100 }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 without jammerSites', async () => {
    const { POST } = await import('@/app/api/cloudrf/interference/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ signalSites: [{ lat: 13, lon: 100 }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid coords', async () => {
    const { POST } = await import('@/app/api/cloudrf/interference/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        signalSites: [{ lat: 91, lon: 100 }],
        jammerSites: [{ lat: 13, lon: 100 }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns interference result', async () => {
    const { POST } = await import('@/app/api/cloudrf/interference/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        signalSites: [{ lat: 13, lon: 100 }],
        jammerSites: [{ lat: 14, lon: 101 }],
      }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBe('interference');
    expect(data.cached).toBe(false);
  });

  it('returns 500 without API key', async () => {
    delete process.env.CLOUDRF_API_KEY;
    const { POST } = await import('@/app/api/cloudrf/interference/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        signalSites: [{ lat: 13, lon: 100 }],
        jammerSites: [{ lat: 14, lon: 101 }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
