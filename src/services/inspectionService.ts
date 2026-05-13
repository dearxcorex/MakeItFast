// src/services/inspectionService.ts
import prisma from '@/lib/prisma';
import type { SessionData } from '@/lib/session';
import type {
  CreateInspectionInput,
  InspectionMember,
  StationInspection,
} from '@/types/inspection';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateOnlyISO(date: Date): string {
  // The DB column is `DATE` so the JS Date is at 00:00:00Z. Slice first 10 chars.
  return date.toISOString().slice(0, 10);
}

function parseInspectedOn(input: string): Date {
  if (!DATE_RE.test(input)) throw new Error('inspectedOn must use YYYY-MM-DD format');
  const d = new Date(`${input}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error('inspectedOn is not a real date');
  const todayMs = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  );
  if (d.getTime() > todayMs) throw new Error('inspectedOn cannot be in the future');
  return d;
}

function shape(row: Record<string, unknown>): StationInspection {
  type Row = {
    id: number; station_id: number; inspected_on: Date; lead_user_id: number;
    notes: string | null; source: string; created_at: Date;
    lead: { id: number; username: string; display_name: string };
    members: Array<{ user_id: number; member: { id: number; username: string; display_name: string } }>;
  };
  const r = row as unknown as Row;
  const lead: InspectionMember = {
    userId: r.lead.id, username: r.lead.username, displayName: r.lead.display_name,
  };
  const helpers: InspectionMember[] = r.members.map((m) => ({
    userId: m.member.id, username: m.member.username, displayName: m.member.display_name,
  }));
  return {
    id: r.id,
    stationId: r.station_id,
    inspectedOn: toDateOnlyISO(r.inspected_on),
    lead,
    helpers,
    notes: r.notes ?? undefined,
    source: r.source,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listInspectionsForStation(stationId: number): Promise<StationInspection[]> {
  const rows = await prisma.station_inspection.findMany({
    where: { station_id: stationId },
    orderBy: [{ inspected_on: 'desc' }, { id: 'desc' }],
    include: {
      lead: { select: { id: true, username: true, display_name: true } },
      members: {
        include: { member: { select: { id: true, username: true, display_name: true } } },
      },
    },
  });
  return rows.map((row) => shape(row as unknown as Record<string, unknown>));
}

export async function recomputeStationInspectionState(stationId: number): Promise<void> {
  const agg = await prisma.station_inspection.aggregate({
    where: { station_id: stationId },
    _max: { inspected_on: true },
  });
  const count = await prisma.station_inspection.count({ where: { station_id: stationId } });
  const date = agg._max.inspected_on ? toDateOnlyISO(agg._max.inspected_on) : null;
  await prisma.fm_station.update({
    where: { id_fm: stationId },
    data: { date_inspected: date, inspection_69: count > 0 },
  });
}

export async function createInspection(input: CreateInspectionInput): Promise<StationInspection> {
  if (input.helperUserIds.length > 5) throw new Error('At most 5 helpers allowed');
  const uniqueHelpers = new Set(input.helperUserIds);
  if (uniqueHelpers.size !== input.helperUserIds.length) {
    throw new Error('Duplicate helpers not allowed');
  }
  if (uniqueHelpers.has(input.leadUserId)) {
    throw new Error('Helpers must not include the lead');
  }
  const inspectedDate = parseInspectedOn(input.inspectedOn);

  const station = await prisma.fm_station.findUnique({ where: { id_fm: input.stationId } });
  if (!station) throw new Error('Station not found');

  const allUserIds = [input.leadUserId, ...input.helperUserIds];
  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds }, active: true, role: { in: ['admin', 'inspector'] } },
  });
  if (users.length !== allUserIds.length) {
    throw new Error('One or more users are inactive, missing, or not inspectors');
  }

  const existing = await prisma.station_inspection.findFirst({
    where: {
      station_id: input.stationId,
      inspected_on: inspectedDate,
      lead_user_id: input.leadUserId,
    },
    include: {
      lead: { select: { id: true, username: true, display_name: true } },
      members: {
        include: { member: { select: { id: true, username: true, display_name: true } } },
      },
    },
  });
  if (existing) return shape(existing as unknown as Record<string, unknown>);

  const created = await prisma.$transaction(async (tx) => {
    const ins = await tx.station_inspection.create({
      data: {
        station_id: input.stationId,
        inspected_on: inspectedDate,
        lead_user_id: input.leadUserId,
        notes: input.notes ?? null,
        source: 'app',
      },
    });
    if (input.helperUserIds.length > 0) {
      await tx.station_inspection_member.createMany({
        data: input.helperUserIds.map((uid) => ({
          inspection_id: ins.id, user_id: uid, role: 'helper',
        })),
      });
    }
    const agg = await tx.station_inspection.aggregate({
      where: { station_id: input.stationId },
      _max: { inspected_on: true },
    });
    const count = await tx.station_inspection.count({ where: { station_id: input.stationId } });
    await tx.fm_station.update({
      where: { id_fm: input.stationId },
      data: {
        date_inspected: agg._max.inspected_on ? toDateOnlyISO(agg._max.inspected_on) : null,
        inspection_69: count > 0,
      },
    });
    return ins.id;
  });

  const full = await prisma.station_inspection.findUnique({
    where: { id: created },
    include: {
      lead: { select: { id: true, username: true, display_name: true } },
      members: {
        include: { member: { select: { id: true, username: true, display_name: true } } },
      },
    },
  });
  return shape(full as unknown as Record<string, unknown>);
}

export async function deleteInspection(id: number, actor: SessionData): Promise<number> {
  const row = await prisma.station_inspection.findUnique({ where: { id } });
  if (!row) throw new Error('Inspection not found');
  if (actor.role !== 'admin' && actor.userId !== row.lead_user_id) {
    throw new Error('forbidden');
  }
  await prisma.station_inspection.delete({ where: { id } });
  await recomputeStationInspectionState(row.station_id);
  return row.station_id;
}
