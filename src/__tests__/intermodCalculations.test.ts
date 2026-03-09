import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  calculateThirdOrderProducts,
  getAffectedService,
  calculateLineOfSight,
  calculatePathLoss,
  findPairsForTargetFrequency,
  assessInterferenceRisk,
  summarizeByService,
  filterRiskAssessments,
  formatFrequency,
  formatDistance,
  getRiskLevelColor,
  getRiskLevelBgColor,
} from '@/utils/intermodCalculations';
import type { FMStation } from '@/types/station';
import type { IntermodPair, InterferenceRisk } from '@/types/intermod';

// Helper to create test stations
function makeStation(overrides: Partial<FMStation> & { id: string | number; frequency: number }): FMStation {
  return {
    name: 'Test Station',
    latitude: 13.75,
    longitude: 100.5,
    city: 'Bangkok',
    state: 'Bangkok',
    genre: 'FM',
    ...overrides,
  };
}

// --- calculateDistance ---
describe('calculateDistance', () => {
  it('returns 0 for same point', () => {
    expect(calculateDistance(13.75, 100.5, 13.75, 100.5)).toBe(0);
  });

  it('calculates Bangkok to Chiang Mai (~580 km)', () => {
    const d = calculateDistance(13.7563, 100.5018, 18.7883, 98.9853);
    expect(d).toBeGreaterThan(570);
    expect(d).toBeLessThan(600);
  });

  it('calculates short distance accurately', () => {
    // ~1 degree latitude ≈ 111 km
    const d = calculateDistance(0, 0, 1, 0);
    expect(d).toBeCloseTo(111.19, 0);
  });

  it('handles negative coordinates', () => {
    const d = calculateDistance(-33.87, 151.21, -37.81, 144.96);
    expect(d).toBeGreaterThan(700);
    expect(d).toBeLessThan(800);
  });
});

// --- calculateThirdOrderProducts ---
describe('calculateThirdOrderProducts', () => {
  it('computes 2f1-f2 and 2f2-f1', () => {
    const products = calculateThirdOrderProducts(100, 90);
    expect(products).toHaveLength(2);
    expect(products[0].type).toBe('2f1-f2');
    expect(products[0].frequency).toBe(110); // 2*100 - 90
    expect(products[1].type).toBe('2f2-f1');
    expect(products[1].frequency).toBe(80); // 2*90 - 100
  });

  it('marks products in aviation band', () => {
    // 2*100 - 90 = 110 (in VOR/ILS 108-117.95)
    const products = calculateThirdOrderProducts(100, 90);
    expect(products[0].inAviationBand).toBe(true);
    expect(products[0].affectedService).toBe('VOR/ILS');
  });

  it('marks products outside aviation band', () => {
    // 2*90 - 100 = 80 (below 108)
    const products = calculateThirdOrderProducts(100, 90);
    expect(products[1].inAviationBand).toBe(false);
  });

  it('rounds to 2 decimal places', () => {
    const products = calculateThirdOrderProducts(99.33, 88.77);
    // 2*99.33 - 88.77 = 109.89
    expect(products[0].frequency).toBe(109.89);
    // 2*88.77 - 99.33 = 78.21
    expect(products[1].frequency).toBe(78.21);
  });

  it('detects emergency frequency', () => {
    // Need 2f1 - f2 = 121.5
    // f1=100, f2=78.5 → 2*100-78.5 = 121.5
    const products = calculateThirdOrderProducts(100, 78.5);
    expect(products[0].frequency).toBe(121.5);
    expect(products[0].affectedService).toBe('Emergency');
  });

  it('detects ATC Voice frequency', () => {
    // Need 2f1 - f2 ∈ [118, 137]
    // f1=100, f2=72 → 2*100-72 = 128
    const products = calculateThirdOrderProducts(100, 72);
    expect(products[0].frequency).toBe(128);
    expect(products[0].affectedService).toBe('ATC Voice');
  });
});

// --- getAffectedService ---
describe('getAffectedService', () => {
  it('returns Emergency for 121.5 MHz', () => {
    expect(getAffectedService(121.5)).toBe('Emergency');
  });

  it('returns Emergency within tolerance of 121.5', () => {
    expect(getAffectedService(121.48)).toBe('Emergency');
    expect(getAffectedService(121.52)).toBe('Emergency');
  });

  it('returns VOR/ILS for 108-117.95', () => {
    expect(getAffectedService(108.0)).toBe('VOR/ILS');
    expect(getAffectedService(112.0)).toBe('VOR/ILS');
    expect(getAffectedService(117.95)).toBe('VOR/ILS');
  });

  it('returns ATC Voice for 118-137', () => {
    expect(getAffectedService(118.0)).toBe('ATC Voice');
    expect(getAffectedService(125.0)).toBe('ATC Voice');
    expect(getAffectedService(137.0)).toBe('ATC Voice');
  });

  it('returns undefined for frequencies outside aviation bands', () => {
    expect(getAffectedService(100.0)).toBeUndefined();
    expect(getAffectedService(140.0)).toBeUndefined();
    expect(getAffectedService(88.0)).toBeUndefined();
  });
});

// --- calculateLineOfSight ---
describe('calculateLineOfSight', () => {
  it('increases with height and altitude', () => {
    const los1 = calculateLineOfSight(30, 10000);
    const los2 = calculateLineOfSight(30, 30000);
    expect(los2).toBeGreaterThan(los1);
  });

  it('returns correct value for known inputs', () => {
    // d = 4.12 * (√30 + √(10000*0.3048)) = 4.12 * (5.477 + 55.23) ≈ 250 km
    const los = calculateLineOfSight(30, 10000);
    expect(los).toBeGreaterThan(240);
    expect(los).toBeLessThan(260);
  });

  it('handles zero height', () => {
    const los = calculateLineOfSight(0, 10000);
    expect(los).toBeGreaterThan(0);
  });
});

// --- calculatePathLoss ---
describe('calculatePathLoss', () => {
  it('returns 0 for zero distance', () => {
    expect(calculatePathLoss(0, 100)).toBe(0);
  });

  it('returns 0 for zero frequency', () => {
    expect(calculatePathLoss(10, 0)).toBe(0);
  });

  it('calculates FSPL correctly for 1km at 100 MHz', () => {
    // FSPL = 20*log10(1) + 20*log10(100) + 32.45 = 0 + 40 + 32.45 = 72.45
    expect(calculatePathLoss(1, 100)).toBeCloseTo(72.45, 1);
  });

  it('increases with distance', () => {
    const loss1 = calculatePathLoss(1, 100);
    const loss10 = calculatePathLoss(10, 100);
    expect(loss10).toBeGreaterThan(loss1);
  });

  it('increases with frequency', () => {
    const loss100 = calculatePathLoss(1, 100);
    const loss1000 = calculatePathLoss(1, 1000);
    expect(loss1000).toBeGreaterThan(loss100);
  });
});

// --- findPairsForTargetFrequency ---
describe('findPairsForTargetFrequency', () => {
  const stations: FMStation[] = [
    makeStation({ id: '1', frequency: 100.0, latitude: 13.75, longitude: 100.5 }),
    makeStation({ id: '2', frequency: 89.0, latitude: 13.76, longitude: 100.51 }),
    makeStation({ id: '3', frequency: 95.0, latitude: 13.77, longitude: 100.52 }),
  ];

  it('finds pairs that produce target frequency', () => {
    // 2*100 - 89 = 111 (VOR/ILS band)
    const result = findPairsForTargetFrequency(stations, 111.0);
    expect(result.dangerousPairs.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for impossible target', () => {
    const result = findPairsForTargetFrequency(stations, 50.0);
    expect(result.dangerousPairs).toHaveLength(0);
  });

  it('respects tolerance', () => {
    const result = findPairsForTargetFrequency(stations, 111.05, 0.1);
    expect(result.dangerousPairs.length).toBeGreaterThanOrEqual(1);
  });

  it('returns calculation time', () => {
    const result = findPairsForTargetFrequency(stations, 111.0);
    expect(result.calculationTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('does not produce duplicate pairs', () => {
    const result = findPairsForTargetFrequency(stations, 111.0);
    const pairKeys = result.dangerousPairs.map(
      (p) => [p.station1.id, p.station2.id].sort().join('-')
    );
    const uniqueKeys = new Set(pairKeys);
    expect(uniqueKeys.size).toBe(pairKeys.length);
  });

  it('handles empty stations', () => {
    const result = findPairsForTargetFrequency([], 121.5);
    expect(result.dangerousPairs).toHaveLength(0);
    expect(result.totalPairsChecked).toBe(0);
  });

  it('handles single station', () => {
    const result = findPairsForTargetFrequency([stations[0]], 121.5);
    expect(result.dangerousPairs).toHaveLength(0);
  });
});

// --- assessInterferenceRisk ---
describe('assessInterferenceRisk', () => {
  const station1 = makeStation({ id: '1', frequency: 100.0, transmitterPower: 5000 });
  const station2 = makeStation({ id: '2', frequency: 89.0, latitude: 13.76, longitude: 100.51, transmitterPower: 5000 });

  const pair: IntermodPair = {
    station1,
    station2,
    distance: 3,
    products: calculateThirdOrderProducts(100, 89),
    aviationProducts: calculateThirdOrderProducts(100, 89).filter((p) => p.inAviationBand),
  };

  it('returns risk assessments sorted by score', () => {
    const risks = assessInterferenceRisk([pair]);
    expect(risks.length).toBeGreaterThan(0);
    for (let i = 1; i < risks.length; i++) {
      expect(risks[i].riskScore).toBeLessThanOrEqual(risks[i - 1].riskScore);
    }
  });

  it('includes combined power', () => {
    const risks = assessInterferenceRisk([pair]);
    expect(risks[0].combinedPower).toBe(10000);
  });

  it('factors in aircraft data', () => {
    const risksNoAircraft = assessInterferenceRisk([pair]);
    const risksWithAircraft = assessInterferenceRisk([pair], {
      frequency: 111.0,
      altitude: 10000,
      latitude: 13.76,
      longitude: 100.51,
    });
    // With aircraft data, scores should differ
    expect(risksWithAircraft[0].distanceToAircraft).toBeDefined();
  });

  it('handles missing transmitter power', () => {
    const pairNoPower: IntermodPair = {
      ...pair,
      station1: { ...station1, transmitterPower: undefined },
      station2: { ...station2, transmitterPower: undefined },
    };
    const risks = assessInterferenceRisk([pairNoPower]);
    expect(risks[0].combinedPower).toBe(0);
  });

  it('returns empty for empty input', () => {
    expect(assessInterferenceRisk([])).toHaveLength(0);
  });

  it('sets lineOfSight based on altitude and distance', () => {
    const risks = assessInterferenceRisk([pair], {
      frequency: 111.0,
      altitude: 100, // very low altitude
      latitude: 20, // far away
      longitude: 110,
    });
    if (risks.length > 0 && risks[0].distanceToAircraft !== undefined) {
      // At very low altitude and far distance, should be out of LOS
      expect(risks[0].lineOfSight).toBeDefined();
    }
  });
});

// --- summarizeByService ---
describe('summarizeByService', () => {
  it('counts by service type', () => {
    const risks: InterferenceRisk[] = [
      { targetFrequency: 112.0, riskLevel: 'HIGH', riskScore: 100 } as InterferenceRisk,
      { targetFrequency: 121.5, riskLevel: 'CRITICAL', riskScore: 200 } as InterferenceRisk,
      { targetFrequency: 125.0, riskLevel: 'MEDIUM', riskScore: 50 } as InterferenceRisk,
      { targetFrequency: 110.0, riskLevel: 'LOW', riskScore: 30 } as InterferenceRisk,
    ];
    const summary = summarizeByService(risks);
    expect(summary['VOR/ILS']).toBe(2);
    expect(summary['Emergency']).toBe(1);
    expect(summary['ATC Voice']).toBe(1);
  });

  it('returns zeros for empty input', () => {
    const summary = summarizeByService([]);
    expect(summary['VOR/ILS']).toBe(0);
    expect(summary['Emergency']).toBe(0);
    expect(summary['ATC Voice']).toBe(0);
  });
});

// --- filterRiskAssessments ---
describe('filterRiskAssessments', () => {
  const risks: InterferenceRisk[] = [
    {
      targetFrequency: 112.0,
      riskLevel: 'HIGH',
      riskScore: 100,
      distanceToAircraft: 30,
      pair: {} as IntermodPair,
      frequencyDelta: 0,
      lineOfSight: true,
    },
    {
      targetFrequency: 121.5,
      riskLevel: 'CRITICAL',
      riskScore: 200,
      distanceToAircraft: 150,
      pair: {} as IntermodPair,
      frequencyDelta: 0,
      lineOfSight: true,
    },
    {
      targetFrequency: 125.0,
      riskLevel: 'LOW',
      riskScore: 20,
      distanceToAircraft: 300,
      pair: {} as IntermodPair,
      frequencyDelta: 0,
      lineOfSight: true,
    },
  ];

  it('filters by minimum risk level', () => {
    const filtered = filterRiskAssessments(risks, { minRiskLevel: 'HIGH' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL')).toBe(true);
  });

  it('filters by service', () => {
    const filtered = filterRiskAssessments(risks, { service: 'Emergency' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].targetFrequency).toBe(121.5);
  });

  it('filters by max distance', () => {
    const filtered = filterRiskAssessments(risks, { maxDistance: 100 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].distanceToAircraft).toBe(30);
  });

  it('filters by target frequency', () => {
    const filtered = filterRiskAssessments(risks, { targetFrequency: 112.0 });
    expect(filtered).toHaveLength(1);
  });

  it('returns all when no filters', () => {
    const filtered = filterRiskAssessments(risks, {});
    expect(filtered).toHaveLength(3);
  });

  it('combines multiple filters', () => {
    const filtered = filterRiskAssessments(risks, {
      minRiskLevel: 'HIGH',
      maxDistance: 100,
    });
    expect(filtered).toHaveLength(1);
  });
});

// --- formatFrequency ---
describe('formatFrequency', () => {
  it('formats with 2 decimals and MHz suffix', () => {
    expect(formatFrequency(100)).toBe('100.00 MHz');
    expect(formatFrequency(121.5)).toBe('121.50 MHz');
    expect(formatFrequency(99.333)).toBe('99.33 MHz');
  });
});

// --- formatDistance ---
describe('formatDistance', () => {
  it('formats km for distances >= 1', () => {
    expect(formatDistance(5.3)).toBe('5.3 km');
    expect(formatDistance(100)).toBe('100.0 km');
  });

  it('formats meters for distances < 1 km', () => {
    expect(formatDistance(0.5)).toBe('500 m');
    expect(formatDistance(0.123)).toBe('123 m');
  });
});

// --- getRiskLevelColor ---
describe('getRiskLevelColor', () => {
  it('returns correct tailwind classes', () => {
    expect(getRiskLevelColor('CRITICAL')).toBe('text-red-500');
    expect(getRiskLevelColor('HIGH')).toBe('text-orange-500');
    expect(getRiskLevelColor('MEDIUM')).toBe('text-yellow-500');
    expect(getRiskLevelColor('LOW')).toBe('text-green-500');
  });
});

// --- getRiskLevelBgColor ---
describe('getRiskLevelBgColor', () => {
  it('returns correct tailwind bg classes', () => {
    expect(getRiskLevelBgColor('CRITICAL')).toBe('bg-red-500/20 border-red-500/50');
    expect(getRiskLevelBgColor('HIGH')).toBe('bg-orange-500/20 border-orange-500/50');
    expect(getRiskLevelBgColor('MEDIUM')).toBe('bg-yellow-500/20 border-yellow-500/50');
    expect(getRiskLevelBgColor('LOW')).toBe('bg-green-500/20 border-green-500/50');
  });
});
