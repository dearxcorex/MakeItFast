// src/__tests__/api-users-me-crew.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mintCookie } from './helpers/session';
import { COOKIE_NAME } from '@/lib/session';

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v ? { name, value: v } : undefined;
    },
    set: () => {},
    delete: () => {},
  }),
}));

import prisma from '@/lib/prisma';
import { GET as getCrew, PUT as putCrew } from '@/app/api/users/me/crew/route';

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    process.env.SESSION_PASSWORD ?? 'test-session-password-32-chars-or-more!!!';
  cookieStore.clear();
  vi.clearAllMocks();
});

async function req(
  url: string,
  init?: { method?: string; cookie?: string; body?: unknown },
): Promise<NextRequest> {
  const headers = new Headers();
  if (init?.cookie) {
    headers.set('Cookie', init.cookie);
    const match = init.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (match) cookieStore.set(COOKIE_NAME, match[1]);
  }
  if (init?.body) headers.set('Content-Type', 'application/json');
  return new NextRequest(url, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
}

describe('GET /api/users/me/crew', () => {
  it('401 when no session', async () => {
    const r = await getCrew(await req('http://t/api/users/me/crew'));
    expect(r.status).toBe(401);
  });

  it('200 with defaultHelperUserIds: null when undecided', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3, default_helper_user_ids: [], crew_decided: false,
    } as never);
    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff' });
    const r = await getCrew(await req('http://t/api/users/me/crew', { cookie: c.header }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ defaultHelperUserIds: null });
  });

  it('200 with [] when solo', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3, default_helper_user_ids: [], crew_decided: true,
    } as never);
    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff' });
    const r = await getCrew(await req('http://t/api/users/me/crew', { cookie: c.header }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ defaultHelperUserIds: [] });
  });

  it('200 with the persisted crew', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 3, default_helper_user_ids: [6, 7], crew_decided: true,
    } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 6 }, { id: 7 },
    ] as never);
    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff' });
    const r = await getCrew(await req('http://t/api/users/me/crew', { cookie: c.header }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ defaultHelperUserIds: [6, 7] });
  });
});

describe('PUT /api/users/me/crew', () => {
  it('401 when no session', async () => {
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      body: { defaultHelperUserIds: [] },
    }));
    expect(r.status).toBe(401);
  });

  it('400 when body is not an object', async () => {
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: [1, 2, 3] as unknown as object,
    }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'invalid_body' });
  });

  it('400 when defaultHelperUserIds is not an array', async () => {
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: 'nope' as unknown as number[] },
    }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'invalid_body' });
  });

  it('400 when array contains a non-integer', async () => {
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: [6, 'oops' as unknown as number] },
    }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'invalid_body' });
  });

  it('400 self_in_list', async () => {
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: [3] },
    }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'self_in_list' });
  });

  it('400 too_many', async () => {
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: [4, 5, 6, 7, 8, 9] },
    }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'too_many' });
  });

  it('400 invalid_helper when an id is not an active inspector', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([{ id: 6 }] as never);
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: [6, 9] },
    }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'invalid_helper' });
  });

  it('200 saves solo []', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: 3, default_helper_user_ids: [], crew_decided: true,
    } as never);
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: [] },
    }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ defaultHelperUserIds: [] });
  });

  it('200 saves a valid crew', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: 6 }, { id: 7 },
    ] as never);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: 3, default_helper_user_ids: [6, 7], crew_decided: true,
    } as never);
    const c = await mintCookie({ userId: 3 });
    const r = await putCrew(await req('http://t/api/users/me/crew', {
      method: 'PUT',
      cookie: c.header,
      body: { defaultHelperUserIds: [6, 7] },
    }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ defaultHelperUserIds: [6, 7] });
  });
});
