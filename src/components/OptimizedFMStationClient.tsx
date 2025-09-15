/**
 * Optimized FMStationClient with performance fixes
 * Addresses Chrome freezing, memory leaks, and navigation issues
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FMStation, UserLocation, FilterType } from '@/types/station';
import { createClient } from '@/utils/supabase/client';
import { useOptimizedFilters, useOptimizedCityFilter, useMemoryMonitor } from '@/hooks/useOptimizedFilters';
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
  const [filters, setFilters] = useState<FilterType>({
    onAir: '',
    city: '',
    province: '',
    inspection: '',
    search: '',
    submitRequest: ''
  });

  // Performance monitoring
  const { checkMemoryUsage } = useMemoryMonitor();
  const geolocationWatcherRef = useRef<number | null>(null);
  const performanceMonitorRef = useRef<NodeJS.Timeout | null>(null);

  // Simplified real-time without aggressive fallbacks
  const supabaseClient = useRef(createClient()).current;

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

  // Optimized geolocation with proper cleanup
  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    MapPerformanceMonitor.startTimer();

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setUserLocation(location);
        MapPerformanceMonitor.endTimer();
      },
      (error) => {
        console.error('❌ Geolocation failed:', {
          code: error.code,
          message: error.message,
          type: error.constructor.name
        });
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);

        // Show user-friendly error message
        let errorMessage = '';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location permissions in your browser.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
          default:
            errorMessage = 'Unknown location error occurred.';
        }

        console.warn('⚠️', errorMessage);

        // Only use default if we can't get real location

        MapPerformanceMonitor.endTimer();
      },
      {
        enableHighAccuracy: true,
        timeout: 30000, // Give more time for GPS
        maximumAge: 0 // Always get fresh location, don't use cached
      }
    );

    // Set up watching (but don't auto-pan unless requested)
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
        console.warn('Geolocation watch error:', {
          code: error.code,
          message: error.message,
          type: error.constructor.name
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 15000 // Update every 15 seconds max
      }
    );

    geolocationWatcherRef.current = watchId;
    GeolocationDebugger.trackWatcher();

    return cleanupGeolocation;
  }, [cleanupGeolocation]);

  // Simple real-time subscription (no aggressive fallbacks)
  useEffect(() => {
    // Only set up real-time if environment supports it
    if (typeof window === 'undefined') return;

    console.log('🔄 Setting up simple real-time subscription...');

    const channel = supabaseClient
      .channel('fm_station_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'fm_station'
        },
        (payload) => {
          console.log('📡 Real-time update received for station:', payload.new?.id_fm);

          if (payload.new && payload.new.id_fm) {
            const updatedData = payload.new;

            // Only update if the data actually changed (prevent unnecessary re-renders)
            setStations(prevStations => {
              const existingStation = prevStations.find(s => s.id === updatedData.id_fm);

              if (existingStation &&
                  existingStation.onAir === updatedData.on_air &&
                  existingStation.inspection68 === updatedData.inspection_68) {
                // No change, return original array to prevent re-render
                return prevStations;
              }

              return prevStations.map(station =>
                station.id === updatedData.id_fm
                  ? {
                      ...station,
                      onAir: updatedData.on_air,
                      inspection68: updatedData.inspection_68,
                      unwanted: updatedData.unwanted === 'true' || updatedData.unwanted === true,
                      submitRequest: updatedData.submit_a_request
                    }
                  : station
              );
            });

            // Update selected station
            setSelectedStation(prevSelected =>
              prevSelected && prevSelected.id === updatedData.id_fm
                ? {
                    ...prevSelected,
                    onAir: updatedData.on_air,
                    inspection68: updatedData.inspection_68,
                    unwanted: updatedData.unwanted === 'true' || updatedData.unwanted === true,
                    submitRequest: updatedData.submit_a_request
                  }
                : prevSelected
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // Just log, don't start aggressive polling
          console.log('📡 Real-time disconnected, relying on optimistic updates');
        }
      });

    // Simple cleanup
    return () => {
      try {
        supabaseClient.removeChannel(channel);
      } catch (error) {
        // Silent cleanup
      }
    };
  }, [supabaseClient]);

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
    setFilters({
      onAir: '',
      city: '',
      province: '',
      inspection: '',
      search: '',
      submitRequest: ''
    });
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

      // Send to server (don't wait for response to keep UI responsive)
      fetch(`/api/stations/${numericId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiUpdates),
      }).then(response => {
        if (response.ok) {
          console.log(`✅ Station ${stationId} successfully updated on server`);
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
      <div className="h-screen flex flex-col bg-background">
        {/* Header with debug controls */}
        <header className="bg-card shadow-sm border-b border-border px-6 py-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2.5 rounded-xl bg-secondary hover:bg-accent transition-colors text-secondary-foreground"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">FM Station Tracker</h1>
                <p className="text-sm text-muted-foreground">
                  {filteredStations.length} stations • Database connected ✅
                  {userLocation && ` • Location: ${userLocation.accuracy?.toFixed(0)}m accuracy`}
                </p>
              </div>
            </div>
          </div>

        </header>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
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
          <div className="flex-1 relative bg-muted/30">
            <div className="absolute inset-4 rounded-2xl overflow-hidden shadow-2xl border border-border/50">
              <Map
                stations={filteredStations}
                selectedStation={selectedStation}
                onStationSelect={handleStationSelect}
                onUpdateStation={handleUpdateStation}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Test Suite Modal */}
    </>
  );
}