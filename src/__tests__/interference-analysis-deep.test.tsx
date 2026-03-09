import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock next/dynamic
vi.mock('next/dynamic', () => ({
  default: () => {
    const C = (props: Record<string, unknown>) => {
      capturedMapProps = props;
      return <div data-testid="interference-map">InterferenceMap</div>;
    };
    C.displayName = 'InterferenceMap';
    return C;
  },
}));

// Capture map callbacks (used for site selection since InterferenceSiteList was removed)
let capturedMapProps: Record<string, unknown> = {};

// Capture filter panel callbacks
let capturedFilterProps: Record<string, unknown> = {};
vi.mock('@/components/interference/InterferenceFilterPanel', () => ({
  default: (props: Record<string, unknown>) => {
    capturedFilterProps = props;
    return <div data-testid="filter-panel">FilterPanel</div>;
  },
}));

vi.mock('@/components/interference/InterferenceSiteDetail', () => ({
  default: ({ site }: { site: { siteName: string } }) => <div data-testid="site-detail">{site.siteName}</div>,
}));

vi.mock('@/components/interference/CloudRFControls', () => ({
  default: ({ onResult, onClearOverlays, overlayCount }: { onResult: (o: unknown) => void; onClearOverlays?: () => void; overlayCount?: number }) => (
    <div data-testid="cloudrf-controls">
      <button data-testid="run-prop" onClick={() => onResult({ siteId: 1, pngUrl: 'http://x.com/i.png', leafletBounds: [[13, 100], [14, 101]] })}>
        Run
      </button>
      {onClearOverlays && <button data-testid="clear-overlays" onClick={onClearOverlays}>Clear {overlayCount}</button>}
    </div>
  ),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  capturedMapProps = {};
  capturedFilterProps = {};
});

import InterferenceAnalysis from '@/components/interference/InterferenceAnalysis';

const makeSite = (overrides = {}) => ({
  id: 1, siteCode: 'AWN-001', siteName: 'Test Site',
  lat: 13.75, long: 100.5, direction: 120, ranking: 'Critical',
  ...overrides,
});

describe('InterferenceAnalysis - fetchSites', () => {
  it('fetches sites on mount', async () => {
    const sites = [makeSite({ id: 1 }), makeSite({ id: 2 })];
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites }) });

    render(<InterferenceAnalysis />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/interference'));
    });
  });

  it('handles fetch error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network'));

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => {
      // Should still render without crashing
      expect(container.textContent).toContain('Interference Analysis');
    });
  });

  it('refetches when filters change', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites: [] }) });

    render(<InterferenceAnalysis />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Simulate filter change via captured callback
    const onFiltersChange = capturedFilterProps.onFiltersChange as (f: Record<string, string>) => void;
    await act(async () => {
      onFiltersChange({ changwat: 'กรุงเทพ' });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).toContain('changwat=');
    });
  });
});

describe('InterferenceAnalysis - site selection via map', () => {
  it('shows detail view when site is selected via map', async () => {
    const sites = [makeSite({ id: 1, siteName: 'Selected Site' })];
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites }) });

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => {
      expect(capturedMapProps.onSiteSelect).toBeTruthy();
    });

    // Simulate site selection via map
    const onSiteSelect = capturedMapProps.onSiteSelect as (s: unknown) => void;
    act(() => {
      onSiteSelect(sites[0]);
    });

    expect(container.querySelector('[data-testid="site-detail"]')?.textContent).toContain('Selected Site');
    expect(container.querySelector('[data-testid="cloudrf-controls"]')).toBeTruthy();
    expect(container.textContent).toContain('Back to filters');
  });

  it('goes back to filters when back button clicked', async () => {
    const sites = [makeSite({ id: 1, siteName: 'Test' })];
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites }) });

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => expect(capturedMapProps.onSiteSelect).toBeTruthy());

    const onSiteSelect = capturedMapProps.onSiteSelect as (s: unknown) => void;
    act(() => {
      onSiteSelect(sites[0]);
    });

    // Click "Back to filters"
    const backBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Back to filters')
    )!;
    fireEvent.click(backBtn);

    expect(container.querySelector('[data-testid="filter-panel"]')).toBeTruthy();
  });
});

describe('InterferenceAnalysis - propagation overlays', () => {
  it('adds overlay via CloudRFControls and shows overlay count', async () => {
    const sites = [makeSite({ id: 1, siteName: 'Site' })];
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites }) });

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => expect(capturedMapProps.onSiteSelect).toBeTruthy());

    // Select site to show CloudRFControls
    const onSiteSelect = capturedMapProps.onSiteSelect as (s: unknown) => void;
    act(() => {
      onSiteSelect(sites[0]);
    });

    // Click Run in mocked CloudRFControls
    const runBtn = container.querySelector('[data-testid="run-prop"]')!;
    fireEvent.click(runBtn);

    // Should show overlay count
    await waitFor(() => {
      expect(container.textContent).toContain('Clear 1');
    });
  });

  it('clears overlays via CloudRFControls', async () => {
    const sites = [makeSite({ id: 1, siteName: 'Site' })];
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites }) });

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => expect(capturedMapProps.onSiteSelect).toBeTruthy());

    const onSiteSelect = capturedMapProps.onSiteSelect as (s: unknown) => void;
    act(() => {
      onSiteSelect(sites[0]);
    });

    // Add overlay
    const runBtn = container.querySelector('[data-testid="run-prop"]')!;
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(container.textContent).toContain('Clear 1');
    });

    // Clear overlays
    const clearBtn = container.querySelector('[data-testid="clear-overlays"]')!;
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(container.textContent).toContain('Clear 0');
    });
  });
});
