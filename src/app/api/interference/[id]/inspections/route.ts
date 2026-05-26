import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listInspectionsForInterferenceSite } from '@/services/interferenceInspectionService';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const siteId = parseInt(id, 10);
  if (Number.isNaN(siteId)) {
    return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
  }

  const inspections = await listInspectionsForInterferenceSite(siteId);
  return NextResponse.json({ inspections });
}
