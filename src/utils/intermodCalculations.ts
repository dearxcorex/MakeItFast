import { FMStation } from '@/types/station';
import {
  IntermodProduct,
  IntermodPair,
  IntermodProductType,
  AircraftInput,
  InterferenceRisk,
  RiskLevel,
  AviationService,
  AVIATION_BANDS,
  AVIATION_BAND_RANGE,
  IntermodCalculationResult,
} from '@/types/intermod';

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate third-order intermodulation products from two frequencies
 * @param f1 First frequency in MHz
 * @param f2 Second frequency in MHz
 * @returns Array of intermodulation products
 */
export function calculateThirdOrderProducts(
  f1: number,
  f2: number
): IntermodProduct[] {
  const products: IntermodProduct[] = [];

  // 3rd order products: 2f1 - f2 and 2f2 - f1
  const productTypes: { type: IntermodProductType; frequency: number }[] = [
    { type: '2f1-f2', frequency: 2 * f1 - f2 },
    { type: '2f2-f1', frequency: 2 * f2 - f1 },
  ];

  for (const { type, frequency } of productTypes) {
    const inAviationBand =
      frequency >= AVIATION_BAND_RANGE.min &&
      frequency <= AVIATION_BAND_RANGE.max;

    const affectedService = getAffectedService(frequency);

    products.push({
      type,
      frequency: Math.round(frequency * 100) / 100, // Round to 2 decimals
      inAviationBand,
      affectedService,
    });
  }

  return products;
}

/**
 * Determine which aviation service is affected by a frequency
 * @param frequency Frequency in MHz
 * @returns The affected aviation service or undefined
 */
export function getAffectedService(frequency: number): AviationService | undefined {
  // Check emergency frequency first (most critical)
  if (Math.abs(frequency - 121.5) < 0.05) {
    return 'Emergency';
  }

  // Check VOR/ILS band
  if (frequency >= AVIATION_BANDS['VOR/ILS'].min && frequency <= AVIATION_BANDS['VOR/ILS'].max) {
    return 'VOR/ILS';
  }

  // Check ATC Voice band
  if (frequency >= AVIATION_BANDS['ATC Voice'].min && frequency <= AVIATION_BANDS['ATC Voice'].max) {
    return 'ATC Voice';
  }

  return undefined;
}

/**
 * Calculate radio line-of-sight distance
 * @param stationHeight Station antenna height in meters
 * @param aircraftAltitude Aircraft altitude in feet
 * @returns Line of sight distance in kilometers
 */
export function calculateLineOfSight(
  stationHeight: number,
  aircraftAltitude: number
): number {
  // Convert aircraft altitude from feet to meters
  const aircraftHeightM = aircraftAltitude * 0.3048;

  // Radio horizon formula: d = 4.12 × (√h_tx + √h_rx) km
  // where h is in meters
  const distance = 4.12 * (Math.sqrt(stationHeight) + Math.sqrt(aircraftHeightM));

  return distance;
}

/**
 * Calculate free space path loss
 * @param distanceKm Distance in kilometers
 * @param frequencyMHz Frequency in MHz
 * @returns Path loss in dB
 */
export function calculatePathLoss(distanceKm: number, frequencyMHz: number): number {
  // FSPL = 20×log10(d_km) + 20×log10(f_MHz) + 32.45
  if (distanceKm <= 0 || frequencyMHz <= 0) return 0;

  return (
    20 * Math.log10(distanceKm) +
    20 * Math.log10(frequencyMHz) +
    32.45
  );
}

/**
 * FM broadcast band range for validation
 */
const FM_BAND = { min: 87.5, max: 108.0 };

/**
 * Reverse lookup: Find FM station pairs that would create interference at a target aircraft frequency
 *
 * Given target frequency T, we need to find pairs where:
 * - 2*f1 - f2 = T  →  f2 = 2*f1 - T
 * - 2*f2 - f1 = T  →  f1 = 2*f2 - T
 *
 * @param stations Array of FM stations
 * @param targetFrequency The aircraft frequency being interfered with
 * @param tolerance Frequency matching tolerance in MHz (default 0.1)
 * @returns Calculation result with pairs that could cause interference
 */
export function findPairsForTargetFrequency(
  stations: FMStation[],
  targetFrequency: number,
  tolerance: number = 0.1
): IntermodCalculationResult {
  const startTime = performance.now();
  const dangerousPairs: IntermodPair[] = [];
  const foundPairKeys = new Set<string>(); // To avoid duplicates
  let totalPairsChecked = 0;

  // Use all stations (including off-air) for interference analysis
  const allStations = stations;

  // Create a frequency index for quick lookup
  const stationsByFreq = new Map<number, FMStation[]>();
  for (const station of allStations) {
    const freqKey = Math.round(station.frequency * 10) / 10; // Round to 0.1 MHz
    if (!stationsByFreq.has(freqKey)) {
      stationsByFreq.set(freqKey, []);
    }
    stationsByFreq.get(freqKey)!.push(station);
  }

  // For each station f1, calculate what f2 would need to be
  for (const station1 of allStations) {
    const f1 = station1.frequency;

    // Case 1: 2*f1 - f2 = target → f2 = 2*f1 - target
    const neededF2 = 2 * f1 - targetFrequency;

    // Check if neededF2 is in FM band range
    if (neededF2 >= FM_BAND.min && neededF2 <= FM_BAND.max) {
      // Look for stations with frequency close to neededF2
      for (const station2 of allStations) {
        if (station1.id === station2.id) continue;

        totalPairsChecked++;

        if (Math.abs(station2.frequency - neededF2) <= tolerance) {
          // Create a unique key for this pair (smaller id first)
          const pairKey = station1.id < station2.id
            ? `${station1.id}-${station2.id}`
            : `${station2.id}-${station1.id}`;

          if (!foundPairKeys.has(pairKey)) {
            foundPairKeys.add(pairKey);

            const products = calculateThirdOrderProducts(f1, station2.frequency);
            const aviationProducts = products.filter(
              (p) => Math.abs(p.frequency - targetFrequency) <= tolerance
            );

            if (aviationProducts.length > 0) {
              const distance = calculateDistance(
                station1.latitude,
                station1.longitude,
                station2.latitude,
                station2.longitude
              );

              dangerousPairs.push({
                station1,
                station2,
                distance,
                products,
                aviationProducts,
              });
            }
          }
        }
      }
    }
  }

  const calculationTimeMs = performance.now() - startTime;

  return {
    totalPairsChecked,
    dangerousPairs,
    calculationTimeMs,
  };
}

/**
 * Assess interference risk for each dangerous pair
 * @param dangerousPairs Array of dangerous intermod pairs
 * @param aircraftData Optional aircraft data for enhanced assessment
 * @returns Array of risk assessments sorted by risk level
 */
export function assessInterferenceRisk(
  dangerousPairs: IntermodPair[],
  aircraftData?: AircraftInput
): InterferenceRisk[] {
  const riskAssessments: InterferenceRisk[] = [];

  for (const pair of dangerousPairs) {
    for (const product of pair.aviationProducts) {
      // Calculate frequency delta if target frequency provided
      let frequencyDelta = 0;
      if (aircraftData?.frequency) {
        frequencyDelta = Math.abs(product.frequency - aircraftData.frequency);
      }

      // Calculate distance to aircraft if location provided
      let distanceToAircraft: number | undefined;
      let lineOfSight = true;

      if (
        aircraftData?.latitude !== undefined &&
        aircraftData?.longitude !== undefined
      ) {
        // Use midpoint between stations for distance calculation
        const midLat = (pair.station1.latitude + pair.station2.latitude) / 2;
        const midLon = (pair.station1.longitude + pair.station2.longitude) / 2;

        distanceToAircraft = calculateDistance(
          midLat,
          midLon,
          aircraftData.latitude,
          aircraftData.longitude
        );

        // Check line of sight if altitude provided
        if (aircraftData.altitude) {
          // Assume average station height of 100m
          const losDistance = calculateLineOfSight(100, aircraftData.altitude);
          lineOfSight = distanceToAircraft <= losDistance;
        }
      }

      // Calculate risk level and score
      const { riskLevel, riskScore } = calculateRiskLevel(
        product,
        pair,
        frequencyDelta,
        distanceToAircraft,
        lineOfSight
      );

      riskAssessments.push({
        pair,
        targetFrequency: product.frequency,
        frequencyDelta,
        distanceToAircraft,
        lineOfSight,
        combinedPower:
          (pair.station1.transmitterPower || 0) +
          (pair.station2.transmitterPower || 0),
        riskLevel,
        riskScore,
      });
    }
  }

  // Sort by risk score (highest first)
  return riskAssessments.sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Calculate risk level based on various factors
 */
function calculateRiskLevel(
  product: IntermodProduct,
  pair: IntermodPair,
  frequencyDelta: number,
  distanceToAircraft?: number,
  lineOfSight?: boolean
): { riskLevel: RiskLevel; riskScore: number } {
  let score = 0;

  // Emergency frequency is always critical
  if (product.affectedService === 'Emergency') {
    score += 100;
  } else if (product.affectedService === 'VOR/ILS') {
    score += 80;
  } else if (product.affectedService === 'ATC Voice') {
    score += 60;
  }

  // Closer stations = higher risk (stronger intermod)
  if (pair.distance < 5) {
    score += 40;
  } else if (pair.distance < 10) {
    score += 30;
  } else if (pair.distance < 20) {
    score += 20;
  } else if (pair.distance < 50) {
    score += 10;
  }

  // Frequency match proximity
  if (frequencyDelta > 0) {
    if (frequencyDelta < 0.05) {
      score += 30; // Exact match
    } else if (frequencyDelta < 0.2) {
      score += 20;
    } else if (frequencyDelta < 0.5) {
      score += 10;
    }
  }

  // Distance to aircraft
  if (distanceToAircraft !== undefined) {
    if (distanceToAircraft < 50) {
      score += 30;
    } else if (distanceToAircraft < 100) {
      score += 20;
    } else if (distanceToAircraft < 200) {
      score += 10;
    }
  }

  // Line of sight
  if (lineOfSight === false) {
    score -= 30; // Reduce score if not in line of sight
  }

  // Combined transmitter power (if available)
  const combinedPower =
    (pair.station1.transmitterPower || 0) + (pair.station2.transmitterPower || 0);
  if (combinedPower > 20000) {
    score += 20;
  } else if (combinedPower > 10000) {
    score += 15;
  } else if (combinedPower > 5000) {
    score += 10;
  }

  // Determine risk level from score
  let riskLevel: RiskLevel;
  if (score >= 120) {
    riskLevel = 'CRITICAL';
  } else if (score >= 80) {
    riskLevel = 'HIGH';
  } else if (score >= 50) {
    riskLevel = 'MEDIUM';
  } else {
    riskLevel = 'LOW';
  }

  return { riskLevel, riskScore: score };
}

/**
 * Generate a summary of dangerous pairs by affected service
 */
export function summarizeByService(
  riskAssessments: InterferenceRisk[]
): Record<AviationService, number> {
  const summary: Record<AviationService, number> = {
    'VOR/ILS': 0,
    'Emergency': 0,
    'ATC Voice': 0,
  };

  for (const assessment of riskAssessments) {
    const service = getAffectedService(assessment.targetFrequency);
    if (service) {
      summary[service]++;
    }
  }

  return summary;
}

/**
 * Filter risk assessments by criteria
 */
export function filterRiskAssessments(
  assessments: InterferenceRisk[],
  options: {
    minRiskLevel?: RiskLevel;
    service?: AviationService;
    maxDistance?: number;
    targetFrequency?: number;
  }
): InterferenceRisk[] {
  const riskLevelOrder: Record<RiskLevel, number> = {
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3,
    'CRITICAL': 4,
  };

  return assessments.filter((a) => {
    if (options.minRiskLevel) {
      if (riskLevelOrder[a.riskLevel] < riskLevelOrder[options.minRiskLevel]) {
        return false;
      }
    }

    if (options.service) {
      const service = getAffectedService(a.targetFrequency);
      if (service !== options.service) {
        return false;
      }
    }

    if (options.maxDistance !== undefined && a.distanceToAircraft !== undefined) {
      if (a.distanceToAircraft > options.maxDistance) {
        return false;
      }
    }

    if (options.targetFrequency !== undefined) {
      if (Math.abs(a.targetFrequency - options.targetFrequency) > 0.1) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Format frequency for display
 */
export function formatFrequency(freq: number): string {
  return freq.toFixed(2) + ' MHz';
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return (distanceKm * 1000).toFixed(0) + ' m';
  }
  return distanceKm.toFixed(1) + ' km';
}

/**
 * Get risk level color for UI display
 */
export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL':
      return 'text-red-500';
    case 'HIGH':
      return 'text-orange-500';
    case 'MEDIUM':
      return 'text-yellow-500';
    case 'LOW':
      return 'text-green-500';
  }
}

/**
 * Get risk level background color for UI display
 */
export function getRiskLevelBgColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL':
      return 'bg-red-500/20 border-red-500/50';
    case 'HIGH':
      return 'bg-orange-500/20 border-orange-500/50';
    case 'MEDIUM':
      return 'bg-yellow-500/20 border-yellow-500/50';
    case 'LOW':
      return 'bg-green-500/20 border-green-500/50';
  }
}
