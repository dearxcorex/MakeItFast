import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchInterferenceSiteById } from '@/services/interferenceService';
import { getSession } from '@/lib/session';
import {
  createInterferenceInspection,
  recomputeInterferenceInspectionState,
} from '@/services/interferenceInspectionService';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
    }

    const site = await fetchInterferenceSiteById(numId);

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    return NextResponse.json({ site });
  } catch (error) {
    console.error('Interference site fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interference site' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
    }

    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const ALLOWED_STATUSES = ['ตรวจแล้ว', 'ยังไม่ตรวจ'];
    const ALLOWED_RANKINGS = ['Critical', 'Major', 'Minor', 'Normal'];

    const updateData: Record<string, unknown> = {};
    if ('status' in body && typeof body.status === 'string' && ALLOWED_STATUSES.includes(body.status)) {
      updateData.status = body.status;
    }
    if ('notes' in body && typeof body.notes === 'string' && body.notes.length <= 4000) {
      updateData.notes = body.notes;
    }
    if ('ranking' in body && typeof body.ranking === 'string' && ALLOWED_RANKINGS.includes(body.ranking)) {
      updateData.ranking = body.ranking;
    }
    if ('lawPaperSent' in body && typeof body.lawPaperSent === 'boolean') {
      updateData.law_paper_sent = body.lawPaperSent;
    }
    if ('sourceLat' in body) {
      const v = body.sourceLat;
      if (v === null) updateData.source_lat = null;
      else if (typeof v === 'number' && Number.isFinite(v) && v >= -90 && v <= 90) {
        updateData.source_lat = v;
      } else {
        return NextResponse.json({ error: 'Invalid sourceLat' }, { status: 400 });
      }
    }
    if ('sourceLong' in body) {
      const v = body.sourceLong;
      if (v === null) updateData.source_long = null;
      else if (typeof v === 'number' && Number.isFinite(v) && v >= -180 && v <= 180) {
        updateData.source_long = v;
      } else {
        return NextResponse.json({ error: 'Invalid sourceLong' }, { status: 400 });
      }
    }
    if ('estimateDistance' in body) {
      const v = body.estimateDistance;
      if (v === null) updateData.estimate_distance = null;
      else if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        updateData.estimate_distance = v;
      } else {
        return NextResponse.json({ error: 'Invalid estimateDistance' }, { status: 400 });
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.interference_site.update({
      where: { id: numId },
      data: updateData,
    });

    // Sidecar: when status flips to 'ตรวจแล้ว', record a history row with
    // any tagged teammates. Idempotent on (interference_id, today, lead_user_id),
    // so repeated toggles in the same day are safe.
    if (updateData.status === 'ตรวจแล้ว') {
      try {
        const session = await getSession();
        if (session.userId) {
          await createInterferenceInspection({
            interferenceId: numId,
            inspectedOn: new Date().toISOString().split('T')[0],
            leadUserId: session.userId,
            helperUserIds: Array.isArray(body.helperUserIds)
              ? body.helperUserIds.filter((x: unknown): x is number =>
                  typeof x === 'number' && Number.isInteger(x))
              : [],
          });
        }
      } catch (err) {
        console.warn(`Failed to record interference inspection history for site ${numId}:`, err);
      }
    }

    // Sidecar: when status flips to 'ยังไม่ตรวจ', delete the caller's today
    // row + recompute. Semantic: the toggle is today's action; OFF can only
    // undo today's action.
    if (updateData.status === 'ยังไม่ตรวจ') {
      try {
        const session = await getSession();
        if (session.userId) {
          const today = new Date().toISOString().split('T')[0];
          await prisma.interference_inspection.deleteMany({
            where: {
              interference_id: numId,
              lead_user_id: session.userId,
              inspected_on: new Date(`${today}T00:00:00Z`),
            },
          });
          await recomputeInterferenceInspectionState(numId);
        }
      } catch (err) {
        console.warn(`Failed to delete interference inspection history for site ${numId}:`, err);
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Interference site update error:', error);
    return NextResponse.json(
      { error: 'Failed to update interference site' },
      { status: 500 }
    );
  }
}
