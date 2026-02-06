/**
 * Optimized filtering hook to prevent Chrome freezing
 * Uses debouncing and memoization for performance
 */

import { useMemo, useCallback } from 'react';
import { FMStation, UserLocation, FilterType } from '@/types/station';


// Optimized distance calculation with caching
class DistanceCache {
  private cache = new Map<string, number>();
  private maxCacheSize = 1000;

  getCacheKey(lat1: number, lon1: number, lat2: number, lon2: number): string {
    return `${lat1.toFixed(4)},${lon1.toFixed(4)}-${lat2.toFixed(4)},${lon2.toFixed(4)}`;
  }

  getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const key = this.getCacheKey(lat1, lon1, lat2, lon2);

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // Clear cache if it gets too large
    if (this.cache.size > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      // Keep only the last half
      this.cache.clear();
      entries.slice(-this.maxCacheSize / 2).forEach(([k, v]) => {
        this.cache.set(k, v);
      });
    }

    // Calculate distance using Haversine formula
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    this.cache.set(key, distance);
    return distance;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize
    };
  }
}

const distanceCache = new DistanceCache();

interface UseOptimizedFiltersOptions {
  stations: FMStation[];
  filters: FilterType;
  userLocation?: UserLocation;
  enableDebounce?: boolean;
  debounceDelay?: number;
}

export function useOptimizedFilters({
  stations,
  filters,
  userLocation
}: Omit<UseOptimizedFiltersOptions, 'enableDebounce' | 'debounceDelay'>) {

  // Memoized filter predicates to avoid recreation
  const filterPredicates = useMemo(() => {
    return {
      onAir: filters.onAir !== undefined ?
        (station: FMStation) => station.onAir === filters.onAir :
        null,

      city: filters.city ?
        (station: FMStation) => station.city === filters.city :
        null,

      province: filters.province ?
        (station: FMStation) => station.state === filters.province :
        null,

      inspection: filters.inspection ?
        (station: FMStation) => station.inspection68 === filters.inspection :
        null,

      submitRequest: filters.submitRequest === 'ไม่ยื่น' ?
        (station: FMStation) => station.submitRequest === 'ไม่ยื่น' :
        null,

      search: filters.search ?
        (station: FMStation) => {
          const searchLower = filters.search!.toLowerCase();
          const searchTerm = filters.search!;
          return (
            station.name.toLowerCase().includes(searchLower) ||
            station.description?.toLowerCase().includes(searchLower) ||
            station.genre.toLowerCase().includes(searchLower) ||
            station.city.toLowerCase().includes(searchLower) ||
            station.state.toLowerCase().includes(searchLower) ||
            station.details?.toLowerCase().includes(searchLower) ||
            station.frequency.toString().includes(searchTerm) ||
            // Support searching for hashtags without # prefix
            (searchLower.startsWith('#') && station.details?.toLowerCase().includes(searchLower)) ||
            (!searchLower.startsWith('#') && station.details?.toLowerCase().includes(`#${searchLower}`))
          );
        } :
        null
    };
  }, [filters.onAir, filters.city, filters.province, filters.inspection, filters.submitRequest, filters.search]);

  // Optimized filtering with early returns and minimal operations
  const filteredStations = useMemo(() => {
    if (!stations.length) return [];


    let filtered = stations;

    // Apply filters in order of selectivity (most selective first)
    // This reduces the dataset size early

    if (filterPredicates.city) {
      filtered = filtered.filter(filterPredicates.city);
    }

    if (filterPredicates.province) {
      filtered = filtered.filter(filterPredicates.province);
    }

    if (filterPredicates.inspection) {
      filtered = filtered.filter(filterPredicates.inspection);
    }

    if (filterPredicates.onAir) {
      filtered = filtered.filter(filterPredicates.onAir);
    }

    if (filterPredicates.submitRequest) {
      filtered = filtered.filter(filterPredicates.submitRequest);
    }

    // Search filter last as it's most expensive
    if (filterPredicates.search) {
      filtered = filtered.filter(filterPredicates.search);
    }


    return filtered;
  }, [stations, filterPredicates]);

  // Optimized sorting with distance caching
  const sortedStations = useMemo(() => {
    if (!userLocation || !filteredStations.length) {
      return filteredStations;
    }


    // Pre-calculate all distances to avoid repeated calculations during sort
    const stationsWithDistance = filteredStations.map(station => ({
      ...station,
      distance: distanceCache.getDistance(
        userLocation.latitude,
        userLocation.longitude,
        station.latitude,
        station.longitude
      )
    }));

    // Sort by pre-calculated distance
    const sorted = stationsWithDistance
      .sort((a, b) => a.distance - b.distance)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ distance: _dist, ...station }) => station); // Remove distance property


    return sorted;
  }, [filteredStations, userLocation]);

  // Calculate distance for a specific station (with caching)
  const calculateDistance = useCallback((
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    return distanceCache.getDistance(lat1, lon1, lat2, lon2);
  }, []);

  // Performance metrics
  const getPerformanceMetrics = useCallback(() => {
    return {
      totalStations: stations.length,
      filteredStations: filteredStations.length,
      sortedStations: sortedStations.length,
      distanceCache: distanceCache.getStats(),
      activeFilters: Object.entries(filters).filter(([, value]) => value !== '').length
    };
  }, [stations.length, filteredStations.length, sortedStations.length, filters]);

  // Clear caches for memory management
  const clearCaches = useCallback(() => {
    distanceCache.clear();
  }, []);

  return {
    filteredStations: sortedStations,
    calculateDistance,
    getPerformanceMetrics,
    clearCaches
  };
}

// Hook for optimized city filtering based on province
export function useOptimizedCityFilter(stations: FMStation[], selectedProvince: string | undefined, initialCities: string[]) {
  return useMemo(() => {
    if (!selectedProvince) {
      return initialCities;
    }

    const citiesInProvince = Array.from(new Set(
      stations
        .filter(station => station.state === selectedProvince)
        .map(station => station.city)
    ));

    return citiesInProvince;
  }, [stations, selectedProvince, initialCities]);
}

// Memory monitoring hook
export function useMemoryMonitor() {
  const checkMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      const used = memory.usedJSHeapSize;
      const total = memory.totalJSHeapSize;
      const limit = memory.jsHeapSizeLimit;

      const usage = {
        used: Math.round(used / 1024 / 1024),
        total: Math.round(total / 1024 / 1024),
        limit: Math.round(limit / 1024 / 1024),
        percentage: Math.round((used / total) * 100)
      };


      if (usage.percentage > 80) {
        console.warn('⚠️ High memory usage detected!');
      }

      return usage;
    }
    return null;
  }, []);

  return { checkMemoryUsage };
}