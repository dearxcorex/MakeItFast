// src/__tests__/api-analytics-inspectors.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mintCookie } from './helpers/session';
import { COOKIE_NAME } from '@/lib/session';

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findMany: vi.fn() },
    fm_station: { findUnique: vi.fn() },
    interference_site: { findUnique: vi.fn() },
    $queryRawUnsafe: vi.fn(),
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

import prismaOriginal from '@/lib/prisma';

// Holds whichever prisma instance the route is currently bound to.
// After vi.resetModules(), the route imports a fresh prisma module, so we
// must reach into that same fresh instance to set up our mocks.
let prisma: typeof prismaOriginal = prismaOriginal;

// Helper that re-imports the route fresh each call so the route's
// module-level 60-second cache does not leak between tests. Also re-imports
// the prisma module so the test's mocks land on the same instance the route uses.
// IMPORTANT: call this first, then set up mocks on the updated `prisma` reference.
async function loadRoute() {
  const prismaMod = await import('@/lib/prisma');
  prisma = prismaMod.default;
  const mod = await import('@/app/api/analytics/inspectors/route');
  return mod.GET;
}

beforeEach(async () => {
  process.env.SESSION_PASSWORD =
    process.env.SESSION_PASSWORD ?? 'test-session-password-32-chars-or-more!!!';
  cookieStore.clear();
  vi.resetModules();
  // Re-bind the test's prisma reference to the fresh module instance,
  // then clear all mock call histories on the fresh fns.
  const prismaMod = await import('@/lib/prisma');
  prisma = prismaMod.default;
  vi.resetAllMocks();
});

async function req(cookie?: string): Promise<NextRequest> {
  const headers = new Headers();
  if (cookie) {
    headers.set('Cookie', cookie);
    const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (match) cookieStore.set(COOKIE_NAME, match[1]);
  }
  return new NextRequest('http://t/api/analytics/inspectors', { method: 'GET', headers });
}

// Mock all 9 $queryRawUnsafe calls with empty arrays.
// Call AFTER loadRoute() so `prisma` is bound to the fresh module instance.
function mockEmptyAggregates() {
  vi.mocked(prisma.$queryRawUnsafe)
    .mockResolvedValueOnce([] as never) // 1 leadYtd
    .mockResolvedValueOnce([] as never) // 2 leadMonth
    .mockResolvedValueOnce([] as never) // 3 leadMax
    .mockResolvedValueOnce([] as never) // 4 memberYtd
    .mockResolvedValueOnce([] as never) // 5 memberMonth
    .mockResolvedValueOnce([] as never) // 6 leadMonthly
    .mockResolvedValueOnce([] as never) // 7 helperMonthly
    .mockResolvedValueOnce([] as never) // 8 helperMax
    .mockResolvedValueOnce([] as never); // 9 largestTeamRows
  vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);
}

describe('GET /api/analytics/inspectors', () => {
  it('returns 401 without a session', async () => {
    const getInspectors = await loadRoute();
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    mockEmptyAggregates();

    const r = await getInspectors(await req());
    expect(r.status).toBe(401);
  });

  it('excludes inactive users (aom) from the inspectors list', async () => {
    const getInspectors = await loadRoute();

    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
    ] as never);
    mockEmptyAggregates();

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const r = await getInspectors(await req(c.header));
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json.inspectors.map((u: { username: string }) => u.username)).toEqual(['iff', 'daf']);
    expect(vi.mocked(prisma.user.findMany).mock.calls[0][0]).toMatchObject({
      where: { active: true, role: { in: ['admin', 'inspector'] } },
    });
  });

  it('aggregates ytdAsLead + ytdAsHelper + monthTotal + lastActive per user', async () => {
    const getInspectors = await loadRoute();

    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
    ] as never);

    vi.mocked(prisma.$queryRawUnsafe)
      // 1. leadYtd
      .mockResolvedValueOnce([
        { lead_user_id: 3, n: 11 },
        { lead_user_id: 6, n: 4 },
      ] as never)
      // 2. leadMonth
      .mockResolvedValueOnce([
        { lead_user_id: 3, n: 2 },
      ] as never)
      // 3. leadMax
      .mockResolvedValueOnce([
        { lead_user_id: 3, last: new Date('2026-05-10T00:00:00Z') },
        { lead_user_id: 6, last: new Date('2026-04-21T00:00:00Z') },
      ] as never)
      // 4. memberYtd
      .mockResolvedValueOnce([
        { user_id: 3, n: 3 },
        { user_id: 6, n: 5 },
      ] as never)
      // 5. memberMonth (kept empty so chart agrees with groupBy for the divergence-warn contract)
      .mockResolvedValueOnce([] as never)
      // 6. leadMonthly
      .mockResolvedValueOnce([
        { month: '2026-05', lead_user_id: 3, n: 2 },
        { month: '2026-04', lead_user_id: 3, n: 5 },
        { month: '2026-04', lead_user_id: 6, n: 3 },
      ] as never)
      // 7. helperMonthly
      .mockResolvedValueOnce([
        { month: '2026-04', user_id: 6, n: 4 },
        { month: '2026-05', user_id: 3, n: 1 },
      ] as never)
      // 8. helperMax
      .mockResolvedValueOnce([
        { user_id: 3, last: new Date('2026-05-12T00:00:00Z') },
        { user_id: 6, last: new Date('2026-04-25T00:00:00Z') },
      ] as never)
      // 9. largestTeamRows (FM site)
      .mockResolvedValueOnce([
        { id: 42, target_type: 'fm', target_id: 5520014, inspected_on: new Date('2026-04-21T00:00:00Z'), member_count: 3 },
      ] as never);

    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({
      id_fm: 5520014, name: 'กว้างไกล ฟ้าใส',
    } as never);

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const r = await getInspectors(await req(c.header));
    expect(r.status).toBe(200);
    const json = await r.json();

    const iff = json.inspectors.find((u: { username: string }) => u.username === 'iff');
    const daf = json.inspectors.find((u: { username: string }) => u.username === 'daf');
    expect(iff).toMatchObject({
      ytdAsLead: 11, ytdAsHelper: 3, ytdTotal: 14, monthTotal: 3, lastActive: '2026-05-12',
    });
    expect(daf).toMatchObject({
      // monthTotal=0 because the raw May bucket has no daf entry. The chart
      // is the source of truth post-Fix 2; daf's YTD helper count of 5 all
      // landed in April.
      ytdAsLead: 4, ytdAsHelper: 5, ytdTotal: 9, monthTotal: 0, lastActive: '2026-04-25',
    });

    expect(json.monthlySeries).toHaveLength(12);
    expect(json.monthlySeries[11].month).toBe(json.thisMonth);
    expect(json.monthlySeries[11].perUser).toMatchObject({ iff: 3 /* 2 lead + 1 helper */ });

    expect(json.kpis.largestTeam).toMatchObject({
      inspectionId: 42,
      stationId: 5520014,
      stationName: 'กว้างไกล ฟ้าใส',
      inspectedOn: '2026-04-21',
      memberCount: 3,
    });
    expect(json.kpis.activeThisMonth).toBe(1); // only iff had any participation this month
    expect(json.kpis.mostTaggedHelperThisYear).toMatchObject({ username: 'daf', count: 5 });
  });

  it('returns null kpi fields when no data', async () => {
    const getInspectors = await loadRoute();

    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
    ] as never);
    mockEmptyAggregates();

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const r = await getInspectors(await req(c.header));
    const json = await r.json();
    expect(json.kpis.largestTeam).toBeNull();
    expect(json.kpis.mostTaggedHelperThisYear).toBeNull();
    expect(json.kpis.activeThisMonth).toBe(0);
  });

  it('uses the raw monthly bucket as truth even when groupBy disagrees', async () => {
    const getInspectors = await loadRoute();

    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
    ] as never);

    // Raw monthly bucket says: this month iff appeared only twice.
    // Disagreement — Math.max would pick 5; truth picks 2.
    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never)                                       // 1 leadYtd
      .mockResolvedValueOnce([{ lead_user_id: 3, n: 5 }] as never)              // 2 leadMonth (says 5)
      .mockResolvedValueOnce([] as never)                                       // 3 leadMax
      .mockResolvedValueOnce([] as never)                                       // 4 memberYtd
      .mockResolvedValueOnce([] as never)                                       // 5 memberMonth (says 0)
      .mockResolvedValueOnce([
        { month: new Date().toISOString().slice(0, 7), lead_user_id: 3, n: 2 },
      ] as never)                                                                // 6 leadMonthly (says 2 — chart truth)
      .mockResolvedValueOnce([] as never)                                       // 7 helperMonthly
      .mockResolvedValueOnce([] as never)                                       // 8 helperMax
      .mockResolvedValueOnce([] as never);                                      // 9 largestTeamRows

    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const r = await getInspectors(await req(c.header));
    const json = await r.json();
    const iff = json.inspectors.find((u: { username: string }) => u.username === 'iff');
    // monthTotal must match the chart (raw query) — 2, not 5.
    expect(iff.monthTotal).toBe(2);
  });

  it('skips deactivated top helper and surfaces the next active helper', async () => {
    // active users list excludes the deactivated user `aom` (id 99)
    const getInspectors = await loadRoute();

    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
    ] as never);

    vi.mocked(prisma.$queryRawUnsafe)
      .mockResolvedValueOnce([] as never) // 1 leadYtd
      .mockResolvedValueOnce([] as never) // 2 leadMonth
      .mockResolvedValueOnce([] as never) // 3 leadMax
      .mockResolvedValueOnce([
        { user_id: 99, n: 99 },
        { user_id: 6,  n: 5 },
        { user_id: 3,  n: 3 },
      ] as never)                          // 4 memberYtd
      .mockResolvedValueOnce([] as never) // 5 memberMonth
      .mockResolvedValueOnce([] as never) // 6 leadMonthly
      .mockResolvedValueOnce([] as never) // 7 helperMonthly
      .mockResolvedValueOnce([] as never) // 8 helperMax
      .mockResolvedValueOnce([] as never); // 9 largestTeamRows

    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const r = await getInspectors(await req(c.header));
    expect(r.status).toBe(200);
    const json = await r.json();
    // The deactivated aom (99) should be skipped; daf (5) wins.
    expect(json.kpis.mostTaggedHelperThisYear).toMatchObject({
      username: 'daf',
      count: 5,
    });
  });
});
