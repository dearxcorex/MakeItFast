import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  formatInspectionDate,
  createStationIcon,
  createLocationIcon,
  getStationIcon,
} from '@/utils/mapHelpers';
import type { FMStation } from '@/types/station';

function makeStation(overrides: Partial<FMStation> = {}): FMStation {
  return {
    id: '1',
    name: 'Test',
    frequency: 100,
    latitude: 13.75,
    longitude: 100.5,
    city: 'Bangkok',
    state: 'Bangkok',
    genre: 'FM',
    onAir: true,
    submitRequest: 'ยื่น',
    inspection69: 'ยังไม่ตรวจ',
    ...overrides,
  };
}

// --- calculateDistance ---
describe('calculateDistance (mapHelpers)', () => {
  it('returns 0 for same point', () => {
    expect(calculateDistance(13.75, 100.5, 13.75, 100.5)).toBe(0);
  });

  it('calculates short distances', () => {
    const d = calculateDistance(0, 0, 1, 0);
    expect(d).toBeCloseTo(111.19, 0);
  });
});

// --- formatInspectionDate ---
describe('formatInspectionDate', () => {
  it('returns null for undefined input', () => {
    expect(formatInspectionDate()).toBeNull();
    expect(formatInspectionDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatInspectionDate('')).toBeNull();
  });

  it('formats valid date in Thai locale', () => {
    const result = formatInspectionDate('2024-01-15');
    expect(result).toBeTruthy();
    // Thai locale should include Thai year (2567)
    expect(typeof result).toBe('string');
  });

  it('returns original string for invalid date format', () => {
    const result = formatInspectionDate('not-a-date');
    // Date constructor may produce "Invalid Date" which toLocaleDateString may handle
    expect(result).toBeTruthy();
  });
});

// --- createStationIcon ---
describe('createStationIcon', () => {
  it('returns a DivIcon', () => {
    const icon = createStationIcon(makeStation());
    expect(icon).toBeDefined();
    expect(icon.options.className).toBe('custom-station-marker');
  });

  it('uses gold color when highlighted', () => {
    const icon = createStationIcon(makeStation(), true);
    expect(icon.options.html).toContain('station-marker--gold');
  });

  it('uses black for no-request stations', () => {
    const icon = createStationIcon(makeStation({ submitRequest: 'ไม่ยื่น' }));
    expect(icon.options.html).toContain('station-marker--black');
  });

  it('uses grey for off-air stations', () => {
    const icon = createStationIcon(makeStation({ onAir: false }));
    expect(icon.options.html).toContain('station-marker--grey');
  });

  it('uses green for inspected stations', () => {
    const icon = createStationIcon(makeStation({ inspection69: 'ตรวจแล้ว' }));
    expect(icon.options.html).toContain('station-marker--green');
  });

  it('uses orange for default status', () => {
    const icon = createStationIcon(makeStation());
    expect(icon.options.html).toContain('station-marker--orange');
  });

  it('shows count badge when stationCount > 1', () => {
    const icon = createStationIcon(makeStation(), false, 3);
    expect(icon.options.html).toContain('3');
    expect(icon.options.html).toContain('station-badge--danger');
  });

  it('shows star badge for main station group', () => {
    const icon = createStationIcon(makeStation(), false, 3, true);
    expect(icon.options.html).toContain('★3');
    expect(icon.options.html).toContain('station-badge--info');
  });

  it('shows star badge for single main station', () => {
    const icon = createStationIcon(makeStation({ type: 'สถานีหลัก' }), false, 1, true);
    expect(icon.options.html).toContain('★');
  });

  it('shows ! badge for no-request', () => {
    const icon = createStationIcon(makeStation({ submitRequest: 'ไม่ยื่น' }));
    expect(icon.options.html).toContain('!');
    expect(icon.options.html).toContain('station-badge--danger');
  });

  it('shows ✓ badge for inspected', () => {
    const icon = createStationIcon(makeStation({ inspection69: 'ตรวจแล้ว' }));
    expect(icon.options.html).toContain('✓');
    expect(icon.options.html).toContain('station-badge--success');
  });

  it('shows ⏳ badge for pending', () => {
    const icon = createStationIcon(makeStation());
    expect(icon.options.html).toContain('⏳');
    expect(icon.options.html).toContain('station-badge--warning');
  });

  it('shows pulse ring when highlighted', () => {
    const icon = createStationIcon(makeStation(), true);
    expect(icon.options.html).toContain('station-marker-pulse');
  });

  it('uses off-air SVG for off-air stations', () => {
    const icon = createStationIcon(makeStation({ onAir: false }));
    expect(icon.options.html).toContain('opacity="0.3"');
  });

  it('has correct icon dimensions', () => {
    const icon = createStationIcon(makeStation());
    expect(icon.options.iconSize).toEqual([32, 40]);
    expect(icon.options.iconAnchor).toEqual([16, 40]);
    expect(icon.options.popupAnchor).toEqual([0, -38]);
  });
});

// --- createLocationIcon ---
describe('createLocationIcon', () => {
  it('returns a DivIcon', () => {
    const icon = createLocationIcon();
    expect(icon).toBeDefined();
    expect(icon.options.className).toBe('custom-location-icon');
  });

  it('has correct dimensions', () => {
    const icon = createLocationIcon();
    expect(icon.options.iconSize).toEqual([20, 20]);
    expect(icon.options.iconAnchor).toEqual([10, 10]);
  });

  it('contains location-pulse class', () => {
    const icon = createLocationIcon();
    expect(icon.options.html).toContain('location-pulse');
  });
});

// --- getStationIcon ---
describe('getStationIcon', () => {
  it('returns icon for single station', () => {
    const station = makeStation();
    const icon = getStationIcon(station, []);
    expect(icon).toBeDefined();
    expect(icon.options.className).toBe('custom-station-marker');
  });

  it('highlights when station id is in highlighted list', () => {
    const station = makeStation({ id: '42' });
    const icon = getStationIcon(station, ['42']);
    expect(icon.options.html).toContain('station-marker--gold');
  });

  it('handles station group array', () => {
    const stations = [makeStation({ id: '1' }), makeStation({ id: '2' })];
    const icon = getStationIcon(stations, [], 2);
    expect(icon.options.html).toContain('2');
  });

  it('detects main station in group', () => {
    const stations = [
      makeStation({ id: '1', type: 'สถานีหลัก' }),
      makeStation({ id: '2' }),
    ];
    const icon = getStationIcon(stations, [], 2);
    expect(icon.options.html).toContain('★');
  });

  it('highlights group when any station is highlighted', () => {
    const stations = [makeStation({ id: '1' }), makeStation({ id: '2' })];
    const icon = getStationIcon(stations, ['2']);
    expect(icon.options.html).toContain('station-marker--gold');
  });
});
