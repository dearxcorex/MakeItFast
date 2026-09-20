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
    changwat: row.changwat,
    cellName: row.cell_name,
    sectorName: row.sector_name,
    direction: row.direction,
    avgNiCarrier: row.avg_ni_carrier,
    sourceLat: row.source_lat,
    sourceLong: row.source_long,
    estimateDistance: row.estimate_distance,
    ranking: row.ranking,
    status: row.status,
    lawPaperSent: row.law_paper_sent ?? false,
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
