import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { AnalyticsSummary } from '@/types/analytics';

export async function GET() {
  try {
    const [
      totalStations,
      inspectedStations,
      onAirStations,
      fmSubmitted,
      fmInspection68,
      fmInspection69,
      fmBothYears,
      totalInterferenceSites,
      criticalCount,
      inspectedInterferenceCount,
      rankingGroups,
      provinceGroups,
      topCriticalRaw,
      recentActivityRaw,
      directionSamples,
      fmProvinceGroups,
      fmProvinceInspected69,
      fmFrequencies,
    ] = await Promise.all([
      prisma.fm_station.count(),
      prisma.fm_station.count({
        where: { OR: [{ inspection_68: true }, { inspection_69: true }] },
      }),
      prisma.fm_station.count({ where: { on_air: true } }),
      prisma.fm_station.count({ where: { submit_a_request: true } }),
      prisma.fm_station.count({ where: { inspection_68: true } }),
      prisma.fm_station.count({ where: { inspection_69: true } }),
      prisma.fm_station.count({ where: { inspection_68: true, inspection_69: true } }),
      prisma.interference_site.count(),
      prisma.interference_site.count({
        where: { ranking: { equals: 'Critical', mode: 'insensitive' } },
      }),
      prisma.interference_site.count({ where: { status: 'ตรวจแล้ว' } }),
      prisma.interference_site.groupBy({
        by: ['ranking'],
        _count: { _all: true },
      }),
      prisma.interference_site.groupBy({
        by: ['changwat'],
        _count: { _all: true },
        where: { changwat: { not: null } },
      }),
      prisma.interference_site.findMany({
        where: { ranking: { equals: 'Critical', mode: 'insensitive' }, status: { not: 'ตรวจแล้ว' } },
        orderBy: { updated_at: 'desc' },
        take: 10,
        select: { id: true, site_name: true, site_code: true, changwat: true, ranking: true, status: true },
      }),
      prisma.interference_site.findMany({
        orderBy: { updated_at: 'desc' },
        take: 10,
        select: { id: true, site_name: true, site_code: true, ranking: true, status: true, updated_at: true },
      }),
      prisma.interference_site.findMany({
        where: { direction: { not: null }, source_lat: { not: null }, source_long: { not: null }, lat: { not: null }, long: { not: null } },
        select: { lat: true, long: true, source_lat: true, source_long: true, direction: true },
      }),
      prisma.fm_station.groupBy({
        by: ['province'],
        _count: { _all: true },
        where: { province: { not: null } },
      }),
      prisma.fm_station.groupBy({
        by: ['province'],
        _count: { _all: true },
        where: { province: { not: null }, inspection_69: true },
      }),
      prisma.fm_station.findMany({
        where: { freq: { not: null } },
        select: { freq: true },
      }),
    ]);

    // Direction match rate
    let matchCount = 0;
    let totalWithDir = 0;
    for (const s of directionSamples) {
      if (s.direction == null || s.lat == null || s.long == null || s.source_lat == null || s.source_long == null) continue;
      totalWithDir++;
      const actualBearing = calculateBearing(s.lat, s.long, s.source_lat, s.source_long);
      const diff = Math.abs(((actualBearing - s.direction + 540) % 360) - 180);
      if (diff <= 15) matchCount++;
    }
    const directionMatchRate = totalWithDir > 0 ? Math.round((matchCount / totalWithDir) * 100) : 0;

    // Interference province aggregation
    const provincePerRanking = await prisma.interference_site.groupBy({
      by: ['changwat', 'ranking'],
      _count: { _all: true },
      where: { changwat: { not: null } },
    });
    const provinceInspected = await prisma.interference_site.groupBy({
      by: ['changwat'],
      _count: { _all: true },
      where: { changwat: { not: null }, status: 'ตรวจแล้ว' },
    });

    const provinceMap = new Map<string, { name: string; total: number; critical: number; major: number; minor: number; inspected: number }>();
    for (const g of provinceGroups) {
      if (!g.changwat) continue;
      provinceMap.set(g.changwat, { name: g.changwat, total: g._count._all, critical: 0, major: 0, minor: 0, inspected: 0 });
    }
    for (const g of provincePerRanking) {
      if (!g.changwat || !g.ranking) continue;
      const entry = provinceMap.get(g.changwat);
      if (!entry) continue;
      const r = g.ranking.toLowerCase();
      if (r === 'critical') entry.critical = g._count._all;
      else if (r === 'major') entry.major = g._count._all;
      else if (r === 'minor') entry.minor = g._count._all;
    }
    for (const g of provinceInspected) {
      if (!g.changwat) continue;
      const entry = provinceMap.get(g.changwat);
      if (entry) entry.inspected = g._count._all;
    }

    const byProvince = Array.from(provinceMap.values()).sort((a, b) => b.total - a.total);

    const rankingDistribution = rankingGroups
      .filter((g) => g.ranking)
      .map((g) => ({ ranking: g.ranking as string, count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    // FM station province aggregation — inspected year 69 only
    const fmProvinceMap = new Map<string, { name: string; total: number; inspected69: number }>();
    for (const g of fmProvinceGroups) {
      if (!g.province) continue;
      fmProvinceMap.set(g.province, { name: g.province, total: g._count._all, inspected69: 0 });
    }
    for (const g of fmProvinceInspected69) {
      if (!g.province) continue;
      const entry = fmProvinceMap.get(g.province);
      if (entry) entry.inspected69 = g._count._all;
    }
    const fmStationsByProvince = Array.from(fmProvinceMap.values()).sort((a, b) => b.total - a.total);

    // FM frequency distribution (2 MHz bands from 88-108)
    const bands: Record<string, number> = {
      '88-90': 0, '90-92': 0, '92-94': 0, '94-96': 0, '96-98': 0,
      '98-100': 0, '100-102': 0, '102-104': 0, '104-106': 0, '106-108': 0,
    };
    for (const s of fmFrequencies) {
      if (s.freq == null) continue;
      const band = Math.floor(s.freq / 2) * 2;
      const key = `${band}-${band + 2}`;
      if (key in bands) bands[key]++;
    }
    const fmFrequencyDistribution = Object.entries(bands).map(([band, count]) => ({ band, count }));

    // FM inspection breakdown
    const only68 = fmInspection68 - fmBothYears;
    const only69 = fmInspection69 - fmBothYears;
    const neverInspected = totalStations - (only68 + only69 + fmBothYears);

    const summary: AnalyticsSummary = {
      heroStats: {
        totalStations,
        inspectedStations,
        totalInterferenceSites,
        criticalInterference: criticalCount,
        inspectedInterference: inspectedInterferenceCount,
        pendingInterference: totalInterferenceSites - inspectedInterferenceCount,
        directionMatchRate,
        onAirStations,
        offAirStations: totalStations - onAirStations,
      },
      byProvince,
      rankingDistribution,
      inspectionStatus: {
        inspected: inspectedInterferenceCount,
        pending: totalInterferenceSites - inspectedInterferenceCount,
      },
      topCriticalSites: topCriticalRaw.map((s) => ({
        id: s.id,
        siteName: s.site_name,
        siteCode: s.site_code,
        changwat: s.changwat,
        ranking: s.ranking,
        status: s.status,
      })),
      recentActivity: recentActivityRaw.map((s) => ({
        id: s.id,
        siteName: s.site_name,
        siteCode: s.site_code,
        ranking: s.ranking,
        status: s.status,
        updatedAt: s.updated_at.toISOString(),
      })),
      fmStationsByProvince,
      fmStationAirStatus: {
        onAir: onAirStations,
        offAir: totalStations - onAirStations,
      },
      fmStationInspection: {
        inspection68: only68,
        inspection69: only69,
        bothYears: fmBothYears,
        neverInspected: Math.max(0, neverInspected),
      },
      fmFrequencyDistribution,
      fmStationRequests: {
        submitted: fmSubmitted,
        notSubmitted: totalStations - fmSubmitted,
      },
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Analytics summary error:', error);
    return NextResponse.json({ error: 'Failed to load analytics summary' }, { status: 500 });
  }
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
