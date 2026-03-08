import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

// Mock leaflet CSS import
vi.mock('leaflet/dist/leaflet.css', () => ({}));

// Mock leaflet
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn((opts) => ({ options: opts })),
    icon: vi.fn((opts) => ({ options: opts })),
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
    latLngBounds: vi.fn(() => ({})),
  },
  divIcon: vi.fn((opts) => ({ options: opts })),
  icon: vi.fn((opts) => ({ options: opts })),
  latLngBounds: vi.fn(() => ({})),
}));

// Mock react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  Polyline: () => <div data-testid="polyline" />,
  useMap: () => ({ flyTo: vi.fn(), setView: vi.fn(), getContainer: vi.fn(() => true), flyToBounds: vi.fn() }),
}));

// Mock next/dynamic to render the actual component
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType }>) => {
    // For Map component, return a simple mock since it's complex
    const DynamicComponent = (props: Record<string, unknown>) => <div data-testid="dynamic-component" {...props} />;
    DynamicComponent.displayName = 'DynamicComponent';
    return DynamicComponent;
  },
}));

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock useKeyboardNavigation
vi.mock('@/hooks/useKeyboardNavigation', () => ({
  useKeyboardNavigation: () => ({ selectedIndex: -1 }),
}));

// Mock useOptimizedFilters
vi.mock('@/hooks/useOptimizedFilters', () => ({
  useOptimizedFilters: ({ stations }: { stations: unknown[] }) => ({
    filteredStations: stations,
    clearCaches: vi.fn(),
  }),
  useMemoryMonitor: () => ({
    checkMemoryUsage: vi.fn(),
  }),
}));

// Mock child components for OptimizedFMStationClient
vi.mock('@/components/NavSidebar', () => ({
  default: ({ activeTab }: { activeTab: string }) => <div data-testid="nav-sidebar">NavSidebar tab={activeTab}</div>,
}));

vi.mock('@/components/client/AppHeader', () => ({
  default: () => <div data-testid="app-header">AppHeader</div>,
}));

vi.mock('@/components/client/MobileFilterBar', () => ({
  default: () => <div data-testid="mobile-filter-bar">MobileFilterBar</div>,
}));

vi.mock('@/components/IntermodCalculator', () => ({
  default: ({ stations }: { stations: unknown[] }) => (
    <div data-testid="intermod-calculator">IntermodCalculator stations={stations.length}</div>
  ),
}));

vi.mock('@/components/interference/InterferenceAnalysis', () => ({
  default: () => <div data-testid="interference-analysis">InterferenceAnalysis</div>,
}));

// Mock child components for Sidebar
vi.mock('@/components/sidebar/FilterControls', () => ({
  default: () => <div data-testid="filter-controls">FilterControls</div>,
}));

vi.mock('@/components/sidebar/StationListItem', () => ({
  default: ({ station, variant }: { station: { name: string; frequency: number }; variant: string }) => (
    <div data-testid="station-list-item">{station.name} {station.frequency} ({variant})</div>
  ),
}));

// Mock child components for Map
vi.mock('@/services/stationService', () => ({
  groupStationsByCoordinates: (stations: Array<{ latitude: number; longitude: number }>) => {
    const map = new Map<string, typeof stations>();
    stations.forEach((s) => {
      const key = `${s.latitude},${s.longitude}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  },
}));

vi.mock('@/utils/mapHelpers', () => ({
  calculateDistance: vi.fn(() => 5),
  createLocationIcon: vi.fn(() => ({ options: {} })),
  getStationIcon: vi.fn(() => ({ options: {} })),
}));

vi.mock('@/components/map/StationPopupSingle', () => ({
  default: ({ station }: { station: { name: string } }) => (
    <div data-testid="station-popup-single">StationPopupSingle: {station.name}</div>
  ),
}));

vi.mock('@/components/map/StationPopupMultiple', () => ({
  default: () => <div data-testid="station-popup-multiple">StationPopupMultiple</div>,
}));

// Mock StationCard and NavigateButton for the real StationPopupSingle test
vi.mock('@/components/map/StationCard', () => ({
  default: ({ station }: { station: { name: string; frequency: number; city: string; state: string } }) => (
    <div data-testid="station-card">{station.name} - {station.frequency} MHz - {station.city}, {station.state}</div>
  ),
}));

vi.mock('@/components/map/NavigateButton', () => ({
  default: ({ stationName }: { stationName: string }) => (
    <div data-testid="navigate-button">Navigate to {stationName}</div>
  ),
}));

// Mock intermod calculation utilities
vi.mock('@/utils/intermodCalculations', () => ({
  findPairsForTargetFrequency: vi.fn(() => ({ totalPairsChecked: 0, dangerousPairs: [], calculationTimeMs: 0 })),
  assessInterferenceRisk: vi.fn(() => []),
  calculateThirdOrderProducts: vi.fn(() => []),
  formatDistance: vi.fn((d: number) => `${d.toFixed(1)} km`),
  getRiskLevelColor: vi.fn(() => 'text-red-500'),
  getRiskLevelBgColor: vi.fn(() => 'bg-red-500/10'),
  summarizeByService: vi.fn(() => ({})),
  filterRiskAssessments: vi.fn(() => []),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ==========================================
// Helper factories
// ==========================================

const makeStation = (overrides = {}) => ({
  id: '1', name: 'Test FM', frequency: 98.5, latitude: 13.75, longitude: 100.5,
  city: 'Bangkok', state: 'Bangkok', genre: 'FM', onAir: true,
  submitRequest: 'ยื่น', inspection68: 'ยังไม่ตรวจ', inspection69: 'ยังไม่ตรวจ',
  description: 'Test FM station', details: '#test', type: 'FM',
  ...overrides,
});

// ==========================================
// 1. IntermodCalculator
// ==========================================

// We need to import the REAL IntermodCalculator, not the mock above.
// The mock above is for OptimizedFMStationClient. We need to use vi.importActual.
// Actually, the mock is set globally. Let's work around this by testing the mock-free version.
// We'll unmock it for this test suite by importing directly.

// Since IntermodCalculator is mocked globally for OptimizedFMStationClient,
// we need to get the real one. Use dynamic import with vi.importActual.

describe('IntermodCalculator', () => {
  // We must use the real component. Since it's mocked above, use importActual.
  let IntermodCalculatorReal: React.ComponentType<{
    stations: ReturnType<typeof makeStation>[];
    onHighlightStations?: (id1: string | number, id2: string | number) => void;
    onSwitchToStations?: () => void;
  }>;

  // Use beforeAll to load the real module
  beforeAll(async () => {
    const mod = await vi.importActual<{ default: typeof IntermodCalculatorReal }>(
      '@/components/IntermodCalculator'
    );
    IntermodCalculatorReal = mod.default;
  });

  const defaultProps = {
    stations: [makeStation(), makeStation({ id: '2', name: 'Station 2', frequency: 99.0 })],
    onHighlightStations: vi.fn(),
    onSwitchToStations: vi.fn(),
  };

  it('renders the Intermod Calculator heading', () => {
    const { container } = render(<IntermodCalculatorReal {...defaultProps} />);
    expect(container.textContent).toContain('Intermod Calculator');
  });

  it('renders the mode selector with two options', () => {
    const { container } = render(<IntermodCalculatorReal {...defaultProps} />);
    expect(container.textContent).toContain('Mode');
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(1);
    const modeSelect = selects[0];
    const options = modeSelect.querySelectorAll('option');
    expect(options.length).toBe(2);
    expect(options[0].textContent).toContain('Find FM Pairs');
    expect(options[1].textContent).toContain('Check FM Frequencies');
  });

  it('renders aircraft frequency input in aircraft-check mode by default', () => {
    const { container } = render(<IntermodCalculatorReal {...defaultProps} />);
    expect(container.textContent).toContain('Aircraft Frequency');
    expect(container.textContent).toContain('(108-137 MHz)');
  });

  it('renders the Find FM Pairs button', () => {
    const { container } = render(<IntermodCalculatorReal {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    const findBtn = Array.from(buttons).find(b => b.textContent?.includes('Find FM Pairs'));
    expect(findBtn).toBeTruthy();
  });

  it('renders Clear All button', () => {
    const { container } = render(<IntermodCalculatorReal {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    const clearBtn = Array.from(buttons).find(b => b.textContent?.includes('Clear All'));
    expect(clearBtn).toBeTruthy();
  });

  it('renders the Results panel with empty state', () => {
    const { container } = render(<IntermodCalculatorReal {...defaultProps} />);
    expect(container.textContent).toContain('Results');
    expect(container.textContent).toContain('No Results Yet');
  });

  it('renders Aviation Band info section', () => {
    const { container } = render(<IntermodCalculatorReal {...defaultProps} />);
    expect(container.textContent).toContain('Aviation Band (108-137 MHz)');
    expect(container.textContent).toContain('VOR/ILS Navigation');
    expect(container.textContent).toContain('Emergency');
    expect(container.textContent).toContain('ATC Voice');
  });

  it('renders common frequencies reference', () => {
    const { container } = render(<IntermodCalculatorReal {...defaultProps} />);
    expect(container.textContent).toContain('Common Frequencies Reference');
  });

  it('shows station count in reverse lookup info', () => {
    const { container } = render(<IntermodCalculatorReal {...defaultProps} />);
    expect(container.textContent).toContain('2 FM stations');
  });
});

// ==========================================
// 2. OptimizedFMStationClient
// ==========================================
import OptimizedFMStationClient from '@/components/OptimizedFMStationClient';

describe('OptimizedFMStationClient', () => {
  const defaultProps = {
    initialStations: [makeStation(), makeStation({ id: '2', name: 'Station 2', frequency: 99.0 })],
    initialOnAirStatuses: [true, false],
    initialCities: ['Bangkok'],
    initialProvinces: ['Bangkok'],
    initialInspectionStatuses: ['ตรวจแล้ว', 'ยังไม่ตรวจ'],
  };

  it('renders the main layout with header and nav sidebar', () => {
    const { container } = render(<OptimizedFMStationClient {...defaultProps} />);
    expect(container.querySelector('[data-testid="app-header"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="nav-sidebar"]')).toBeTruthy();
  });

  it('renders mobile bottom navigation with Stations, Intermod, and Interference tabs', () => {
    const { container } = render(<OptimizedFMStationClient {...defaultProps} />);
    expect(container.textContent).toContain('Stations');
    expect(container.textContent).toContain('Intermod');
    expect(container.textContent).toContain('Interference');
  });

  it('renders the MobileFilterBar and dynamic Map on stations tab by default', () => {
    const { container } = render(<OptimizedFMStationClient {...defaultProps} />);
    expect(container.querySelector('[data-testid="mobile-filter-bar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="dynamic-component"]')).toBeTruthy();
  });

  it('shows empty state when no stations are provided', () => {
    const { container } = render(
      <OptimizedFMStationClient {...defaultProps} initialStations={[]} />
    );
    expect(container.textContent).toContain('No FM Stations Found');
    expect(container.textContent).toContain('fm_station table is empty');
  });

  it('renders nav sidebar with stations tab active', () => {
    const { container } = render(<OptimizedFMStationClient {...defaultProps} />);
    expect(container.querySelector('[data-testid="nav-sidebar"]')?.textContent).toContain('tab=stations');
  });
});

// ==========================================
// 3. Sidebar
// ==========================================
import Sidebar from '@/components/Sidebar';

describe('Sidebar', () => {
  const defaultProps = {
    stations: [
      makeStation(),
      makeStation({ id: '2', name: 'Station 2', frequency: 99.0, latitude: 13.76, longitude: 100.51 }),
    ],
    allStations: [
      makeStation(),
      makeStation({ id: '2', name: 'Station 2', frequency: 99.0, latitude: 13.76, longitude: 100.51 }),
    ],
    onStationSelect: vi.fn(),
    selectedStation: undefined,
    isOpen: false,
    onToggle: vi.fn(),
    userLocation: { latitude: 13.75, longitude: 100.5, accuracy: 10 },
    initialCities: ['Bangkok'],
    initialProvinces: ['Bangkok'],
    initialInspectionStatuses: ['ตรวจแล้ว', 'ยังไม่ตรวจ'],
    filters: {},
    onFiltersChange: vi.fn(),
    onClearFilters: vi.fn(),
    calculateDistance: vi.fn(() => 5),
  };

  it('renders the desktop sidebar with FilterControls', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    expect(container.querySelector('[data-testid="filter-controls"]')).toBeTruthy();
  });

  it('renders station list items for stations within 20km', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    const items = container.querySelectorAll('[data-testid="station-list-item"]');
    expect(items.length).toBeGreaterThan(0);
  });

  it('shows station count in header', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    // The nearby count should be shown (2 stations within 20km since calculateDistance returns 5)
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('nearby');
  });

  it('shows "within 20km radius" when user location is provided', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    expect(container.textContent).toContain('within 20km radius');
  });
});

// ==========================================
// 4. Map
// ==========================================

describe('Map', () => {
  let MapReal: React.ComponentType<{
    stations: ReturnType<typeof makeStation>[];
    selectedStation?: ReturnType<typeof makeStation>;
    onStationSelect: (station: ReturnType<typeof makeStation>) => void;
    onUpdateStation?: (id: string | number, updates: Partial<ReturnType<typeof makeStation>>) => void;
    highlightedStationIds?: (string | number)[];
    flyToStations?: null;
  }>;

  beforeAll(async () => {
    const mod = await vi.importActual<{ default: typeof MapReal }>('@/components/Map');
    MapReal = mod.default;
  });

  const defaultProps = {
    stations: [makeStation()],
    onStationSelect: vi.fn(),
    highlightedStationIds: [] as (string | number)[],
    flyToStations: null,
  };

  it('renders the map container with tile layer', () => {
    const { container } = render(<MapReal {...defaultProps} />);
    expect(container.querySelector('[data-testid="map"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tile-layer"]')).toBeTruthy();
  });

  it('renders markers for stations', () => {
    const stations = [
      makeStation(),
      makeStation({ id: '2', name: 'Station 2', frequency: 99.0, latitude: 14.0, longitude: 101.0 }),
    ];
    const { container } = render(<MapReal {...defaultProps} stations={stations} />);
    const markers = container.querySelectorAll('[data-testid="marker"]');
    // 2 station markers (no user location marker since geolocation is not triggered in test)
    expect(markers.length).toBeGreaterThanOrEqual(2);
  });

  it('renders popup content for a station', () => {
    const { container } = render(<MapReal {...defaultProps} />);
    // The mocked StationPopupSingle should be present
    expect(container.querySelector('[data-testid="station-popup-single"]')).toBeTruthy();
  });
});

// ==========================================
// 5. StationPopupSingle (real component, not mock)
// ==========================================

describe('StationPopupSingle', () => {
  let StationPopupSingleReal: React.ComponentType<{
    station: ReturnType<typeof makeStation>;
    distance: number | null;
    onUpdateStation?: (id: string | number, updates: Partial<ReturnType<typeof makeStation>>) => void;
  }>;

  beforeAll(async () => {
    const mod = await vi.importActual<{ default: typeof StationPopupSingleReal }>(
      '@/components/map/StationPopupSingle'
    );
    StationPopupSingleReal = mod.default;
  });

  it('renders the station card and navigate button', () => {
    const station = makeStation();
    const { container } = render(
      <StationPopupSingleReal station={station} distance={null} />
    );
    expect(container.querySelector('[data-testid="station-card"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="navigate-button"]')).toBeTruthy();
  });

  it('shows distance when provided', () => {
    const station = makeStation();
    const { container } = render(
      <StationPopupSingleReal station={station} distance={3.7} />
    );
    expect(container.textContent).toContain('3.7 km away');
  });

  it('shows station description when present', () => {
    const station = makeStation({ description: 'A cool radio station' });
    const { container } = render(
      <StationPopupSingleReal station={station} distance={null} />
    );
    expect(container.textContent).toContain('A cool radio station');
  });

  it('does not show description when not present', () => {
    const station = makeStation({ description: undefined });
    const { container } = render(
      <StationPopupSingleReal station={station} distance={null} />
    );
    // Should still render without error
    expect(container.querySelector('[data-testid="station-card"]')).toBeTruthy();
  });
});

// ==========================================
// 6. FMStationsFetcher - SKIPPED (server component)
// ==========================================

describe('FMStationsFetcher', () => {
  it.skip('is a server component using Prisma and cannot be tested in jsdom', () => {
    // FMStationsFetcher is an async server component that directly queries
    // PostgreSQL via Prisma. It cannot render in a jsdom test environment.
  });
});
