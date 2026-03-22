/**
 * Generate SVG sector antenna icons for cell site visualization.
 * Creates "pie slice" wedge shapes showing antenna coverage direction.
 *
 * Inspection status design:
 * - ตรวจแล้ว (inspected): Green center dot + thick green outer ring + muted sector fills
 * - ยังไม่ตรวจ (pending): Ranking-colored center (red/amber/yellow) + normal sector fills
 * Status is visible at a glance without needing a separate badge.
 */

const DEG2RAD = Math.PI / 180;

interface SectorDef {
  azimuth: number;    // 0-360, 0 = North
  beamwidth?: number; // horizontal beamwidth in degrees (default 65)
  color?: string;
}

/**
 * Create SVG arc path for a sector wedge.
 * Azimuth 0 = North (up), clockwise.
 */
function sectorArcPath(
  cx: number,
  cy: number,
  radius: number,
  azimuth: number,
  beamwidth: number
): string {
  const halfBw = beamwidth / 2;
  const startAngle = (azimuth - halfBw - 90) * DEG2RAD;
  const endAngle = (azimuth + halfBw - 90) * DEG2RAD;

  const x1 = cx + radius * Math.cos(startAngle);
  const y1 = cy + radius * Math.sin(startAngle);
  const x2 = cx + radius * Math.cos(endAngle);
  const y2 = cy + radius * Math.sin(endAngle);

  const largeArc = beamwidth > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

// Pending site sectors: ranking-tinted fills
const SECTOR_COLORS_PENDING = [
  'rgba(99, 102, 241, 0.45)',   // indigo
  'rgba(59, 130, 246, 0.45)',   // blue
  'rgba(139, 92, 246, 0.45)',   // purple
];
const SECTOR_STROKE_PENDING = [
  'rgba(99, 102, 241, 0.8)',
  'rgba(59, 130, 246, 0.8)',
  'rgba(139, 92, 246, 0.8)',
];

// Inspected site sectors: green-tinted fills
const SECTOR_COLORS_INSPECTED = [
  'rgba(34, 197, 94, 0.35)',   // green
  'rgba(16, 185, 129, 0.35)',  // emerald
  'rgba(52, 211, 153, 0.35)',  // teal
];
const SECTOR_STROKE_INSPECTED = [
  'rgba(34, 197, 94, 0.7)',
  'rgba(16, 185, 129, 0.7)',
  'rgba(52, 211, 153, 0.7)',
];

/**
 * Generate an SVG string showing sector antenna directions.
 *
 * Inspected: green center + green ring + green-tinted sectors + checkmark
 * Pending:   ranking-colored center (red/amber) + blue-tinted sectors
 */
export function createSectorSVG(
  sectors: SectorDef[],
  size: number = 48,
  options?: {
    centerColor?: string;
    centerRadius?: number;
    isSelected?: boolean;
    isInspected?: boolean;
    rankingColor?: string;
  }
): string {
  const center = size / 2;
  const sectorRadius = size / 2 - 2;
  const centerR = options?.centerRadius ?? 7;
  const isInspected = options?.isInspected ?? false;

  // Colors based on inspection status
  const centerColor = isInspected
    ? '#22c55e'  // green for inspected
    : (options?.rankingColor ?? '#EF4444');  // ranking color for pending

  const sectorFills = isInspected ? SECTOR_COLORS_INSPECTED : SECTOR_COLORS_PENDING;
  const sectorStrokes = isInspected ? SECTOR_STROKE_INSPECTED : SECTOR_STROKE_PENDING;

  // Sector wedges
  let paths = '';
  sectors.forEach((sector, i) => {
    const bw = sector.beamwidth ?? 65;
    const color = sector.color ?? sectorFills[i % sectorFills.length];
    const strokeColor = sectorStrokes[i % sectorStrokes.length];
    const path = sectorArcPath(center, center, sectorRadius, sector.azimuth, bw);
    paths += `<path d="${path}" fill="${color}" stroke="${strokeColor}" stroke-width="1.5"/>`;
  });

  // Outer ring: green for inspected, ranking color for selected pending
  let outerRing = '';
  if (isInspected) {
    outerRing = `<circle cx="${center}" cy="${center}" r="${sectorRadius + 1}" fill="none" stroke="#22c55e" stroke-width="2.5" opacity="0.9"/>`;
  } else if (options?.isSelected) {
    outerRing = `<circle cx="${center}" cy="${center}" r="${sectorRadius + 1}" fill="none" stroke="${centerColor}" stroke-width="2" stroke-dasharray="4 2" opacity="0.7"/>`;
  }

  // Center dot with icon
  const centerDot = isInspected
    ? `<circle cx="${center}" cy="${center}" r="${centerR + 1}" fill="#22c55e" stroke="white" stroke-width="2"/>
       <path d="M${center - 3.5} ${center} l2.5 2.5 4.5-5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<circle cx="${center}" cy="${center}" r="${centerR}" fill="${centerColor}" stroke="white" stroke-width="2"/>`;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${outerRing}
    ${paths}
    ${centerDot}
  </svg>`;
}

/**
 * Extract sectors from an interference site's direction field.
 */
export function siteToSectors(direction: number | null): SectorDef[] {
  if (direction == null) return [];
  return [{ azimuth: direction, beamwidth: 65 }];
}

/**
 * Group interference site records by site_code to reconstruct multi-sector towers.
 */
export function groupSiteSectors<T extends { siteCode: string | null; direction: number | null; sectorName: string | null }>(
  sites: T[]
): Map<string, { sectors: SectorDef[]; sites: T[] }> {
  const groups = new Map<string, { sectors: SectorDef[]; sites: T[] }>();

  for (const site of sites) {
    const key = site.siteCode ?? `standalone-${Math.random()}`;
    if (!groups.has(key)) {
      groups.set(key, { sectors: [], sites: [] });
    }
    const group = groups.get(key)!;
    group.sites.push(site);
    if (site.direction != null) {
      group.sectors.push({
        azimuth: site.direction,
        beamwidth: 65,
      });
    }
  }

  return groups;
}

export function getRankingColor(ranking: string | null): string {
  switch (ranking?.toLowerCase()) {
    case 'critical': return '#EF4444';
    case 'major': return '#F59E0B';
    case 'minor': return '#FACC15';
    default: return '#6B7280';
  }
}
