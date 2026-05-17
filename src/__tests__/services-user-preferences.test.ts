// src/__tests__/services-user-preferences.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { getDefaultCrew } from '@/services/userPreferencesService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDefaultCrew', () => {
  it('returns null when the user has never decided (crew_decided=false)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3,
      default_helper_user_ids: [],
      crew_decided: false,
    } as never);
    const result = await getDefaultCrew(3);
    expect(result).toBeNull();
  });

  it('returns null even if the array is non-empty when crew_decided=false', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3,
      default_helper_user_ids: [9],
      crew_decided: false,
    } as never);
    const result = await getDefaultCrew(3);
    expect(result).toBeNull();
  });

  it('returns [] when the user picked solo', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3,
      default_helper_user_ids: [],
      crew_decided: true,
    } as never);
    const result = await getDefaultCrew(3);
    expect(result).toEqual([]);
  });

  it('returns the persisted crew when all ids are still valid', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3,
      default_helper_user_ids: [6, 7],
      crew_decided: true,
    } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 6 }, { id: 7 },
    ] as never);
    const result = await getDefaultCrew(3);
    expect(result).toEqual([6, 7]);
  });

  it('filters out deactivated helpers and background-PUTs the cleaned set', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3,
      default_helper_user_ids: [6, 9],
      crew_decided: true,
    } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 6 },
    ] as never);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({} as never);
    const result = await getDefaultCrew(3);
    expect(result).toEqual([6]);
    await new Promise((r) => setTimeout(r, 0));
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { default_helper_user_ids: [6] },
    });
  });
});
