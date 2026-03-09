import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

// Mock NavigateButton so we can assert it receives correct props from InterferenceMap
vi.mock('@/components/map/NavigateButton', () => ({
  default: ({ lat, lng, stationName }: { lat: number; lng: number; stationName?: string }) => (
    <div
      data-testid="navigate-button"
      data-lat={lat}
      data-lng={lng}
      data-station-name={stationName ?? ''}
    />
  ),
}));

// Mock leaflet CSS import
vi.mock('leaflet/dist/leaflet.css', () => ({}));

// Mock leaflet
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn((opts) => ({ options: opts })),
    icon: vi.fn((opts) => ({ options: opts })),
  },
  divIcon: vi.fn((opts) => ({ options: opts })),
  icon: vi.fn((opts) => ({ options: opts })),
}));

// Mock react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  Polyline: () => <div data-testid="polyline" />,
  ImageOverlay: () => <div data-testid="image-overlay" />,
  useMap: () => ({ flyTo: vi.fn() }),
}));

// Mock next/dynamic to just render the component directly
vi.mock('next/dynamic', () => ({
  default: () => {
    const DynamicComponent = () => <div data-testid="dynamic-map">InterferenceMap</div>;
    DynamicComponent.displayName = 'DynamicComponent';
    return DynamicComponent;
  },
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

const makeSite = (overrides = {}) => ({
  id: 1, siteCode: 'AWN-001', siteName: 'Test Site',
  lat: 13.75, long: 100.5, mcZone: 'Zone1', changwat: 'กรุงเทพ',
  cellName: 'Cell-A', sectorName: 'S1', direction: 120, avgNiCarrier: -85.5,
  dayTime: -82, nightTime: -88, sourceLat: 13.76, sourceLong: 100.51,
  estimateDistance: 1.5, ranking: 'Critical', status: 'Active',
  nbtcArea: 'Area1', awnContact: null, lot: null, onSiteScanBy: null,
  onSiteScanDate: null, checkRealtime: null, sourceLocation1: null,
  sourceLocation2: null, cameraModel1: null, cameraModel2: null,
  notes: null, createdAt: new Date(), updatedAt: new Date(),
  ...overrides,
});

const makeStation = (overrides = {}) => ({
  id: '1', name: 'Test FM', frequency: 98.5, latitude: 13.75, longitude: 100.5,
  city: 'Bangkok', state: 'Bangkok', genre: 'FM', onAir: true,
  submitRequest: 'ยื่น', inspection69: 'ยังไม่ตรวจ', ...overrides,
});

// ==========================================
// CloudRFControls
// ==========================================
import CloudRFControls from '@/components/interference/CloudRFControls';

describe('CloudRFControls', () => {
  const defaultProps = {
    site: makeSite(),
    onResult: vi.fn(),
    onClearOverlays: vi.fn(),
    overlayCount: 0,
  };

  it('renders the CloudRF Analysis heading', () => {
    const { container } = render(<CloudRFControls {...defaultProps} />);
    expect(container.textContent).toContain('CloudRF Analysis');
  });

  it('renders deployment type select with three options', () => {
    const { container } = render(<CloudRFControls {...defaultProps} />);
    const selects = container.querySelectorAll('select');
    // First select is deployment type
    const deploySelect = selects[0];
    expect(deploySelect).toBeTruthy();
    const options = deploySelect.querySelectorAll('option');
    expect(options.length).toBe(3);
    expect(options[0].textContent).toContain('Macro Urban');
    expect(options[1].textContent).toContain('Macro Suburban');
    expect(options[2].textContent).toContain('Macro Rural');
  });

  it('renders Power, Height, Radius, and Azimuth inputs', () => {
    const { container } = render(<CloudRFControls {...defaultProps} />);
    expect(container.textContent).toContain('Power (W)');
    expect(container.textContent).toContain('Height (m)');
    expect(container.textContent).toContain('Radius (km)');
    expect(container.textContent).toContain('Azimuth');
  });

  it('renders Run Propagation button', () => {
    const { container } = render(<CloudRFControls {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    const runBtn = Array.from(buttons).find(b => b.textContent?.includes('Run Propagation'));
    expect(runBtn).toBeTruthy();
  });

  it('shows Point-to-Point button when site has source coordinates', () => {
    const { container } = render(
      <CloudRFControls {...defaultProps} site={makeSite({ sourceLat: 13.76, sourceLong: 100.51 })} />
    );
    const buttons = container.querySelectorAll('button');
    const p2pBtn = Array.from(buttons).find(b => b.textContent?.includes('Point-to-Point'));
    expect(p2pBtn).toBeTruthy();
  });

  it('does not show Point-to-Point button when site has no source coordinates', () => {
    const { container } = render(
      <CloudRFControls {...defaultProps} site={makeSite({ sourceLat: null, sourceLong: null })} />
    );
    const buttons = container.querySelectorAll('button');
    const p2pBtn = Array.from(buttons).find(b => b.textContent?.includes('Point-to-Point'));
    expect(p2pBtn).toBeFalsy();
  });

  it('shows clear overlay button when overlayCount > 0', () => {
    const { container } = render(<CloudRFControls {...defaultProps} overlayCount={3} />);
    expect(container.textContent).toContain('Clear 3 overlays');
  });

  it('does not show clear overlay button when overlayCount is 0', () => {
    const { container } = render(<CloudRFControls {...defaultProps} overlayCount={0} />);
    expect(container.textContent).not.toContain('Clear');
  });
});

// ==========================================
// InterferenceAnalysis
// ==========================================
import InterferenceAnalysis from '@/components/interference/InterferenceAnalysis';

// Mock child components that InterferenceAnalysis uses
vi.mock('@/components/interference/InterferenceFilterPanel', () => ({
  default: () => <div data-testid="filter-panel">FilterPanel</div>,
}));

vi.mock('@/components/interference/InterferenceSiteDetail', () => ({
  default: () => <div data-testid="site-detail">SiteDetail</div>,
}));

describe('InterferenceAnalysis', () => {
  it('renders the Interference Analysis heading', () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites: [] }) });
    const { container } = render(<InterferenceAnalysis />);
    expect(container.textContent).toContain('Interference Analysis');
  });

  it('renders filter panel by default', () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites: [] }) });
    const { container } = render(<InterferenceAnalysis />);
    expect(container.querySelector('[data-testid="filter-panel"]')).toBeTruthy();
  });

  it('renders the map area', () => {
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ sites: [] }) });
    const { container } = render(<InterferenceAnalysis />);
    expect(container.querySelector('[data-testid="dynamic-map"]')).toBeTruthy();
  });
});

// ==========================================
// InterferenceMap
// ==========================================
// We need to reimport InterferenceMap directly since the mock above overrides it for InterferenceAnalysis.
// We'll use the non-mocked version by importing from the actual file with vi.importActual pattern.
// Instead, let's just test the actual InterferenceMap component since we already mock react-leaflet.

// Unmock CloudRFControls for the InterferenceMap tests (it was mocked above for InterferenceAnalysis).
// InterferenceMap doesn't import CloudRFControls, so the mock won't affect it.

// We need to import InterferenceMap directly; the vi.mock for next/dynamic doesn't interfere
// because InterferenceMap itself doesn't use next/dynamic.
import InterferenceMapActual from '@/components/interference/InterferenceMap';

describe('InterferenceMap', () => {
  const defaultProps = {
    sites: [] as ReturnType<typeof makeSite>[],
    selectedSite: null,
    onSiteSelect: vi.fn(),
    propagationOverlays: [],
    flyToSite: null,
  };

  it('renders the map container', () => {
    const { container } = render(<InterferenceMapActual {...defaultProps} />);
    expect(container.querySelector('[data-testid="map"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tile-layer"]')).toBeTruthy();
  });

  it('renders markers for sites with coordinates', () => {
    const sites = [
      makeSite({ id: 1, lat: 13.75, long: 100.5 }),
      makeSite({ id: 2, lat: 14.0, long: 101.0 }),
    ];
    const { container } = render(
      <InterferenceMapActual {...defaultProps} sites={sites} />
    );
    const markers = container.querySelectorAll('[data-testid="marker"]');
    // 2 tower markers + 2 source markers (both have sourceLat/sourceLong)
    expect(markers.length).toBe(4);
  });

  it('renders polylines for sites with source coordinates', () => {
    const sites = [makeSite({ id: 1, sourceLat: 13.76, sourceLong: 100.51 })];
    const { container } = render(
      <InterferenceMapActual {...defaultProps} sites={sites} />
    );
    expect(container.querySelector('[data-testid="polyline"]')).toBeTruthy();
  });

  it('does not render SignalLegend when no overlays', () => {
    const { container } = render(<InterferenceMapActual {...defaultProps} />);
    expect(container.textContent).not.toContain('Signal (dBm)');
  });

  it('renders SignalLegend when propagation overlays exist', () => {
    const overlays = [{ siteId: 1, pngUrl: 'http://example.com/img.png', leafletBounds: [[13, 100], [14, 101]] as [[number, number], [number, number]] }];
    const { container } = render(
      <InterferenceMapActual {...defaultProps} propagationOverlays={overlays} />
    );
    expect(container.textContent).toContain('Signal (dBm)');
  });

  // Tower markers have no popup or NavigateButton (click calls onSiteSelect)
  it('does not render NavigateButton for tower-only markers (no popup)', () => {
    const sites = [makeSite({ id: 1, lat: 13.75, long: 100.5, sourceLat: null, sourceLong: null })];
    const { container } = render(
      <InterferenceMapActual {...defaultProps} sites={sites} />
    );
    const navBtns = container.querySelectorAll('[data-testid="navigate-button"]');
    expect(navBtns.length).toBe(0);
  });

  // NavigateButton in source marker popups
  it('renders NavigateButton inside each source marker popup', () => {
    const sites = [makeSite({ id: 1, lat: 13.75, long: 100.5, sourceLat: 13.76, sourceLong: 100.51 })];
    const { container } = render(
      <InterferenceMapActual {...defaultProps} sites={sites} />
    );
    const navBtns = container.querySelectorAll('[data-testid="navigate-button"]');
    // Only source popup has NavigateButton (tower has no popup)
    expect(navBtns.length).toBe(1);
  });

  it('passes source lat/lng to NavigateButton in source popup', () => {
    const sites = [makeSite({ id: 1, lat: 13.75, long: 100.5, sourceLat: 13.76, sourceLong: 100.51 })];
    const { container } = render(
      <InterferenceMapActual {...defaultProps} sites={sites} />
    );
    const navBtns = container.querySelectorAll('[data-testid="navigate-button"]');
    expect(navBtns[0]?.getAttribute('data-lat')).toBe('13.76');
    expect(navBtns[0]?.getAttribute('data-lng')).toBe('100.51');
  });

  it('passes "Source: <siteName>" as stationName to NavigateButton in source popup when siteName exists', () => {
    const sites = [makeSite({ id: 1, siteName: 'Tower A', lat: 13.75, long: 100.5, sourceLat: 13.76, sourceLong: 100.51 })];
    const { container } = render(
      <InterferenceMapActual {...defaultProps} sites={sites} />
    );
    const navBtns = container.querySelectorAll('[data-testid="navigate-button"]');
    expect(navBtns[0]?.getAttribute('data-station-name')).toBe('Source: Tower A');
  });

  it('passes "Interference Source" as stationName to NavigateButton in source popup when siteName is null', () => {
    const sites = [makeSite({ id: 1, siteName: null, lat: 13.75, long: 100.5, sourceLat: 13.76, sourceLong: 100.51 })];
    const { container } = render(
      <InterferenceMapActual {...defaultProps} sites={sites} />
    );
    const navBtns = container.querySelectorAll('[data-testid="navigate-button"]');
    expect(navBtns[0]?.getAttribute('data-station-name')).toBe('Interference Source');
  });

  it('does not render a source NavigateButton when site has no source coordinates', () => {
    const sites = [makeSite({ id: 1, lat: 13.75, long: 100.5, sourceLat: null, sourceLong: null })];
    const { container } = render(
      <InterferenceMapActual {...defaultProps} sites={sites} />
    );
    const navBtns = container.querySelectorAll('[data-testid="navigate-button"]');
    expect(navBtns.length).toBe(0);
  });
});

// ==========================================
// FilterControls
// ==========================================
import FilterControls from '@/components/sidebar/FilterControls';

describe('FilterControls', () => {
  const defaultProps = {
    filters: {},
    onFiltersChange: vi.fn(),
    onClearFilters: vi.fn(),
    provinces: ['กรุงเทพมหานคร', 'เชียงใหม่', 'ขอนแก่น'],
    availableCities: ['เมือง', 'บางกะปิ'],
    inspectionStatuses: ['ตรวจแล้ว', 'ยังไม่ตรวจ'],
    variant: 'desktop' as const,
  };

  it('renders desktop variant with search, location, and status sections', () => {
    const { container } = render(<FilterControls {...defaultProps} />);
    expect(container.textContent).toContain('Search');
    expect(container.textContent).toContain('Location');
    expect(container.textContent).toContain('Status');
  });

  it('renders province dropdown with all provinces', () => {
    const { container } = render(<FilterControls {...defaultProps} />);
    const selects = container.querySelectorAll('select');
    const provinceSelect = Array.from(selects).find(s => s.getAttribute('aria-label') === 'Filter by province');
    expect(provinceSelect).toBeTruthy();
    const options = provinceSelect!.querySelectorAll('option');
    // "All Provinces" + 3 provinces = 4
    expect(options.length).toBe(4);
    expect(options[1].textContent).toBe('กรุงเทพมหานคร');
  });

  it('renders On Air and Off Air buttons', () => {
    const { container } = render(<FilterControls {...defaultProps} />);
    expect(container.textContent).toContain('On Air');
    expect(container.textContent).toContain('Off Air');
  });

  it('renders inspection status dropdown', () => {
    const { container } = render(<FilterControls {...defaultProps} />);
    const selects = container.querySelectorAll('select');
    const inspectionSelect = Array.from(selects).find(s => s.getAttribute('aria-label') === 'Filter by inspection status');
    expect(inspectionSelect).toBeTruthy();
    const options = inspectionSelect!.querySelectorAll('option');
    // "All Inspection Status" + 2 statuses = 3
    expect(options.length).toBe(3);
  });

  it('renders mobile variant with search input', () => {
    const { container } = render(<FilterControls {...defaultProps} variant="mobile" />);
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    expect(input?.getAttribute('placeholder')).toBe('Search stations...');
  });

  it('renders province select in mobile variant', () => {
    const { container } = render(<FilterControls {...defaultProps} variant="mobile" />);
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
    const provinceSelect = Array.from(selects).find(s => {
      const firstOpt = s.querySelector('option');
      return firstOpt?.textContent === 'All Provinces';
    });
    expect(provinceSelect).toBeTruthy();
  });
});

// ==========================================
// MobileFilterBar
// ==========================================
import MobileFilterBar from '@/components/client/MobileFilterBar';

describe('MobileFilterBar', () => {
  const defaultProps = {
    filters: {},
    setFilters: vi.fn(),
    showFilters: false,
    setShowFilters: vi.fn(),
    clearFilters: vi.fn(),
    initialProvinces: ['กรุงเทพมหานคร', 'เชียงใหม่'],
    initialCities: ['เมือง', 'บางกะปิ'],
    initialInspectionStatuses: ['ตรวจแล้ว', 'ยังไม่ตรวจ'],
    stations: [makeStation()],
  };

  it('renders search input', () => {
    const { container } = render(<MobileFilterBar {...defaultProps} />);
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    expect(input?.getAttribute('placeholder')).toBe('Search stations...');
  });

  it('renders filter toggle button', () => {
    const { container } = render(<MobileFilterBar {...defaultProps} />);
    const toggleBtn = container.querySelector('button[aria-label="Toggle filters"]');
    expect(toggleBtn).toBeTruthy();
  });

  it('renders On Air and Off Air filter chips', () => {
    const { container } = render(<MobileFilterBar {...defaultProps} showFilters={true} />);
    expect(container.textContent).toContain('On Air');
    expect(container.textContent).toContain('Off Air');
  });

  it('renders province and city selects', () => {
    const { container } = render(<MobileFilterBar {...defaultProps} showFilters={true} />);
    const selects = container.querySelectorAll('select');
    // province, city, inspection = 3
    expect(selects.length).toBe(3);
    expect(container.textContent).toContain('All Provinces');
  });

  it('shows active filter count badge when filters are set', () => {
    const { container } = render(
      <MobileFilterBar {...defaultProps} filters={{ province: 'กรุงเทพมหานคร', onAir: true }} />
    );
    // Badge should show "2"
    const badge = container.querySelector('.absolute.-top-1');
    // Use textContent check instead
    const toggleBtn = container.querySelector('button[aria-label="Toggle filters"]');
    expect(toggleBtn?.textContent).toContain('2');
  });
});
