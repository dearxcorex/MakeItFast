/**
 * Optimized FMStationClient with performance fixes
 * Addresses Chrome freezing, memory leaks, and navigation issues
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FMStation, UserLocation, FilterType } from '@/types/station';
import { useOptimizedFilters, useOptimizedCityFilter, useMemoryMonitor } from '@/hooks/useOptimizedFilters';

// Tab type for navigation
type ActiveTab = 'stations' | 'intermod' | 'settings';
// Simple replacements for removed debug utilities
const GeolocationDebugger = {
  cleanupWatchers: () => {},
  trackWatcher: () => {}
};
const MapPerformanceMonitor = {
  startTimer: () => {},
  endTimer: () => {},
  recordMemoryUsage: () => {}
};
import NavSidebar from '@/components/NavSidebar';

// Lazy load components
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
          <svg className="w-6 h-6 text-primary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div className="text-muted-foreground font-medium">Loading map...</div>
      </div>
    </div>
  )
});

import IntermodCalculator from '@/components/IntermodCalculator';


interface OptimizedFMStationClientProps {
  initialStations: FMStation[];
  initialOnAirStatuses: boolean[];
  initialCities: string[];
  initialProvinces: string[];
  initialInspectionStatuses: string[];
}

export default function OptimizedFMStationClient({
  initialStations,
  initialOnAirStatuses,
  initialCities,
  initialProvinces,
  initialInspectionStatuses
}: OptimizedFMStationClientProps) {
  // State management
  const [selectedStation, setSelectedStation] = useState<FMStation | undefined>();
  const [userLocation, setUserLocation] = useState<UserLocation | undefined>();
  const [stations, setStations] = useState<FMStation[]>(initialStations);
  const [filters, setFilters] = useState<FilterType>({});
  const [activeTab, setActiveTab] = useState<ActiveTab>('stations');
  const [highlightedStationIds, setHighlightedStationIds] = useState<(string | number)[]>([]);
  const [flyToStations, setFlyToStations] = useState<{ lat1: number; lng1: number; lat2: number; lng2: number; timestamp: number } | null>(null);

  // Performance monitoring
  const { checkMemoryUsage } = useMemoryMonitor();
  const geolocationWatcherRef = useRef<number | null>(null);
  const performanceMonitorRef = useRef<NodeJS.Timeout | null>(null);

  // Optimized filtering
  const {
    filteredStations,
    calculateDistance,
    getPerformanceMetrics,
    clearCaches
  } = useOptimizedFilters({
    stations,
    filters,
    userLocation
  });

  // Optimized city filtering
  useOptimizedCityFilter(stations, filters.province, initialCities);

  // Cleanup function for geolocation
  const cleanupGeolocation = useCallback(() => {
    if (geolocationWatcherRef.current !== null) {
      navigator.geolocation.clearWatch(geolocationWatcherRef.current);
      GeolocationDebugger.cleanupWatchers();
      geolocationWatcherRef.current = null;
    }
  }, []);

  // Optimized geolocation with proper cleanup and fallback strategy
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    MapPerformanceMonitor.startTimer();

    // Set default location (Thailand center) as fallback
    const defaultLocation: UserLocation = {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 1000
    };

    // Success handler
    const handleSuccess = (position: GeolocationPosition) => {
      const location: UserLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      console.info('📍 Location obtained:', `${location.accuracy?.toFixed(0)}m accuracy`);
      setUserLocation(location);
      MapPerformanceMonitor.endTimer();
    };

    // Try with low accuracy first (faster, works on desktop)
    // Then try high accuracy for better precision on mobile
    const tryLowAccuracyFirst = () => {
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (error) => {
          console.info('📍 Low accuracy geolocation failed, trying high accuracy...', error.message);
          // Try high accuracy as fallback
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            (highAccError) => {
              let errorMessage = '';
              switch (highAccError.code) {
                case highAccError.PERMISSION_DENIED:
                  errorMessage = 'Location access denied - using default location';
                  break;
                case highAccError.POSITION_UNAVAILABLE:
                  errorMessage = 'Location unavailable - using default location';
                  break;
                case highAccError.TIMEOUT:
                  errorMessage = 'Location request timed out - using default location';
                  break;
                default:
                  errorMessage = 'Could not get location - using default location';
              }
              console.info('📍', errorMessage);
              setUserLocation(defaultLocation);
              MapPerformanceMonitor.endTimer();
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 60000
            }
          );
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000 // Accept cached location up to 1 minute old
        }
      );
    };

    tryLowAccuracyFirst();

    // Set up watching with lower accuracy for better compatibility
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading || null,
          speed: position.coords.speed || null
        };
        setUserLocation(location);
      },
      (error) => {
        // Only log if it's not a timeout (timeouts are common on desktop)
        if (error.code !== error.TIMEOUT) {
          console.info('📍 Geolocation watch:', error.message);
        }
      },
      {
        enableHighAccuracy: false, // Use low accuracy for better compatibility
        timeout: 30000,
        maximumAge: 30000 // Accept cached location up to 30 seconds old
      }
    );

    geolocationWatcherRef.current = watchId;
    GeolocationDebugger.trackWatcher();

    return cleanupGeolocation;
  }, [cleanupGeolocation]);

  // Performance monitoring
  useEffect(() => {

    const monitorPerformance = () => {
      checkMemoryUsage();
      MapPerformanceMonitor.recordMemoryUsage();

      const metrics = getPerformanceMetrics();
      if (metrics.filteredStations > 1000) {
        console.warn('⚠️ Large dataset detected, consider pagination');
      }
    };

    // Monitor every 30 seconds
    performanceMonitorRef.current = setInterval(monitorPerformance, 30000);

    return () => {
      if (performanceMonitorRef.current) {
        clearInterval(performanceMonitorRef.current);
        performanceMonitorRef.current = null;
      }
    };
  }, [checkMemoryUsage, getPerformanceMetrics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupGeolocation();
      clearCaches();
    };
  }, [cleanupGeolocation, clearCaches]);

  // Auto-clear city filter when province changes (optimized)
  useEffect(() => {
    if (filters.province && filters.city) {
      const isCityInProvince = stations.some(station =>
        station.state === filters.province && station.city === filters.city
      );
      if (!isCityInProvince) {
        setFilters(prevFilters => ({
          ...prevFilters,
          city: ''
        }));
      }
    }
  }, [filters.province, filters.city, stations]);

  // Optimized clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
    clearCaches(); // Clear distance cache when filters reset
  }, [clearCaches]);

  // Optimized station selection
  const handleStationSelect = useCallback((station: FMStation) => {
    setSelectedStation(station);
  }, []);

  // Highlight stations from intermod calculator results and fly to them
  const handleHighlightStations = useCallback((station1Id: string | number, station2Id: string | number) => {
    setHighlightedStationIds([station1Id, station2Id]);

    // Find the stations to get their coordinates
    const station1 = stations.find(s => s.id === station1Id);
    const station2 = stations.find(s => s.id === station2Id);

    if (station1 && station2) {
      // Set coordinates for map to fly to (timestamp ensures useEffect triggers)
      setFlyToStations({
        lat1: station1.latitude,
        lng1: station1.longitude,
        lat2: station2.latitude,
        lng2: station2.longitude,
        timestamp: Date.now()
      });
    }

    // Clear highlight and fly target after 10 seconds
    setTimeout(() => {
      setHighlightedStationIds([]);
      setFlyToStations(null);
    }, 10000);
  }, [stations]);

  // Switch to stations tab (used by intermod calculator)
  const handleSwitchToStations = useCallback(() => {
    setActiveTab('stations');
  }, []);

  // Stable optimistic updates without blinking
  const handleUpdateStation = useCallback(async (stationId: string | number, updates: Partial<FMStation>) => {
    const originalStation = stations.find(station => station.id === stationId);
    if (!originalStation) return;

    console.log(`🔄 Updating station ${stationId}:`, updates);

    try {
      const numericId = typeof stationId === 'string' ? parseInt(stationId) : stationId;

      // Immediate optimistic update for instant UI feedback
      setStations(prevStations =>
        prevStations.map(station =>
          station.id === stationId
            ? { ...station, ...updates }
            : station
        )
      );

      // Also update selected station immediately
      setSelectedStation(prevSelected =>
        prevSelected && prevSelected.id === stationId
          ? { ...prevSelected, ...updates }
          : prevSelected
      );

      // Prepare API request
      const apiUpdates: Record<string, boolean | string> = {};
      if ('onAir' in updates && updates.onAir !== undefined) {
        apiUpdates.onAir = updates.onAir;
      }
      if ('inspection68' in updates && updates.inspection68 !== undefined) {
        apiUpdates.inspection68 = updates.inspection68;
      }
      if ('inspection69' in updates && updates.inspection69 !== undefined) {
        apiUpdates.inspection69 = updates.inspection69;
      }
      if ('details' in updates && updates.details !== undefined) {
        apiUpdates.details = updates.details;
      }

      // Send to server and wait for response to get auto-generated fields like dateInspected
      fetch(`/api/stations/${numericId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiUpdates),
      }).then(async response => {
        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Station ${stationId} successfully updated on server`, result);

          // Update with server response data (includes auto-generated dateInspected)
          if (result.data) {
            const serverData = {
              onAir: result.data.on_air,
              // Convert boolean back to Thai string for UI
              inspection68: result.data.inspection_68 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
              inspection69: result.data.inspection_69 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
              dateInspected: result.data.date_inspected,
              details: result.data.details,
              submitRequest: result.data.submit_a_request ? 'ยื่น' : 'ไม่ยื่น'
            };

            // Update stations with server data
            setStations(prevStations =>
              prevStations.map(station =>
                station.id === stationId
                  ? { ...station, ...serverData }
                  : station
              )
            );

            // Update selected station with server data
            setSelectedStation(prevSelected =>
              prevSelected && prevSelected.id === stationId
                ? { ...prevSelected, ...serverData }
                : prevSelected
            );
          }
        } else {
          console.warn(`⚠️ Server update failed for station ${stationId}, but UI remains optimistic`);
        }
      }).catch(error => {
        console.warn(`⚠️ Network error for station ${stationId}:`, error);
        // Don't revert optimistic update to prevent blinking
        // Real-time will sync when connection is restored
      });

    } catch (error) {
      console.error('❌ Error in optimistic update:', error);
      // Even on error, keep optimistic update to prevent blinking
    }
  }, [stations]);


  // Performance warning for large datasets
  useEffect(() => {
    if (stations.length > 5000) {
      console.warn('⚠️ Large dataset detected. Consider implementing virtual scrolling.');
    }
  }, [stations.length]);

  // Handle empty stations
  if (stations.length === 0) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center max-w-md px-6">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.034 0-3.952.617-5.542 1.673M3 9.5v7.5A2.5 2.5 0 005.5 19H7M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">No FM Stations Found</h2>
              <p className="text-muted-foreground mb-4">
                Your fm_station table is empty. Please check your database connection.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-screen flex bg-background">
        {/* Left Navigation Sidebar - Desktop only */}
        <div className="hidden lg:block p-4 pr-0">
          <NavSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header - Slim version */}
          <header className="glass-card border-b border-border/50 px-4 lg:px-6 py-3 relative z-10 mx-4 mt-4 rounded-2xl">
            <div className="flex items-center justify-between gap-4">
              {/* Left: Title */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 lg:hidden">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-gold">
                    <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div className="hidden sm:block">
                    <h1 className="text-lg font-heading font-bold gradient-text">Task Tracker</h1>
                    <p className="text-xs text-muted-foreground">
                      {userLocation ? `Location: ±${userLocation.accuracy?.toFixed(0)}m` : 'NBTC FM Monitoring'}
                    </p>
                  </div>
                </div>

                {/* Desktop: Just show location info */}
                <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{userLocation ? `±${userLocation.accuracy?.toFixed(0)}m accuracy` : 'NBTC FM Monitoring'}</span>
                </div>
              </div>

              {/* Right: Stats */}
              <div className="hidden lg:flex items-center gap-3">
                {/* Filtered Count */}
                <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl">
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">{filteredStations.length}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Stations</div>
                  </div>
                </div>

                {/* On/Off Air */}
                <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-bold text-green-400">{filteredStations.filter(s => s.onAir).length}</span>
                  </div>
                  <div className="w-px h-4 bg-border" />
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-sm font-bold text-red-400">{filteredStations.filter(s => !s.onAir).length}</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" title="Inspected" />
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" title="Pending" />
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400" title="Off Air" />
                  </div>
                </div>
              </div>

              {/* Mobile Stats */}
              <div className="flex lg:hidden items-center gap-2">
                <span className="text-xs font-bold text-primary">{filteredStations.length}</span>
                <div className="w-px h-3 bg-border" />
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span className="text-xs text-green-400">{filteredStations.filter(s => s.onAir).length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  <span className="text-xs text-red-400">{filteredStations.filter(s => !s.onAir).length}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Main content */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto p-4 pt-2 gap-4">
            {activeTab === 'stations' ? (
              /* Map with Filter Bar */
              <div className="flex-1 flex flex-col gap-2">
                {/* Filter Bar */}
                <div className="glass-card rounded-xl p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[180px]">
                      <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search stations..."
                        value={filters.search || ''}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
                        className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                      {filters.search && (
                        <button
                          onClick={() => setFilters({ ...filters, search: undefined })}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Province Select */}
                    <select
                      value={filters.province || ''}
                      onChange={(e) => setFilters({ ...filters, province: e.target.value || undefined, city: undefined })}
                      className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent min-w-[140px]"
                    >
                      <option value="">All Provinces</option>
                      {initialProvinces.map(province => (
                        <option key={province} value={province}>{province}</option>
                      ))}
                    </select>

                    {/* City Select */}
                    <select
                      value={filters.city || ''}
                      onChange={(e) => setFilters({ ...filters, city: e.target.value || undefined })}
                      className={`px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent min-w-[140px] ${!filters.province ? 'opacity-50' : ''}`}
                      disabled={!filters.province}
                    >
                      <option value="">{filters.province ? 'All Cities' : 'Select province'}</option>
                      {filters.province && initialCities
                        .filter(city => stations.some(s => s.state === filters.province && s.city === city))
                        .map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))
                      }
                    </select>

                    {/* On Air Toggle */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => setFilters({ ...filters, onAir: filters.onAir === true ? undefined : true })}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                          filters.onAir === true
                            ? 'bg-green-500 text-white border-green-500'
                            : 'bg-background border-border hover:border-green-500/50'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${filters.onAir === true ? 'bg-white' : 'bg-green-500'}`} />
                        On Air
                      </button>
                      <button
                        onClick={() => setFilters({ ...filters, onAir: filters.onAir === false ? undefined : false })}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                          filters.onAir === false
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-background border-border hover:border-red-500/50'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${filters.onAir === false ? 'bg-white' : 'bg-red-500'}`} />
                        Off Air
                      </button>
                    </div>

                    {/* Inspection Status */}
                    <select
                      value={filters.inspection68 || ''}
                      onChange={(e) => setFilters({ ...filters, inspection68: e.target.value || undefined })}
                      className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent min-w-[140px]"
                    >
                      <option value="">All Inspection</option>
                      {initialInspectionStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>

                    {/* Clear Filters */}
                    {(filters.search || filters.province || filters.city || filters.onAir !== undefined || filters.inspection68) && (
                      <button
                        onClick={clearFilters}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg border border-destructive/20 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Map container */}
                <div className="flex-1 relative min-h-[400px]">
                  <div className="absolute inset-0 rounded-2xl overflow-hidden glass-card">
                    <Map
                      stations={filteredStations}
                      selectedStation={selectedStation}
                      onStationSelect={handleStationSelect}
                      onUpdateStation={handleUpdateStation}
                      highlightedStationIds={highlightedStationIds}
                      flyToStations={flyToStations}
                    />
                  </div>
                </div>
              </div>
            ) : activeTab === 'intermod' ? (
              /* Intermodulation Calculator */
              <IntermodCalculator
                stations={stations}
                onHighlightStations={handleHighlightStations}
                onSwitchToStations={handleSwitchToStations}
              />
            ) : (
              /* Settings Page - Placeholder */
              <div className="flex-1 glass-card p-6 rounded-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-muted to-secondary flex items-center justify-center">
                    <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-heading font-bold text-foreground">Settings</h2>
                    <p className="text-xs text-muted-foreground">Configure application preferences</p>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <div className="w-20 h-20 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h4>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Settings page is under development. Configure theme, notifications,
                    and other preferences here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden mobile-bottom-nav">
        <div className="flex items-center justify-around py-2">
          <button
            onClick={() => setActiveTab('stations')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
              activeTab === 'stations'
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
            <span className="text-xs font-medium">Stations</span>
          </button>
          <button
            onClick={() => setActiveTab('intermod')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
              activeTab === 'intermod'
                ? 'text-accent'
                : 'text-muted-foreground'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium">Intermod</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
              activeTab === 'settings'
                ? 'text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs font-medium">Settings</span>
          </button>
        </div>
      </div>
    </>
  );
}