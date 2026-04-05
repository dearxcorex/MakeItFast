import { FMStation } from './station';

/**
 * Type of intermodulation product
 */
export type IntermodProductType = '2f1-f2' | '2f2-f1';

/**
 * An intermodulation product resulting from two frequencies mixing
 */
export interface IntermodProduct {
  type: IntermodProductType;
  frequency: number; // MHz
  inAviationBand: boolean;
  affectedService?: AviationService;
}

/**
 * Aviation services that can be affected by intermodulation
 */
export type AviationService = 'VOR/ILS' | 'Emergency' | 'ATC Voice';

/**
 * Aviation band frequency ranges
 */
export const AVIATION_BANDS: Record<AviationService, { min: number; max: number }> = {
  'VOR/ILS': { min: 108.0, max: 117.95 },
  'Emergency': { min: 121.5, max: 121.5 },
  'ATC Voice': { min: 118.0, max: 137.0 },
};

/**
 * Overall aviation band range
 */
export const AVIATION_BAND_RANGE = { min: 108.0, max: 137.0 };

/**
 * FM broadcast band range
 */
export const FM_BAND_RANGE = { min: 87.5, max: 108.0 };

/**
 * A pair of FM stations that produce intermodulation products
 */
export interface IntermodPair {
  station1: FMStation;
  station2: FMStation;
  distance: number; // Distance between stations in km
  products: IntermodProduct[];
  aviationProducts: IntermodProduct[]; // Only products falling in 108-137 MHz
}

/**
 * Aircraft data input for targeted interference analysis
 */
export interface AircraftInput {
  frequency?: number; // Target aviation frequency being affected (MHz)
  altitude?: number; // Feet
  latitude?: number;
  longitude?: number;
}

/**
 * Risk level for interference assessment
 */
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Risk assessment for an intermodulation pair
 */
export interface InterferenceRisk {
  pair: IntermodPair;
  targetFrequency: number; // The aviation frequency being affected
  frequencyDelta: number; // How close the intermod product is to target (MHz)
  distanceToAircraft?: number; // Distance from midpoint of station pair to aircraft (km)
  lineOfSight: boolean; // Whether aircraft is within line of sight
  combinedPower?: number; // Combined transmitter power if available
  riskLevel: RiskLevel;
  riskScore: number; // Numeric score for sorting (higher = more dangerous)
}

/**
 * Common aviation frequencies for quick selection
 */
export const COMMON_AVIATION_FREQUENCIES: { frequency: number; name: string; service: AviationService }[] = [
  { frequency: 108.0, name: 'VOR/ILS Start', service: 'VOR/ILS' },
  { frequency: 110.1, name: 'ILS Localizer', service: 'VOR/ILS' },
  { frequency: 112.0, name: 'VOR', service: 'VOR/ILS' },
  { frequency: 117.95, name: 'VOR/ILS End', service: 'VOR/ILS' },
  { frequency: 118.0, name: 'ATC Start', service: 'ATC Voice' },
  { frequency: 121.5, name: 'Emergency', service: 'Emergency' },
  { frequency: 123.45, name: 'Air-to-Air', service: 'ATC Voice' },
  { frequency: 125.0, name: 'Approach Control', service: 'ATC Voice' },
  { frequency: 132.0, name: 'Area Control', service: 'ATC Voice' },
  { frequency: 137.0, name: 'ATC End', service: 'ATC Voice' },
];

/**
 * Result summary for the calculator
 */
export interface IntermodCalculationResult {
  totalPairsChecked: number;
  dangerousPairs: IntermodPair[];
  riskAssessments?: InterferenceRisk[];
  calculationTimeMs: number;
}
