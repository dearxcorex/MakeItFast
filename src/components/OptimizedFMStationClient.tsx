/**
 * Optimized FMStationClient with performance fixes
 * Addresses Chrome freezing, memory leaks, and navigation issues
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FMStation, UserLocation, FilterType } from '@/types/station';
import { useOptimizedFilters, useMemoryMonitor } from '@/hooks/useOptimizedFilters';
import NavSidebar from '@/components/NavSidebar';
import AppHeader from '@/components/client/AppHeader';
import MobileFilterBar from '@/components/client/MobileFilterBar';

import type { InterferenceStats } from '@/components/interference/InterferenceAnalysis';

type ActiveTab = 'stations' | 'intermod' | 'interference' | 'analytics';

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

const AnalyticsDashboard = dynamic(() => import('@/components/analytics/AnalyticsDashboard'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
      <div className="text-muted-foreground font-medium">Loading analytics...</div>
    </div>
  ),
});

const InterferenceAnalysis = dynamic(() => import('@/components/interference/InterferenceAnalysis'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
      <div className="text-muted-foreground font-medium">Loading interference analysis...</div>
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
  initialCities,
  initialProvinces,
  initialInspectionStatuses
}: OptimizedFMStationClientProps) {
  // State management
  const [selectedStation, setSelectedStation] = useState<FMStation | undefined>();
  const [userLocation, setUserLocation] = useState<UserLocation | undefined>();
  const [stations, setStations] = useState<FMStation[]>(initialStations);
  const stationsRef = useRef(stations);
  stationsRef.current = stations;
  const [filters, setFilters] = useState<FilterType>({});
  const [activeTab, setActiveTabRaw] = useState<ActiveTab>('stations');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const setActiveTab = useCallback((tab: ActiveTab) => {
    setActiveTabRaw(tab);
    setMobileNavOpen(false);
  }, []);
  const [highlightedStationIds, setHighlightedStationIds] = useState<(string | number)[]>([]);
  const [flyToStations, setFlyToStations] = useState<{ lat1: number; lng1: number; lat2: number; lng2: number; timestamp: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [interferenceStats, setInterferenceStats] = useState<InterferenceStats | null>(null);

  // Performance monitoring
  const { checkMemoryUsage } = useMemoryMonitor();
  const geolocationWatcherRef = useRef<number | null>(null);
  const performanceMonitorRef = useRef<NodeJS.Timeout | null>(null);

  // Optimized filtering
  const {
    filteredStations,
    clearCaches
  } = useOptimizedFilters({
    stations,
    filters,
    userLocation
  });

  // Cleanup function for geolocation
  const cleanupGeolocation = useCallback(() => {
    if (geolocationWatcherRef.current !== null) {
      navigator.geolocation.clearWatch(geolocationWatcherRef.current);
      geolocationWatcherRef.current = null;
    }
  }, []);

  // Optimized geolocation with proper cleanup and fallback strategy
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

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

    return cleanupGeolocation;
  }, [cleanupGeolocation]);

  // Performance monitoring
  useEffect(() => {
    const monitorPerformance = () => {
      checkMemoryUsage();
    };

    performanceMonitorRef.current = setInterval(monitorPerformance, 30000);

    return () => {
      if (performanceMonitorRef.current) {
        clearInterval(performanceMonitorRef.current);
        performanceMonitorRef.current = null;
      }
    };
  }, [checkMemoryUsage]);

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
  }, [setActiveTab]);

  // Stable optimistic updates without blinking
  // Uses stationsRef to avoid stale closures - Leaflet popups hold callback references
  // that don't update when stations changes, so we read from the ref instead.
  const handleUpdateStation = useCallback(async (stationId: string | number, updates: Partial<FMStation>) => {
    const originalStation = stationsRef.current.find(station => station.id === stationId);
    if (!originalStation) {
      console.error(`Station ${stationId} not found in ${stationsRef.current.length} stations`);
      return;
    }

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

      // Send to server and await response to get auto-generated fields like dateInspected
      const response = await fetch(`/api/stations/${numericId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiUpdates),
      });

      if (response.ok) {
        const result = await response.json();

        // Update with server response data (includes auto-generated dateInspected)
        if (result.data) {
          const serverData = {
            onAir: result.data.on_air,
            // Convert boolean back to Thai string for UI
            inspection68: result.data.inspection_68 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
            inspection69: result.data.inspection_69 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
            dateInspected: result.data.date_inspected,
            details: result.data.note,
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
        console.warn(`Server update failed for station ${stationId}: ${response.status}`);
      }
    } catch (error) {
      console.warn(`Network error for station ${stationId}:`, error);
      // Don't revert optimistic update to prevent blinking
    }
  }, []);

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
          {/* Header */}
          <AppHeader
            filteredStations={filteredStations}
            userLocation={userLocation}
            activeTab={activeTab}
            onMenuClick={() => setMobileNavOpen(true)}
          />

          {/* Main content */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto p-4 pt-2 gap-4">
            {activeTab === 'stations' ? (
              /* Map with Filter Bar */
              <div className="flex-1 flex flex-col gap-2">
                {/* Filter Bar */}
                <MobileFilterBar
                  filters={filters}
                  setFilters={setFilters}
                  showFilters={showFilters}
                  setShowFilters={setShowFilters}
                  clearFilters={clearFilters}
                  initialProvinces={initialProvinces}
                  initialCities={initialCities}
                  initialInspectionStatuses={initialInspectionStatuses}
                  stations={stations}
                />

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
            ) : activeTab === 'interference' ? (
              /* Interference Analysis */
              <InterferenceAnalysis userLocation={userLocation} onStatsChange={setInterferenceStats} />
            ) : (
              /* Analytics Dashboard */
              <AnalyticsDashboard />
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <div
        data-testid="mobile-nav-backdrop"
        className={`lg:hidden nav-drawer-backdrop ${mobileNavOpen ? 'open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden={!mobileNavOpen}
      />
      <div
        data-testid="mobile-nav-drawer"
        className={`lg:hidden nav-drawer-panel ${mobileNavOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <NavSidebar activeTab={activeTab} onTabChange={setActiveTab} variant="mobile-drawer" />
      </div>
    </>
  );
}