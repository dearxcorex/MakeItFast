import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

// Mock ThemeContext
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

// Mock useKeyboardNavigation
vi.mock('@/hooks/useKeyboardNavigation', () => ({
  useKeyboardNavigation: () => ({ selectedIndex: -1 }),
}));

// Mock FilterControls
vi.mock('@/components/sidebar/FilterControls', () => ({
  default: () => <div data-testid="filter-controls">FilterControls</div>,
}));

// Track StationListItem renders
vi.mock('@/components/sidebar/StationListItem', () => ({
  default: ({
    station,
    distance,
    isSelected,
    onClick,
    variant,
  }: {
    station: { id: string | number; name: string; frequency: number };
    distance: number | null;
    isSelected: boolean;
    onClick: () => void;
    variant: string;
  }) => (
    <div
      data-testid={`station-item-${station.id}`}
      data-selected={isSelected}
      data-variant={variant}
      data-distance={distance}
      onClick={onClick}
    >
      {station.name} {station.frequency}
    </div>
  ),
}));

import Sidebar from '@/components/Sidebar';
import type { FMStation, FilterType } from '@/types/station';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
  ...overrides,
});

const defaultProps = {
  stations: [
    makeStation({ id: '1', name: 'Station A', frequency: 88.0 }),
    makeStation({ id: '2', name: 'Station B', frequency: 99.0, latitude: 13.76, longitude: 100.51 }),
    makeStation({ id: '3', name: 'Station C', frequency: 102.5, latitude: 13.77, longitude: 100.52 }),
  ],
  allStations: [
    makeStation({ id: '1', name: 'Station A', frequency: 88.0 }),
    makeStation({ id: '2', name: 'Station B', frequency: 99.0, latitude: 13.76, longitude: 100.51 }),
    makeStation({ id: '3', name: 'Station C', frequency: 102.5, latitude: 13.77, longitude: 100.52 }),
  ],
  onStationSelect: vi.fn(),
  selectedStation: undefined as FMStation | undefined,
  isOpen: false,
  onToggle: vi.fn(),
  userLocation: { latitude: 13.75, longitude: 100.5, accuracy: 10 },
  initialCities: ['Bangkok'],
  initialProvinces: ['Bangkok'],
  initialInspectionStatuses: ['ตรวจแล้ว', 'ยังไม่ตรวจ'],
  filters: {} as FilterType,
  onFiltersChange: vi.fn(),
  onClearFilters: vi.fn(),
  calculateDistance: vi.fn(() => 5), // 5km = within 20km radius
};

describe('Sidebar - Deep Tests', () => {
  it('renders all stations within 20km on desktop', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    // Each station should create a StationListItem
    expect(container.querySelector('[data-testid="station-item-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="station-item-2"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="station-item-3"]')).toBeTruthy();
  });

  it('filters out stations beyond 20km', () => {
    const calcDist = vi.fn((lat1: number, lon1: number, lat2: number, lon2: number) => {
      // Station C at 13.77 is "far away"
      if (lat2 === 13.77) return 25;
      return 5;
    });

    const { container } = render(<Sidebar {...defaultProps} calculateDistance={calcDist} />);
    expect(container.querySelector('[data-testid="station-item-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="station-item-2"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="station-item-3"]')).toBeNull();
  });

  it('shows correct nearby count in header', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    // All 3 stations are within 20km (calculateDistance returns 5)
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('nearby');
  });

  it('highlights selected station', () => {
    const selectedStation = defaultProps.stations[1];
    const { container } = render(
      <Sidebar {...defaultProps} selectedStation={selectedStation} />
    );

    const item2 = container.querySelector('[data-testid="station-item-2"]');
    expect(item2?.getAttribute('data-selected')).toBe('true');

    const item1 = container.querySelector('[data-testid="station-item-1"]');
    expect(item1?.getAttribute('data-selected')).toBe('false');
  });

  it('calls onStationSelect when station is clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(<Sidebar {...defaultProps} onStationSelect={onSelect} />);

    const item1 = container.querySelector('[data-testid="station-item-1"]');
    fireEvent.click(item1!);

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', name: 'Station A' })
    );
  });

  it('passes distance to StationListItem', () => {
    const calcDist = vi.fn(() => 12.3);
    const { container } = render(<Sidebar {...defaultProps} calculateDistance={calcDist} />);

    const item1 = container.querySelector('[data-testid="station-item-1"]');
    expect(item1?.getAttribute('data-distance')).toBe('12.3');
  });

  it('shows "stations" instead of "nearby" when no user location', () => {
    const { container } = render(
      <Sidebar {...defaultProps} userLocation={undefined} />
    );
    expect(container.textContent).toContain('stations');
    expect(container.textContent).not.toContain('within 20km radius');
  });

  it('shows all stations without filtering when no user location', () => {
    const { container } = render(
      <Sidebar {...defaultProps} userLocation={undefined} />
    );
    // Without userLocation, getFilteredStations returns all stations
    expect(container.querySelector('[data-testid="station-item-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="station-item-2"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="station-item-3"]')).toBeTruthy();
  });

  it('shows empty state when no stations within range', () => {
    const calcDist = vi.fn(() => 25); // All beyond 20km
    const { container } = render(<Sidebar {...defaultProps} calculateDistance={calcDist} />);
    expect(container.textContent).toContain('No stations found');
    expect(container.textContent).toContain('No stations within 20km');
  });

  it('shows empty state with filter message when no stations and no location', () => {
    const { container } = render(
      <Sidebar {...defaultProps} stations={[]} allStations={[]} userLocation={undefined} />
    );
    expect(container.textContent).toContain('No stations found');
    expect(container.textContent).toContain('Try adjusting filters');
  });

  it('renders desktop variant for station items in desktop sidebar', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    // Desktop sidebar items should have variant="desktop"
    const desktopItems = container.querySelectorAll('[data-variant="desktop"]');
    expect(desktopItems.length).toBe(3);
  });

  it('renders theme toggle button', () => {
    const { container } = render(<Sidebar {...defaultProps} />);
    const themeBtn = container.querySelector('[aria-label*="Switch to"]');
    expect(themeBtn).toBeTruthy();
  });
});
