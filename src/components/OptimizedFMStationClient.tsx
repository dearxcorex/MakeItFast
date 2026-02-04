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
import Sidebar from '@/components/Sidebar';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | undefined>();
  const [stations, setStations] = useState<FMStation[]>(initialStations);
  const [filters, setFilters] = useState<FilterType>({});
  const [activeTab, setActiveTab] = useState<ActiveTab>('stations');

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
    // Close sidebar on mobile after selection
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
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
              dateInspected: result.data.date_inspected,
              details: result.data.details,
              unwanted: result.data.unwanted === 'true' || result.data.unwanted === true,
              submitRequest: result.data.submit_a_request
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
              {/* Left: Menu (mobile) + Title */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2.5 rounded-xl bg-secondary hover:bg-accent transition-colors text-secondary-foreground cursor-pointer"
                  aria-label="Toggle sidebar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

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
          <div className="flex-1 flex overflow-hidden p-4 pt-2">
            {activeTab === 'stations' ? (
              <>
                {/* Sidebar */}
                <Sidebar
                  stations={filteredStations}
                  allStations={stations}
                  onStationSelect={handleStationSelect}
                  selectedStation={selectedStation}
                  isOpen={sidebarOpen}
                  onToggle={() => setSidebarOpen(!sidebarOpen)}
                  userLocation={userLocation}
                  initialOnAirStatuses={initialOnAirStatuses}
                  initialCities={initialCities}
                  initialProvinces={initialProvinces}
                  initialInspectionStatuses={initialInspectionStatuses}
                  filters={filters}
                  onFiltersChange={setFilters}
                  onClearFilters={clearFilters}
                  calculateDistance={calculateDistance}
                />

                {/* Map container */}
                <div className="flex-1 relative">
                  <div className="absolute inset-0 rounded-2xl overflow-hidden glass-card">
                    <Map
                      stations={filteredStations}
                      selectedStation={selectedStation}
                      onStationSelect={handleStationSelect}
                      onUpdateStation={handleUpdateStation}
                    />
                  </div>
                </div>
              </>
            ) : activeTab === 'intermod' ? (
              /* Intermodulation Calculator */
              <div className="flex-1 flex flex-col lg:flex-row gap-4">
                {/* Calculator Input Panel */}
                <div className="lg:w-[400px] glass-card p-6 rounded-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center glow-purple">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-heading font-bold text-foreground">Intermodulation Calculator</h2>
                      <p className="text-xs text-muted-foreground">Calculate IM products for FM frequencies</p>
                    </div>
                  </div>

                  {/* Frequency Inputs */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Frequency 1 (MHz)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g., 88.0"
                        className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Frequency 2 (MHz)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g., 92.5"
                        className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Frequency 3 (MHz) <span className="text-muted-foreground">(Optional)</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g., 97.0"
                        className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      />
                    </div>

                    <div className="pt-2">
                      <button className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:opacity-90 transition-all glow-gold">
                        Calculate Intermodulation
                      </button>
                    </div>

                    <div className="pt-2">
                      <button className="w-full py-2 px-4 rounded-xl bg-secondary/50 text-muted-foreground font-medium hover:text-foreground hover:bg-secondary transition-all">
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className="mt-6 p-4 rounded-xl bg-accent/10 border border-accent/20">
                    <h4 className="text-sm font-semibold text-accent mb-2">About Intermodulation</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Intermodulation occurs when two or more signals mix in a non-linear device,
                      creating unwanted frequencies. Common IM products are 2f1-f2, 2f2-f1, and
                      third-order products.
                    </p>
                  </div>
                </div>

                {/* Results Panel */}
                <div className="flex-1 glass-card p-6 rounded-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-heading font-bold text-foreground">Results</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Ready to calculate
                    </div>
                  </div>

                  {/* Empty State */}
                  <div className="flex flex-col items-center justify-center h-[400px] text-center">
                    <div className="w-20 h-20 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
                      <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-foreground mb-2">No Results Yet</h4>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Enter at least two frequencies and click &quot;Calculate&quot; to see
                      intermodulation products and potential interference frequencies.
                    </p>
                  </div>
                </div>
              </div>
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