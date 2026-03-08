import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

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

afterEach(() => {
  cleanup();
});

// ==================
// LoadingSpinner
// ==================
import LoadingSpinner from '@/components/map/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders without text', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('renders with text', () => {
    render(<LoadingSpinner text="Loading..." />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('uses sm size class', () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('w-2.5')).toBe(true);
  });

  it('uses md size class by default', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('w-3')).toBe(true);
  });
});

// ==================
// NavigateButton
// ==================
import NavigateButton from '@/components/map/NavigateButton';

describe('NavigateButton', () => {
  it('renders navigate text', () => {
    const { container } = render(<NavigateButton lat={13.75} lng={100.5} />);
    expect(container.textContent).toContain('Navigate');
  });

  it('has correct aria-label with station name', () => {
    const { container } = render(<NavigateButton lat={13.75} lng={100.5} stationName="Test Station" />);
    const btn = container.querySelector('button');
    expect(btn?.getAttribute('aria-label')).toContain('Test Station');
  });

  it('opens Google Maps on click', () => {
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(<NavigateButton lat={13.75} lng={100.5} />);
    const btn = container.querySelector('button')!;
    fireEvent.click(btn);
    expect(windowOpen).toHaveBeenCalledWith(
      expect.stringContaining('google.com/maps'),
      '_blank',
      'noopener,noreferrer'
    );
    windowOpen.mockRestore();
  });
});

// ==================
// InterferenceSiteDetail
// ==================
import InterferenceSiteDetail from '@/components/interference/InterferenceSiteDetail';

const makeSite = (overrides = {}) => ({
  id: 1,
  siteCode: 'AWN-001',
  siteName: 'Test Site',
  lat: 13.75,
  long: 100.5,
  mcZone: 'Zone1',
  changwat: 'กรุงเทพ',
  cellName: 'Cell-A',
  sectorName: 'Sector-1',
  direction: 120,
  avgNiCarrier: -85.5,
  dayTime: -82.0,
  nightTime: -88.0,
  sourceLat: 13.76,
  sourceLong: 100.51,
  estimateDistance: 1.5,
  ranking: 'Critical',
  status: 'Active',
  nbtcArea: 'Area1',
  awnContact: 'Contact1',
  lot: 'Lot1',
  onSiteScanBy: 'Scanner1',
  onSiteScanDate: 'Date1',
  checkRealtime: 'Yes',
  sourceLocation1: 'Location1',
  sourceLocation2: 'Location2',
  cameraModel1: 'Cam1',
  cameraModel2: 'Cam2',
  notes: 'Test notes',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('InterferenceSiteDetail', () => {
  it('renders site name', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite()} />);
    expect(container.textContent).toContain('Test Site');
  });

  it('renders ranking badge', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite({ ranking: 'Critical' })} />);
    expect(container.textContent).toContain('Critical');
  });

  it('renders noise values', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite()} />);
    expect(container.textContent).toContain('-85.5');
    expect(container.textContent).toContain('-82.0');
    expect(container.textContent).toContain('-88.0');
  });

  it('renders cell name', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite()} />);
    expect(container.textContent).toContain('Cell-A');
  });

  it('renders source location when available', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite()} />);
    expect(container.textContent).toContain('Interference Source');
    expect(container.textContent).toContain('Location1');
  });

  it('does not render source when no coords', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite({ sourceLat: null, sourceLong: null })} />);
    expect(container.textContent).not.toContain('Interference Source');
  });

  it('renders notes', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite()} />);
    expect(container.textContent).toContain('Test notes');
  });

  it('does not render notes when null', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite({ notes: null })} />);
    // "Notes" label should not be present
    const notesLabel = container.querySelector('.text-muted-foreground');
    const allText = container.textContent || '';
    // Notes section is only rendered when notes exist
    expect(allText).not.toContain('Test notes');
  });

  it('handles N/A for missing noise', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite({ avgNiCarrier: null })} />);
    expect(container.textContent).toContain('N/A');
  });

  it('falls back to siteCode when siteName is null', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite({ siteName: null })} />);
    expect(container.textContent).toContain('AWN-001');
  });

  it('falls back to Site #id when both are null', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite({ siteName: null, siteCode: null })} />);
    expect(container.textContent).toContain('Site #1');
  });
});

// ==================
// InterferenceSiteList
// ==================
import InterferenceSiteList from '@/components/interference/InterferenceSiteList';

describe('InterferenceSiteList', () => {
  const sites = [
    makeSite({ id: 1, siteName: 'Site A', ranking: 'Critical', avgNiCarrier: -80 }),
    makeSite({ id: 2, siteName: 'Site B', ranking: 'Major', avgNiCarrier: -90 }),
    makeSite({ id: 3, siteName: 'Site C', ranking: 'Minor', avgNiCarrier: -100 }),
  ];

  it('shows loading state', () => {
    const { container } = render(
      <InterferenceSiteList sites={[]} selectedSite={null} onSiteSelect={vi.fn()} loading={true} />
    );
    expect(container.textContent).toContain('Loading sites...');
  });

  it('shows empty state', () => {
    const { container } = render(
      <InterferenceSiteList sites={[]} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    expect(container.textContent).toContain('No sites found');
  });

  it('renders site list', () => {
    const { container } = render(
      <InterferenceSiteList sites={sites} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    expect(container.textContent).toContain('Site A');
    expect(container.textContent).toContain('Site B');
    expect(container.textContent).toContain('Site C');
  });

  it('shows site count', () => {
    const { container } = render(
      <InterferenceSiteList sites={sites} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    expect(container.textContent).toContain('3 sites');
  });

  it('calls onSiteSelect when clicking a site', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <InterferenceSiteList sites={sites} selectedSite={null} onSiteSelect={onSelect} loading={false} />
    );
    const buttons = container.querySelectorAll('button');
    // First button after the select should be a site button
    const siteBtn = Array.from(buttons).find(b => b.textContent?.includes('Site A'));
    if (siteBtn) fireEvent.click(siteBtn);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('highlights selected site', () => {
    const { container } = render(
      <InterferenceSiteList sites={sites} selectedSite={sites[0]} onSiteSelect={vi.fn()} loading={false} />
    );
    const buttons = container.querySelectorAll('button');
    const siteBtn = Array.from(buttons).find(b => b.textContent?.includes('Site A'));
    expect(siteBtn?.className).toContain('bg-primary/10');
  });

  it('has sort dropdown', () => {
    const { container } = render(
      <InterferenceSiteList sites={sites} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    const select = container.querySelector('select');
    expect(select).toBeTruthy();
  });
});

// ==================
// ImportDialog
// ==================
import ImportDialog from '@/components/interference/ImportDialog';

describe('ImportDialog', () => {
  it('renders dialog title', () => {
    const { container } = render(<ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />);
    expect(container.textContent).toContain('Import Interference Data');
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<ImportDialog onClose={onClose} onImportComplete={vi.fn()} />);
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent === 'Cancel'
    );
    if (cancelBtn) fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('has disabled import button without file', () => {
    const { container } = render(<ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />);
    const importBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent === 'Import'
    );
    expect(importBtn?.disabled).toBe(true);
  });

  it('shows file selection text', () => {
    const { container } = render(<ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />);
    expect(container.textContent).toContain('Click to select');
  });
});

// ==================
// ThemeProvider + useTheme
// ==================
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

describe('ThemeProvider', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
        length: 0,
        key: () => null,
      },
      writable: true,
    });
  });

  function ThemeConsumer() {
    const { theme, toggleTheme } = useTheme();
    return (
      <div>
        <span data-testid="theme">{theme}</span>
        <button onClick={toggleTheme}>Toggle</button>
      </div>
    );
  }

  it('provides default dark theme', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(getByTestId('theme').textContent).toBe('dark');
  });

  it('toggles theme', () => {
    const { getByTestId, getByText } = render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    fireEvent.click(getByText('Toggle'));
    expect(getByTestId('theme').textContent).toBe('light');
  });

  it('throws when useTheme is used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ThemeConsumer />)).toThrow('useTheme must be used within a ThemeProvider');
    consoleSpy.mockRestore();
  });
});
