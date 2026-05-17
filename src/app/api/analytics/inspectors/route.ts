// src/app/api/analytics/inspectors/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';
import type { InspectorsAnalytics } from '@/types/analytics';

// 60-second in-memory cache (singleton). Resets on dev hot-reload and prod redeploy.
let cached: { at: number; payload: InspectorsAnalytics } | null = null;
const CACHE_TTL_MS = 60_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function firstOfYear(year: number): Date {
  return new Date(`${year}-01-01T00:00:00Z`);
}

function firstOfMonth(year: number, monthIndex0: number): Date {
  const mm = String(monthIndex0 + 1).padStart(2, '0');
  return new Date(`${year}-${mm}-01T00:00:00Z`);
}

function ymKey(d: Date): string {
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}`;
}

function buildMonthGrid(now: Date): string[] {
  // Last 12 months oldest → newest, ending in current month.
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(ymKey(d));
  }
  return out;
}

async function buildPayload(): Promise<InspectorsAnalytics> {
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const yearStart = firstOfYear(thisYear);
  const monthStart = firstOfMonth(thisYear, now.getUTCMonth());
  const monthGrid = buildMonthGrid(now);
  const monthGridStart = new Date(`${monthGrid[0]}-01T00:00:00Z`);

  const [
    users,
    leadYtd,
    leadMonth,
    leadMax,
    memberYtd,
    memberMonth,
    leadMonthly,
    helperMonthly,
    helperMax,
    largestTeamRows,
  ] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, role: { in: ['admin', 'inspector'] } },
      select: { id: true, username: true, display_name: true },
      orderBy: { display_name: 'asc' },
    }),
    prisma.station_inspection.groupBy({
      by: ['lead_user_id'],
      _count: { _all: true },
      where: { inspected_on: { gte: yearStart } },
    }),
    prisma.station_inspection.groupBy({
      by: ['lead_user_id'],
      _count: { _all: true },
      where: { inspected_on: { gte: monthStart } },
    }),
    prisma.station_inspection.groupBy({
      by: ['lead_user_id'],
      _max: { inspected_on: true },
    }),
    prisma.station_inspection_member.groupBy({
      by: ['user_id'],
      _count: { _all: true },
      where: { inspection: { inspected_on: { gte: yearStart } } },
    }),
    prisma.station_inspection_member.groupBy({
      by: ['user_id'],
      _count: { _all: true },
      where: { inspection: { inspected_on: { gte: monthStart } } },
    }),
    prisma.$queryRawUnsafe<Array<{ month: string; lead_user_id: number; n: number }>>(
      `SELECT to_char(date_trunc('month', inspected_on), 'YYYY-MM') AS month,
              lead_user_id, COUNT(*)::int AS n
         FROM station_inspection
        WHERE inspected_on >= $1
        GROUP BY month, lead_user_id`,
      monthGridStart,
    ),
    prisma.$queryRawUnsafe<Array<{ month: string; user_id: number; n: number }>>(
      `SELECT to_char(date_trunc('month', i.inspected_on), 'YYYY-MM') AS month,
              m.user_id, COUNT(*)::int AS n
         FROM station_inspection_member m
         JOIN station_inspection i ON i.id = m.inspection_id
        WHERE i.inspected_on >= $1
        GROUP BY month, m.user_id`,
      monthGridStart,
    ),
    prisma.$queryRawUnsafe<Array<{ user_id: number; last: Date }>>(
      `SELECT m.user_id, MAX(i.inspected_on) AS last
         FROM station_inspection_member m
         JOIN station_inspection i ON i.id = m.inspection_id
        GROUP BY m.user_id`,
    ),
    prisma.$queryRawUnsafe<Array<{ id: number; station_id: number; inspected_on: Date; member_count: number }>>(
      `SELECT i.id, i.station_id, i.inspected_on,
              (1 + COUNT(m.user_id))::int AS member_count
         FROM station_inspection i
         LEFT JOIN station_inspection_member m ON m.inspection_id = i.id
        WHERE i.inspected_on >= $1
        GROUP BY i.id
        ORDER BY member_count DESC, i.inspected_on DESC
        LIMIT 1`,
      yearStart,
    ),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const leadYtdMap = new Map(leadYtd.map((r) => [r.lead_user_id, r._count._all]));
  const leadMonthMap = new Map(leadMonth.map((r) => [r.lead_user_id, r._count._all]));
  const leadMaxMap = new Map(leadMax.map((r) => [r.lead_user_id, r._max.inspected_on]));
  const memberYtdMap = new Map(memberYtd.map((r) => [r.user_id, r._count._all]));
  const memberMonthMap = new Map(memberMonth.map((r) => [r.user_id, r._count._all]));
  const helperMaxMap = new Map(helperMax.map((r) => [r.user_id, r.last]));

  const monthlySeries = monthGrid.map((month) => {
    const perUser: Record<string, number> = {};
    for (const row of leadMonthly) {
      if (row.month !== month) continue;
      const u = userById.get(row.lead_user_id);
      if (!u) continue;
      perUser[u.username] = (perUser[u.username] ?? 0) + Number(row.n);
    }
    for (const row of helperMonthly) {
      if (row.month !== month) continue;
      const u = userById.get(row.user_id);
      if (!u) continue;
      perUser[u.username] = (perUser[u.username] ?? 0) + Number(row.n);
    }
    return { month, perUser };
  });

  const thisMonthKey = ymKey(now);
  const thisMonthPerUser = monthlySeries.find((m) => m.month === thisMonthKey)?.perUser ?? {};

  const inspectors = users.map((u) => {
    const ytdAsLead = leadYtdMap.get(u.id) ?? 0;
    const ytdAsHelper = memberYtdMap.get(u.id) ?? 0;
    const monthAsLead = leadMonthMap.get(u.id) ?? 0;
    const monthAsHelper = memberMonthMap.get(u.id) ?? 0;
    const monthFromSeries = thisMonthPerUser[u.username] ?? 0;
    // Raw query is the source for the monthly chart the user sees — make it
    // the source of truth for the leaderboard total too. If the groupBy
    // numbers disagree, that's a real divergence worth investigating, not a
    // discrepancy to paper over with max().
    const monthTotal = monthFromSeries;
    if (monthFromSeries !== monthAsLead + monthAsHelper) {
      console.warn(
        `[analytics] count divergence for ${u.username}: chart=${monthFromSeries}, groupBy=${monthAsLead + monthAsHelper}`,
      );
    }
    const leadMaxDate = leadMaxMap.get(u.id) ?? null;
    const helperMaxDate = helperMaxMap.get(u.id) ?? null;
    let lastActive: Date | null = null;
    if (leadMaxDate && helperMaxDate) {
      lastActive = leadMaxDate > helperMaxDate ? leadMaxDate : helperMaxDate;
    } else {
      lastActive = leadMaxDate ?? helperMaxDate;
    }
    return {
      userId: u.id,
      username: u.username,
      displayName: u.display_name,
      ytdTotal: ytdAsLead + ytdAsHelper,
      monthTotal,
      ytdAsLead,
      ytdAsHelper,
      lastActive: lastActive ? isoDate(lastActive) : null,
    };
  });
  inspectors.sort((a, b) => b.ytdTotal - a.ytdTotal);

  // "Active this month" is grounded in the monthlySeries[thisMonth] bucket so
  // it agrees with the chart the user sees.
  const activeThisMonth = Object.values(thisMonthPerUser).filter((n) => n > 0).length;

  let largestTeam: InspectorsAnalytics['kpis']['largestTeam'] = null;
  const top = largestTeamRows[0];
  if (top) {
    const station = await prisma.fm_station.findUnique({
      where: { id_fm: top.station_id },
      select: { name: true },
    });
    largestTeam = {
      inspectionId: top.id,
      stationId: top.station_id,
      stationName: station?.name ?? '(unknown station)',
      inspectedOn: isoDate(top.inspected_on),
      memberCount: Number(top.member_count),
    };
  }

  let mostTaggedHelperThisYear: InspectorsAnalytics['kpis']['mostTaggedHelperThisYear'] = null;
  const sortedHelpers = memberYtd.slice().sort((a, b) => b._count._all - a._count._all);
  for (const helperTop of sortedHelpers) {
    const u = userById.get(helperTop.user_id);
    if (u) {
      mostTaggedHelperThisYear = {
        username: u.username,
        displayName: u.display_name,
        count: helperTop._count._all,
      };
      break;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    thisYear,
    thisMonth: ymKey(now),
    inspectors,
    monthlySeries,
    kpis: { activeThisMonth, largestTeam, mostTaggedHelperThisYear },
  };
}

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }
  const payload = await buildPayload();
  cached = { at: Date.now(), payload };
  return NextResponse.json(payload);
}
