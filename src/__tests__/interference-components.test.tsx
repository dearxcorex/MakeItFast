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

  it('renders heading', async () => {
    const { container } = render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(container.textContent).toContain('Interference Analysis');
    });
  });

  it('fetches sites on mount', async () => {
    render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/interference'),
      );
    });
  });

  it('renders filter panel', async () => {
    const { container } = render(<InterferenceAnalysis />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="filter-panel"]')).toBeTruthy();
    });
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
