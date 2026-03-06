import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { InterferenceSite, DeploymentType, EnvironmentConfig } from '@/types/interference';
import { getProfile, getEnvironmentOverrides, LTE_UE_RECEIVER } from '@/utils/equipmentProfiles';

const CLOUDRF_API_URL = 'https://api.cloudrf.com';

// NOTE: Module-level rate limiter — effective within a single process only.
// In serverless environments (Vercel/Lambda), each cold start resets this.
let lastCallTime = 0;
const MIN_CALL_INTERVAL = 1050; // ms between CloudRF API calls

export function hashRequest(params: Record<string, unknown>): string {
  const json = JSON.stringify(params, Object.keys(params).sort());
  return createHash('sha256').update(json).digest('hex');
}

export async function getCachedResult(hash: string) {
  const cached = await prisma.cloudrf_cache.findUnique({
    where: { request_hash: hash },
  });

  if (cached && cached.expires_at > new Date()) {
    return cached;
  }

  // Clean up expired entry
  if (cached) {
    await prisma.cloudrf_cache.delete({ where: { id: cached.id } });
  }

  return null;
}

export async function setCachedResult(params: {
  requestType: string;
  requestHash: string;
  requestParams: Record<string, unknown>;
  responseData: Record<string, unknown>;
  pngUrl?: string;
  bounds?: number[];
  viewerUrl?: string;
  siteId?: number;
}) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day TTL

  return prisma.cloudrf_cache.upsert({
    where: { request_hash: params.requestHash },
    create: {
      request_type: params.requestType,
      request_hash: params.requestHash,
      request_params: params.requestParams as Prisma.InputJsonValue,
      response_data: params.responseData as Prisma.InputJsonValue,
      png_url: params.pngUrl ?? null,
      bounds: params.bounds ? (params.bounds as Prisma.InputJsonValue) : Prisma.JsonNull,
      viewer_url: params.viewerUrl ?? null,
      site_id: params.siteId ?? null,
      expires_at: expiresAt,
    },
    update: {
      response_data: params.responseData as Prisma.InputJsonValue,
      png_url: params.pngUrl ?? null,
      bounds: params.bounds ? (params.bounds as Prisma.InputJsonValue) : Prisma.JsonNull,
      viewer_url: params.viewerUrl ?? null,
      expires_at: expiresAt,
    },
  });
}

export function buildAreaPayload(
  site: InterferenceSite,
  options?: {
    alt?: number;
    txw?: number;
    rad?: number;
    azi?: number;
    profile?: DeploymentType;
    antennaGain?: number;
    downtilt?: number;
    bandwidth?: number;
    environment?: Partial<EnvironmentConfig>;
  }
) {
  const profile = options?.profile ? getProfile(options.profile) : null;
  const env = getEnvironmentOverrides(options?.environment);

  return {
    site: site.siteCode || `SITE-${site.id}`,
    network: 'AWN-2600',
    transmitter: {
      lat: site.lat,
      lon: site.long,
      alt: options?.alt ?? profile?.antennaHeight ?? 30,
      txw: options?.txw ?? profile?.txPower ?? 20,
      bwi: options?.bandwidth ?? profile?.bandwidth ?? 20,
      ant: 1,  // directional
      antenna: 1,
      azi: options?.azi ?? site.direction ?? 0,
      tlt: options?.downtilt ?? profile?.downtilt ?? 6,
      frq: 2600,
      pol: 'v',
      txg: options?.antennaGain ?? profile?.antennaGain ?? 17,
      txl: profile?.feederLoss ?? 2,
    },
    receiver: {
      lat: 0,
      lon: 0,
      alt: LTE_UE_RECEIVER.rxHeight,
      rxg: LTE_UE_RECEIVER.rxGain,
      rxs: LTE_UE_RECEIVER.rxSensitivity,
    },
    model: {
      pm: env.propagationModel,  // ITM/Longley-Rice for 2600 MHz
      pe: 2,
      cli: 6,
      ked: env.diffraction,
      rel: env.reliability,
    },
    environment: {
      clt: env.climate,
      elevation: 1,
      landcover: env.landcover,
      buildings: env.buildings,
    },
    output: {
      units: 'm',
      col: 'RAINBOW.dBm',
      out: 2,
      ber: 2,
      mod: 7,
      nf: LTE_UE_RECEIVER.noiseFloor,
      res: 30,
      rad: options?.rad ?? 5,
    },
  };
}

export function buildPathPayloadV2(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  options?: {
    profile?: DeploymentType;
    alt?: number;
    txw?: number;
    environment?: Partial<EnvironmentConfig>;
  }
) {
  const profile = options?.profile ? getProfile(options.profile) : null;
  const env = getEnvironmentOverrides(options?.environment);

  return {
    site: `PATH-${Date.now()}`,
    network: 'AWN-2600',
    transmitter: {
      lat: from.lat,
      lon: from.lon,
      alt: options?.alt ?? profile?.antennaHeight ?? 30,
      txw: options?.txw ?? profile?.txPower ?? 20,
      bwi: profile?.bandwidth ?? 20,
      ant: 1,
      antenna: 1,
      azi: 0,
      tlt: profile?.downtilt ?? 6,
      frq: 2600,
      pol: 'v',
      txg: profile?.antennaGain ?? 17,
      txl: profile?.feederLoss ?? 2,
    },
    receiver: {
      lat: to.lat,
      lon: to.lon,
      alt: LTE_UE_RECEIVER.rxHeight,
      rxg: LTE_UE_RECEIVER.rxGain,
      rxs: LTE_UE_RECEIVER.rxSensitivity,
    },
    model: {
      pm: env.propagationModel,
      pe: 2,
      cli: 6,
      ked: env.diffraction,
      rel: env.reliability,
    },
    environment: {
      clt: env.climate,
      elevation: 1,
      landcover: env.landcover,
      buildings: env.buildings,
    },
    output: {
      units: 'm',
      col: 'RAINBOW.dBm',
      out: 2,
      ber: 2,
      mod: 7,
      nf: LTE_UE_RECEIVER.noiseFloor,
      res: 30,
      rad: 5,
    },
  };
}

export function buildMultisitePayload(
  sites: Array<{
    lat: number;
    lon: number;
    alt?: number;
    txw?: number;
    azi?: number;
    profile?: DeploymentType;
  }>,
  options?: {
    environment?: Partial<EnvironmentConfig>;
    radius?: number;
  }
) {
  const env = getEnvironmentOverrides(options?.environment);

  return {
    transmitters: sites.map((s, i) => {
      const profile = s.profile ? getProfile(s.profile) : null;
      return {
        site: `MULTI-${i}`,
        network: 'AWN-2600',
        lat: s.lat,
        lon: s.lon,
        alt: s.alt ?? profile?.antennaHeight ?? 30,
        txw: s.txw ?? profile?.txPower ?? 20,
        bwi: profile?.bandwidth ?? 20,
        ant: 1,
        antenna: 1,
        azi: s.azi ?? 0,
        tlt: profile?.downtilt ?? 6,
        frq: 2600,
        pol: 'v',
        txg: profile?.antennaGain ?? 17,
        txl: profile?.feederLoss ?? 2,
      };
    }),
    receiver: {
      lat: 0,
      lon: 0,
      alt: LTE_UE_RECEIVER.rxHeight,
      rxg: LTE_UE_RECEIVER.rxGain,
      rxs: LTE_UE_RECEIVER.rxSensitivity,
    },
    model: {
      pm: env.propagationModel,
      pe: 2,
      cli: 6,
      ked: env.diffraction,
      rel: env.reliability,
    },
    environment: {
      clt: env.climate,
      elevation: 1,
      landcover: env.landcover,
      buildings: env.buildings,
    },
    output: {
      units: 'm',
      col: 'RAINBOW.dBm',
      out: 2,
      ber: 2,
      mod: 7,
      nf: LTE_UE_RECEIVER.noiseFloor,
      res: 30,
      rad: options?.radius ?? 5,
    },
  };
}

export function convertBoundsToLeaflet(
  bounds: [number, number, number, number]
): [[number, number], [number, number]] {
  // CloudRF returns [N, E, S, W] → Leaflet needs [[S, W], [N, E]]
  const [north, east, south, west] = bounds;
  return [
    [south, west],
    [north, east],
  ];
}

async function rateLimitedFetch(url: string, options: RequestInit) {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < MIN_CALL_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_CALL_INTERVAL - timeSinceLastCall)
    );
  }
  lastCallTime = Date.now();
  return fetch(url, options);
}

export async function callCloudRFArea(
  payload: Record<string, unknown>,
  apiKey: string
) {
  const response = await rateLimitedFetch(`${CLOUDRF_API_URL}/area`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      key: apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CloudRF API error ${response.status}: ${text}`);
  }

  return response.json();
}

export async function callCloudRFPath(
  payload: Record<string, unknown>,
  apiKey: string
) {
  const response = await rateLimitedFetch(`${CLOUDRF_API_URL}/path`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      key: apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CloudRF path API error ${response.status}: ${text}`);
  }

  return response.json();
}

export async function callCloudRFMultisite(
  payload: Record<string, unknown>,
  apiKey: string
) {
  const response = await rateLimitedFetch(`${CLOUDRF_API_URL}/multisite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      key: apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CloudRF multisite API error ${response.status}: ${text}`);
  }

  return response.json();
}

export async function callCloudRFInterference(
  payload: Record<string, unknown>,
  apiKey: string
) {
  const response = await rateLimitedFetch(`${CLOUDRF_API_URL}/interference`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      key: apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CloudRF interference API error ${response.status}: ${text}`);
  }

  return response.json();
}
