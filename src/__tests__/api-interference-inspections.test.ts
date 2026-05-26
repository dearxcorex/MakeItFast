import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockListInspections = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/services/interferenceInspectionService', () => ({
  listInspectionsForInterferenceSite: (...args: unknown[]) => mockListInspections(...args),
}));
vi.mock('@/lib/session', () => ({
  getSession: () => mockGetSession(),
}));

const { GET } = await import('@/app/api/interference/[id]/inspections/route');

describe('GET /api/interference/[id]/inspections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: 1 });
  });

  it('returns inspections for a valid site ID', async () => {
    const fakeInspections = [
      { id: 1, interferenceId: 42, inspectedOn: '2026-05-20', lead: { userId: 1, username: 'dao', displayName: 'dao' }, helpers: [] },
    ];
    mockListInspections.mockResolvedValue(fakeInspections);

    const req = new NextRequest('http://localhost/api/interference/42/inspections');
    const res = await GET(req, { params: Promise.resolve({ id: '42' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.inspections).toEqual(fakeInspections);
    expect(mockListInspections).toHaveBeenCalledWith(42);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue({ userId: null });

    const req = new NextRequest('http://localhost/api/interference/42/inspections');
    const res = await GET(req, { params: Promise.resolve({ id: '42' }) });

    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost/api/interference/abc/inspections');
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });
});
