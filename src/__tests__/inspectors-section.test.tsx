// src/__tests__/inspectors-section.test.tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

vi.mock('@/components/analytics/charts/FoBarChart', () => ({ default: () => null }));
vi.mock('@/components/analytics/charts/FoDonut', () => ({ default: () => null }));

import InspectorsSection from '@/components/analytics/InspectorsSection';
import type { InspectorsAnalytics } from '@/types/analytics';

afterEach(() => cleanup());

const SAMPLE: InspectorsAnalytics = {
  generatedAt: '2026-05-16T12:00:00.000Z',
  thisYear: 2026,
  thisMonth: '2026-05',
  inspectors: [
    { userId: 3, username: 'iff', displayName: 'iff', ytdTotal: 14, monthTotal: 3, ytdAsLead: 11, ytdAsHelper: 3, lastActive: '2026-05-12' },
    { userId: 6, username: 'daf', displayName: 'daf', ytdTotal: 9, monthTotal: 1, ytdAsLead: 4, ytdAsHelper: 5, lastActive: '2026-04-25' },
    { userId: 2, username: 'ice', displayName: 'ice', ytdTotal: 7, monthTotal: 0, ytdAsLead: 6, ytdAsHelper: 1, lastActive: '2026-04-21' },
  ],
  monthlySeries: Array.from({ length: 12 }, (_, i) => ({ month: `2025-${String(i + 1).padStart(2, '0')}`, perUser: {} })),
  kpis: {
    activeThisMonth: 2,
    largestTeam: { inspectionId: 42, stationId: 5520014, stationName: 'กว้างไกล ฟ้าใส', inspectedOn: '2026-04-21', memberCount: 3 },
    mostTaggedHelperThisYear: { username: 'daf', displayName: 'daf', count: 5 },
  },
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InspectorsSection', () => {
  it('shows a skeleton while fetching', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Promise(() => {})); // never resolves
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<InspectorsSection />);
    expect(container.textContent).toMatch(/loading|skeleton|\.\.\./i);
  });

  it('renders leaderboard rows in DESC ytdTotal order with TopPerformer hero', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => SAMPLE,
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<InspectorsSection />);

    // wait for data — 'iff' appears in both the hero card and the leaderboard table
    await waitFor(() => expect(screen.getAllByText('iff').length).toBeGreaterThanOrEqual(1));

    // TopPerformer hero card
    expect(container.textContent).toContain('TOP PERFORMER');
    expect(container.textContent).toContain('14');

    // Leaderboard: rows in order iff, daf, ice (sorted DESC by ytdTotal)
    const rows = screen.getAllByRole('row');
    // first row is header; data rows follow
    expect(rows[1].textContent).toContain('iff');
    expect(rows[2].textContent).toContain('daf');
    expect(rows[3].textContent).toContain('ice');
  });

  it('shows error banner when fetch fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    render(<InspectorsSection />);
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeTruthy());
  });

  it('shows empty-state when there is no inspection data', async () => {
    const empty: InspectorsAnalytics = {
      ...SAMPLE,
      inspectors: [],
      monthlySeries: SAMPLE.monthlySeries.map((m) => ({ ...m, perUser: {} })),
      kpis: { activeThisMonth: 0, largestTeam: null, mostTaggedHelperThisYear: null },
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => empty });
    vi.stubGlobal('fetch', fetchMock);

    render(<InspectorsSection />);
    await waitFor(() => expect(screen.getByText(/no inspection activity yet/i)).toBeTruthy());
  });
});
