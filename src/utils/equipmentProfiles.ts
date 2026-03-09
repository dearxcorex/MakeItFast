import type { DeploymentType, EquipmentProfile, EnvironmentConfig } from '@/types/interference';

export const EQUIPMENT_PROFILES: Record<DeploymentType, EquipmentProfile> = {
  macro_urban: {
    name: 'Macro Urban',
    deploymentType: 'macro_urban',
    txPower: 20,
    antennaGain: 17,
    antennaHeight: 30,
    hBeamwidth: 65,
    vBeamwidth: 7,
    downtilt: 6,
    bandwidth: 20,
    feederLoss: 2,
  },
  macro_suburban: {
    name: 'Macro Suburban',
    deploymentType: 'macro_suburban',
    txPower: 20,
    antennaGain: 18,
    antennaHeight: 45,
    hBeamwidth: 65,
    vBeamwidth: 7,
    downtilt: 4,
    bandwidth: 20,
    feederLoss: 2,
  },
  macro_rural: {
    name: 'Macro Rural',
    deploymentType: 'macro_rural',
    txPower: 40,
    antennaGain: 18,
    antennaHeight: 55,
    hBeamwidth: 65,
    vBeamwidth: 6,
    downtilt: 3,
    bandwidth: 20,
    feederLoss: 2,
  },
};

export const THAILAND_ENVIRONMENT: EnvironmentConfig = {
  climate: 'Tropical.clt',
  landcover: 1,
  buildings: 1,
  propagationModel: 7,  // ITM/Longley-Rice (20 MHz - 40 GHz, terrain-aware)
  diffraction: 1,
  reliability: 95,
};

export const LTE_UE_RECEIVER = {
  rxSensitivity: -100,  // dBm (3GPP LTE UE)
  rxGain: 0,            // dBi (handheld)
  rxHeight: 1.5,        // meters
  noiseFloor: -96,       // dBm (kTB + NF)
};

export const PROPAGATION_MODELS: Record<number, string> = {
  7: 'ITM / Longley-Rice (20 MHz - 40 GHz)',
  11: 'ITU-R P.525 Free Space',
  1: 'Hata (150-1500 MHz)',
  9: 'Ericsson 9999 (150-1900 MHz)',
};

export function getProfile(type: DeploymentType): EquipmentProfile {
  return EQUIPMENT_PROFILES[type];
}

export function getEnvironmentOverrides(
  overrides?: Partial<EnvironmentConfig>
): EnvironmentConfig {
  return { ...THAILAND_ENVIRONMENT, ...overrides };
}
