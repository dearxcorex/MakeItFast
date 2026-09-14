// src/__tests__/api-cron-inspection-digest.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  default: {
    station_inspection: { findMany: vi.fn() },
    fm_station: { groupBy: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { GET } from '@/app/api/cron/inspection-digest/route';

const SECRET = 'test-cron-secret';
const WEBHOOK = 'https://discord.com/api/webhooks/1/abc';
const fetchMock = vi.fn();

function req(query = '', auth: string | null = `Bearer ${SECRET}`) {
  const headers = new Headers();
  if (auth) headers.set('authorization', auth);
  return new NextRequest(`http://localhost/api/cron/inspection-digest${query}`, { headers });
}

const inspectionRow = {
  id: 1,
  station_id: 5520014,
  inspected_on: new Date('2026-09-13T00:00:00Z'),
  station: { name: 'สถานีวิทยุชุมชนปากช่อง', freq: 98.5, district: 'ปากช่อง', province: 'นครราชสีมา' },
  lead: { display_name: 'สมชาย' },
  members: [{ user_id: 6 }, { user_id: 7 }],
};

const groups = [
  { province: 'นครราชสีมา', inspection_69: true, revoked: false, _count: { _all: 110 } },
  { province: 'นครราชสีมา', inspection_69: true, revoked: true, _count: { _all: 10 } },
  { province: 'นครราชสีมา', inspection_69: false, revoked: true, _count: { _all: 2 } },
  { province: 'นครราชสีมา', inspection_69: null, revoked: null, _count: { _all: 84 } },
  { province: 'ชัยภูมิ', inspection_69: true, revoked: false, _count: { _all: 64 } },
  { province: 'ชัยภูมิ', inspection_69: false, revoked: false, _count: { _all: 76 } },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  process.env.DISCORD_FIELD_OPS_WEBHOOK_URL = WEBHOOK;
  process.env.SITE_URL = 'https://fm.example.com';
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  vi.mocked(prisma.station_inspection.findMany).mockResolvedValue([inspectionRow] as never);
  vi.mocked(prisma.fm_station.groupBy).mockResolvedValue(groups as never);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.CRON_SECRET;
  delete process.env.DISCORD_FIELD_OPS_WEBHOOK_URL;
  delete process.env.SITE_URL;
});

describe('GET /api/cron/inspection-digest — auth', () => {
  it('rejects a request without the bearer secret', async () => {
    const res = await GET(req('', null));
    expect(res.status).toBe(401);
    expect(prisma.station_inspection.findMany).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret', async () => {
    const res = await GET(req('', 'Bearer nope'));
    expect(res.status).toBe(401);
  });

  it('rejects everything when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req('', 'Bearer undefined'));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/cron/inspection-digest — digest', () => {
  it('posts the digest for the requested date to the webhook', async () => {
    const res = await GET(req('?date=2026-09-13'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ posted: true, date: '2026-09-13', stations: 1 });

    expect(vi.mocked(prisma.station_inspection.findMany).mock.calls[0][0]).toMatchObject({
      where: { inspected_on: new Date('2026-09-13T00:00:00Z') },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.embeds[0].url).toBe('https://fm.example.com');
    expect(body.embeds[0].description).toContain('สมชาย +2');
    // 110 + 10 inspected of 206; 12 revoked
    expect(body.embeds[0].description).toContain('นครราชสีมา 120/206 (58%) · ถูกเพิกถอน 12');
    expect(body.embeds[0].description).toContain('ชัยภูมิ 64/140 (46%)');
  });

  it('defaults to today in Bangkok, not UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-12T23:30:00Z'));
    const res = await GET(req());
    expect((await res.json()).date).toBe('2026-09-13');
  });

  it('rejects a malformed date', async () => {
    const res = await GET(req('?date=13-09-2026'));
    expect(res.status).toBe(400);
  });

  it('skips posting on a day with no inspections', async () => {
    vi.mocked(prisma.station_inspection.findMany).mockResolvedValue([] as never);
    const res = await GET(req('?date=2026-09-13'));
    expect(await res.json()).toEqual({ posted: false, date: '2026-09-13', reason: 'no_inspections' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the payload without posting on dryRun', async () => {
    const res = await GET(req('?date=2026-09-13&dryRun=1'));
    const json = await res.json();
    expect(json.posted).toBe(false);
    expect(json.dryRun).toBe(true);
    expect(json.payload.embeds[0].title).toContain('13 ก.ย. 2569');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 200 without posting when the webhook URL is missing', async () => {
    delete process.env.DISCORD_FIELD_OPS_WEBHOOK_URL;
    const res = await GET(req('?date=2026-09-13'));
    expect(res.status).toBe(200);
    expect((await res.json()).reason).toBe('webhook_not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 200 when Discord rejects the post', async () => {
    fetchMock.mockResolvedValue(new Response('bad', { status: 400 }));
    const res = await GET(req('?date=2026-09-13'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ posted: false, reason: 'discord_error' });
  });

  it('returns 200 when the webhook request throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const res = await GET(req('?date=2026-09-13'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ posted: false, reason: 'discord_error' });
  });

  it('returns 500 when the database fails', async () => {
    vi.mocked(prisma.station_inspection.findMany).mockRejectedValue(new Error('DB down'));
    const res = await GET(req('?date=2026-09-13'));
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
