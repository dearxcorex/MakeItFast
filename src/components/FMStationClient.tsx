'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { FMStation, UserLocation, FilterType } from '@/types/station';
import Sidebar from '@/components/Sidebar';

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

interface FMStationClientProps {
  initialStations: FMStation[];
  initialOnAirStatuses: boolean[];
  initialCities: string[];
  initialProvinces: string[];
  initialInspectionStatuses: string[];
}

export default function FMStationClient({ 
  initialStations, 
  initialOnAirStatuses, 
  initialCities, 
  initialProvinces, 
  initialInspectionStatuses 
}: FMStationClientProps) {
  const [selectedStation, setSelectedStation] = useState<FMStation | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | undefined>();
  const [stations, setStations] = useState<FMStation[]>(initialStations);
  const [filters, setFilters] = useState<FilterType>({});


  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.warn('Geolocation error:', error);
        }
      );
    }
  }, []);

  // Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Get districts filtered by selected province
  const availableCities = useMemo(() => {
    if (!filters.province) {
      return initialCities; // Show all cities if no province selected
    }
    // Filter cities to only those in the selected province
    const citiesInProvince = stations
      .filter(station => station.state === filters.province)
      .map(station => station.city);
    return Array.from(new Set(citiesInProvince));
  }, [stations, filters.province, initialCities]);

  // Auto-clear city filter when province changes and city is no longer valid
  useEffect(() => {
    if (filters.province && filters.city) {
      const isCityInProvince = stations.some(station =>
        station.state === filters.province && station.city === filters.city
      );
      if (!isCityInProvince) {
        setFilters(prevFilters => ({
          ...prevFilters,
          city: '' // Clear city filter if it doesn't exist in selected province
        }));
      }
    }
  }, [filters.province, filters.city, stations]);

  // Filter and sort stations based on current filters and user location
  const filteredStations = useMemo(() => {
    let filtered = stations;

    if (filters.onAir !== undefined) {
      filtered = filtered.filter(station => station.onAir === filters.onAir);
    }

    if (filters.city) {
      filtered = filtered.filter(station => station.city === filters.city);
      console.log('After city filter:', { city: filters.city, remaining: filtered.length });
    }

    if (filters.province) {
      filtered = filtered.filter(station => station.state === filters.province);
      console.log('After province filter:', { province: filters.province, remaining: filtered.length });
    }

    if (filters.inspection) {
      filtered = filtered.filter(station => station.inspection68 === filters.inspection);
      console.log('After inspection filter:', { inspection: filters.inspection, remaining: filtered.length });
      console.log('Sample station inspection values:', filtered.slice(0, 3).map(s => ({ name: s.name, inspection68: s.inspection68 })));
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(station =>
        station.name.toLowerCase().includes(searchLower) ||
        station.description?.toLowerCase().includes(searchLower) ||
        station.genre.toLowerCase().includes(searchLower) ||
        station.city.toLowerCase().includes(searchLower) ||
        station.state.toLowerCase().includes(searchLower)
      );
    }

    if (filters.submitRequest !== '') {
      if (filters.submitRequest === 'ไม่ยื่น') {
        filtered = filtered.filter(station => station.submitRequest === 'ไม่ยื่น');
      }
    }

    // Note: Distance filtering is handled in Sidebar component (20km limit)

    // Sort by distance if user location is available
    if (userLocation) {
      filtered = [...filtered].sort((a, b) => {
        const distanceA = calculateDistance(
          userLocation.latitude, userLocation.longitude, 
          a.latitude, a.longitude
        );
        const distanceB = calculateDistance(
          userLocation.latitude, userLocation.longitude, 
          b.latitude, b.longitude
        );
        return distanceA - distanceB;
      });
    }

    console.log('Final filtered stations:', filtered.length);
    return filtered;
  }, [stations, filters, userLocation]);

  const clearFilters = () => {
    setFilters({});
  };

  const handleStationSelect = (station: FMStation) => {
    setSelectedStation(station);
    // Close sidebar on mobile after selection
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleUpdateStation = (stationId: string | number, updates: Partial<FMStation>) => {
    setStations(prevStations => 
      prevStations.map(station => 
        station.id === stationId 
          ? { ...station, ...updates }
          : station
      )
    );
  };

  // Show message if no stations
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
                Your fm_station table is empty. Use the tools below to add sample data.
              </p>
            </div>
          </div>
        </div>
        
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border px-6 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2.5 rounded-xl bg-secondary hover:bg-accent transition-all duration-200 hover:scale-105 text-secondary-foreground"
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
          initialCities={availableCities}
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
  );
}