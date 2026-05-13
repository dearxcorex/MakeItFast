// src/__tests__/api-inspections.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mintCookie, mintAdminCookie } from './helpers/session';
import { COOKIE_NAME } from '@/lib/session';

vi.mock('@/lib/prisma', () => ({
  default: {
    fm_station: { findUnique: vi.fn(), update: vi.fn() },
    user: { findMany: vi.fn() },
    station_inspection: {
      findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(),
      create: vi.fn(), delete: vi.fn(), aggregate: vi.fn(), count: vi.fn(),
    },
    station_inspection_member: { createMany: vi.fn() },
    $transaction: vi.fn(async (cb) => cb({
      fm_station: { update: vi.fn(async () => ({ id_fm: 1 })) },
      station_inspection: {
        create: vi.fn(async () => ({ id: 100 })),
        aggregate: vi.fn(async () => ({ _max: { inspected_on: new Date('2026-05-13T00:00:00Z') } })),
        count: vi.fn(async () => 1),
      },
      station_inspection_member: { createMany: vi.fn(async () => ({ count: 1 })) },
    })),
  },
}));

const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v ? { name, value: v } : undefined;
    },
    set: () => {},
    delete: () => {},
  }),
}));

import prisma from '@/lib/prisma';
import { GET as listInspections, POST as createInspectionRoute } from '@/app/api/stations/[id]/inspections/route';
import { DELETE as deleteInspectionRoute } from '@/app/api/inspections/[id]/route';
import { GET as listInspectors } from '@/app/api/users/inspectors/route';

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    process.env.SESSION_PASSWORD ?? 'test-session-password-32-chars-or-more!!!';
  cookieStore.clear();
  vi.clearAllMocks();
});

async function req(url: string, init?: { method?: string; cookie?: string; body?: unknown }): Promise<NextRequest> {
  const headers = new Headers();
  if (init?.cookie) {
    headers.set('Cookie', init.cookie);
    // Bridge the Cookie header into the next/headers cookieStore mock so
    // route handlers calling `cookies()` see the same session value.
    const match = init.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (match) cookieStore.set(COOKIE_NAME, match[1]);
  }
  if (init?.body) headers.set('Content-Type', 'application/json');
  return new NextRequest(url, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
}

const IFF = { userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' as const };

describe('GET /api/stations/:id/inspections', () => {
  it('returns inspections for the station', async () => {
    vi.mocked(prisma.station_inspection.findMany).mockResolvedValue([] as never);
    const c = await mintCookie(IFF);
    const r = await listInspections(
      await req('http://t/api/stations/1/inspections', { cookie: c.header }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json).toEqual({ inspections: [] });
  });
});

describe('POST /api/stations/:id/inspections', () => {
  it('creates an inspection with lead=session user and returns updated station', async () => {
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({ id_fm: 1 } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff', active: true, role: 'inspector' },
      { id: 6, username: 'daf', display_name: 'daf', active: true, role: 'inspector' },
    ] as never);
    vi.mocked(prisma.station_inspection.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 100,
      station_id: 1,
      inspected_on: new Date('2026-05-13T00:00:00Z'),
      lead_user_id: 3, notes: null, source: 'app',
      created_at: new Date('2026-05-13T00:00:00Z'),
      lead: { id: 3, username: 'iff', display_name: 'iff' },
      members: [{ user_id: 6, member: { id: 6, username: 'daf', display_name: 'daf' } }],
    } as never);
    // Final fm_station read for the response payload.
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValueOnce({ id_fm: 1 } as never).mockResolvedValueOnce({
      id_fm: 1, name: 'X', freq: 95.5, lat: 0, long: 0, district: 'A', province: 'B',
      type: '', inspection_68: false, inspection_69: true, on_air: false,
      submit_a_request: true, date_inspected: '2026-05-13', note: null, revoked: false, revoked_note: null, permit: null,
    } as never);

    const c = await mintCookie(IFF);
    const r = await createInspectionRoute(
      await req('http://t/api/stations/1/inspections', {
        method: 'POST', cookie: c.header,
        body: { inspectedOn: '2026-05-13', helperUserIds: [6] },
      }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(r.status).toBe(201);
    const json = await r.json();
    expect(json.inspection).toMatchObject({ id: 100, lead: { userId: 3 } });
    expect(json.station).toMatchObject({ id: 1, dateInspected: '2026-05-13', inspection69: 'ตรวจแล้ว' });
  });

  it('rejects logged-out callers with 401', async () => {
    const r = await createInspectionRoute(
      await req('http://t/api/stations/1/inspections', {
        method: 'POST', body: { inspectedOn: '2026-05-13', helperUserIds: [] },
      }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(r.status).toBe(401);
  });

  it('returns 400 on bad date', async () => {
    const c = await mintCookie(IFF);
    const r = await createInspectionRoute(
      await req('http://t/api/stations/1/inspections', {
        method: 'POST', cookie: c.header,
        body: { inspectedOn: '13-05-2026', helperUserIds: [] },
      }),
      { params: Promise.resolve({ id: '1' }) },
    );
    expect(r.status).toBe(400);
  });
});

describe('DELETE /api/inspections/:id', () => {
  it('lets the lead delete their own inspection', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 7, station_id: 1, lead_user_id: 3,
    } as never);
    vi.mocked(prisma.station_inspection.aggregate).mockResolvedValue({ _max: { inspected_on: null } } as never);
    vi.mocked(prisma.station_inspection.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({
      id_fm: 1, name: 'X', freq: 95.5, lat: 0, long: 0, district: 'A', province: 'B',
      type: '', inspection_68: false, inspection_69: false, on_air: false,
      submit_a_request: true, date_inspected: null, note: null, revoked: false, revoked_note: null, permit: null,
    } as never);

    const c = await mintCookie(IFF);
    const r = await deleteInspectionRoute(
      await req('http://t/api/inspections/7', { method: 'DELETE', cookie: c.header }),
      { params: Promise.resolve({ id: '7' }) },
    );
    expect(r.status).toBe(200);
  });

  it('returns 403 if not admin and not lead', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 7, station_id: 1, lead_user_id: 999,
    } as never);
    const c = await mintCookie(IFF);
    const r = await deleteInspectionRoute(
      await req('http://t/api/inspections/7', { method: 'DELETE', cookie: c.header }),
      { params: Promise.resolve({ id: '7' }) },
    );
    expect(r.status).toBe(403);
  });

  it('admin can delete any inspection', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 7, station_id: 1, lead_user_id: 999,
    } as never);
    vi.mocked(prisma.station_inspection.aggregate).mockResolvedValue({ _max: { inspected_on: null } } as never);
    vi.mocked(prisma.station_inspection.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({
      id_fm: 1, name: 'X', freq: 95.5, lat: 0, long: 0, district: 'A', province: 'B',
      type: '', inspection_68: false, inspection_69: false, on_air: false,
      submit_a_request: true, date_inspected: null, note: null, revoked: false, revoked_note: null, permit: null,
    } as never);

    const c = await mintAdminCookie();
    const r = await deleteInspectionRoute(
      await req('http://t/api/inspections/7', { method: 'DELETE', cookie: c.header }),
      { params: Promise.resolve({ id: '7' }) },
    );
    expect(r.status).toBe(200);
  });
});

describe('GET /api/users/inspectors', () => {
  it('lists active inspectors + admins sorted by displayName, hides aom (inactive)', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 1, username: 'admin', display_name: 'Admin' },
      { id: 6, username: 'daf', display_name: 'daf' },
      { id: 4, username: 'dao', display_name: 'dao' },
      { id: 2, username: 'ice', display_name: 'ice' },
      { id: 3, username: 'iff', display_name: 'iff' },
    ] as never);

    const c = await mintCookie(IFF);
    const r = await listInspectors(await req('http://t/api/users/inspectors', { cookie: c.header }));
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json.users.map((u: { username: string }) => u.username)).toEqual([
      'admin', 'daf', 'dao', 'ice', 'iff',
    ]);
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]).toMatchObject({
      where: { active: true, role: { in: ['admin', 'inspector'] } },
    });
  });
});
