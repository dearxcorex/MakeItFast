// src/services/userPreferencesService.ts
import prisma from '@/lib/prisma';

export const MAX_DEFAULT_HELPERS = 5;

async function loadValidIds(ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: {
      id: { in: ids },
      active: true,
      role: { in: ['admin', 'inspector'] },
    },
    select: { id: true },
  });
  const valid = new Set(rows.map((r) => r.id));
  return ids.filter((id) => valid.has(id));
}

export async function getDefaultCrew(userId: number): Promise<number[] | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { default_helper_user_ids: true, crew_decided: true },
  });
  if (!row) return null;
  if (!row.crew_decided) return null;
  const raw = row.default_helper_user_ids;
  if (raw.length === 0) return [];
  const valid = await loadValidIds(raw);
  if (valid.length === 0) {
    // Entire stored crew has been deactivated. Treat as undecided so the
    // user is re-prompted; reset crew_decided so future GETs are
    // consistent. Fire-and-forget; we already know the right answer.
    void prisma.user
      .update({
        where: { id: userId },
        data: { default_helper_user_ids: [], crew_decided: false },
      })
      .catch(() => {});
    return null;
  }
  if (valid.length !== raw.length) {
    // Self-heal partial staleness: persist the filtered set. Fire-and-forget.
    void prisma.user
      .update({ where: { id: userId }, data: { default_helper_user_ids: valid } })
      .catch(() => {});
  }
  return valid;
}

export class CrewValidationError extends Error {
  constructor(public code: 'invalid_helper' | 'self_in_list' | 'too_many') {
    super(code);
    this.name = 'CrewValidationError';
  }
}

function dedupe(ids: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export async function setDefaultCrew(
  userId: number,
  rawIds: number[],
): Promise<number[]> {
  for (const id of rawIds) {
    if (!Number.isInteger(id)) throw new CrewValidationError('invalid_helper');
  }
  const ids = dedupe(rawIds);
  if (ids.some((id) => id === userId)) {
    throw new CrewValidationError('self_in_list');
  }
  if (ids.length > MAX_DEFAULT_HELPERS) {
    throw new CrewValidationError('too_many');
  }
  if (ids.length > 0) {
    const rows = await prisma.user.findMany({
      where: {
        id: { in: ids },
        active: true,
        role: { in: ['admin', 'inspector'] },
      },
      select: { id: true },
    });
    if (rows.length !== ids.length) {
      throw new CrewValidationError('invalid_helper');
    }
  }
  await prisma.user.update({
    where: { id: userId },
    data: { default_helper_user_ids: ids, crew_decided: true },
  });
  return ids;
}
