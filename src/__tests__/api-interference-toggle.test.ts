// src/__tests__/api-interference-toggle.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mintCookie } from './helpers/session';

vi.mock('@/lib/prisma', () => ({
  default: {
    interference_site: { update: vi.fn(), findUnique: vi.fn() },
    interference_inspection: { deleteMany: vi.fn() },
  },
}));

vi.mock('@/services/interferenceService', () => ({
  fetchInterferenceSiteById: vi.fn(),
}));

import prisma from '@/lib/prisma';

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    process.env.SESSION_PASSWORD ?? 'test-session-password-32-chars-or-more!!!';
  vi.clearAllMocks();
});

async function makeReq(body: unknown, cookie?: string): Promise<NextRequest> {
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  headers.set('Content-Type', 'application/json');
  return new NextRequest('http://t/api/interference/42', {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/interference/[id] — toggle ON sidecar', () => {
  it('forwards helperUserIds to createInterferenceInspection', async () => {
    vi.mocked(prisma.interference_site.update).mockResolvedValue({ id: 42 } as never);

    const service = await import('@/services/interferenceInspectionService');
    const createSpy = vi
      .spyOn(service, 'createInterferenceInspection')
      .mockResolvedValue({} as never);

    const sessionLib = await import('@/lib/session');
    const getSessionSpy = vi.spyOn(sessionLib, 'getSession').mockResolvedValue({
      userId: 3, username: 'iff', displayName: 'iff', role: 'inspector', issuedAt: Date.now(),
    } as never);

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const { PATCH } = await import('@/app/api/interference/[id]/route');
    const r = await PATCH(
      await makeReq({ status: 'ตรวจแล้ว', helperUserIds: [6, 2] }, c.header),
      { params: Promise.resolve({ id: '42' }) },
    );
    expect(r.status).toBe(200);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      interferenceId: 42,
      leadUserId: 3,
      helperUserIds: [6, 2],
    }));
    createSpy.mockRestore();
    getSessionSpy.mockRestore();
  });

  it('toggle ON still succeeds when createInterferenceInspection throws', async () => {
    vi.mocked(prisma.interference_site.update).mockResolvedValue({ id: 42 } as never);
    const service = await import('@/services/interferenceInspectionService');
    const createSpy = vi
      .spyOn(service, 'createInterferenceInspection')
      .mockRejectedValue(new Error('connection refused') as never);

    const sessionLib = await import('@/lib/session');
    const getSessionSpy = vi.spyOn(sessionLib, 'getSession').mockResolvedValue({
      userId: 3, username: 'iff', displayName: 'iff', role: 'inspector', issuedAt: Date.now(),
    } as never);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const { PATCH } = await import('@/app/api/interference/[id]/route');
    const r = await PATCH(
      await makeReq({ status: 'ตรวจแล้ว' }, c.header),
      { params: Promise.resolve({ id: '42' }) },
    );
    expect(r.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
    createSpy.mockRestore();
    getSessionSpy.mockRestore();
  });
});

describe('PATCH /api/interference/[id] — toggle OFF sidecar', () => {
  it('deletes today\'s caller-owned interference_inspection row + recomputes', async () => {
    vi.mocked(prisma.interference_site.update).mockResolvedValue({ id: 42 } as never);
    vi.mocked(prisma.interference_inspection.deleteMany).mockResolvedValue({ count: 1 } as never);
    const service = await import('@/services/interferenceInspectionService');
    const recomputeSpy = vi
      .spyOn(service, 'recomputeInterferenceInspectionState')
      .mockResolvedValue(undefined as never);

    const sessionLib = await import('@/lib/session');
    const getSessionSpy = vi.spyOn(sessionLib, 'getSession').mockResolvedValue({
      userId: 3, username: 'iff', displayName: 'iff', role: 'inspector', issuedAt: Date.now(),
    } as never);

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const { PATCH } = await import('@/app/api/interference/[id]/route');
    const r = await PATCH(
      await makeReq({ status: 'ยังไม่ตรวจ' }, c.header),
      { params: Promise.resolve({ id: '42' }) },
    );
    expect(r.status).toBe(200);
    expect(prisma.interference_inspection.deleteMany).toHaveBeenCalledWith({
      where: {
        interference_id: 42,
        lead_user_id: 3,
        inspected_on: expect.any(Date),
      },
    });
    expect(recomputeSpy).toHaveBeenCalledWith(42);

    recomputeSpy.mockRestore();
    getSessionSpy.mockRestore();
  });

  it('toggle OFF still succeeds when deleteMany throws', async () => {
    vi.mocked(prisma.interference_site.update).mockResolvedValue({ id: 42 } as never);
    vi.mocked(prisma.interference_inspection.deleteMany).mockRejectedValue(
      new Error('connection refused') as never,
    );
    const service = await import('@/services/interferenceInspectionService');
    const recomputeSpy = vi
      .spyOn(service, 'recomputeInterferenceInspectionState')
      .mockResolvedValue(undefined as never);

    const sessionLib = await import('@/lib/session');
    const getSessionSpy = vi.spyOn(sessionLib, 'getSession').mockResolvedValue({
      userId: 3, username: 'iff', displayName: 'iff', role: 'inspector', issuedAt: Date.now(),
    } as never);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const { PATCH } = await import('@/app/api/interference/[id]/route');
    const r = await PATCH(
      await makeReq({ status: 'ยังไม่ตรวจ' }, c.header),
      { params: Promise.resolve({ id: '42' }) },
    );
    expect(r.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();
    expect(recomputeSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    recomputeSpy.mockRestore();
    getSessionSpy.mockRestore();
  });
});
