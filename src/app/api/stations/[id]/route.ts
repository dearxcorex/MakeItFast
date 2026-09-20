import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createInspection, recomputeStationInspectionState } from '@/services/inspectionService';
import { getSession } from '@/lib/session';
import { bangkokToday } from '@/utils/bangkokDate';
import { queueInspectionNotice, queueNoticeRetraction } from '@/services/inspectionNotifier';

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
    const { onAir, inspection69, helperUserIds } = body;

    // Build update object with only provided fields
    const updates: Record<string, boolean | string | null> = {};

    // If trying to set on_air, check if station has submitted a request
    if (onAir !== undefined) {
      if (onAir === true) {
        const station = await prisma.fm_station.findUnique({
          where: { id: stationId },
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
    if (inspection69 !== undefined) {
      const truthy = inspection69 === 'ตรวจแล้ว' || inspection69 === true;
      updates.inspection_69 = truthy;
      updates.date_inspected = truthy ? bangkokToday() : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const data = await prisma.fm_station.update({
      where: { id: stationId },
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
          const inspection = await createInspection({
            stationId,
            inspectedOn: bangkokToday(),
            leadUserId: session.userId,
            helperUserIds: Array.isArray(helperUserIds)
              ? helperUserIds.filter((x: unknown): x is number => typeof x === 'number' && Number.isInteger(x))
              : [],
          });
          queueInspectionNotice('fm', inspection.id);
        }
      } catch (err) {
        // Don't fail the PATCH if the history insert fails — the boolean
        // update is the user's intent. The service is idempotent, so
        // duplicates are not an error path here; this catches DB outages,
        // missing-user races, etc.
        console.warn(`Failed to record inspection history for station ${stationId}:`, err);
      }
    }

    // Sidecar: when toggling inspection OFF, delete the caller's
    // station_inspection row for TODAY. Semantic: the toggle is "today's
    // action"; OFF can only undo today's action. Older inspections by the
    // same user, or inspections by other leads, are untouched.
    // recomputeStationInspectionState keeps fm_station.inspection_69 = true
    // if any remaining history exists for the station.
    if (updates.inspection_69 === false) {
      try {
        const session = await getSession();
        if (session.userId) {
          const today = bangkokToday();
          const where = {
            station_id: stationId,
            lead_user_id: session.userId,
            inspected_on: new Date(`${today}T00:00:00Z`),
          };
          const undone = await prisma.station_inspection.findFirst({
            where,
            select: { discord_message_id: true },
          });
          await prisma.station_inspection.deleteMany({ where });
          await recomputeStationInspectionState(stationId);
          queueNoticeRetraction(undone?.discord_message_id);
        }
      } catch (err) {
        console.warn(`Failed to delete inspection history for station ${stationId}:`, err);
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
      where: { id: stationId },
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
