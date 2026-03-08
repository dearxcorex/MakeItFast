import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock next/dynamic
vi.mock('next/dynamic', () => ({
  default: () => {
    const C = () => <div data-testid="interference-map">InterferenceMap</div>;
    C.displayName = 'InterferenceMap';
    return C;
  },
}));

// Capture InterferenceSiteList callbacks
let capturedSiteListProps: Record<string, unknown> = {};
vi.mock('@/components/interference/InterferenceSiteList', () => ({
  default: (props: Record<string, unknown>) => {
    capturedSiteListProps = props;
    return <div data-testid="site-list">{(props.loading as boolean) ? 'Loading...' : `${(props.sites as unknown[]).length} sites`}</div>;
  },
}));

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

vi.mock('@/components/interference/ImportDialog', () => ({
  default: ({ onClose, onImportComplete }: { onClose: () => void; onImportComplete: () => void }) => (
    <div data-testid="import-dialog">
      <button data-testid="close-import" onClick={onClose}>Close</button>
      <button data-testid="complete-import" onClick={onImportComplete}>Complete</button>
    </div>
  ),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  capturedSiteListProps = {};
  capturedFilterProps = {};
});

import InterferenceAnalysis from '@/components/interference/InterferenceAnalysis';

const makeSite = (overrides = {}) => ({
  id: 1, siteCode: 'AWN-001', siteName: 'Test Site',
  lat: 13.75, long: 100.5, direction: 120, ranking: 'Critical',
  ...overrides,
});

describe('InterferenceAnalysis - fetchSites', () => {
  it('fetches sites on mount and shows them', async () => {
    const sites = [makeSite({ id: 1 }), makeSite({ id: 2 })];
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites }) });

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="site-list"]')?.textContent).toContain('2 sites');
    });
  });

  it('handles fetch error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network'));

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="site-list"]')?.textContent).toContain('0 sites');
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

describe('InterferenceAnalysis - site selection', () => {
  it('shows detail view when site is selected', async () => {
    const sites = [makeSite({ id: 1, siteName: 'Selected Site' })];
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites }) });

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => {
      expect(capturedSiteListProps.sites).toBeTruthy();
    });

    // Simulate site selection
    const onSiteSelect = capturedSiteListProps.onSiteSelect as (s: unknown) => void;
    act(() => {
      onSiteSelect(sites[0]);
    });

    expect(container.querySelector('[data-testid="site-detail"]')?.textContent).toContain('Selected Site');
    expect(container.querySelector('[data-testid="cloudrf-controls"]')).toBeTruthy();
    expect(container.textContent).toContain('Back to list');
  });

  it('goes back to list when back button clicked', async () => {
    const sites = [makeSite({ id: 1, siteName: 'Test' })];
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites }) });

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => expect(capturedSiteListProps.sites).toBeTruthy());

    const onSiteSelect = capturedSiteListProps.onSiteSelect as (s: unknown) => void;
    act(() => {
      onSiteSelect(sites[0]);
    });

    // Click "Back to list"
    const backBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Back to list')
    )!;
    fireEvent.click(backBtn);

    expect(container.querySelector('[data-testid="filter-panel"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="site-list"]')).toBeTruthy();
  });
});

describe('InterferenceAnalysis - import dialog', () => {
  it('shows import dialog when Import CSV clicked', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites: [] }) });

    const { container } = render(<InterferenceAnalysis />);

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Import CSV')
    )!;
    fireEvent.click(importBtn);

    expect(container.querySelector('[data-testid="import-dialog"]')).toBeTruthy();
  });

  it('closes import dialog on close', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites: [] }) });

    const { container } = render(<InterferenceAnalysis />);

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Import CSV')
    )!;
    fireEvent.click(importBtn);

    const closeBtn = container.querySelector('[data-testid="close-import"]')!;
    fireEvent.click(closeBtn);

    expect(container.querySelector('[data-testid="import-dialog"]')).toBeNull();
  });

  it('closes dialog and refetches on import complete', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites: [] }) });

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Import CSV')
    )!;
    fireEvent.click(importBtn);

    const completeBtn = container.querySelector('[data-testid="complete-import"]')!;

    await act(async () => {
      fireEvent.click(completeBtn);
    });

    expect(container.querySelector('[data-testid="import-dialog"]')).toBeNull();
    // Should have refetched
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('InterferenceAnalysis - propagation overlays', () => {
  it('adds overlay via CloudRFControls and shows overlay count', async () => {
    const sites = [makeSite({ id: 1, siteName: 'Site' })];
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites }) });

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => expect(capturedSiteListProps.sites).toBeTruthy());

    // Select site to show CloudRFControls
    const onSiteSelect = capturedSiteListProps.onSiteSelect as (s: unknown) => void;
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

    await waitFor(() => expect(capturedSiteListProps.sites).toBeTruthy());

    const onSiteSelect = capturedSiteListProps.onSiteSelect as (s: unknown) => void;
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

describe('InterferenceAnalysis - multisite analysis', () => {
  it('calls multisite API and adds overlay', async () => {
    const sites = [makeSite({ id: 1 }), makeSite({ id: 2 })];
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sites }) }) // initial fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pngUrl: 'http://x.com/multi.png', bounds: [[13, 100], [14, 101]] }),
      }); // multisite call

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="site-list"]')?.textContent).toContain('2 sites');
    });

    const multiBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Multi-Site')
    )!;

    await act(async () => {
      fireEvent.click(multiBtn);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('disables multisite button when no sites with coordinates', async () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites: [] }) });

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => {
      const multiBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Multi-Site')
      )!;
      expect(multiBtn.disabled).toBe(true);
    });
  });

  it('shows Analyzing... while multisite loading', async () => {
    const sites = [makeSite({ id: 1 })];
    let resolveMulti: (v: unknown) => void;
    const multiPromise = new Promise((resolve) => { resolveMulti = resolve; });

    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sites }) })
      .mockReturnValueOnce(multiPromise);

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="site-list"]')?.textContent).toContain('1 sites');
    });

    const multiBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Multi-Site')
    )!;

    act(() => {
      fireEvent.click(multiBtn);
    });

    expect(container.textContent).toContain('Analyzing...');

    await act(async () => {
      resolveMulti!({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('handles multisite API error gracefully', async () => {
    const sites = [makeSite({ id: 1 })];
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sites }) })
      .mockRejectedValueOnce(new Error('fail'));

    const { container } = render(<InterferenceAnalysis />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="site-list"]')?.textContent).toContain('1 sites');
    });

    const multiBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Multi-Site')
    )!;

    await act(async () => {
      fireEvent.click(multiBtn);
    });

    // Should not crash - still showing sites
    expect(container.textContent).toContain('Multi-Site');
  });
});
