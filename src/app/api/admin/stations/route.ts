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

export async function GET() {
  try {
    await requireAdmin();
    const rows = await prisma.fm_station.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { inspections: true } } },
    });
    return NextResponse.json({
      stations: rows.map((r) => toAdminStation(r, r._count.inspections)),
    });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAdmin();
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

    if (await findIdFmHolder(data.id_fm)) {
      return NextResponse.json({ error: "id_fm_taken" }, { status: 409 });
    }
    const force = (body as Record<string, unknown>).force === true;
    if (!force) {
      const matches = await findSameFreqDistrict(data);
      if (matches.length > 0) {
        return NextResponse.json({ error: "possible_duplicate", matches }, { status: 409 });
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.fm_station.create({ data });
      await logChange(tx, "create", me.id, row.id, null, row);
      return row;
    });
    return NextResponse.json({ station: toAdminStation(created, 0) }, { status: 201 });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    // Two admins racing for the same id_fm: the unique index settles it.
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: "id_fm_taken" }, { status: 409 });
    }
    throw err;
  }
}
