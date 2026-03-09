import prisma from '@/lib/prisma';
import type { InterferenceSite, InterferenceFilter } from '@/types/interference';
import type { interference_site } from '@prisma/client';

export function convertToInterferenceSite(row: interference_site): InterferenceSite {
  return {
    id: row.id,
    siteCode: row.site_code,
    siteName: row.site_name,
    lat: row.lat,
    long: row.long,
    mcZone: row.mc_zone,
    changwat: row.changwat,
    cellName: row.cell_name,
    sectorName: row.sector_name,
    direction: row.direction,
    avgNiCarrier: row.avg_ni_carrier,
    dayTime: row.day_time,
    nightTime: row.night_time,
    sourceLat: row.source_lat,
    sourceLong: row.source_long,
    estimateDistance: row.estimate_distance,
    ranking: row.ranking,
    status: row.status,
    nbtcArea: row.nbtc_area,
    awnContact: row.awn_contact,
    lot: row.lot,
    onSiteScanBy: row.on_site_scan_by,
    onSiteScanDate: row.on_site_scan_date,
    checkRealtime: row.check_realtime,
    sourceLocation1: row.source_location_1,
    sourceLocation2: row.source_location_2,
    cameraModel1: row.camera_model_1,
    cameraModel2: row.camera_model_2,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchInterferenceSites(
  filters?: InterferenceFilter
): Promise<InterferenceSite[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (filters) {
    if (filters.changwat) {
      where.changwat = filters.changwat;
    }
    if (filters.ranking) {
      where.ranking = filters.ranking;
    }
    if (filters.mcZone) {
      where.mc_zone = filters.mcZone;
    }
    if (filters.nbtcArea) {
      where.nbtc_area = filters.nbtcArea;
    }
    if (filters.hasSource) {
      where.source_lat = { not: null };
      where.source_long = { not: null };
    }
    if (filters.search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { site_name: { contains: filters.search, mode: 'insensitive' } },
            { site_code: { contains: filters.search, mode: 'insensitive' } },
            { cell_name: { contains: filters.search, mode: 'insensitive' } },
          ],
        },
      ];
    }
    if (filters.status) {
      if (filters.status === 'ตรวจแล้ว') {
        where.status = 'ตรวจแล้ว';
      } else {
        // "ยังไม่ตรวจ" means all non-inspected: null, "High interference", "ยังไม่ตรวจ", etc.
        // Prisma NOT excludes NULLs (SQL standard), so use OR to include them
        where.AND = [
          ...(where.AND || []),
          { OR: [{ status: null }, { status: { not: 'ตรวจแล้ว' } }] },
        ];
      }
    }
    if (filters.noiseMin !== undefined || filters.noiseMax !== undefined) {
      where.avg_ni_carrier = {};
      if (filters.noiseMin !== undefined) {
        where.avg_ni_carrier.gte = filters.noiseMin;
      }
      if (filters.noiseMax !== undefined) {
        where.avg_ni_carrier.lte = filters.noiseMax;
      }
    }
  }

  const rows = await prisma.interference_site.findMany({
    where,
    orderBy: { site_name: 'asc' },
  });

  return rows.map(convertToInterferenceSite);
}

export async function fetchInterferenceSiteById(
  id: number
): Promise<InterferenceSite | null> {
  const row = await prisma.interference_site.findUnique({
    where: { id },
  });
  return row ? convertToInterferenceSite(row) : null;
}

export async function getDistinctChangwats(): Promise<string[]> {
  const results = await prisma.interference_site.findMany({
    select: { changwat: true },
    distinct: ['changwat'],
    where: { changwat: { not: null } },
    orderBy: { changwat: 'asc' },
  });
  return results.map((r) => r.changwat!);
}

export async function getDistinctRankings(): Promise<string[]> {
  const results = await prisma.interference_site.findMany({
    select: { ranking: true },
    distinct: ['ranking'],
    where: { ranking: { not: null } },
    orderBy: { ranking: 'asc' },
  });
  return results.map((r) => r.ranking!);
}

export async function getDistinctMcZones(): Promise<string[]> {
  const results = await prisma.interference_site.findMany({
    select: { mc_zone: true },
    distinct: ['mc_zone'],
    where: { mc_zone: { not: null } },
    orderBy: { mc_zone: 'asc' },
  });
  return results.map((r) => r.mc_zone!);
}

export async function getDistinctNbtcAreas(): Promise<string[]> {
  const results = await prisma.interference_site.findMany({
    select: { nbtc_area: true },
    distinct: ['nbtc_area'],
    where: { nbtc_area: { not: null } },
    orderBy: { nbtc_area: 'asc' },
  });
  return results.map((r) => r.nbtc_area!);
}
