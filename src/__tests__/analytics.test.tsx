import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import React from 'react';

// Mock Recharts to avoid SVG measurement issues in jsdom
vi.mock('recharts', () => {
  const MockComponent = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    BarChart: MockComponent,
    Bar: MockComponent,
    XAxis: MockComponent,
    YAxis: MockComponent,
    CartesianGrid: MockComponent,
    Tooltip: MockComponent,
    ResponsiveContainer: MockComponent,
    Cell: MockComponent,
    PieChart: MockComponent,
    Pie: MockComponent,
    Legend: MockComponent,
    AreaChart: MockComponent,
    Area: MockComponent,
  };
});

import StatCard from '@/components/analytics/StatCard';
import ChartCard from '@/components/analytics/ChartCard';
import ProgressRing from '@/components/analytics/ProgressRing';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import type { AnalyticsSummary } from '@/types/analytics';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockSummary: AnalyticsSummary = {
  heroStats: {
    totalStations: 218,
    inspectedStations: 5,
    totalInterferenceSites: 218,
    criticalInterference: 34,
    inspectedInterference: 5,
    pendingInterference: 213,
    directionMatchRate: 62,
    onAirStations: 180,
    offAirStations: 38,
  },
  byProvince: [
    { name: 'นครราชสีมา', total: 120, critical: 15, major: 30, minor: 75, inspected: 3 },
    { name: 'ชัยภูมิ', total: 55, critical: 10, major: 20, minor: 25, inspected: 1 },
    { name: 'บุรีรัมย์', total: 43, critical: 9, major: 14, minor: 20, inspected: 1 },
  ],
  rankingDistribution: [
    { ranking: 'Critical', count: 34 },
    { ranking: 'Major', count: 64 },
    { ranking: 'Minor', count: 120 },
  ],
  inspectionStatus: { inspected: 5, pending: 213 },
  topCriticalSites: [
    { id: 1, siteName: 'Site A', siteCode: 'AWN-001', changwat: 'นครราชสีมา', ranking: 'Critical', status: null },
  ],
  recentActivity: [
    { id: 1, siteName: 'Site A', siteCode: 'AWN-001', ranking: 'Critical', status: null, updatedAt: '2026-04-05T10:00:00.000Z' },
  ],
  fmStationsByProvince: [
    { name: 'นครราชสีมา', total: 80, inspected69: 12 },
    { name: 'ชัยภูมิ', total: 40, inspected69: 5 },
  ],
  fmStationAirStatus: { onAir: 180, offAir: 38 },
  fmStationInspection: { inspection68: 3, inspection69: 2, bothYears: 0, neverInspected: 213 },
  fmFrequencyDistribution: [
    { band: '88-90', count: 15 },
    { band: '90-92', count: 22 },
    { band: '92-94', count: 18 },
  ],
  fmStationRequests: { submitted: 45, notSubmitted: 173 },
};

describe('StatCard', () => {
  it('renders label', () => {
    const { container } = render(<StatCard label="Total" value={218} tone="teal" />);
    expect(container.textContent).toContain('Total');
  });

  it('renders suffix', () => {
    const { container } = render(<StatCard label="Match" value={62} suffix="%" tone="jade" />);
    expect(container.textContent).toContain('%');
  });

  it('renders subtitle', () => {
    const { container } = render(<StatCard label="Sites" value={100} subtitle="12 pending" />);
    expect(container.textContent).toContain('12 pending');
  });

  it('renders icon when provided', () => {
    const { container } = render(
      <StatCard label="x" value={1} icon={<svg data-testid="icon" />} />
    );
    expect(container.querySelector('[data-testid="icon"]')).toBeTruthy();
  });
});

describe('ChartCard', () => {
  it('renders title and children', () => {
    const { container } = render(
      <ChartCard title="My Chart">
        <div>chart content</div>
      </ChartCard>
    );
    expect(container.textContent).toContain('My Chart');
    expect(container.textContent).toContain('chart content');
  });

  it('renders subtitle', () => {
    const { container } = render(
      <ChartCard title="X" subtitle="helpful text">
        <div />
      </ChartCard>
    );
    expect(container.textContent).toContain('helpful text');
  });

  it('renders scallop accent', () => {
    const { container } = render(
      <ChartCard title="X">
        <div />
      </ChartCard>
    );
    expect(container.querySelector('.tt-scallop')).toBeTruthy();
  });
});

describe('ProgressRing', () => {
  it('renders with label', () => {
    const { container } = render(<ProgressRing value={75} label="done" />);
    expect(container.textContent).toContain('done');
  });

  it('renders percent sign', () => {
    const { container } = render(<ProgressRing value={50} />);
    expect(container.textContent).toContain('%');
  });

  it('renders svg circles', () => {
    const { container } = render(<ProgressRing value={30} />);
    expect(container.querySelectorAll('circle').length).toBe(2);
  });
});

describe('AnalyticsDashboard', () => {
  it('shows loading state initially', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    const { container } = render(<AnalyticsDashboard />);
    expect(container.textContent).toContain('Loading');
  });

  it('shows error state on fetch failure', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 } as Response));
    const { container } = render(<AnalyticsDashboard />);
    await waitFor(() => {
      expect(container.textContent).toContain('Unable to load');
    });
  });

  it('renders full dashboard with valid data', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary) } as Response)
    );
    const { container } = render(<AnalyticsDashboard />);
    await waitFor(() => {
      expect(container.textContent).toContain('Analytics Dashboard');
    });
    expect(container.textContent).toContain('FM Stations');
    expect(container.textContent).toContain('Interference Sites');
    expect(container.textContent).toContain('Critical Alerts');
    expect(container.textContent).toContain('Direction Match');
    expect(container.textContent).toContain('Interference by Province');
    expect(container.textContent).toContain('Severity Distribution');
    expect(container.textContent).toContain('FM Station Insights');
    expect(container.textContent).toContain('FM Stations by Province');
    expect(container.textContent).toContain('Inspection Coverage');
    expect(container.textContent).toContain('ตรวจแล้ว');
    expect(container.textContent).toContain('ยังไม่ตรวจ');
  });

  it('shows inspection coverage percentage based on year 69', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary) } as Response)
    );
    const { container } = render(<AnalyticsDashboard />);
    await waitFor(() => {
      expect(container.textContent).toContain('Inspection Coverage');
    });
    // inspection69=2 + bothYears=0 = 2 inspected, out of 218 total
    expect(container.textContent).toMatch(/ตรวจสอบปี 69/);
  });
});
