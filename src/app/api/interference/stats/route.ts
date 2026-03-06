import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const [total, withSource, avgResult, rankingGroups, provinceGroups] =
      await Promise.all([
        prisma.interference_site.count(),
        prisma.interference_site.count({
          where: { source_lat: { not: null }, source_long: { not: null } },
        }),
        prisma.interference_site.aggregate({
          _avg: { avg_ni_carrier: true },
        }),
        prisma.interference_site.groupBy({
          by: ['ranking'],
          _count: true,
          where: { ranking: { not: null } },
        }),
        prisma.interference_site.groupBy({
          by: ['changwat'],
          _count: true,
          where: { changwat: { not: null } },
        }),
      ]);

    const byRanking: Record<string, number> = {};
    for (const g of rankingGroups) {
      if (g.ranking) byRanking[g.ranking] = g._count;
    }

    const byProvince: Record<string, number> = {};
    for (const g of provinceGroups) {
      if (g.changwat) byProvince[g.changwat] = g._count;
    }

    return NextResponse.json({
      total,
      withSource,
      avgNoise: avgResult._avg.avg_ni_carrier ?? 0,
      byRanking,
      byProvince,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
