// src/services/interferenceInspectionService.ts
//
// Mirrors src/services/inspectionService.ts for the INT domain.
// Same validation order, same idempotency, same recompute pattern.
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import type {
  CreateInterferenceInspectionInput,
  InterferenceInspection,
  InterferenceInspectionMember,
} from '@/types/interferenceInspection';

type Tx = Prisma.TransactionClient;
type DbLike = Tx | typeof prisma;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDateOnlyISO(date: Date): string {
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

function shape(row: Record<string, unknown>): InterferenceInspection {
  type Row = {
    id: number; interference_id: number; inspected_on: Date; lead_user_id: number;
    notes: string | null; source: string; created_at: Date;
    lead: { id: number; username: string; display_name: string };
    members: Array<{ user_id: number; member: { id: number; username: string; display_name: string } }>;
  };
  const r = row as unknown as Row;
  const lead: InterferenceInspectionMember = {
    userId: r.lead.id, username: r.lead.username, displayName: r.lead.display_name,
  };
  const helpers: InterferenceInspectionMember[] = r.members.map((m) => ({
    userId: m.member.id, username: m.member.username, displayName: m.member.display_name,
  }));
  return {
    id: r.id,
    interferenceId: r.interference_id,
    inspectedOn: toDateOnlyISO(r.inspected_on),
    lead,
    helpers,
    notes: r.notes ?? undefined,
    source: r.source,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listInspectionsForInterferenceSite(
  interferenceId: number,
): Promise<InterferenceInspection[]> {
  const rows = await prisma.interference_inspection.findMany({
    where: { interference_id: interferenceId },
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

export async function recomputeInterferenceInspectionState(
  interferenceId: number,
  db: DbLike = prisma,
): Promise<void> {
  const count = await db.interference_inspection.count({
    where: { interference_id: interferenceId },
  });
  await db.interference_site.update({
    where: { id: interferenceId },
    data: { status: count > 0 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ' },
  });
}

export async function createInterferenceInspection(
  input: CreateInterferenceInspectionInput,
): Promise<InterferenceInspection> {
  if (input.helperUserIds.length > 5) throw new Error('At most 5 helpers allowed');
  const uniqueHelpers = new Set(input.helperUserIds);
  if (uniqueHelpers.size !== input.helperUserIds.length) {
    throw new Error('Duplicate helpers not allowed');
  }
  if (uniqueHelpers.has(input.leadUserId)) {
    throw new Error('Helpers must not include the lead');
  }
  const inspectedDate = parseInspectedOn(input.inspectedOn);

  const site = await prisma.interference_site.findUnique({ where: { id: input.interferenceId } });
  if (!site) throw new Error('Interference site not found');

  const allUserIds = [input.leadUserId, ...input.helperUserIds];
  const users = await prisma.user.findMany({
    where: { id: { in: allUserIds }, active: true, role: { in: ['admin', 'inspector'] } },
  });
  if (users.length !== allUserIds.length) {
    throw new Error('One or more users are inactive, missing, or not inspectors');
  }

  const existing = await prisma.interference_inspection.findFirst({
    where: {
      interference_id: input.interferenceId,
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
    const ins = await tx.interference_inspection.create({
      data: {
        interference_id: input.interferenceId,
        inspected_on: inspectedDate,
        lead_user_id: input.leadUserId,
        notes: input.notes ?? null,
        source: 'app',
      },
    });
    if (input.helperUserIds.length > 0) {
      await tx.interference_inspection_member.createMany({
        data: input.helperUserIds.map((uid) => ({
          inspection_id: ins.id, user_id: uid, role: 'helper',
        })),
      });
    }
    await recomputeInterferenceInspectionState(input.interferenceId, tx);
    return ins.id;
  });

  const full = await prisma.interference_inspection.findUnique({
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
