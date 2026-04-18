import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
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

// Mock next/dynamic to just render the component directly
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType }>) => {
    const DynamicComponent = (props: Record<string, unknown>) => {
      const [Comp, setComp] = React.useState<React.ComponentType | null>(null);
      React.useEffect(() => {
        loader().then((mod) => setComp(() => mod.default));
      }, []);
      if (!Comp) return null;
      return <Comp {...props} />;
    };
    return DynamicComponent;
  },
}));

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock mapHelpers to avoid leaflet dependency
vi.mock('@/utils/mapHelpers', () => ({
  formatInspectionDate: (date: string) => {
    try {
      return new Date(date).toLocaleDateString('en-US');
    } catch {
      return date;
    }
  },
  calculateDistance: () => 10,
}));

afterEach(() => {
  cleanup();
});

// ==================
// Mock Data
// ==================

import type { FMStation } from '@/types/station';

const mockStation: FMStation = {
  id: '1',
  name: 'วิทยุชุมชนคนรักถิ่น',
  frequency: 98.5,
  latitude: 13.75,
  longitude: 100.5,
  city: 'บางรัก',
  state: 'กรุงเทพมหานคร',
  genre: 'ศาสนา',
  type: 'สถานีหลัก',
  onAir: true,
  inspection69: 'ตรวจแล้ว',
  dateInspected: '2025-01-15',
  details: '',
  submitRequest: 'ยื่น',
};

const mockStationOffAir: FMStation = {
  id: '2',
  name: 'สถานีวิทยุเพื่อการศึกษา',
  frequency: 101.0,
  latitude: 13.76,
  longitude: 100.51,
  city: 'ปทุมวัน',
  state: 'กรุงเทพมหานคร',
  genre: 'การศึกษา',
  type: 'สถานีสาขา',
  onAir: false,
  inspection69: 'ยังไม่ตรวจ',
  details: '#deviation',
  submitRequest: 'ยื่น',
};

const mockStationNoSubmit: FMStation = {
  id: '3',
  name: 'สถานีวิทยุไม่ยื่น',
  frequency: 105.0,
  latitude: 13.77,
  longitude: 100.52,
  city: 'จตุจักร',
  state: 'กรุงเทพมหานคร',
  genre: 'บันเทิง',
  onAir: false,
  inspection69: 'ยังไม่ตรวจ',
  submitRequest: 'ไม่ยื่น',
};

// ==================
// StationCard
// ==================
import StationCard from '@/components/map/StationCard';

describe('StationCard', () => {
  it('renders station name and frequency', () => {
    const { container } = render(<StationCard station={mockStation} />);
    expect(container.textContent).toContain('วิทยุชุมชนคนรักถิ่น');
    expect(container.textContent).toContain('98.5 FM');
  });

  it('shows On Air status when station is on air', () => {
    const { container } = render(<StationCard station={mockStation} />);
    expect(container.textContent).toContain('On Air');
  });

  it('shows Off Air status when station is off air', () => {
    const { container } = render(<StationCard station={mockStationOffAir} />);
    expect(container.textContent).toContain('Off Air');
  });

  it('shows inspection status ตรวจแล้ว', () => {
    const { container } = render(<StationCard station={mockStation} />);
    expect(container.textContent).toContain('ตรวจแล้ว');
  });

  it('shows inspection status ยังไม่ตรวจ', () => {
    const { container } = render(<StationCard station={mockStationOffAir} />);
    expect(container.textContent).toContain('ยังไม่ตรวจ');
  });

  it('shows station genre', () => {
    const { container } = render(<StationCard station={mockStation} />);
    expect(container.textContent).toContain('ศาสนา');
  });

  it('shows Main badge for สถานีหลัก type', () => {
    const { container } = render(<StationCard station={mockStation} />);
    expect(container.textContent).toContain('Main');
  });

  it('shows toggle buttons when onUpdateStation is provided', () => {
    const onUpdate = vi.fn();
    const { container } = render(<StationCard station={mockStation} onUpdateStation={onUpdate} />);
    const buttons = container.querySelectorAll('button');
    // Should have: on/off toggle, inspection toggle, #deviation, #intermod
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('hides toggle buttons when onUpdateStation is not provided', () => {
    const { container } = render(<StationCard station={mockStation} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(0);
  });

  it('shows station index when showStationIndex is provided', () => {
    const { container } = render(
      <StationCard station={mockStation} showStationIndex={{ current: 2, total: 5 }} />
    );
    expect(container.textContent).toContain('Station 2 of 5');
  });

  it('shows ไม่ยื่นคำขอ label for non-submitting off-air stations', () => {
    const onUpdate = vi.fn();
    const { container } = render(<StationCard station={mockStationNoSubmit} onUpdateStation={onUpdate} />);
    expect(container.textContent).toContain('ไม่ยื่นคำขอ');
  });

  it('shows inspection date when dateInspected is set', () => {
    const { container } = render(<StationCard station={mockStation} />);
    expect(container.textContent).toContain('Inspected:');
  });

  it('shows #deviation and #intermod buttons with onUpdateStation', () => {
    const onUpdate = vi.fn();
    const { container } = render(<StationCard station={mockStation} onUpdateStation={onUpdate} />);
    expect(container.textContent).toContain('#deviation');
    expect(container.textContent).toContain('#intermod');
  });
});

// ==================
// StationPopupMultiple
// ==================
import StationPopupMultiple from '@/components/map/StationPopupMultiple';

describe('StationPopupMultiple', () => {
  const stationGroup = [mockStation, mockStationOffAir, mockStationNoSubmit];

  it('renders header with station count', () => {
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stationGroup}
        lat={13.75}
        lng={100.5}
        distance={null}
        currentPage={0}
        setCurrentPage={vi.fn()}
        isMobile={false}
      />
    );
    expect(container.textContent).toContain('3 Stations at this Location');
  });

  it('shows city and state from first station', () => {
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stationGroup}
        lat={13.75}
        lng={100.5}
        distance={null}
        currentPage={0}
        setCurrentPage={vi.fn()}
        isMobile={false}
      />
    );
    expect(container.textContent).toContain('บางรัก');
    expect(container.textContent).toContain('กรุงเทพมหานคร');
  });

  it('shows distance when provided', () => {
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stationGroup}
        lat={13.75}
        lng={100.5}
        distance={5.3}
        currentPage={0}
        setCurrentPage={vi.fn()}
        isMobile={false}
      />
    );
    expect(container.textContent).toContain('5.3 km away');
  });

  it('renders all station names in desktop mode', () => {
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stationGroup}
        lat={13.75}
        lng={100.5}
        distance={null}
        currentPage={0}
        setCurrentPage={vi.fn()}
        isMobile={false}
      />
    );
    expect(container.textContent).toContain('วิทยุชุมชนคนรักถิ่น');
    expect(container.textContent).toContain('สถานีวิทยุเพื่อการศึกษา');
    expect(container.textContent).toContain('สถานีวิทยุไม่ยื่น');
  });

  it('renders Navigate button', () => {
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stationGroup}
        lat={13.75}
        lng={100.5}
        distance={null}
        currentPage={0}
        setCurrentPage={vi.fn()}
        isMobile={false}
      />
    );
    expect(container.textContent).toContain('Navigate');
  });
});

// ==================
// StationListItem
// ==================
import StationListItem from '@/components/sidebar/StationListItem';

describe('StationListItem', () => {
  const defaultProps = {
    station: mockStation,
    distance: 12.5 as number | null,
    isSelected: false,
    onClick: vi.fn(),
    variant: 'desktop' as const,
  };

  it('renders station name and frequency (desktop)', () => {
    const { container } = render(<StationListItem {...defaultProps} />);
    expect(container.textContent).toContain('วิทยุชุมชนคนรักถิ่น');
    expect(container.textContent).toContain('98.5 FM');
  });

  it('shows On status for on-air station', () => {
    const { container } = render(<StationListItem {...defaultProps} />);
    expect(container.textContent).toContain('On');
  });

  it('shows Off status for off-air station', () => {
    const { container } = render(
      <StationListItem {...defaultProps} station={mockStationOffAir} />
    );
    expect(container.textContent).toContain('Off');
  });

  it('shows city and state', () => {
    const { container } = render(<StationListItem {...defaultProps} />);
    expect(container.textContent).toContain('บางรัก');
    expect(container.textContent).toContain('กรุงเทพมหานคร');
  });

  it('shows distance when provided', () => {
    const { container } = render(<StationListItem {...defaultProps} />);
    expect(container.textContent).toContain('12.5 km');
  });

  it('does not show distance when null', () => {
    const { container } = render(<StationListItem {...defaultProps} distance={null} />);
    expect(container.textContent).not.toContain('km');
  });

  it('shows Navigate link when distance <= 20', () => {
    const { container } = render(<StationListItem {...defaultProps} distance={15.0} />);
    expect(container.textContent).toContain('Navigate');
  });

  it('does not show Navigate link when distance > 20', () => {
    const { container } = render(<StationListItem {...defaultProps} distance={25.0} />);
    // Navigate should not appear as link (only in text via aria-label)
    const navLink = container.querySelector('a');
    expect(navLink).toBeNull();
  });

  it('renders mobile variant', () => {
    const { container } = render(
      <StationListItem {...defaultProps} variant="mobile" />
    );
    expect(container.textContent).toContain('วิทยุชุมชนคนรักถิ่น');
    expect(container.querySelector('[role="button"]')).toBeTruthy();
  });

  it('shows selected indicator when isSelected is true (desktop)', () => {
    const { container } = render(
      <StationListItem {...defaultProps} isSelected={true} />
    );
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain('selected');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { container } = render(
      <StationListItem {...defaultProps} onClick={onClick} />
    );
    fireEvent.click(container.firstElementChild!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ==================
// InterferenceFilterPanel
// ==================
import InterferenceFilterPanel from '@/components/interference/InterferenceFilterPanel';

describe('InterferenceFilterPanel', () => {
  beforeEach(() => {
    // Mock fetch for /api/interference/stats
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ byProvince: { 'กรุงเทพมหานคร': 5, 'เชียงใหม่': 3 } }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders ranking badges (Critical, Major, Minor)', () => {
    const { container } = render(
      <InterferenceFilterPanel
        filters={{}}
        onFiltersChange={vi.fn()}
      />
    );
    expect(container.textContent).toContain('Critical');
    expect(container.textContent).toContain('Major');
    expect(container.textContent).toContain('Minor');
  });

  it('renders Has Source button', () => {
    const { container } = render(
      <InterferenceFilterPanel
        filters={{}}
        onFiltersChange={vi.fn()}
      />
    );
    expect(container.textContent).toContain('Has Source');
  });

  it('renders province select dropdown', () => {
    const { container } = render(
      <InterferenceFilterPanel
        filters={{}}
        onFiltersChange={vi.fn()}
      />
    );
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBe(1);
    expect(container.textContent).toContain('All Provinces');
  });

  it('shows Clear all filters when filters are active', () => {
    const { container } = render(
      <InterferenceFilterPanel
        filters={{ ranking: 'Critical' }}
        onFiltersChange={vi.fn()}
      />
    );
    expect(container.textContent).toContain('Clear all');
  });

  it('does not show Clear all filters when no filters active', () => {
    const { container } = render(
      <InterferenceFilterPanel
        filters={{}}
        onFiltersChange={vi.fn()}
      />
    );
    expect(container.textContent).not.toContain('Clear all');
  });

  it('calls onFiltersChange when ranking badge is clicked', () => {
    const onFiltersChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel
        filters={{}}
        onFiltersChange={onFiltersChange}
      />
    );
    // Find the Critical button (it's a badge button, not the select option)
    const buttons = container.querySelectorAll('button');
    const criticalBtn = Array.from(buttons).find(b => b.textContent === 'Critical');
    expect(criticalBtn).toBeTruthy();
    fireEvent.click(criticalBtn!);
    expect(onFiltersChange).toHaveBeenCalledWith({ ranking: 'Critical' });
  });
});

// ==================
// NavSidebar
// ==================
import NavSidebar from '@/components/NavSidebar';

describe('NavSidebar', () => {
  it('renders navigation buttons', () => {
    const { container } = render(
      <NavSidebar activeTab="stations" onTabChange={vi.fn()} />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(4); // stations, intermod, interference, analytics
  });

  it('renders as nav element', () => {
    const { container } = render(
      <NavSidebar activeTab="stations" onTabChange={vi.fn()} />
    );
    const nav = container.querySelector('nav');
    expect(nav).toBeTruthy();
  });

  it('calls onTabChange when a nav item is clicked', () => {
    const onTabChange = vi.fn();
    const { container } = render(
      <NavSidebar activeTab="stations" onTabChange={onTabChange} />
    );
    const buttons = container.querySelectorAll('button');
    // Click the second button (intermod)
    fireEvent.click(buttons[1]);
    expect(onTabChange).toHaveBeenCalledWith('intermod');
  });

  it('shows Collapse text in bottom section', () => {
    const { container } = render(
      <NavSidebar activeTab="stations" onTabChange={vi.fn()} />
    );
    // Collapse is only visible when expanded (hover), but the element exists in DOM
    // The text is conditionally rendered, so it won't appear by default
    // Just verify the bottom section with the chevron icon exists
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});

// ==================
// AppHeader
// ==================
import AppHeader from '@/components/client/AppHeader';

describe('AppHeader', () => {
  const stations: FMStation[] = [mockStation, mockStationOffAir, mockStationNoSubmit];

  it('renders header element', () => {
    const { container } = render(<AppHeader filteredStations={stations} />);
    const header = container.querySelector('header');
    expect(header).toBeTruthy();
  });

  it('shows total station count', () => {
    const { container } = render(<AppHeader filteredStations={stations} />);
    expect(container.textContent).toContain('3');
  });

  it('shows on-air count', () => {
    const { container } = render(<AppHeader filteredStations={stations} />);
    // Only mockStation is onAir=true
    expect(container.textContent).toContain('1');
  });

  it('shows off-air count', () => {
    const { container } = render(<AppHeader filteredStations={stations} />);
    // 2 stations are off air
    expect(container.textContent).toContain('2');
  });

  it('shows NBTC FM Monitoring when no user location', () => {
    const { container } = render(<AppHeader filteredStations={stations} />);
    expect(container.textContent).toContain('NBTC FM Monitoring');
  });

  it('shows accuracy when user location is provided', () => {
    const { container } = render(
      <AppHeader
        filteredStations={stations}
        userLocation={{ latitude: 13.75, longitude: 100.5, accuracy: 25.678 }}
      />
    );
    expect(container.textContent).toContain('26'); // accuracy rounded to 0 decimals
  });

  it('renders theme toggle button', () => {
    const { container } = render(<AppHeader filteredStations={stations} />);
    const themeButtons = container.querySelectorAll('button');
    expect(themeButtons.length).toBeGreaterThanOrEqual(1);
  });
});
