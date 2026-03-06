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

    const updateData: Record<string, unknown> = {};
    if ('status' in body && typeof body.status === 'string') updateData.status = body.status;
    if ('notes' in body && typeof body.notes === 'string') updateData.notes = body.notes;
    if ('ranking' in body && typeof body.ranking === 'string') updateData.ranking = body.ranking;

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
