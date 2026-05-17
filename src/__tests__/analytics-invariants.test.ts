// src/__tests__/analytics-invariants.test.ts
//
// Invariant contracts for the /api/analytics/inspectors payload.
// Each assertion is a property the payload MUST satisfy regardless of
// which seed data is mocked. Failures here mean the route's aggregation
// shape has regressed; the existing api-analytics-inspectors.test.ts
// covers specific value assertions.

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
let prisma: typeof prismaOriginal = prismaOriginal;

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
  const prismaMod = await import('@/lib/prisma');
  prisma = prismaMod.default;
  vi.resetAllMocks();
});

async function callRoute(): Promise<{ status: number; json: ReturnType<typeof JSON.parse> }> {
  const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
  const headers = new Headers();
  headers.set('Cookie', c.header);
  const match = c.header.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (match) cookieStore.set(COOKIE_NAME, match[1]);
  const req = new NextRequest('http://t/api/analytics/inspectors', { method: 'GET', headers });
  const getInspectors = await loadRoute();
  const r = await getInspectors(req);
  const json = await r.json();
  return { status: r.status, json };
}

describe('Analytics — invariant contracts', () => {
  it('inspector.ytdTotal === ytdAsLead + ytdAsHelper for every inspector', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
      { id: 7, username: 'ice', display_name: 'ice' },
    ] as never);

    vi.mocked(prisma.$queryRawUnsafe)
      // 1. leadYtd
      .mockResolvedValueOnce([
        { lead_user_id: 3, n: 4 },
        { lead_user_id: 6, n: 2 },
      ] as never)
      // 2. leadMonth
      .mockResolvedValueOnce([] as never)
      // 3. leadMax
      .mockResolvedValueOnce([] as never)
      // 4. memberYtd
      .mockResolvedValueOnce([
        { user_id: 6, n: 1 },
        { user_id: 7, n: 3 },
      ] as never)
      // 5. memberMonth
      .mockResolvedValueOnce([] as never)
      // 6. leadMonthly
      .mockResolvedValueOnce([] as never)
      // 7. helperMonthly
      .mockResolvedValueOnce([] as never)
      // 8. helperMax
      .mockResolvedValueOnce([] as never)
      // 9. largestTeamRows
      .mockResolvedValueOnce([] as never);

    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);

    const { json } = await callRoute();
    for (const insp of json.inspectors) {
      expect(insp.ytdTotal).toBe(insp.ytdAsLead + insp.ytdAsHelper);
    }
  });

  it('monthlySeries[thisMonth].perUser === monthAsLead + monthAsHelper (post Fix 2 contract)', async () => {
    const thisMonthKey = new Date().toISOString().slice(0, 7);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
    ] as never);

    vi.mocked(prisma.$queryRawUnsafe)
      // 1. leadYtd
      .mockResolvedValueOnce([] as never)
      // 2. leadMonth — says 2 (agrees with chart)
      .mockResolvedValueOnce([{ lead_user_id: 3, n: 2 }] as never)
      // 3. leadMax
      .mockResolvedValueOnce([] as never)
      // 4. memberYtd
      .mockResolvedValueOnce([] as never)
      // 5. memberMonth — says 1 (agrees with chart)
      .mockResolvedValueOnce([{ user_id: 3, n: 1 }] as never)
      // 6. leadMonthly — chart source of truth: 2 for iff this month
      .mockResolvedValueOnce([{ month: thisMonthKey, lead_user_id: 3, n: 2 }] as never)
      // 7. helperMonthly — chart source of truth: 1 helper this month
      .mockResolvedValueOnce([{ month: thisMonthKey, user_id: 3, n: 1 }] as never)
      // 8. helperMax
      .mockResolvedValueOnce([] as never)
      // 9. largestTeamRows
      .mockResolvedValueOnce([] as never);

    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);

    const { json } = await callRoute();
    const thisMonth = json.monthlySeries.find((m: { month: string }) => m.month === thisMonthKey)!;
    const iff = json.inspectors.find((u: { username: string }) => u.username === 'iff');
    // Contract: chart number === groupBy lead + groupBy helper. After Fix 2
    // they MUST agree; if they don't, that's an invariant violation worth
    // failing the test for.
    expect(thisMonth.perUser.iff).toBe(3);
    expect(iff.monthTotal).toBe(3);
  });

  it('kpis.activeThisMonth === |{u | thisMonthPerUser[u.username] > 0}|', async () => {
    const thisMonthKey = new Date().toISOString().slice(0, 7);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
      { id: 7, username: 'ice', display_name: 'ice' },
    ] as never);

    vi.mocked(prisma.$queryRawUnsafe)
      // 1. leadYtd
      .mockResolvedValueOnce([] as never)
      // 2. leadMonth
      .mockResolvedValueOnce([] as never)
      // 3. leadMax
      .mockResolvedValueOnce([] as never)
      // 4. memberYtd
      .mockResolvedValueOnce([] as never)
      // 5. memberMonth
      .mockResolvedValueOnce([] as never)
      // 6. leadMonthly — iff has 1 lead this month
      .mockResolvedValueOnce([{ month: thisMonthKey, lead_user_id: 3, n: 1 }] as never)
      // 7. helperMonthly — daf has 2 helper this month
      .mockResolvedValueOnce([{ month: thisMonthKey, user_id: 6, n: 2 }] as never)
      // 8. helperMax
      .mockResolvedValueOnce([] as never)
      // 9. largestTeamRows
      .mockResolvedValueOnce([] as never);

    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);

    const { json } = await callRoute();
    expect(json.kpis.activeThisMonth).toBe(2);
  });

  it('mostTaggedHelperThisYear is non-null whenever any active user has ytdAsHelper > 0', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
    ] as never);

    vi.mocked(prisma.$queryRawUnsafe)
      // 1. leadYtd
      .mockResolvedValueOnce([] as never)
      // 2. leadMonth
      .mockResolvedValueOnce([] as never)
      // 3. leadMax
      .mockResolvedValueOnce([] as never)
      // 4. memberYtd — daf has 4 helper inspections this year
      .mockResolvedValueOnce([{ user_id: 6, n: 4 }] as never)
      // 5. memberMonth
      .mockResolvedValueOnce([] as never)
      // 6. leadMonthly
      .mockResolvedValueOnce([] as never)
      // 7. helperMonthly
      .mockResolvedValueOnce([] as never)
      // 8. helperMax
      .mockResolvedValueOnce([] as never)
      // 9. largestTeamRows
      .mockResolvedValueOnce([] as never);

    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);

    const { json } = await callRoute();
    const dafYtdAsHelper = json.inspectors.find(
      (u: { username: string }) => u.username === 'daf',
    )?.ytdAsHelper ?? 0;
    expect(dafYtdAsHelper).toBeGreaterThan(0);
    expect(json.kpis.mostTaggedHelperThisYear).not.toBeNull();
  });

  it('deactivated user (filtered out of users) does NOT inflate any inspector ytdAsHelper', async () => {
    // active list excludes deactivated user id 99.
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff' },
      { id: 6, username: 'daf', display_name: 'daf' },
    ] as never);

    vi.mocked(prisma.$queryRawUnsafe)
      // 1. leadYtd
      .mockResolvedValueOnce([] as never)
      // 2. leadMonth
      .mockResolvedValueOnce([] as never)
      // 3. leadMax
      .mockResolvedValueOnce([] as never)
      // 4. memberYtd — includes deactivated user 99 with 50 hits
      .mockResolvedValueOnce([
        { user_id: 99, n: 50 },
        { user_id: 6,  n: 3 },
      ] as never)
      // 5. memberMonth
      .mockResolvedValueOnce([] as never)
      // 6. leadMonthly
      .mockResolvedValueOnce([] as never)
      // 7. helperMonthly
      .mockResolvedValueOnce([] as never)
      // 8. helperMax
      .mockResolvedValueOnce([] as never)
      // 9. largestTeamRows
      .mockResolvedValueOnce([] as never);

    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);

    const { json } = await callRoute();
    for (const insp of json.inspectors) {
      // No active inspector should have 50 helper hits attributed to them.
      expect(insp.ytdAsHelper).toBeLessThan(50);
    }
    // The deactivated user 99 does NOT appear as an active inspector.
    expect(json.inspectors.find((u: { userId: number }) => u.userId === 99)).toBeUndefined();
  });
});
