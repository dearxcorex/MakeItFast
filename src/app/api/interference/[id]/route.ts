import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { fetchInterferenceSiteById } from '@/services/interferenceService';

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
    if ('notes' in body && typeof body.notes === 'string') {
      updateData.notes = body.notes;
    }
    if ('ranking' in body && typeof body.ranking === 'string' && ALLOWED_RANKINGS.includes(body.ranking)) {
      updateData.ranking = body.ranking;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await prisma.interference_site.update({
      where: { id: numId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Interference site update error:', error);
    return NextResponse.json(
      { error: 'Failed to update interference site' },
      { status: 500 }
    );
  }
}
