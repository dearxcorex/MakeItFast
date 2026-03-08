import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import React from 'react';

// ==========================================
// Mock global fetch
// ==========================================
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ==========================================
// Mock next/dynamic for InterferenceAnalysis
// ==========================================
vi.mock('next/dynamic', () => ({
  default: () => {
    const DynamicComponent = (props: Record<string, unknown>) => (
      <div data-testid="interference-map">InterferenceMap</div>
    );
    DynamicComponent.displayName = 'InterferenceMap';
    return DynamicComponent;
  },
}));

// Mock child components for InterferenceAnalysis tests
vi.mock('@/components/interference/InterferenceFilterPanel', () => ({
  default: ({ filters, onFiltersChange }: { filters: Record<string, unknown>; onFiltersChange: (f: Record<string, unknown>) => void }) => (
    <div data-testid="filter-panel">
      <button data-testid="set-filter" onClick={() => onFiltersChange({ changwat: 'Bangkok' })}>
        Set Filter
      </button>
    </div>
  ),
}));

vi.mock('@/components/interference/InterferenceSiteList', () => ({
  default: ({
    sites,
    selectedSite,
    onSiteSelect,
    loading,
  }: {
    sites: Array<{ id: number; siteName: string; lat: number; long: number }>;
    selectedSite: unknown;
    onSiteSelect: (site: unknown) => void;
    loading: boolean;
  }) => (
    <div data-testid="site-list">
      {loading ? 'Loading...' : `${sites.length} sites`}
      {sites.map((s) => (
        <button key={s.id} data-testid={`select-site-${s.id}`} onClick={() => onSiteSelect(s)}>
          {s.siteName}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/components/interference/InterferenceSiteDetail', () => ({
  default: ({ site }: { site: { siteName: string } }) => (
    <div data-testid="site-detail">{site.siteName} Detail</div>
  ),
}));

vi.mock('@/components/interference/CloudRFControls', () => ({
  default: ({
    site,
    onResult,
    onClearOverlays,
    overlayCount,
  }: {
    site: { id: number };
    onResult: (o: unknown) => void;
    onClearOverlays: () => void;
    overlayCount: number;
  }) => (
    <div data-testid="cloudrf-controls">
      CloudRF for site {site.id}, overlays: {overlayCount}
      <button data-testid="add-overlay" onClick={() => onResult({ siteId: site.id, pngUrl: 'test.png', leafletBounds: [[0,0],[1,1]] })}>
        Add Overlay
      </button>
      <button data-testid="clear-overlays" onClick={onClearOverlays}>
        Clear
      </button>
    </div>
  ),
}));

vi.mock('@/components/interference/ImportDialog', () => ({
  default: ({
    onClose,
    onImportComplete,
  }: {
    onClose: () => void;
    onImportComplete: () => void;
  }) => (
    <div data-testid="import-dialog">
      <button data-testid="close-import" onClick={onClose}>Close</button>
      <button data-testid="complete-import" onClick={onImportComplete}>Complete</button>
    </div>
  ),
}));

import InterferenceAnalysis from '@/components/interference/InterferenceAnalysis';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockSites = [
  { id: 1, siteCode: 'AWN-001', siteName: 'Site Alpha', lat: 13.75, long: 100.5, changwat: 'Bangkok', ranking: 'Critical', mcZone: null, cellName: null, sectorName: null, direction: 90, avgNiCarrier: -80, dayTime: null, nightTime: null, sourceLat: null, sourceLong: null, estimateDistance: 2.5, status: null, nbtcArea: null, awnContact: null, lot: null, onSiteScanBy: null, onSiteScanDate: null, checkRealtime: null, sourceLocation1: null, sourceLocation2: null, cameraModel1: null, cameraModel2: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, siteCode: 'AWN-002', siteName: 'Site Beta', lat: 14.0, long: 101.0, changwat: 'Nonthaburi', ranking: 'Major', mcZone: null, cellName: null, sectorName: null, direction: 180, avgNiCarrier: -75, dayTime: null, nightTime: null, sourceLat: null, sourceLong: null, estimateDistance: 5.0, status: null, nbtcArea: null, awnContact: null, lot: null, onSiteScanBy: null, onSiteScanDate: null, checkRealtime: null, sourceLocation1: null, sourceLocation2: null, cameraModel1: null, cameraModel2: null, notes: null, createdAt: new Date(), updatedAt: new Date() },
];

describe('InterferenceAnalysis', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sites: mockSites }),
    });
  });

  it('renders heading and buttons', async () => {
    const { container } = render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(container.textContent).toContain('Interference Analysis');
    });
    expect(container.textContent).toContain('Import CSV');
    expect(container.textContent).toContain('Multi-Site');
  });

  it('fetches sites on mount', async () => {
    render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/interference'),
      );
    });
  });

  it('displays site list after fetch', async () => {
    const { container } = render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(container.textContent).toContain('2 sites');
    });
  });

  it('selects a site and shows detail view', async () => {
    const { container } = render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="select-site-1"]')).toBeTruthy();
    });

    fireEvent.click(container.querySelector('[data-testid="select-site-1"]')!);

    await waitFor(() => {
      expect(container.textContent).toContain('Site Alpha Detail');
      expect(container.textContent).toContain('Back to list');
    });
  });

  it('goes back to list from detail view', async () => {
    const { container } = render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="select-site-1"]')).toBeTruthy();
    });

    fireEvent.click(container.querySelector('[data-testid="select-site-1"]')!);
    await waitFor(() => {
      expect(container.textContent).toContain('Back to list');
    });

    const backBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Back to list')
    )!;
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(container.textContent).toContain('2 sites');
    });
  });

  it('opens and closes import dialog', async () => {
    const { container } = render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(container.textContent).toContain('Import CSV');
    });

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Import CSV')
    )!;
    fireEvent.click(importBtn);

    expect(container.querySelector('[data-testid="import-dialog"]')).toBeTruthy();

    fireEvent.click(container.querySelector('[data-testid="close-import"]')!);
    expect(container.querySelector('[data-testid="import-dialog"]')).toBeNull();
  });

  it('import complete triggers refetch', async () => {
    const { container } = render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Import CSV')
    )!;
    fireEvent.click(importBtn);

    fireEvent.click(container.querySelector('[data-testid="complete-import"]')!);

    // Should refetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('handles multi-site analysis', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sites: mockSites }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pngUrl: 'http://test.png', bounds: [[0,0],[1,1]] }),
      });

    const { container } = render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(container.textContent).toContain('Multi-Site');
    });

    const multiBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Multi-Site')
    )!;

    await act(async () => {
      fireEvent.click(multiBtn);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/cloudrf/multisite',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('shows CloudRF controls with overlay management in detail view', async () => {
    const { container } = render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="select-site-1"]')).toBeTruthy();
    });

    fireEvent.click(container.querySelector('[data-testid="select-site-1"]')!);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="cloudrf-controls"]')).toBeTruthy();
    });

    // Add overlay
    fireEvent.click(container.querySelector('[data-testid="add-overlay"]')!);
    expect(container.textContent).toContain('overlays: 1');

    // Clear overlays
    fireEvent.click(container.querySelector('[data-testid="clear-overlays"]')!);
    expect(container.textContent).toContain('overlays: 0');
  });

  it('handles fetch error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { container } = render(<InterferenceAnalysis />);
    // Should still render without crashing
    await waitFor(() => {
      expect(container.textContent).toContain('Interference Analysis');
    });
  });

  it('re-fetches when filter changes', async () => {
    const { container } = render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Trigger filter change
    fireEvent.click(container.querySelector('[data-testid="set-filter"]')!);

    await waitFor(() => {
      // Should have fetched again with new filter params
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const lastCall = mockFetch.mock.calls[1][0] as string;
      expect(lastCall).toContain('changwat=Bangkok');
    });
  });
});
