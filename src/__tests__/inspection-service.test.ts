// src/__tests__/inspection-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    fm_station: { findUnique: vi.fn(), update: vi.fn() },
    user: { findMany: vi.fn() },
    station_inspection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
    },
    station_inspection_member: { createMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(async (cb) => cb({
      fm_station: { update: vi.fn() },
      station_inspection: { create: vi.fn(), findFirst: vi.fn(), aggregate: vi.fn(), count: vi.fn(), delete: vi.fn() },
      station_inspection_member: { createMany: vi.fn() },
    })),
  },
}));

import prisma from '@/lib/prisma';
import {
  listInspectionsForStation,
  createInspection,
  deleteInspection,
  recomputeStationInspectionState,
} from '@/services/inspectionService';

beforeEach(() => { vi.clearAllMocks(); });

describe('listInspectionsForStation', () => {
  it('returns inspections newest-first with lead + helpers shaped for the UI', async () => {
    vi.mocked(prisma.station_inspection.findMany).mockResolvedValue([
      {
        id: 10,
        station_id: 5520014,
        inspected_on: new Date('2026-04-03T00:00:00Z'),
        lead_user_id: 3,
        notes: null,
        source: 'xlsx_import_2026_05',
        created_at: new Date('2026-04-03T00:00:00Z'),
        updated_at: new Date('2026-04-03T00:00:00Z'),
        lead: { id: 3, username: 'iff', display_name: 'iff' },
        members: [
          { user_id: 6, role: 'helper', member: { id: 6, username: 'daf', display_name: 'daf' } },
        ],
      },
    ] as never);

    const out = await listInspectionsForStation(5520014);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: 10,
      stationId: 5520014,
      inspectedOn: '2026-04-03',
      lead: { userId: 3, username: 'iff', displayName: 'iff' },
      helpers: [{ userId: 6, username: 'daf', displayName: 'daf' }],
      source: 'xlsx_import_2026_05',
    });
    expect(vi.mocked(prisma.station_inspection.findMany).mock.calls[0][0]).toMatchObject({
      where: { station_id: 5520014 },
      orderBy: [{ inspected_on: 'desc' }, { id: 'desc' }],
    });
  });
});

describe('createInspection', () => {
  it('rejects future dates', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await expect(createInspection({
      stationId: 1, inspectedOn: future, leadUserId: 3, helperUserIds: [],
    })).rejects.toThrow(/future/i);
  });

  it('rejects malformed dates', async () => {
    await expect(createInspection({
      stationId: 1, inspectedOn: '2026/04/03', leadUserId: 3, helperUserIds: [],
    })).rejects.toThrow(/format/i);
  });

  it('rejects duplicate helpers and helpers that include the lead', async () => {
    await expect(createInspection({
      stationId: 1, inspectedOn: '2026-04-03', leadUserId: 3, helperUserIds: [6, 6],
    })).rejects.toThrow(/duplicate/i);
    await expect(createInspection({
      stationId: 1, inspectedOn: '2026-04-03', leadUserId: 3, helperUserIds: [3],
    })).rejects.toThrow(/lead/i);
  });

  it('returns existing inspection (idempotent) when one matches station+date+lead', async () => {
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({ id_fm: 1 } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff', active: true, role: 'inspector' },
    ] as never);
    vi.mocked(prisma.station_inspection.findFirst).mockResolvedValue({
      id: 42,
      station_id: 1,
      inspected_on: new Date('2026-04-03T00:00:00Z'),
      lead_user_id: 3,
      notes: null,
      source: 'app',
      created_at: new Date('2026-04-03T00:00:00Z'),
      updated_at: new Date('2026-04-03T00:00:00Z'),
      lead: { id: 3, username: 'iff', display_name: 'iff' },
      members: [],
    } as never);

    const out = await createInspection({
      stationId: 1, inspectedOn: '2026-04-03', leadUserId: 3, helperUserIds: [],
    });
    expect(out.id).toBe(42);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('recomputeStationInspectionState', () => {
  it('sets date_inspected to MAX(inspected_on) and inspection_69 true when rows exist', async () => {
    vi.mocked(prisma.station_inspection.aggregate).mockResolvedValue({
      _max: { inspected_on: new Date('2026-04-21T00:00:00Z') },
    } as never);
    vi.mocked(prisma.station_inspection.count).mockResolvedValue(3 as never);

    await recomputeStationInspectionState(5520014);

    expect(prisma.fm_station.update).toHaveBeenCalledWith({
      where: { id_fm: 5520014 },
      data: { date_inspected: '2026-04-21', inspection_69: true },
    });
  });

  it('clears date_inspected and flips inspection_69 false when no rows remain', async () => {
    vi.mocked(prisma.station_inspection.aggregate).mockResolvedValue({
      _max: { inspected_on: null },
    } as never);
    vi.mocked(prisma.station_inspection.count).mockResolvedValue(0 as never);

    await recomputeStationInspectionState(5520014);

    expect(prisma.fm_station.update).toHaveBeenCalledWith({
      where: { id_fm: 5520014 },
      data: { date_inspected: null, inspection_69: false },
    });
  });
});

describe('deleteInspection', () => {
  it('lets admins delete any inspection and recomputes state', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 7, station_id: 1, lead_user_id: 999,
    } as never);
    vi.mocked(prisma.station_inspection.aggregate).mockResolvedValue({ _max: { inspected_on: null } } as never);
    vi.mocked(prisma.station_inspection.count).mockResolvedValue(0 as never);

    await deleteInspection(7, { userId: 1, username: 'admin', displayName: 'Admin', role: 'admin', issuedAt: 0 });

    expect(prisma.station_inspection.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it('rejects non-admin who is not the lead', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 7, station_id: 1, lead_user_id: 999,
    } as never);

    await expect(deleteInspection(7, {
      userId: 2, username: 'ice', displayName: 'ice', role: 'inspector', issuedAt: 0,
    })).rejects.toThrow(/forbidden/i);
  });
});

describe('createInspection — additional validation', () => {
  it('rejects more than 5 helpers', async () => {
    await expect(createInspection({
      stationId: 1,
      inspectedOn: '2026-04-03',
      leadUserId: 3,
      helperUserIds: [6, 4, 2, 1, 5, 7],
    })).rejects.toThrow(/5 helpers/);
  });

  it('rejects when station does not exist', async () => {
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);
    await expect(createInspection({
      stationId: 999, inspectedOn: '2026-04-03', leadUserId: 3, helperUserIds: [],
    })).rejects.toThrow(/Station not found/);
  });

  it('rejects when a user is inactive, missing, or not an inspector', async () => {
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({ id_fm: 1 } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
    await expect(createInspection({
      stationId: 1, inspectedOn: '2026-04-03', leadUserId: 3, helperUserIds: [],
    })).rejects.toThrow(/inactive, missing, or not inspectors/);
  });

  it('writes inspection + members and runs recompute inside the transaction (happy path)', async () => {
    vi.mocked(prisma.fm_station.findUnique)
      .mockResolvedValueOnce({ id_fm: 1 } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 3, username: 'iff', display_name: 'iff', active: true, role: 'inspector' },
      { id: 6, username: 'daf', display_name: 'daf', active: true, role: 'inspector' },
    ] as never);
    vi.mocked(prisma.station_inspection.findFirst).mockResolvedValue(null);

    const txCreate = vi.fn().mockResolvedValue({ id: 100 });
    const txAggregate = vi.fn().mockResolvedValue({ _max: { inspected_on: new Date('2026-04-03T00:00:00Z') } });
    const txCount = vi.fn().mockResolvedValue(1);
    const txStationUpdate = vi.fn().mockResolvedValue({ id_fm: 1 });
    const txMemberCreateMany = vi.fn().mockResolvedValue({ count: 1 });

    vi.mocked(prisma.$transaction).mockImplementationOnce(async (cb: never) => {
      const tx = {
        station_inspection: { create: txCreate, aggregate: txAggregate, count: txCount },
        station_inspection_member: { createMany: txMemberCreateMany },
        fm_station: { update: txStationUpdate },
      };
      return (cb as unknown as (t: typeof tx) => Promise<number>)(tx);
    });

    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 100,
      station_id: 1,
      inspected_on: new Date('2026-04-03T00:00:00Z'),
      lead_user_id: 3, notes: null, source: 'app',
      created_at: new Date('2026-04-03T00:00:00Z'),
      updated_at: new Date('2026-04-03T00:00:00Z'),
      lead: { id: 3, username: 'iff', display_name: 'iff' },
      members: [{ user_id: 6, member: { id: 6, username: 'daf', display_name: 'daf' } }],
    } as never);

    const out = await createInspection({
      stationId: 1, inspectedOn: '2026-04-03', leadUserId: 3, helperUserIds: [6],
    });

    expect(out.id).toBe(100);
    expect(txCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ station_id: 1, lead_user_id: 3 }),
    }));
    expect(txMemberCreateMany).toHaveBeenCalledWith({
      data: [{ inspection_id: 100, user_id: 6, role: 'helper' }],
    });
    expect(txStationUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id_fm: 1 },
      data: { date_inspected: '2026-04-03', inspection_69: true },
    }));
  });
});

describe('deleteInspection — recompute runs', () => {
  it('runs recompute after admin delete', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue({
      id: 7, station_id: 1, lead_user_id: 999,
    } as never);
    vi.mocked(prisma.station_inspection.aggregate).mockResolvedValue({ _max: { inspected_on: null } } as never);
    vi.mocked(prisma.station_inspection.count).mockResolvedValue(0 as never);

    await deleteInspection(7, { userId: 1, username: 'admin', displayName: 'Admin', role: 'admin', issuedAt: 0 });

    expect(prisma.fm_station.update).toHaveBeenCalledWith({
      where: { id_fm: 1 },
      data: { date_inspected: null, inspection_69: false },
    });
  });
});
