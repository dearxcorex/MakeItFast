import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { parseStationInput } from "@/utils/stationInput";
import {
  authErrorResponse,
  findIdFmHolder,
  findSameFreqDistrict,
  isUniqueViolation,
  logChange,
  toAdminStation,
} from "@/services/stationAdmin";

type Ctx = { params: Promise<{ id: string }> };

async function readId(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params;
  return /^\d+$/.test(id) ? Number(id) : null;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireAdmin();
    const id = await readId(ctx);
    if (id === null) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "validation_error", fields: {} }, { status: 400 });
    }
    const parsed = parseStationInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: "validation_error", fields: parsed.errors }, { status: 400 });
    }
    const data = parsed.data;

    const found = await prisma.fm_station.findUnique({
      where: { id },
      include: { _count: { select: { inspections: true } } },
    });
    if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { _count, ...before } = found;

    if (await findIdFmHolder(data.id_fm, id)) {
      return NextResponse.json({ error: "id_fm_taken" }, { status: 409 });
    }
    // Only a change to the matching key can create a new near-duplicate; an
    // edit to a station that already has a sibling should not nag every time.
    const keyChanged = data.freq !== before.freq || data.district !== before.district;
    const force = (body as Record<string, unknown>).force === true;
    if (keyChanged && !force) {
      const matches = await findSameFreqDistrict(data, id);
      if (matches.length > 0) {
        return NextResponse.json({ error: "possible_duplicate", matches }, { status: 409 });
      }
    }

    const after = await prisma.$transaction(async (tx) => {
      const row = await tx.fm_station.update({ where: { id }, data });
      await logChange(tx, "update", me.id, id, before, row);
      return row;
    });
    return NextResponse.json({ station: toAdminStation(after, _count?.inspections ?? 0) });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "id_fm_taken" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireAdmin();
    const id = await readId(ctx);
    if (id === null) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

    const found = await prisma.fm_station.findUnique({
      where: { id },
      include: { _count: { select: { inspections: true } } },
    });
    if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // Inspection history is never deleted from here. A station that has been
    // inspected is retired by marking it revoked instead.
    const count = found._count.inspections;
    if (count > 0) {
      return NextResponse.json({ error: "has_inspections", count }, { status: 409 });
    }

    const { _count: _unused, ...before } = found;
    void _unused;
    await prisma.$transaction(async (tx) => {
      await tx.fm_station.delete({ where: { id } });
      await logChange(tx, "delete", me.id, id, before, null);
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}
