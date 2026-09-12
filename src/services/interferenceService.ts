import prisma from '@/lib/prisma';
import type { InterferenceSite } from '@/types/interference';
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
    lawPaperSent: row.law_paper_sent ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchInterferenceSiteById(
  id: number
): Promise<InterferenceSite | null> {
  const row = await prisma.interference_site.findUnique({
    where: { id },
  });
  return row ? convertToInterferenceSite(row) : null;
}
