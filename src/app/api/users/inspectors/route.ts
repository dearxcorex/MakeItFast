// src/app/api/users/inspectors/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const rows = await prisma.user.findMany({
    where: { active: true, role: { in: ['admin', 'inspector'] } },
    select: { id: true, username: true, display_name: true },
    orderBy: { display_name: 'asc' },
  });
  return NextResponse.json({
    users: rows.map((r) => ({ id: r.id, username: r.username, displayName: r.display_name })),
  });
}
