import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';

// Mock mapHelpers
vi.mock('@/utils/mapHelpers', () => ({
  formatInspectionDate: (d: string) => d,
  calculateDistance: vi.fn(() => 5),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// NOTE: StationCard tests moved to station-card.test.tsx to avoid
// vi.mock hoisting conflicts with the StationCard mock used by
// StationPopupMultiple tests below.

const makeStation = (overrides = {}) => ({
  id: '1',
  name: 'Test FM',
  frequency: 98.5,
  latitude: 13.75,
  longitude: 100.5,
  city: 'Bangkok',
  state: 'Bangkok',
  genre: 'FM',
  type: 'สถานีวิทยุ',
  onAir: true,
  inspection68: 'ยังไม่ตรวจ',
  inspection69: 'ยังไม่ตรวจ',
  submitRequest: 'ยื่น',
  details: '',
  ...overrides,
});

// ==========================================
// StationListItem
// ==========================================
import StationListItem from '@/components/sidebar/StationListItem';

describe('StationListItem', () => {
  const station = makeStation({ type: 'FM Radio' });

  it('renders desktop variant with station info', () => {
    const { container } = render(
      <StationListItem
        station={station}
        distance={5.3}
        isSelected={false}
        onClick={vi.fn()}
        variant="desktop"
      />
    );
    expect(container.textContent).toContain('Test FM');
    expect(container.textContent).toContain('98.5 FM');
    expect(container.textContent).toContain('5.3 km');
    expect(container.textContent).toContain('Bangkok, Bangkok');
  });

  it('renders mobile variant', () => {
    const { container } = render(
      <StationListItem
        station={station}
        distance={3.0}
        isSelected={false}
        onClick={vi.fn()}
        variant="mobile"
      />
    );
    expect(container.textContent).toContain('Test FM');
    expect(container.textContent).toContain('3.0 km');
  });

  it('shows selected state on desktop', () => {
    const { container } = render(
      <StationListItem
        station={station}
        distance={null}
        isSelected={true}
        onClick={vi.fn()}
        variant="desktop"
      />
    );
    expect(container.firstElementChild?.className).toContain('selected');
  });

  it('shows selected state on mobile', () => {
    const { container } = render(
      <StationListItem
        station={station}
        distance={null}
        isSelected={true}
        onClick={vi.fn()}
        variant="mobile"
      />
    );
    expect(container.firstElementChild?.className).toContain('bg-primary/10');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { container } = render(
      <StationListItem
        station={station}
        distance={null}
        isSelected={false}
        onClick={onClick}
        variant="desktop"
      />
    );
    fireEvent.click(container.firstElementChild!);
    expect(onClick).toHaveBeenCalled();
  });

  it('calls onClick on Enter key', () => {
    const onClick = vi.fn();
    const { container } = render(
      <StationListItem
        station={station}
        distance={null}
        isSelected={false}
        onClick={onClick}
        variant="desktop"
      />
    );
    fireEvent.keyDown(container.firstElementChild!, { key: 'Enter' });
    expect(onClick).toHaveBeenCalled();
  });

  it('shows Navigate link when distance <= 20km', () => {
    const { container } = render(
      <StationListItem
        station={station}
        distance={15}
        isSelected={false}
        onClick={vi.fn()}
        variant="desktop"
      />
    );
    expect(container.textContent).toContain('Navigate');
  });

  it('does not show Navigate link when no distance', () => {
    const { container } = render(
      <StationListItem
        station={station}
        distance={null}
        isSelected={false}
        onClick={vi.fn()}
        variant="desktop"
      />
    );
    expect(container.textContent).not.toContain('Navigate');
  });

  it('shows dateInspected on desktop', () => {
    const stationWithDate = makeStation({ dateInspected: '2026-01-15' });
    const { container } = render(
      <StationListItem
        station={stationWithDate}
        distance={null}
        isSelected={false}
        onClick={vi.fn()}
        variant="desktop"
      />
    );
    expect(container.textContent).toContain('Inspected:');
  });

  it('shows keyboard-selected class', () => {
    const { container } = render(
      <StationListItem
        station={station}
        distance={null}
        isSelected={false}
        isKeyboardSelected={true}
        onClick={vi.fn()}
        variant="desktop"
      />
    );
    expect(container.firstElementChild?.className).toContain('keyboard-selected');
  });

  it('shows on/off air badge in mobile variant', () => {
    const offStation = makeStation({ onAir: false });
    const { container } = render(
      <StationListItem
        station={offStation}
        distance={5}
        isSelected={false}
        onClick={vi.fn()}
        variant="mobile"
      />
    );
    expect(container.textContent).toContain('Off');
  });

  it('shows navigate link in mobile when distance <= 20', () => {
    const { container } = render(
      <StationListItem
        station={station}
        distance={10}
        isSelected={false}
        onClick={vi.fn()}
        variant="mobile"
      />
    );
    expect(container.textContent).toContain('Navigate');
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
    provinces: ['Bangkok', 'Chiang Mai'],
    availableCities: ['Bangkok Noi', 'Bangkok Yai'],
    inspectionStatuses: ['ตรวจแล้ว', 'ยังไม่ตรวจ'],
    variant: 'desktop' as const,
  };

  it('renders desktop search input', () => {
    const { container } = render(<FilterControls {...defaultProps} />);
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
  });

  it('renders province dropdown', () => {
    const { container } = render(<FilterControls {...defaultProps} />);
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain('All Provinces');
  });

  it('renders On Air / Off Air buttons', () => {
    const { container } = render(<FilterControls {...defaultProps} />);
    expect(container.textContent).toContain('On Air');
    expect(container.textContent).toContain('Off Air');
  });

  it('calls onFiltersChange on search input', () => {
    const onFiltersChange = vi.fn();
    const { container } = render(
      <FilterControls {...defaultProps} onFiltersChange={onFiltersChange} />
    );
    const input = container.querySelector('input[type="text"]')!;
    fireEvent.change(input, { target: { value: 'test' } });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'test' })
    );
  });

  it('calls onFiltersChange on province select', () => {
    const onFiltersChange = vi.fn();
    const { container } = render(
      <FilterControls {...defaultProps} onFiltersChange={onFiltersChange} />
    );
    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Bangkok' } });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ province: 'Bangkok' })
    );
  });

  it('toggles On Air filter', () => {
    const onFiltersChange = vi.fn();
    const { container } = render(
      <FilterControls {...defaultProps} onFiltersChange={onFiltersChange} />
    );
    const buttons = Array.from(container.querySelectorAll('button'));
    const onAirBtn = buttons.find((b) => b.textContent?.includes('On Air'));
    fireEvent.click(onAirBtn!);
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ onAir: true })
    );
  });

  it('toggles Off Air filter', () => {
    const onFiltersChange = vi.fn();
    const { container } = render(
      <FilterControls {...defaultProps} onFiltersChange={onFiltersChange} />
    );
    const buttons = Array.from(container.querySelectorAll('button'));
    const offAirBtn = buttons.find((b) => b.textContent?.includes('Off Air'));
    fireEvent.click(offAirBtn!);
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ onAir: false })
    );
  });

  it('shows clear button when filters active and calls onClearFilters', () => {
    const onClear = vi.fn();
    const { container } = render(
      <FilterControls {...defaultProps} filters={{ search: 'test' }} onClearFilters={onClear} />
    );
    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Clear')
    );
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn!);
    expect(onClear).toHaveBeenCalled();
  });

  it('does not show clear button when no filters active', () => {
    const { container } = render(<FilterControls {...defaultProps} />);
    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Clear')
    );
    expect(clearBtn).toBeUndefined();
  });

  it('renders inspection status dropdown', () => {
    const { container } = render(<FilterControls {...defaultProps} />);
    expect(container.textContent).toContain('All Inspection Status');
  });

  it('calls onFiltersChange on inspection select', () => {
    const onFiltersChange = vi.fn();
    const { container } = render(
      <FilterControls {...defaultProps} onFiltersChange={onFiltersChange} />
    );
    const selects = container.querySelectorAll('select');
    // inspection is the 3rd select
    const inspectionSelect = selects[2];
    fireEvent.change(inspectionSelect, { target: { value: 'ตรวจแล้ว' } });
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ inspection69: 'ตรวจแล้ว' })
    );
  });

  // Mobile variant
  it('renders mobile variant with search', () => {
    const { container } = render(
      <FilterControls {...defaultProps} variant="mobile" />
    );
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
  });

  it('renders mobile On Air/Off Air buttons', () => {
    const { container } = render(
      <FilterControls {...defaultProps} variant="mobile" />
    );
    expect(container.textContent).toContain('On Air');
    expect(container.textContent).toContain('Off Air');
  });

  it('shows mobile province dropdown', () => {
    const { container } = render(
      <FilterControls {...defaultProps} variant="mobile" />
    );
    expect(container.textContent).toContain('All Provinces');
  });

  it('shows mobile city dropdown when province selected', () => {
    const { container } = render(
      <FilterControls
        {...defaultProps}
        variant="mobile"
        filters={{ province: 'Bangkok' }}
      />
    );
    expect(container.textContent).toContain('All Cities in Bangkok');
  });

  it('shows clear search button in mobile when search is active', () => {
    const { container } = render(
      <FilterControls
        {...defaultProps}
        variant="mobile"
        filters={{ search: 'test' }}
      />
    );
    const clearSearchBtn = container.querySelector('[aria-label="Clear search"]');
    expect(clearSearchBtn).toBeTruthy();
  });
});

// ==========================================
// StationPopupMultiple
// ==========================================
vi.mock('@/components/map/StationCard', () => ({
  default: ({ station, isMobile }: { station: { name: string }; isMobile?: boolean }) => (
    <div data-testid={`card-${station.name}`}>
      {station.name} {isMobile ? '(mobile)' : '(desktop)'}
    </div>
  ),
}));

vi.mock('@/components/map/NavigateButton', () => ({
  default: ({ lat, lng }: { lat: number; lng: number }) => (
    <div data-testid="navigate-btn">Navigate {lat},{lng}</div>
  ),
}));

import StationPopupMultiple from '@/components/map/StationPopupMultiple';

describe('StationPopupMultiple', () => {
  const stations = [
    makeStation({ id: '1', name: 'Station A', frequency: 88.0 }),
    makeStation({ id: '2', name: 'Station B', frequency: 99.0 }),
    makeStation({ id: '3', name: 'Station C', frequency: 102.5 }),
    makeStation({ id: '4', name: 'Station D', frequency: 104.0 }),
  ];

  it('renders header with station count', () => {
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stations}
        lat={13.75}
        lng={100.5}
        distance={null}
        currentPage={0}
        setCurrentPage={vi.fn()}
        isMobile={false}
      />
    );
    expect(container.textContent).toContain('4 Stations at this Location');
  });

  it('renders navigate button', () => {
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stations}
        lat={13.75}
        lng={100.5}
        distance={null}
        currentPage={0}
        setCurrentPage={vi.fn()}
        isMobile={false}
      />
    );
    expect(container.querySelector('[data-testid="navigate-btn"]')).toBeTruthy();
  });

  it('renders distance when provided', () => {
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stations}
        lat={13.75}
        lng={100.5}
        distance={3.7}
        currentPage={0}
        setCurrentPage={vi.fn()}
        isMobile={false}
      />
    );
    expect(container.textContent).toContain('3.7 km away');
  });

  it('renders all stations in desktop mode (no pagination for <= 3 per page)', () => {
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stations}
        lat={13.75}
        lng={100.5}
        distance={null}
        currentPage={0}
        setCurrentPage={vi.fn()}
        isMobile={false}
      />
    );
    // Desktop mode renders all stations (not paginated per-page, but shows all)
    expect(container.textContent).toContain('Station A');
    expect(container.textContent).toContain('Station D');
  });

  it('renders mobile mode with pagination controls', () => {
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stations}
        lat={13.75}
        lng={100.5}
        distance={null}
        currentPage={0}
        setCurrentPage={vi.fn()}
        isMobile={true}
      />
    );
    // Mobile shows 1 station per page
    expect(container.textContent).toContain('Station A');
    expect(container.textContent).toContain('Station 1 of 4');
    expect(container.textContent).toContain('Previous');
    expect(container.textContent).toContain('Next');
  });

  it('navigates to next page in mobile mode', () => {
    const setPage = vi.fn();
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stations}
        lat={13.75}
        lng={100.5}
        distance={null}
        currentPage={0}
        setCurrentPage={setPage}
        isMobile={true}
      />
    );
    const nextBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Next')
    )!;
    fireEvent.click(nextBtn);
    expect(setPage).toHaveBeenCalledWith(1);
  });

  it('disables previous on first page', () => {
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stations}
        lat={13.75}
        lng={100.5}
        distance={null}
        currentPage={0}
        setCurrentPage={vi.fn()}
        isMobile={true}
      />
    );
    const prevBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Previous')
    )!;
    expect(prevBtn.disabled).toBe(true);
  });

  it('city and state shown from first station', () => {
    const { container } = render(
      <StationPopupMultiple
        stationGroup={stations}
        lat={13.75}
        lng={100.5}
        distance={null}
        currentPage={0}
        setCurrentPage={vi.fn()}
        isMobile={false}
      />
    );
    expect(container.textContent).toContain('Bangkok, Bangkok');
  });
});
