// Types for Interference Analysis feature

export interface InterferenceSite {
  id: number;
  siteCode: string | null;
  siteName: string | null;
  lat: number | null;
  long: number | null;
  mcZone: string | null;
  changwat: string | null;
  cellName: string | null;
  sectorName: string | null;
  direction: number | null;
  avgNiCarrier: number | null;
  dayTime: number | null;
  nightTime: number | null;
  sourceLat: number | null;
  sourceLong: number | null;
  estimateDistance: number | null;
  ranking: string | null;
  status: string | null;
  nbtcArea: string | null;
  awnContact: string | null;
  lot: string | null;
  onSiteScanBy: string | null;
  onSiteScanDate: string | null;
  checkRealtime: string | null;
  sourceLocation1: string | null;
  sourceLocation2: string | null;
  cameraModel1: string | null;
  cameraModel2: string | null;
  notes: string | null;
  lawPaperSent: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

