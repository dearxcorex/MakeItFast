/**
 * Test the DistanceCache class from useOptimizedFilters
 * Since it's module-scoped, we test via the hook's exported functions.
 * But we can also test the distance logic directly.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimizedFilters, useOptimizedCityFilter } from '@/hooks/useOptimizedFilters';
import type { FMStation, FilterType } from '@/types/station';

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
    inspection68: 'ยังไม่ตรวจ',
    inspection69: 'ยังไม่ตรวจ',
    description: 'Test station',
    details: '#deviation #intermod',
    ...overrides,
  };
}

const emptyFilters: FilterType = {};

describe('useOptimizedFilters', () => {
  it('returns all stations with no filters', () => {
    const stations = [makeStation({ id: '1' }), makeStation({ id: '2' })];
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations, filters: emptyFilters })
    );
    expect(result.current.filteredStations).toHaveLength(2);
  });

  it('filters by onAir', () => {
    const stations = [
      makeStation({ id: '1', onAir: true }),
      makeStation({ id: '2', onAir: false }),
    ];
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations, filters: { onAir: true } })
    );
    expect(result.current.filteredStations).toHaveLength(1);
    expect(result.current.filteredStations[0].id).toBe('1');
  });

  it('filters by city', () => {
    const stations = [
      makeStation({ id: '1', city: 'Bangkok' }),
      makeStation({ id: '2', city: 'Chiang Mai' }),
    ];
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations, filters: { city: 'Bangkok' } })
    );
    expect(result.current.filteredStations).toHaveLength(1);
  });

  it('filters by province', () => {
    const stations = [
      makeStation({ id: '1', state: 'Bangkok' }),
      makeStation({ id: '2', state: 'Chiang Mai' }),
    ];
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations, filters: { province: 'Bangkok' } })
    );
    expect(result.current.filteredStations).toHaveLength(1);
  });

  it('filters by inspection', () => {
    const stations = [
      makeStation({ id: '1', inspection69: 'ตรวจแล้ว' }),
      makeStation({ id: '2', inspection69: 'ยังไม่ตรวจ' }),
    ];
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations, filters: { inspection69: 'ตรวจแล้ว' } })
    );
    expect(result.current.filteredStations).toHaveLength(1);
  });

  it('filters by submitRequest ไม่ยื่น', () => {
    const stations = [
      makeStation({ id: '1', submitRequest: 'ยื่น' }),
      makeStation({ id: '2', submitRequest: 'ไม่ยื่น' }),
    ];
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations, filters: { submitRequest: 'ไม่ยื่น' } })
    );
    expect(result.current.filteredStations).toHaveLength(1);
    expect(result.current.filteredStations[0].id).toBe('2');
  });

  it('filters by search text', () => {
    const stations = [
      makeStation({ id: '1', name: 'Radio Thailand' }),
      makeStation({ id: '2', name: 'Cool FM' }),
    ];
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations, filters: { search: 'thailand' } })
    );
    expect(result.current.filteredStations).toHaveLength(1);
    expect(result.current.filteredStations[0].name).toBe('Radio Thailand');
  });

  it('search includes frequency', () => {
    const stations = [
      makeStation({ id: '1', frequency: 98.5 }),
      makeStation({ id: '2', frequency: 101.0 }),
    ];
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations, filters: { search: '98.5' } })
    );
    expect(result.current.filteredStations).toHaveLength(1);
  });

  it('search includes hashtags in details', () => {
    const stations = [
      makeStation({ id: '1', details: '#deviation #intermod' }),
      makeStation({ id: '2', details: '#clean' }),
    ];
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations, filters: { search: 'deviation' } })
    );
    expect(result.current.filteredStations).toHaveLength(1);
  });

  it('search with # prefix', () => {
    const stations = [
      makeStation({ id: '1', details: '#deviation' }),
      makeStation({ id: '2', details: '#clean' }),
    ];
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations, filters: { search: '#deviation' } })
    );
    expect(result.current.filteredStations).toHaveLength(1);
  });

  it('combines multiple filters', () => {
    const stations = [
      makeStation({ id: '1', city: 'Bangkok', onAir: true }),
      makeStation({ id: '2', city: 'Bangkok', onAir: false }),
      makeStation({ id: '3', city: 'Chiang Mai', onAir: true }),
    ];
    const { result } = renderHook(() =>
      useOptimizedFilters({
        stations,
        filters: { city: 'Bangkok', onAir: true },
      })
    );
    expect(result.current.filteredStations).toHaveLength(1);
    expect(result.current.filteredStations[0].id).toBe('1');
  });

  it('returns empty for empty stations', () => {
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations: [], filters: emptyFilters })
    );
    expect(result.current.filteredStations).toHaveLength(0);
  });

  it('sorts by distance when user location provided', () => {
    const stations = [
      makeStation({ id: '1', latitude: 14.0, longitude: 100.0 }), // farther
      makeStation({ id: '2', latitude: 13.76, longitude: 100.5 }), // closer
    ];
    const { result } = renderHook(() =>
      useOptimizedFilters({
        stations,
        filters: emptyFilters,
        userLocation: { latitude: 13.75, longitude: 100.5 },
      })
    );
    // Station 2 should be first (closer)
    expect(result.current.filteredStations[0].id).toBe('2');
  });

  it('calculateDistance returns a number', () => {
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations: [], filters: emptyFilters })
    );
    const d = result.current.calculateDistance(13.75, 100.5, 14.0, 101.0);
    expect(d).toBeGreaterThan(0);
  });

  it('getPerformanceMetrics returns stats', () => {
    const stations = [makeStation()];
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations, filters: emptyFilters })
    );
    const metrics = result.current.getPerformanceMetrics();
    expect(metrics.totalStations).toBe(1);
    expect(metrics.filteredStations).toBe(1);
    expect(metrics.distanceCache).toBeDefined();
  });

  it('clearCaches runs without error', () => {
    const { result } = renderHook(() =>
      useOptimizedFilters({ stations: [], filters: emptyFilters })
    );
    expect(() => result.current.clearCaches()).not.toThrow();
  });
});

describe('useOptimizedCityFilter', () => {
  const stations: FMStation[] = [
    makeStation({ id: '1', state: 'Bangkok', city: 'Bangna' }),
    makeStation({ id: '2', state: 'Bangkok', city: 'Sathorn' }),
    makeStation({ id: '3', state: 'Chiang Mai', city: 'Mueang' }),
  ];

  it('returns all cities when no province selected', () => {
    const { result } = renderHook(() =>
      useOptimizedCityFilter(stations, undefined, ['Bangna', 'Sathorn', 'Mueang'])
    );
    expect(result.current).toEqual(['Bangna', 'Sathorn', 'Mueang']);
  });

  it('filters cities by province', () => {
    const { result } = renderHook(() =>
      useOptimizedCityFilter(stations, 'Bangkok', ['Bangna', 'Sathorn', 'Mueang'])
    );
    expect(result.current).toContain('Bangna');
    expect(result.current).toContain('Sathorn');
    expect(result.current).not.toContain('Mueang');
  });

  it('returns unique cities', () => {
    const dupeStations = [
      ...stations,
      makeStation({ id: '4', state: 'Bangkok', city: 'Bangna' }),
    ];
    const { result } = renderHook(() =>
      useOptimizedCityFilter(dupeStations, 'Bangkok', [])
    );
    const bangnaCount = result.current.filter((c) => c === 'Bangna').length;
    expect(bangnaCount).toBe(1);
  });
});
