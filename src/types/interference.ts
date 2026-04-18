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
  directionMatch?: 'match' | 'mismatch';
  lawPaperSent?: string; // 'sent' | 'not_sent'
}

export interface PropagationOverlay {
  siteId: number;
  pngUrl: string;
  leafletBounds: [[number, number], [number, number]];
}

export interface BearingValidation {
  calculatedBearing: number;       // 0-360 degrees
  storedDirection: number;         // from site.direction (normalized)
  angularDifference: number;       // 0-180 degrees
  compassDirection: string;        // e.g., "NE (42°)"
  isMatch: boolean;               // within tolerance
  toleranceDeg: number;           // tolerance used
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

