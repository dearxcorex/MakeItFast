import { NextResponse } from "next/server";
import { Prisma, type fm_station } from "@prisma/client";
import prisma from "@/lib/prisma";
import { AuthError } from "@/lib/auth";
import type { AdminStation } from "@/types/station";
import type { StationWrite } from "@/utils/stationInput";

type Tx = Prisma.TransactionClient;

export function toAdminStation(row: fm_station, inspectionCount: number): AdminStation {
  return {
    id: row.id,
    idFm: row.id_fm,
    registerStationId: row.register_station_id,
    name: row.name ?? "",
    freq: row.freq,
    lat: row.lat,
    long: row.long,
    district: row.district ?? "",
    province: row.province ?? "",
    type: row.type?.trim() ?? "",
    permit: row.permit,
    submitRequest: row.submit_a_request === true,
    revoked: row.revoked === true,
    revokedNote: row.revoked_note,
    onAir: row.on_air === true,
    inspected: row.inspection_69 === true,
    inspectionCount,
  };
}

/** Another station already holding this id_fm, if any. */
export function findIdFmHolder(idFm: string | null, excludeId?: number) {
  if (!idFm) return Promise.resolve(null);
  return prisma.fm_station.findFirst({
    where: excludeId === undefined ? { id_fm: idFm } : { id_fm: idFm, NOT: { id: excludeId } },
  });
}

/**
 * Stations on the same freq in the same district — the key register sync's
 * Pass 1 matches on, so a near-duplicate here would also confuse the sync.
 */
export async function findSameFreqDistrict(data: StationWrite, excludeId?: number) {
  const rows = await prisma.fm_station.findMany({
    where: { freq: data.freq, district: data.district },
  });
  return rows
    .filter((r) => r.id !== excludeId)
    .map((r) => ({ id: r.id, idFm: r.id_fm, name: r.name, freq: r.freq, district: r.district }));
}

/** fm_station has no Date columns, so a row stores as JSON unchanged. */
function snapshot(row: fm_station): Prisma.InputJsonValue {
  return { ...row } as Prisma.InputJsonValue;
}

export function logChange(
  tx: Tx,
  action: "create" | "update" | "delete",
  userId: number,
  rowId: number,
  before: fm_station | null,
  after: fm_station | null
) {
  return tx.data_change.create({
    data: {
      table_name: "fm_station",
      row_id: rowId,
      action,
      user_id: userId,
      ...(before ? { before: snapshot(before) } : {}),
      ...(after ? { after: snapshot(after) } : {}),
    },
  });
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export function authErrorResponse(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.code }, { status: err.status });
  }
  return null;
}
