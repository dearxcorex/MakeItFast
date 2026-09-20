// Types for Interference Analysis feature

export interface InterferenceSite {
  id: number;
  siteCode: string | null;
  siteName: string | null;
  lat: number | null;
  long: number | null;
  changwat: string | null;
  cellName: string | null;
  sectorName: string | null;
  direction: number | null;
  avgNiCarrier: number | null;
  sourceLat: number | null;
  sourceLong: number | null;
  estimateDistance: number | null;
  ranking: string | null;
  status: string | null;
  lawPaperSent: boolean | null;
  /** Never displayed. dedupeInterference sorts on it to pick the visible pin. */
  updatedAt: Date;
}

