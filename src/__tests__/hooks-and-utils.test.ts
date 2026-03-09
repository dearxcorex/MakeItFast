import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useMemoryMonitor } from '@/hooks/useOptimizedFilters';
import {
  AVIATION_BANDS,
  AVIATION_BAND_RANGE,
  FM_BAND_RANGE,
  COMMON_AVIATION_FREQUENCIES,
} from '@/types/intermod';
import type { FMStation } from '@/types/station';

// ---------- helpers ----------

function makeStation(overrides: Partial<FMStation> = {}): FMStation {
  return {
    id: 1,
    name: 'Test Station',
    frequency: 99.5,
    latitude: 13.75,
    longitude: 100.5,
    city: 'Bangkok',
    state: 'Bangkok',
    genre: 'Pop',
    ...overrides,
  };
}

function fireKey(key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true });
  document.dispatchEvent(event);
}

// ---------- useKeyboardNavigation ----------

describe('useKeyboardNavigation', () => {
  const stations: FMStation[] = [
    makeStation({ id: 1, name: 'Station A' }),
    makeStation({ id: 2, name: 'Station B' }),
    makeStation({ id: 3, name: 'Station C' }),
  ];

  const defaultOptions = () => ({
    stations,
    isOpen: true,
    calculateDistance: vi.fn(() => 5),
    onToggle: vi.fn(),
    onStationSelect: vi.fn(),
  });

  it('returns selectedIndex of -1 initially', () => {
    const opts = defaultOptions();
    const { result } = renderHook(() => useKeyboardNavigation(opts));
    expect(result.current.selectedIndex).toBe(-1);
  });

  it('ArrowDown increments selectedIndex', () => {
    const opts = defaultOptions();
    const { result } = renderHook(() => useKeyboardNavigation(opts));

    act(() => fireKey('ArrowDown'));
    expect(result.current.selectedIndex).toBe(0);

    act(() => fireKey('ArrowDown'));
    expect(result.current.selectedIndex).toBe(1);
  });

  it('ArrowUp decrements selectedIndex (wraps to end from -1)', () => {
    const opts = defaultOptions();
    const { result } = renderHook(() => useKeyboardNavigation(opts));

    // From initial -1, ArrowUp should wrap to last index (length - 1 = 2)
    act(() => fireKey('ArrowUp'));
    expect(result.current.selectedIndex).toBe(stations.length - 1);
  });

  it('ArrowDown wraps around from last to first', () => {
    const opts = defaultOptions();
    const { result } = renderHook(() => useKeyboardNavigation(opts));

    // Navigate to last item
    act(() => fireKey('ArrowDown')); // 0
    act(() => fireKey('ArrowDown')); // 1
    act(() => fireKey('ArrowDown')); // 2
    act(() => fireKey('ArrowDown')); // wraps to 0
    expect(result.current.selectedIndex).toBe(0);
  });

  it('Escape calls onToggle when isOpen is true', () => {
    const opts = defaultOptions();
    renderHook(() => useKeyboardNavigation(opts));

    act(() => fireKey('Escape'));
    expect(opts.onToggle).toHaveBeenCalledTimes(1);
  });
});

// ---------- intermod constants ----------

describe('Intermod constants', () => {
  it('AVIATION_BANDS has correct ranges for all services', () => {
    expect(AVIATION_BANDS['VOR/ILS']).toEqual({ min: 108.0, max: 117.95 });
    expect(AVIATION_BANDS['Emergency']).toEqual({ min: 121.5, max: 121.5 });
    expect(AVIATION_BANDS['ATC Voice']).toEqual({ min: 118.0, max: 137.0 });
  });

  it('AVIATION_BAND_RANGE covers 108-137 MHz', () => {
    expect(AVIATION_BAND_RANGE).toEqual({ min: 108.0, max: 137.0 });
  });

  it('FM_BAND_RANGE covers 87.5-108 MHz', () => {
    expect(FM_BAND_RANGE).toEqual({ min: 87.5, max: 108.0 });
  });

  it('COMMON_AVIATION_FREQUENCIES has entries with required fields', () => {
    expect(COMMON_AVIATION_FREQUENCIES.length).toBeGreaterThan(0);
    for (const entry of COMMON_AVIATION_FREQUENCIES) {
      expect(entry).toHaveProperty('frequency');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('service');
      expect(typeof entry.frequency).toBe('number');
    }
  });

  it('all COMMON_AVIATION_FREQUENCIES fall within AVIATION_BAND_RANGE', () => {
    for (const entry of COMMON_AVIATION_FREQUENCIES) {
      expect(entry.frequency).toBeGreaterThanOrEqual(AVIATION_BAND_RANGE.min);
      expect(entry.frequency).toBeLessThanOrEqual(AVIATION_BAND_RANGE.max);
    }
  });
});

// ---------- useMemoryMonitor ----------

describe('useMemoryMonitor', () => {
  it('returns a checkMemoryUsage function', () => {
    const { result } = renderHook(() => useMemoryMonitor());
    expect(typeof result.current.checkMemoryUsage).toBe('function');
  });

  it('checkMemoryUsage returns null when performance.memory is not available', () => {
    const { result } = renderHook(() => useMemoryMonitor());
    // jsdom does not provide performance.memory
    const usage = result.current.checkMemoryUsage();
    expect(usage).toBeNull();
  });
});
