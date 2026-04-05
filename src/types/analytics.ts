export interface AnalyticsSummary {
  heroStats: {
    totalStations: number;
    inspectedStations: number;
    totalInterferenceSites: number;
    criticalInterference: number;
    inspectedInterference: number;
    pendingInterference: number;
    directionMatchRate: number; // 0-100
    onAirStations: number;
    offAirStations: number;
  };
  byProvince: Array<{
    name: string;
    total: number;
    critical: number;
    major: number;
    minor: number;
    inspected: number;
  }>;
  rankingDistribution: Array<{
    ranking: string;
    count: number;
  }>;
  inspectionStatus: {
    inspected: number;
    pending: number;
  };
  topCriticalSites: Array<{
    id: number;
    siteName: string | null;
    siteCode: string | null;
    changwat: string | null;
    ranking: string | null;
    status: string | null;
  }>;
  recentActivity: Array<{
    id: number;
    siteName: string | null;
    siteCode: string | null;
    status: string | null;
    ranking: string | null;
    updatedAt: string;
  }>;
  // FM Station analytics
  fmStationsByProvince: Array<{
    name: string;
    total: number;
    inspected69: number;
  }>;
  fmStationAirStatus: {
    onAir: number;
    offAir: number;
  };
  fmStationInspection: {
    inspection68: number;
    inspection69: number;
    bothYears: number;
    neverInspected: number;
  };
  fmFrequencyDistribution: Array<{
    band: string; // e.g., "88-90", "90-92"
    count: number;
  }>;
  fmStationRequests: {
    submitted: number;
    notSubmitted: number;
  };
}
