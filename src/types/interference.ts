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
  createdAt: Date;
  updatedAt: Date;
}

export interface InterferenceFilter {
  changwat?: string;
  ranking?: string;
  mcZone?: string;
  nbtcArea?: string;
  hasSource?: boolean;
  search?: string;
  status?: string;
  noiseMin?: number;
  noiseMax?: number;
}

export interface CloudRFAreaRequest {
  siteId: number;
  lat: number;
  lon: number;
  alt?: number;
  txw?: number;
  azi?: number;
  rad?: number;
}

export interface CloudRFAreaResponse {
  pngUrl: string | null;
  bounds: [[number, number], [number, number]] | null;
  coverage: number | null;
  viewerUrl: string | null;
  cached: boolean;
}

export interface CloudRFPathRequest {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
}

export interface CloudRFPathResponse {
  pathLoss: number | null;
  chartUrl: string | null;
  signalLevel: number | null;
  distance: number | null;
}

export interface PropagationOverlay {
  siteId: number;
  pngUrl: string;
  leafletBounds: [[number, number], [number, number]];
}

export interface InterferenceStats {
  total: number;
  byRanking: Record<string, number>;
  byProvince: Record<string, number>;
  avgNoise: number;
  withSource: number;
}

// Equipment & Propagation types

export type DeploymentType = 'macro_urban' | 'macro_suburban' | 'macro_rural';

export interface EquipmentProfile {
  name: string;
  deploymentType: DeploymentType;
  txPower: number;        // Watts
  antennaGain: number;    // dBi
  antennaHeight: number;  // meters
  hBeamwidth: number;     // horizontal degrees
  vBeamwidth: number;     // vertical degrees
  downtilt: number;       // degrees
  bandwidth: number;      // MHz
  feederLoss: number;     // dB
}

export interface EnvironmentConfig {
  climate: string;
  landcover: 0 | 1;
  buildings: 0 | 1;
  propagationModel: number;
  diffraction: 0 | 1;
  reliability: number;
}

export interface CloudRFAreaRequestV2 extends CloudRFAreaRequest {
  profile?: DeploymentType;
  antennaGain?: number;
  downtilt?: number;
  bandwidth?: number;
  environment?: Partial<EnvironmentConfig>;
}

export interface CloudRFMultisiteRequest {
  sites: Array<{
    siteId: number;
    lat: number;
    lon: number;
    alt?: number;
    txw?: number;
    azi?: number;
    profile?: DeploymentType;
  }>;
  environment?: Partial<EnvironmentConfig>;
  radius?: number;
}
