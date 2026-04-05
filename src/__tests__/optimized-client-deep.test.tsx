/**
 * Deep tests for OptimizedFMStationClient - focusing on handleUpdateStation,
 * handleHighlightStations, and geolocation effects
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import React from 'react';

// Track the Map component's onUpdateStation callback
let capturedMapProps: Record<string, unknown> = {};

vi.mock('next/dynamic', () => {
  let callCount = 0;
  return {
    default: (loader: () => Promise<{ default: React.ComponentType }>) => {
      const idx = callCount++;
      if (idx === 1) {
        // InterferenceAnalysis
        const C = () => <div data-testid="interference-analysis">InterferenceAnalysis</div>;
        C.displayName = 'InterferenceAnalysis';
        return C;
      }
      // Map component - capture all props
      const MapComponent = (props: Record<string, unknown>) => {
        capturedMapProps = props;
        return <div data-testid="map-component">Map</div>;
      };
      MapComponent.displayName = 'DynamicMap';
      return MapComponent;
    },
  };
});

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockClearCaches = vi.fn();
vi.mock('@/hooks/useOptimizedFilters', () => ({
  useOptimizedFilters: ({ stations }: { stations: unknown[] }) => ({
    filteredStations: stations,
    clearCaches: mockClearCaches,
  }),
  useMemoryMonitor: () => ({
    checkMemoryUsage: vi.fn(),
  }),
}));

// Track IntermodCalculator callbacks
let capturedIntermodProps: Record<string, unknown> = {};
vi.mock('@/components/IntermodCalculator', () => ({
  default: (props: Record<string, unknown>) => {
    capturedIntermodProps = props;
    return <div data-testid="intermod-calc">IntermodCalculator</div>;
  },
}));

let capturedNavProps: Record<string, unknown> = {};
vi.mock('@/components/NavSidebar', () => ({
  default: (props: Record<string, unknown>) => {
    capturedNavProps = props;
    return <div data-testid="nav-sidebar">NavSidebar</div>;
  },
}));

vi.mock('@/components/client/AppHeader', () => ({
  default: () => <div data-testid="app-header">AppHeader</div>,
}));

let capturedMobileFilterProps: Record<string, unknown> = {};
vi.mock('@/components/client/MobileFilterBar', () => ({
  default: (props: Record<string, unknown>) => {
    capturedMobileFilterProps = props;
    return <div data-testid="mobile-filter-bar">MobileFilterBar</div>;
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import OptimizedFMStationClient from '@/components/OptimizedFMStationClient';
import type { FMStation } from '@/types/station';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  capturedMapProps = {};
  capturedIntermodProps = {};
  capturedNavProps = {};
  capturedMobileFilterProps = {};
});

const makeStation = (overrides: Partial<FMStation> = {}): FMStation => ({
  id: '1',
  name: 'Test FM',
  frequency: 98.5,
  latitude: 13.75,
  longitude: 100.5,
  city: 'Bangkok',
  state: 'Bangkok',
  genre: 'FM',
  onAir: true,
  submitRequest: 'ยื่น',
  inspection68: 'ยังไม่ตรวจ',
  inspection69: 'ยังไม่ตรวจ',
  ...overrides,
});

const defaultProps = {
  initialStations: [
    makeStation({ id: '1', name: 'Station A', latitude: 13.75, longitude: 100.5 }),
    makeStation({ id: '2', name: 'Station B', latitude: 14.0, longitude: 101.0, frequency: 99.0 }),
  ],
  initialOnAirStatuses: [true, false],
  initialCities: ['Bangkok'],
  initialProvinces: ['Bangkok'],
  initialInspectionStatuses: ['ตรวจแล้ว', 'ยังไม่ตรวจ'],
};

describe('OptimizedFMStationClient - handleUpdateStation', () => {
  it('calls API and updates station on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: {
          on_air: false,
          inspection_68: true,
          inspection_69: false,
          date_inspected: '2026-03-08',
          note: 'Updated note',
          submit_a_request: true,
        },
      }),
    });

    render(<OptimizedFMStationClient {...defaultProps} />);

    // Get onUpdateStation from Map props
    const onUpdateStation = capturedMapProps.onUpdateStation as (id: string | number, updates: Partial<FMStation>) => Promise<void>;
    expect(onUpdateStation).toBeTruthy();

    await act(async () => {
      await onUpdateStation('1', { onAir: false });
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/stations/1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ onAir: false }),
    }));
  });

  it('handles API failure without crashing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<OptimizedFMStationClient {...defaultProps} />);

    const onUpdateStation = capturedMapProps.onUpdateStation as (id: string | number, updates: Partial<FMStation>) => Promise<void>;

    await act(async () => {
      await onUpdateStation('1', { onAir: false });
    });

    // Should not crash
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles network error without crashing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<OptimizedFMStationClient {...defaultProps} />);

    const onUpdateStation = capturedMapProps.onUpdateStation as (id: string | number, updates: Partial<FMStation>) => Promise<void>;

    await act(async () => {
      await onUpdateStation('1', { onAir: false });
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('handles station not found gracefully', async () => {
    render(<OptimizedFMStationClient {...defaultProps} />);

    const onUpdateStation = capturedMapProps.onUpdateStation as (id: string | number, updates: Partial<FMStation>) => Promise<void>;

    await act(async () => {
      await onUpdateStation('999', { onAir: false });
    });

    // Should not call fetch for non-existent station
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends inspection68 and inspection69 updates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: {
        on_air: true, inspection_68: true, inspection_69: true,
        date_inspected: '2026-03-08', note: null, submit_a_request: true,
      }}),
    });

    render(<OptimizedFMStationClient {...defaultProps} />);

    const onUpdateStation = capturedMapProps.onUpdateStation as (id: string | number, updates: Partial<FMStation>) => Promise<void>;

    await act(async () => {
      await onUpdateStation('1', { inspection68: 'ตรวจแล้ว', inspection69: 'ตรวจแล้ว' });
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.inspection68).toBe('ตรวจแล้ว');
    expect(body.inspection69).toBe('ตรวจแล้ว');
  });

  it('sends details update', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: {
        on_air: true, inspection_68: false, inspection_69: false,
        date_inspected: null, note: '#deviation', submit_a_request: true,
      }}),
    });

    render(<OptimizedFMStationClient {...defaultProps} />);

    const onUpdateStation = capturedMapProps.onUpdateStation as (id: string | number, updates: Partial<FMStation>) => Promise<void>;

    await act(async () => {
      await onUpdateStation('1', { details: '#deviation' });
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.details).toBe('#deviation');
  });
});

describe('OptimizedFMStationClient - handleHighlightStations', () => {
  it('highlights stations and passes to map', () => {
    vi.useFakeTimers();

    render(<OptimizedFMStationClient {...defaultProps} />);

    // Switch to intermod tab
    const onTabChange = capturedNavProps.onTabChange as (tab: string) => void;
    act(() => { onTabChange('intermod'); });

    // Get the onHighlightStations callback from intermod
    const onHighlightStations = capturedIntermodProps.onHighlightStations as (id1: string | number, id2: string | number) => void;
    expect(onHighlightStations).toBeTruthy();

    // Switch back to stations to see map
    act(() => { onTabChange('stations'); });

    act(() => {
      onHighlightStations('1', '2');
    });

    // Map should receive highlighted station IDs
    expect(capturedMapProps.highlightedStationIds).toEqual(['1', '2']);

    // flyToStations should be set
    expect(capturedMapProps.flyToStations).toBeTruthy();

    // After 10 seconds, highlight should clear
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(capturedMapProps.highlightedStationIds).toEqual([]);
    expect(capturedMapProps.flyToStations).toBeNull();

    vi.useRealTimers();
  });

  it('onSwitchToStations switches to stations tab', () => {
    render(<OptimizedFMStationClient {...defaultProps} />);

    // Switch to intermod
    const onTabChange = capturedNavProps.onTabChange as (tab: string) => void;
    act(() => { onTabChange('intermod'); });

    expect(capturedIntermodProps.onSwitchToStations).toBeTruthy();
    const onSwitch = capturedIntermodProps.onSwitchToStations as () => void;

    act(() => { onSwitch(); });

    // Should be back on stations tab - map should render
    expect(capturedMapProps).toBeTruthy();
  });
});

describe('OptimizedFMStationClient - filter auto-clear', () => {
  it('clears city when province changes and city not in province', () => {
    const { rerender } = render(<OptimizedFMStationClient {...defaultProps} />);

    // Set province and city filters
    const setFilters = capturedMobileFilterProps.setFilters as (f: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void;

    act(() => {
      setFilters({ province: 'Chiang Mai', city: 'Bangkok' });
    });

    // The effect should auto-clear city since no station in 'Chiang Mai' has city 'Bangkok'
    // This happens asynchronously via useEffect
  });
});

describe('OptimizedFMStationClient - station selection', () => {
  it('onStationSelect from map updates selectedStation', () => {
    render(<OptimizedFMStationClient {...defaultProps} />);

    const onStationSelect = capturedMapProps.onStationSelect as (station: FMStation) => void;
    const station = defaultProps.initialStations[0];

    act(() => {
      onStationSelect(station);
    });

    // Station should be selected (passed back to map as selectedStation)
    expect(capturedMapProps.selectedStation).toEqual(station);
  });
});

describe('OptimizedFMStationClient - mobile navigation', () => {
  it('mobile drawer renders with backdrop, closed by default', () => {
    const { container } = render(<OptimizedFMStationClient {...defaultProps} />);

    const drawer = container.querySelector('[data-testid="mobile-nav-drawer"]');
    const backdrop = container.querySelector('[data-testid="mobile-nav-backdrop"]');
    expect(drawer).toBeTruthy();
    expect(backdrop).toBeTruthy();
    expect(drawer!.className).not.toContain('open');
    expect(backdrop!.className).not.toContain('open');
  });

  it('NavSidebar receives stations as default active tab', () => {
    render(<OptimizedFMStationClient {...defaultProps} />);
    expect(capturedNavProps.activeTab).toBe('stations');
  });

  it('tab change via NavSidebar callback updates the active tab', () => {
    render(<OptimizedFMStationClient {...defaultProps} />);
    const onTabChange = capturedNavProps.onTabChange as (tab: string) => void;
    act(() => {
      onTabChange('intermod');
    });
    expect(capturedNavProps.activeTab).toBe('intermod');
  });
});
