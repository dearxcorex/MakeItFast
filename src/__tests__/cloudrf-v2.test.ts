import { describe, it, expect } from 'vitest';
import { buildAreaPayload, buildPathPayloadV2, buildMultisitePayload } from '@/utils/cloudrf';
import type { InterferenceSite } from '@/types/interference';

const mockSite: InterferenceSite = {
  id: 1,
  siteCode: 'TEST01',
  siteName: 'Test Site',
  lat: 14.87862,
  long: 103.4815,
  mcZone: 'SRN',
  changwat: 'สุรินทร์',
  cellName: 'TESTN2613',
  sectorName: 'TEST_3',
  direction: 120,
  avgNiCarrier: -79.04,
  dayTime: -77,
  nightTime: -79.29,
  sourceLat: 14.878764,
  sourceLong: 103.481064,
  estimateDistance: 0.05,
  ranking: 'Critical',
  status: 'High interference',
  nbtcArea: 'NBTC-22',
  awnContact: null,
  lot: null,
  onSiteScanBy: null,
  onSiteScanDate: null,
  checkRealtime: null,
  sourceLocation1: null,
  sourceLocation2: null,
  cameraModel1: null,
  cameraModel2: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('buildAreaPayload v2 - ECC33 + Tropical defaults', () => {
  it('uses ECC33 propagation model (pm: 9)', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.model.pm).toBe(7);
  });

  it('uses Tropical climate', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.environment.clt).toBe('Tropical.clt');
  });

  it('enables landcover (clutter)', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.environment.landcover).toBe(1);
  });

  it('enables buildings', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.environment.buildings).toBe(1);
  });

  it('enables knife-edge diffraction', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.model.ked).toBe(1);
  });

  it('uses 20 MHz LTE bandwidth', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter.bwi).toBe(20);
  });

  it('uses directional antenna (ant: 1)', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter.ant).toBe(1);
  });

  it('sets downtilt from default profile (6deg for urban)', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter.tlt).toBe(6);
  });

  it('sets rx sensitivity to -100 dBm', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.receiver.rxs).toBe(-100);
  });

  it('sets rx gain to 0 dBi', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.receiver.rxg).toBe(0);
  });

  it('sets noise floor to -96 dBm', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.output.nf).toBe(-96);
  });

  it('sets rx height to 1.5m', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.receiver.alt).toBe(1.5);
  });

  it('includes antenna gain (txg)', () => {
    const payload = buildAreaPayload(mockSite);
    expect(payload.transmitter.txg).toBe(17);
  });
});

describe('buildAreaPayload v2 - profile-aware', () => {
  it('uses macro_urban profile defaults', () => {
    const payload = buildAreaPayload(mockSite, { profile: 'macro_urban' });
    expect(payload.transmitter.alt).toBe(30);
    expect(payload.transmitter.txw).toBe(20);
    expect(payload.transmitter.txg).toBe(17);
    expect(payload.transmitter.tlt).toBe(6);
  });

  it('uses macro_suburban profile defaults', () => {
    const payload = buildAreaPayload(mockSite, { profile: 'macro_suburban' });
    expect(payload.transmitter.alt).toBe(45);
    expect(payload.transmitter.txw).toBe(20);
    expect(payload.transmitter.txg).toBe(18);
    expect(payload.transmitter.tlt).toBe(4);
  });

  it('uses macro_rural profile defaults', () => {
    const payload = buildAreaPayload(mockSite, { profile: 'macro_rural' });
    expect(payload.transmitter.alt).toBe(55);
    expect(payload.transmitter.txw).toBe(40);
    expect(payload.transmitter.txg).toBe(18);
    expect(payload.transmitter.tlt).toBe(3);
  });

  it('allows overriding profile values', () => {
    const payload = buildAreaPayload(mockSite, {
      profile: 'macro_urban',
      alt: 80,
      txw: 50,
      antennaGain: 20,
      downtilt: 10,
    });
    expect(payload.transmitter.alt).toBe(80);
    expect(payload.transmitter.txw).toBe(50);
    expect(payload.transmitter.txg).toBe(20);
    expect(payload.transmitter.tlt).toBe(10);
  });

  it('allows environment overrides', () => {
    const payload = buildAreaPayload(mockSite, {
      environment: { propagationModel: 7, buildings: 0 },
    });
    expect(payload.model.pm).toBe(7);
    expect(payload.environment.buildings).toBe(0);
    expect(payload.environment.clt).toBe('Tropical.clt'); // default preserved
  });
});

describe('buildPathPayloadV2', () => {
  const from = { lat: 14.87862, lon: 103.4815 };
  const to = { lat: 14.878764, lon: 103.481064 };

  it('uses ECC33 propagation model', () => {
    const payload = buildPathPayloadV2(from, to);
    expect(payload.model.pm).toBe(7);
  });

  it('uses Tropical climate', () => {
    const payload = buildPathPayloadV2(from, to);
    expect(payload.environment.clt).toBe('Tropical.clt');
  });

  it('sets from/to coordinates', () => {
    const payload = buildPathPayloadV2(from, to);
    expect(payload.transmitter.lat).toBe(from.lat);
    expect(payload.transmitter.lon).toBe(from.lon);
    expect(payload.receiver.lat).toBe(to.lat);
    expect(payload.receiver.lon).toBe(to.lon);
  });

  it('uses directional antenna', () => {
    const payload = buildPathPayloadV2(from, to);
    expect(payload.transmitter.ant).toBe(1);
  });

  it('uses LTE receiver parameters', () => {
    const payload = buildPathPayloadV2(from, to);
    expect(payload.receiver.rxs).toBe(-100);
    expect(payload.receiver.rxg).toBe(0);
    expect(payload.receiver.alt).toBe(1.5);
  });

  it('respects profile option', () => {
    const payload = buildPathPayloadV2(from, to, { profile: 'macro_rural' });
    expect(payload.transmitter.alt).toBe(55);
    expect(payload.transmitter.txw).toBe(40);
  });

  it('respects environment overrides', () => {
    const payload = buildPathPayloadV2(from, to, {
      environment: { propagationModel: 11 },
    });
    expect(payload.model.pm).toBe(11);
  });
});

describe('buildMultisitePayload', () => {
  const testSites = [
    { lat: 14.87862, lon: 103.4815, azi: 120 },
    { lat: 14.9, lon: 103.5, azi: 240 },
  ];

  it('creates payload with all transmitters', () => {
    const payload = buildMultisitePayload(testSites);
    expect(payload.transmitters).toHaveLength(2);
  });

  it('uses ECC33 propagation model', () => {
    const payload = buildMultisitePayload(testSites);
    expect(payload.model.pm).toBe(7);
  });

  it('uses Tropical climate', () => {
    const payload = buildMultisitePayload(testSites);
    expect(payload.environment.clt).toBe('Tropical.clt');
  });

  it('uses directional antennas for all transmitters', () => {
    const payload = buildMultisitePayload(testSites);
    payload.transmitters.forEach((tx) => {
      expect(tx.ant).toBe(1);
    });
  });

  it('sets correct coordinates per transmitter', () => {
    const payload = buildMultisitePayload(testSites);
    expect(payload.transmitters[0].lat).toBe(14.87862);
    expect(payload.transmitters[1].lat).toBe(14.9);
  });

  it('sets correct azimuth per transmitter', () => {
    const payload = buildMultisitePayload(testSites);
    expect(payload.transmitters[0].azi).toBe(120);
    expect(payload.transmitters[1].azi).toBe(240);
  });

  it('uses LTE receiver parameters', () => {
    const payload = buildMultisitePayload(testSites);
    expect(payload.receiver.rxs).toBe(-100);
    expect(payload.receiver.rxg).toBe(0);
    expect(payload.receiver.alt).toBe(1.5);
  });

  it('respects per-site profile', () => {
    const sitesWithProfiles = [
      { lat: 14.87, lon: 103.48, profile: 'macro_rural' as const },
    ];
    const payload = buildMultisitePayload(sitesWithProfiles);
    expect(payload.transmitters[0].alt).toBe(55);
    expect(payload.transmitters[0].txw).toBe(40);
  });

  it('respects radius option', () => {
    const payload = buildMultisitePayload(testSites, { radius: 10 });
    expect(payload.output.rad).toBe(10);
  });

  it('respects environment overrides', () => {
    const payload = buildMultisitePayload(testSites, {
      environment: { buildings: 0 },
    });
    expect(payload.environment.buildings).toBe(0);
    expect(payload.environment.landcover).toBe(1); // default preserved
  });
});
