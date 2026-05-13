// src/app/api/inspections/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { deleteInspection } from '@/services/inspectionService';
import { fetchFMStationById } from '@/services/stationService';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const { id } = await params;
  const inspectionId = parseInt(id, 10);
  if (Number.isNaN(inspectionId)) {
    return NextResponse.json({ error: 'Invalid inspection ID' }, { status: 400 });
  }

  try {
    const stationId = await deleteInspection(inspectionId, session);
    const station = await fetchFMStationById(stationId);
    return NextResponse.json({ ok: true, station });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'forbidden') {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
