import { describe, it, expect } from 'vitest';
import {
  EQUIPMENT_PROFILES,
  THAILAND_ENVIRONMENT,
  LTE_UE_RECEIVER,
  PROPAGATION_MODELS,
  getProfile,
  getEnvironmentOverrides,
} from '@/utils/equipmentProfiles';
import type { DeploymentType } from '@/types/interference';

describe('EQUIPMENT_PROFILES', () => {
  const profileTypes: DeploymentType[] = ['macro_urban', 'macro_suburban', 'macro_rural'];

  it('has all three deployment types', () => {
    profileTypes.forEach((type) => {
      expect(EQUIPMENT_PROFILES[type]).toBeDefined();
    });
  });

  it.each(profileTypes)('%s has valid power range (1-100W)', (type) => {
    const profile = EQUIPMENT_PROFILES[type];
    expect(profile.txPower).toBeGreaterThanOrEqual(1);
    expect(profile.txPower).toBeLessThanOrEqual(100);
  });

  it.each(profileTypes)('%s has valid antenna gain (0-25 dBi)', (type) => {
    const profile = EQUIPMENT_PROFILES[type];
    expect(profile.antennaGain).toBeGreaterThanOrEqual(0);
    expect(profile.antennaGain).toBeLessThanOrEqual(25);
  });

  it.each(profileTypes)('%s has valid antenna height (10-100m)', (type) => {
    const profile = EQUIPMENT_PROFILES[type];
    expect(profile.antennaHeight).toBeGreaterThanOrEqual(10);
    expect(profile.antennaHeight).toBeLessThanOrEqual(100);
  });

  it.each(profileTypes)('%s has valid horizontal beamwidth (30-120deg)', (type) => {
    const profile = EQUIPMENT_PROFILES[type];
    expect(profile.hBeamwidth).toBeGreaterThanOrEqual(30);
    expect(profile.hBeamwidth).toBeLessThanOrEqual(120);
  });

  it.each(profileTypes)('%s has valid downtilt (0-15deg)', (type) => {
    const profile = EQUIPMENT_PROFILES[type];
    expect(profile.downtilt).toBeGreaterThanOrEqual(0);
    expect(profile.downtilt).toBeLessThanOrEqual(15);
  });

  it.each(profileTypes)('%s has 20 MHz LTE bandwidth', (type) => {
    expect(EQUIPMENT_PROFILES[type].bandwidth).toBe(20);
  });

  it('macro_urban has specific values', () => {
    const p = EQUIPMENT_PROFILES.macro_urban;
    expect(p.txPower).toBe(20);
    expect(p.antennaGain).toBe(17);
    expect(p.antennaHeight).toBe(30);
    expect(p.downtilt).toBe(6);
  });

  it('macro_suburban has specific values', () => {
    const p = EQUIPMENT_PROFILES.macro_suburban;
    expect(p.txPower).toBe(20);
    expect(p.antennaGain).toBe(18);
    expect(p.antennaHeight).toBe(45);
    expect(p.downtilt).toBe(4);
  });

  it('macro_rural has specific values', () => {
    const p = EQUIPMENT_PROFILES.macro_rural;
    expect(p.txPower).toBe(40);
    expect(p.antennaGain).toBe(18);
    expect(p.antennaHeight).toBe(55);
    expect(p.downtilt).toBe(3);
  });
});

describe('THAILAND_ENVIRONMENT', () => {
  it('uses Tropical climate', () => {
    expect(THAILAND_ENVIRONMENT.climate).toBe('Tropical.clt');
  });

  it('uses ITM/Longley-Rice propagation model (7)', () => {
    expect(THAILAND_ENVIRONMENT.propagationModel).toBe(7);
  });

  it('enables landcover', () => {
    expect(THAILAND_ENVIRONMENT.landcover).toBe(1);
  });

  it('enables buildings', () => {
    expect(THAILAND_ENVIRONMENT.buildings).toBe(1);
  });

  it('enables diffraction', () => {
    expect(THAILAND_ENVIRONMENT.diffraction).toBe(1);
  });

  it('has 95% reliability', () => {
    expect(THAILAND_ENVIRONMENT.reliability).toBe(95);
  });
});

describe('LTE_UE_RECEIVER', () => {
  it('has -100 dBm sensitivity', () => {
    expect(LTE_UE_RECEIVER.rxSensitivity).toBe(-100);
  });

  it('has 0 dBi gain (handheld)', () => {
    expect(LTE_UE_RECEIVER.rxGain).toBe(0);
  });

  it('has 1.5m height', () => {
    expect(LTE_UE_RECEIVER.rxHeight).toBe(1.5);
  });

  it('has -96 dBm noise floor', () => {
    expect(LTE_UE_RECEIVER.noiseFloor).toBe(-96);
  });
});

describe('PROPAGATION_MODELS', () => {
  it('includes Ericsson 9999', () => {
    expect(PROPAGATION_MODELS[9]).toContain('Ericsson');
  });

  it('includes ITM', () => {
    expect(PROPAGATION_MODELS[7]).toContain('ITM');
  });

  it('includes Free Space', () => {
    expect(PROPAGATION_MODELS[11]).toContain('Free Space');
  });
});

describe('getProfile', () => {
  it('returns correct profile for each type', () => {
    expect(getProfile('macro_urban')).toBe(EQUIPMENT_PROFILES.macro_urban);
    expect(getProfile('macro_suburban')).toBe(EQUIPMENT_PROFILES.macro_suburban);
    expect(getProfile('macro_rural')).toBe(EQUIPMENT_PROFILES.macro_rural);
  });
});

describe('getEnvironmentOverrides', () => {
  it('returns Thailand defaults with no overrides', () => {
    const env = getEnvironmentOverrides();
    expect(env).toEqual(THAILAND_ENVIRONMENT);
  });

  it('merges overrides with defaults', () => {
    const env = getEnvironmentOverrides({ propagationModel: 7, buildings: 0 });
    expect(env.propagationModel).toBe(7);
    expect(env.buildings).toBe(0);
    expect(env.climate).toBe('Tropical.clt');
    expect(env.landcover).toBe(1);
  });
});
