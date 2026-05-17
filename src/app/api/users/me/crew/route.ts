// src/app/api/users/me/crew/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import { getDefaultCrew } from '@/services/userPreferencesService';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const defaultHelperUserIds = await getDefaultCrew(session.userId);
  return NextResponse.json({ defaultHelperUserIds });
}
