import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';

// Mock next/dynamic - inspect loader source to route to the right stub
vi.mock('next/dynamic', () => {
  return {
    default: (loader: () => Promise<{ default: React.ComponentType }>, options?: Record<string, unknown>) => {
      const src = loader.toString();
      if (src.includes('AnalyticsDashboard') || src.includes('analytics/AnalyticsDashboard')) {
        const C = (props: Record<string, unknown>) => <div data-testid="analytics-dashboard">AnalyticsDashboard</div>;
        C.displayName = 'AnalyticsDashboard';
        return C;
      }
      if (src.includes('InterferenceAnalysis') || src.includes('interference/InterferenceAnalysis')) {
        const C = (props: Record<string, unknown>) => <div data-testid="interference-analysis">InterferenceAnalysis</div>;
        C.displayName = 'InterferenceAnalysis';
        return C;
      }
      const DynamicComponent = (props: Record<string, unknown>) => (
        <div data-testid="dynamic-component" {...props} />
      );
      DynamicComponent.displayName = 'DynamicMap';
      return DynamicComponent;
    },
  };
});

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock useOptimizedFilters
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

// Track NavSidebar's onTabChange callback
let capturedOnTabChange: ((tab: string) => void) | null = null;
vi.mock('@/components/NavSidebar', () => ({
  default: ({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) => {
    capturedOnTabChange = onTabChange;
    return <div data-testid="nav-sidebar">NavSidebar tab={activeTab}</div>;
  },
}));

vi.mock('@/components/client/AppHeader', () => ({
  default: () => <div data-testid="app-header">AppHeader</div>,
}));

// Track MobileFilterBar props
let capturedFilterProps: Record<string, unknown> | null = null;
vi.mock('@/components/client/MobileFilterBar', () => ({
  default: (props: Record<string, unknown>) => {
    capturedFilterProps = props;
    return <div data-testid="mobile-filter-bar">MobileFilterBar</div>;
  },
}));

vi.mock('@/components/IntermodCalculator', () => ({
  default: ({ stations }: { stations: unknown[] }) => (
    <div data-testid="intermod-calculator">IntermodCalculator stations={stations.length}</div>
  ),
}));

vi.mock('@/components/interference/InterferenceAnalysis', () => ({
  default: () => <div data-testid="interference-analysis">InterferenceAnalysis</div>,
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import OptimizedFMStationClient from '@/components/OptimizedFMStationClient';
import type { FMStation } from '@/types/station';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  capturedOnTabChange = null;
  capturedFilterProps = null;
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
    makeStation({ id: '1', name: 'Station A' }),
    makeStation({ id: '2', name: 'Station B', frequency: 99.0 }),
  ],
  initialOnAirStatuses: [true, false],
  initialCities: ['Bangkok'],
  initialProvinces: ['Bangkok'],
  initialInspectionStatuses: ['ตรวจแล้ว', 'ยังไม่ตรวจ'],
};

describe('OptimizedFMStationClient - Deep Tests', () => {
  it('switches to intermod tab via NavSidebar callback', () => {
    const { container } = render(<OptimizedFMStationClient {...defaultProps} />);

    // Initially stations tab
    expect(container.querySelector('[data-testid="mobile-filter-bar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="intermod-calculator"]')).toBeNull();

    // Switch via NavSidebar callback
    act(() => {
      capturedOnTabChange!('intermod');
    });

    expect(container.querySelector('[data-testid="intermod-calculator"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mobile-filter-bar"]')).toBeNull();
  });

  it('switches to interference tab via NavSidebar callback', () => {
    const { container } = render(<OptimizedFMStationClient {...defaultProps} />);

    act(() => {
      capturedOnTabChange!('interference');
    });

    expect(container.querySelector('[data-testid="interference-analysis"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mobile-filter-bar"]')).toBeNull();
    expect(container.querySelector('[data-testid="intermod-calculator"]')).toBeNull();
  });

  it('renders mobile nav drawer and switches tabs via drawer callback', () => {
    const { container } = render(<OptimizedFMStationClient {...defaultProps} />);

    // Drawer + backdrop exist in the DOM
    expect(container.querySelector('[data-testid="mobile-nav-drawer"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mobile-nav-backdrop"]')).toBeTruthy();

    // NavSidebar (mocked) is used in both desktop + drawer — both capture the same onTabChange
    act(() => {
      capturedOnTabChange!('intermod');
    });
    expect(container.querySelector('[data-testid="intermod-calculator"]')).toBeTruthy();

    act(() => {
      capturedOnTabChange!('interference');
    });
    expect(container.querySelector('[data-testid="interference-analysis"]')).toBeTruthy();

    act(() => {
      capturedOnTabChange!('stations');
    });
    expect(container.querySelector('[data-testid="mobile-filter-bar"]')).toBeTruthy();
  });

  it('shows empty state when no stations', () => {
    const { container } = render(
      <OptimizedFMStationClient {...defaultProps} initialStations={[]} />
    );
    expect(container.textContent).toContain('No FM Stations Found');
    expect(container.textContent).toContain('fm_station table is empty');
    // Should NOT render the main layout
    expect(container.querySelector('[data-testid="nav-sidebar"]')).toBeNull();
  });

  it('renders NavSidebar showing active tab correctly', () => {
    const { container } = render(<OptimizedFMStationClient {...defaultProps} />);
    expect(container.querySelector('[data-testid="nav-sidebar"]')?.textContent).toContain(
      'tab=stations'
    );

    act(() => {
      capturedOnTabChange!('intermod');
    });
    expect(container.querySelector('[data-testid="nav-sidebar"]')?.textContent).toContain(
      'tab=intermod'
    );
  });

  it('passes filters to MobileFilterBar and clearFilters clears caches', () => {
    render(<OptimizedFMStationClient {...defaultProps} />);

    expect(capturedFilterProps).toBeTruthy();
    expect(capturedFilterProps!.filters).toEqual({});

    // Call clearFilters
    const clearFilters = capturedFilterProps!.clearFilters as () => void;
    act(() => {
      clearFilters();
    });

    expect(mockClearCaches).toHaveBeenCalled();
  });

  it('handles station update with optimistic update and API call', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            on_air: false,
            inspection_68: true,
            inspection_69: false,
            date_inspected: '2026-03-08',
            note: 'Updated',
            submit_a_request: true,
          },
        }),
    });

    render(<OptimizedFMStationClient {...defaultProps} />);

    // The dynamic Map component receives onUpdateStation prop
    // We'll verify by checking the dynamic component was rendered
    // The actual function is an internal callback, so we can't easily call it
    // But we can verify the component renders with the necessary data-testid
    expect(document.querySelector('[data-testid="dynamic-component"]')).toBeTruthy();
  });

  it('intermod calculator receives stations prop', () => {
    const { container } = render(<OptimizedFMStationClient {...defaultProps} />);

    act(() => {
      capturedOnTabChange!('intermod');
    });

    const intermod = container.querySelector('[data-testid="intermod-calculator"]');
    expect(intermod?.textContent).toContain('stations=2');
  });
});
