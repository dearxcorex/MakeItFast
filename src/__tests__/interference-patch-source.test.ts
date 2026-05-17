import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  default: {
    interference_site: {
      update: vi.fn(),
    },
  },
}));

vi.mock('@/services/interferenceService', () => ({
  fetchInterferenceSiteById: vi.fn(),
}));

import prisma from '@/lib/prisma';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.interference_site.update).mockResolvedValue({ id: 1 } as never);
});

const patch = async (body: Record<string, unknown>, id = '1') => {
  const { PATCH } = await import('@/app/api/interference/[id]/route');
  const req = new NextRequest('http://localhost/api/interference/1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return PATCH(req as never, { params: Promise.resolve({ id }) });
};

describe('PATCH /api/interference/[id] — source fields', () => {
  it('persists sourceLat / sourceLong / estimateDistance with correct snake_case mapping', async () => {
    const res = await patch({ sourceLat: 13.7563, sourceLong: 100.5018, estimateDistance: 12.5 });
    expect(res.status).toBe(200);
    expect(prisma.interference_site.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { source_lat: 13.7563, source_long: 100.5018, estimate_distance: 12.5 },
    });
  });

  it('accepts null to clear all three columns', async () => {
    const res = await patch({ sourceLat: null, sourceLong: null, estimateDistance: null });
    expect(res.status).toBe(200);
    expect(prisma.interference_site.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { source_lat: null, source_long: null, estimate_distance: null },
    });
  });

  it('rejects sourceLat outside [-90, 90]', async () => {
    const res = await patch({ sourceLat: 91, sourceLong: 0 });
    expect(res.status).toBe(400);
    expect(prisma.interference_site.update).not.toHaveBeenCalled();
  });

  it('rejects sourceLong outside [-180, 180]', async () => {
    const res = await patch({ sourceLat: 0, sourceLong: 181 });
    expect(res.status).toBe(400);
    expect(prisma.interference_site.update).not.toHaveBeenCalled();
  });

  it('rejects negative estimateDistance', async () => {
    const res = await patch({ estimateDistance: -1 });
    expect(res.status).toBe(400);
    expect(prisma.interference_site.update).not.toHaveBeenCalled();
  });

  it('rejects non-finite values (NaN)', async () => {
    const res = await patch({ sourceLat: 'abc' });
    expect(res.status).toBe(400);
  });

  it('accepts boundary values lat=90 long=180 distance=0', async () => {
    const res = await patch({ sourceLat: 90, sourceLong: 180, estimateDistance: 0 });
    expect(res.status).toBe(200);
  });

  it('allows updating just sourceLat without the other two', async () => {
    const res = await patch({ sourceLat: 13.7563 });
    expect(res.status).toBe(200);
    expect(prisma.interference_site.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { source_lat: 13.7563 },
    });
  });
});
