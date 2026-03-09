import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma
const mockFindUnique = vi.fn();
const mockDelete = vi.fn();
const mockUpsert = vi.fn();

vi.mock('@/lib/prisma', () => ({
  default: {
    cloudrf_cache: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}));

// Mock equipment profiles (needed by cloudrf module)
vi.mock('@/utils/equipmentProfiles', () => ({
  getProfile: vi.fn(() => ({
    antennaHeight: 30,
    txPower: 20,
    bandwidth: 20,
    downtilt: 6,
    antennaGain: 17,
    feederLoss: 2,
  })),
  getEnvironmentOverrides: vi.fn(() => ({
    propagationModel: 1,
    diffraction: 1,
    reliability: 50,
    climate: 1,
    landcover: 1,
    buildings: 0,
  })),
  LTE_UE_RECEIVER: {
    rxHeight: 1.5,
    rxGain: 2,
    rxSensitivity: -100,
    noiseFloor: -114,
  },
}));

// Mock global fetch
const mockFetchFn = vi.fn();
global.fetch = mockFetchFn;

import { getCachedResult, setCachedResult, callCloudRFArea, callCloudRFPath, callCloudRFMultisite, callCloudRFInterference } from '@/utils/cloudrf';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('getCachedResult', () => {
  it('returns cached result when not expired', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const cached = {
      id: 1,
      request_hash: 'abc123',
      response_data: { url: 'https://example.com/image.png' },
      expires_at: futureDate,
    };
    mockFindUnique.mockResolvedValue(cached);

    const result = await getCachedResult('abc123');
    expect(result).toEqual(cached);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { request_hash: 'abc123' },
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('returns null and deletes expired entry', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const cached = {
      id: 42,
      request_hash: 'expired-hash',
      response_data: {},
      expires_at: pastDate,
    };
    mockFindUnique.mockResolvedValue(cached);
    mockDelete.mockResolvedValue(cached);

    const result = await getCachedResult('expired-hash');
    expect(result).toBeNull();
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 42 } });
  });

  it('returns null when no cached entry exists', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getCachedResult('nonexistent');
    expect(result).toBeNull();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('setCachedResult', () => {
  it('upserts a new cache entry with 7-day TTL', async () => {
    const mockResult = { id: 1, request_hash: 'new-hash' };
    mockUpsert.mockResolvedValue(mockResult);

    const params = {
      requestType: 'area',
      requestHash: 'new-hash',
      requestParams: { lat: 13.75, lon: 100.5 },
      responseData: { png_url: 'https://example.com/img.png' },
      pngUrl: 'https://example.com/img.png',
      bounds: [14.0, 101.0, 13.5, 100.0],
      viewerUrl: 'https://cloudrf.com/viewer/123',
      siteId: 5,
    };

    const result = await setCachedResult(params);
    expect(result).toEqual(mockResult);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { request_hash: 'new-hash' },
        create: expect.objectContaining({
          request_type: 'area',
          request_hash: 'new-hash',
          png_url: 'https://example.com/img.png',
          site_id: 5,
        }),
        update: expect.objectContaining({
          png_url: 'https://example.com/img.png',
        }),
      })
    );

    // Verify expires_at is roughly 7 days from now
    const call = mockUpsert.mock.calls[0][0];
    const expiresAt = call.create.expires_at as Date;
    const daysDiff = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeGreaterThan(6.9);
    expect(daysDiff).toBeLessThan(7.1);
  });

  it('handles optional fields as null', async () => {
    mockUpsert.mockResolvedValue({ id: 2 });

    await setCachedResult({
      requestType: 'path',
      requestHash: 'hash2',
      requestParams: {},
      responseData: {},
    });

    const call = mockUpsert.mock.calls[0][0];
    expect(call.create.png_url).toBeNull();
    expect(call.create.viewer_url).toBeNull();
    expect(call.create.site_id).toBeNull();
  });
});

describe('callCloudRFArea', () => {
  it('makes correct API call and returns JSON', async () => {
    const responseData = { png_url: 'https://cloudrf.com/area.png', bounds: [14, 101, 13, 100] };
    mockFetchFn.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseData),
    });

    const payload = { site: 'TEST', transmitter: { lat: 13.75 } };
    const result = await callCloudRFArea(payload, 'test-api-key');

    expect(result).toEqual(responseData);
    expect(mockFetchFn).toHaveBeenCalledWith(
      'https://api.cloudrf.com/area',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          key: 'test-api-key',
        }),
        body: JSON.stringify(payload),
      })
    );
  });

  it('throws on API error', async () => {
    mockFetchFn.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    await expect(callCloudRFArea({}, 'bad-key')).rejects.toThrow(
      'CloudRF API error 401: Unauthorized'
    );
  });
});

describe('callCloudRFPath', () => {
  it('makes correct API call and returns JSON', async () => {
    const responseData = { path_loss: -80 };
    mockFetchFn.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseData),
    });

    const payload = { transmitter: { lat: 13.75, lon: 100.5 }, receiver: { lat: 14.0, lon: 101.0 } };
    const result = await callCloudRFPath(payload, 'key');

    expect(result).toEqual(responseData);
    expect(mockFetchFn).toHaveBeenCalledWith(
      'https://api.cloudrf.com/path',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws on API error', async () => {
    mockFetchFn.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server error'),
    });

    await expect(callCloudRFPath({}, 'key')).rejects.toThrow(
      'CloudRF path API error 500: Server error'
    );
  });
});

describe('callCloudRFMultisite', () => {
  it('makes correct API call and returns JSON', async () => {
    const responseData = { sites: [{ coverage: 85 }] };
    mockFetchFn.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseData),
    });

    const payload = { transmitters: [{ lat: 13.75, lon: 100.5 }] };
    const result = await callCloudRFMultisite(payload, 'key');

    expect(result).toEqual(responseData);
    expect(mockFetchFn).toHaveBeenCalledWith(
      'https://api.cloudrf.com/multisite',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws on API error', async () => {
    mockFetchFn.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    });

    await expect(callCloudRFMultisite({}, 'key')).rejects.toThrow(
      'CloudRF multisite API error 429: Rate limited'
    );
  });
});

describe('callCloudRFInterference', () => {
  it('makes correct API call and returns JSON', async () => {
    const responseData = { interference_level: -75 };
    mockFetchFn.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseData),
    });

    const payload = { sites: [{ lat: 13.75, lon: 100.5 }] };
    const result = await callCloudRFInterference(payload, 'key');

    expect(result).toEqual(responseData);
    expect(mockFetchFn).toHaveBeenCalledWith(
      'https://api.cloudrf.com/interference',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('throws on API error', async () => {
    mockFetchFn.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    });

    await expect(callCloudRFInterference({}, 'key')).rejects.toThrow(
      'CloudRF interference API error 403: Forbidden'
    );
  });
});
