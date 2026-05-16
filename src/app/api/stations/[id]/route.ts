import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createInspection } from '@/services/inspectionService';
import { getSession } from '@/lib/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const stationId = parseInt(id);
    if (isNaN(stationId)) {
      return NextResponse.json({ error: 'Invalid station ID' }, { status: 400 });
    }

    const body = await request.json();
    const { onAir, inspection68, inspection69, details } = body;

    // Build update object with only provided fields
    const updates: Record<string, boolean | string | null> = {};

    // If trying to set on_air, check if station has submitted a request
    if (onAir !== undefined) {
      if (onAir === true) {
        const station = await prisma.fm_station.findUnique({
          where: { id_fm: stationId },
          select: { submit_a_request: true }
        });

        if (!station?.submit_a_request) {
          return NextResponse.json({
            error: 'Cannot set on_air to true: station has not submitted a request'
          }, { status: 400 });
        }
      }
      updates.on_air = onAir;
    }
    if (details !== undefined) updates.note = details;
    if (inspection68 !== undefined) {
      updates.inspection_68 = inspection68 === 'ตรวจแล้ว' || inspection68 === true;
    }
    if (inspection69 !== undefined) {
      const truthy = inspection69 === 'ตรวจแล้ว' || inspection69 === true;
      updates.inspection_69 = truthy;
      updates.date_inspected = truthy ? new Date().toISOString().split('T')[0] : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const data = await prisma.fm_station.update({
      where: { id_fm: stationId },
      data: updates,
    });

    // Sidecar: when toggling inspection ON, also record a station_inspection row
    // so history continues to accumulate even though the UI no longer exposes
    // the multi-helper form. Idempotent on (station_id, inspected_on,
    // lead_user_id), so repeated toggles in the same day are safe.
    if (updates.inspection_69 === true) {
      try {
        const session = await getSession();
        if (session.userId) {
          await createInspection({
            stationId,
            inspectedOn: new Date().toISOString().split('T')[0],
            leadUserId: session.userId,
            helperUserIds: [],
          });
        }
      } catch (err) {
        // Don't fail the PATCH if the history insert fails — the boolean
        // update is the user's intent. The service is idempotent, so
        // duplicates are not an error path here; this catches DB outages,
        // missing-user races, etc.
        console.warn(`Failed to record inspection history for station ${stationId}:`, err);
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const stationId = parseInt(id);
    if (isNaN(stationId)) {
      return NextResponse.json({ error: 'Invalid station ID' }, { status: 400 });
    }

    const data = await prisma.fm_station.findUnique({
      where: { id_fm: stationId },
    });

    if (!data) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    return NextResponse.json({ station: data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
