// src/app/api/users/me/crew/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getDefaultCrew,
  setDefaultCrew,
  CrewValidationError,
} from '@/services/userPreferencesService';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const defaultHelperUserIds = await getDefaultCrew(session.userId);
  return NextResponse.json({ defaultHelperUserIds });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const raw = (body as { defaultHelperUserIds?: unknown }).defaultHelperUserIds;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!raw.every((x) => typeof x === 'number' && Number.isInteger(x))) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  try {
    const saved = await setDefaultCrew(session.userId, raw as number[]);
    return NextResponse.json({ defaultHelperUserIds: saved });
  } catch (err) {
    if (err instanceof CrewValidationError) {
      return NextResponse.json({ error: err.code }, { status: 400 });
    }
    throw err;
  }
}
