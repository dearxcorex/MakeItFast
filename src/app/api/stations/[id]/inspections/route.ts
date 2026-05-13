// src/app/api/stations/[id]/inspections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  createInspection,
  listInspectionsForStation,
} from '@/services/inspectionService';
import { fetchFMStationById } from '@/services/stationService';

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { id } = await params;
  const stationId = parseInt(id, 10);
  if (Number.isNaN(stationId)) return badRequest('Invalid station ID');

  const inspections = await listInspectionsForStation(stationId);
  return NextResponse.json({ inspections });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { id } = await params;
  const stationId = parseInt(id, 10);
  if (Number.isNaN(stationId)) return badRequest('Invalid station ID');

  let body: { inspectedOn?: string; helperUserIds?: unknown; notes?: string };
  try { body = await req.json(); } catch { return badRequest('Invalid JSON'); }

  if (typeof body.inspectedOn !== 'string') return badRequest('inspectedOn is required');
  const helpers = Array.isArray(body.helperUserIds) ? body.helperUserIds : [];
  if (!helpers.every((x) => typeof x === 'number' && Number.isInteger(x))) {
    return badRequest('helperUserIds must be an array of integers');
  }

  try {
    const inspection = await createInspection({
      stationId,
      inspectedOn: body.inspectedOn,
      leadUserId: session.userId,
      helperUserIds: helpers as number[],
      notes: typeof body.notes === 'string' ? body.notes : undefined,
    });
    const station = await fetchFMStationById(stationId);
    return NextResponse.json({ inspection, station }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return badRequest(msg);
  }
}
