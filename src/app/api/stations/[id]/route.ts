import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
        // Check if station has submitted a request before allowing on_air
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
    if (details !== undefined) updates.details = details;
    if (inspection68 !== undefined) {
      // Convert string status to boolean
      updates.inspection_68 = inspection68 === 'ตรวจแล้ว' || inspection68 === true;

      // Auto-set current date when inspection status changes to true
      if (updates.inspection_68) {
        const currentDate = new Date().toISOString().split('T')[0];
        updates.date_inspected = currentDate;
      } else {
        updates.date_inspected = null;
      }
    }
    if (inspection69 !== undefined) {
      // Convert string status to boolean
      updates.inspection_69 = inspection69 === 'ตรวจแล้ว' || inspection69 === true;

      // Auto-set current date when inspection_69 status changes to true
      if (updates.inspection_69) {
        const currentDate = new Date().toISOString().split('T')[0];
        updates.date_inspected = currentDate;
      } else {
        updates.date_inspected = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const data = await prisma.fm_station.update({
      where: { id_fm: stationId },
      data: updates,
    });

    if (!data) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
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
