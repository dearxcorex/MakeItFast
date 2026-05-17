// src/__tests__/interference-inspection-service.test.ts
//
// Mirrors src/__tests__/inspection-service.test.ts for INT.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    interference_site: { findUnique: vi.fn(), update: vi.fn() },
    interference_inspection: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    interference_inspection_member: { createMany: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(async (cb) => cb({
      interference_inspection: {
        create: vi.fn(async () => ({ id: 100 })),
        count: vi.fn(async () => 1),
      },
      interference_inspection_member: { createMany: vi.fn(async () => ({ count: 1 })) },
      interference_site: { update: vi.fn(async () => ({ id: 1 })) },
    })),
  },
}));

import prisma from '@/lib/prisma';
import {
  createInterferenceInspection,
  recomputeInterferenceInspectionState,
} from '@/services/interferenceInspectionService';

beforeEach(() => {
  vi.clearAllMocks();
});

const baseInput = {
  interferenceId: 42,
  inspectedOn: '2026-05-17',
  leadUserId: 3,
  helperUserIds: [] as number[],
};

describe('createInterferenceInspection — validation', () => {
  it('rejects more than 5 helpers', async () => {
    await expect(
      createInterferenceInspection({ ...baseInput, helperUserIds: [4, 5, 6, 7, 8, 9] }),
    ).rejects.toThrow('At most 5 helpers allowed');
  });

  it('rejects duplicate helpers', async () => {
    await expect(
      createInterferenceInspection({ ...baseInput, helperUserIds: [4, 4] }),
    ).rejects.toThrow('Duplicate helpers not allowed');
  });

  it('rejects helpers that include the lead', async () => {
    await expect(
      createInterferenceInspection({ ...baseInput, helperUserIds: [3] }),
    ).rejects.toThrow('Helpers must not include the lead');
  });

  it('rejects bad date format', async () => {
    await expect(
      createInterferenceInspection({ ...baseInput, inspectedOn: '2026/05/17' }),
    ).rejects.toThrow('inspectedOn must use YYYY-MM-DD format');
  });

  it('rejects future date', async () => {
    await expect(
      createInterferenceInspection({ ...baseInput, inspectedOn: '2099-01-01' }),
    ).rejects.toThrow('inspectedOn cannot be in the future');
  });

  it('rejects when site does not exist', async () => {
    vi.mocked(prisma.interference_site.findUnique).mockResolvedValueOnce(null);
    await expect(createInterferenceInspection(baseInput)).rejects.toThrow('Interference site not found');
  });

  it('rejects when a user is inactive or wrong role', async () => {
    vi.mocked(prisma.interference_site.findUnique).mockResolvedValueOnce({ id: 42 } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as never);
    await expect(createInterferenceInspection(baseInput)).rejects.toThrow(
      'One or more users are inactive, missing, or not inspectors',
    );
  });
});

describe('createInterferenceInspection — idempotency', () => {
  it('returns existing row if (interference_id, date, lead) already exists', async () => {
    vi.mocked(prisma.interference_site.findUnique).mockResolvedValueOnce({ id: 42 } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: 3 }] as never);
    vi.mocked(prisma.interference_inspection.findFirst).mockResolvedValueOnce({
      id: 99,
      interference_id: 42,
      inspected_on: new Date('2026-05-17T00:00:00Z'),
      lead_user_id: 3,
      notes: null,
      source: 'app',
      created_at: new Date(),
      lead: { id: 3, username: 'iff', display_name: 'iff' },
      members: [],
    } as never);

    const result = await createInterferenceInspection(baseInput);
    expect(result.id).toBe(99);
    // Confirm we did NOT enter the create-transaction path.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('createInterferenceInspection — happy path', () => {
  it('creates inspection + members + recomputes state', async () => {
    vi.mocked(prisma.interference_site.findUnique).mockResolvedValueOnce({ id: 42 } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 3 }, { id: 6 },
    ] as never);
    vi.mocked(prisma.interference_inspection.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.interference_inspection.findUnique).mockResolvedValueOnce({
      id: 100,
      interference_id: 42,
      inspected_on: new Date('2026-05-17T00:00:00Z'),
      lead_user_id: 3,
      notes: null,
      source: 'app',
      created_at: new Date(),
      lead: { id: 3, username: 'iff', display_name: 'iff' },
      members: [
        { user_id: 6, member: { id: 6, username: 'daf', display_name: 'daf' } },
      ],
    } as never);

    const result = await createInterferenceInspection({
      ...baseInput,
      helperUserIds: [6],
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(result.lead.username).toBe('iff');
    expect(result.helpers).toHaveLength(1);
    expect(result.helpers[0].username).toBe('daf');
  });
});

describe('recomputeInterferenceInspectionState', () => {
  it('sets status="ตรวจแล้ว" when at least one row exists', async () => {
    vi.mocked(prisma.interference_inspection.count).mockResolvedValueOnce(2);
    vi.mocked(prisma.interference_site.update).mockResolvedValueOnce({ id: 42 } as never);
    await recomputeInterferenceInspectionState(42);
    expect(prisma.interference_site.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { status: 'ตรวจแล้ว' },
    });
  });

  it('sets status="ยังไม่ตรวจ" when zero rows exist', async () => {
    vi.mocked(prisma.interference_inspection.count).mockResolvedValueOnce(0);
    vi.mocked(prisma.interference_site.update).mockResolvedValueOnce({ id: 42 } as never);
    await recomputeInterferenceInspectionState(42);
    expect(prisma.interference_site.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { status: 'ยังไม่ตรวจ' },
    });
  });
});
