'use client';

import { useRef, useState, useCallback } from 'react';
import { FMStation, FilterType, UserLocation } from '@/types/station';
import { useTheme } from '@/contexts/ThemeContext';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import FilterControls from './sidebar/FilterControls';
import StationListItem from './sidebar/StationListItem';

interface SidebarProps {
  stations: FMStation[];
  allStations: FMStation[];
  onStationSelect: (station: FMStation) => void;
  selectedStation?: FMStation;
  isOpen: boolean;
  onToggle: () => void;
  userLocation?: UserLocation;
  initialCities: string[];
  initialProvinces: string[];
  initialInspectionStatuses: string[];
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  onClearFilters: () => void;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
}

export default function Sidebar({
  stations,
  allStations,
  onStationSelect,
  selectedStation,
  isOpen,
  onToggle,
  userLocation,
  initialCities,
  initialProvinces,
  initialInspectionStatuses,
  filters,
  onFiltersChange,
  onClearFilters,
  calculateDistance
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const handleStationSelect = useCallback((station: FMStation) => {
    const currentScrollTop = scrollContainerRef.current?.scrollTop || 0;
    onStationSelect(station);
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = currentScrollTop;
      }
    }, 0);
  }, [onStationSelect]);

  const { selectedIndex } = useKeyboardNavigation({
    stations,
    isOpen,
    userLocation,
    calculateDistance,
    onToggle,
    onStationSelect: handleStationSelect,
  });

  const availableCities = filters.province
    ? initialCities.filter(city => allStations.some(station => station.state === filters.province && station.city === city))
    : initialCities;

  const getFilteredStations = useCallback(() => {
    if (!userLocation) return stations;
    return stations.filter(station => {
      const distance = calculateDistance(
        userLocation.latitude, userLocation.longitude,
        station.latitude, station.longitude
      );
      return distance <= 20;
    });
  }, [stations, userLocation, calculateDistance]);

  const filteredStations = getFilteredStations();
  const nearbyCount = filteredStations.length;

  const renderStationList = (variant: 'desktop' | 'mobile') => {
    if (filteredStations.length === 0) {
      return (
        <div className="p-8 text-center">
          <div className="w-12 h-12 bg-muted/50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 0 1 7.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <h3 className="font-medium text-foreground mb-1">No stations found</h3>
          <p className="text-sm text-muted-foreground">
            {userLocation ? "No stations within 20km" : "Try adjusting filters"}
          </p>
        </div>
      );
    }

    if (variant === 'desktop') {
      return (
        <div className="p-3 space-y-2">
          {filteredStations.map((station, index) => {
            const distance = userLocation
              ? calculateDistance(userLocation.latitude, userLocation.longitude, station.latitude, station.longitude)
              : null;
            return (
              <StationListItem
                key={station.id}
                station={station}
                distance={distance}
                isSelected={selectedStation?.id === station.id}
                isKeyboardSelected={selectedIndex === index}
                onClick={() => handleStationSelect(station)}
                variant="desktop"
              />
            );
          })}
        </div>
      );
    }

    // Mobile
    return filteredStations.map((station) => {
      const distance = userLocation
        ? calculateDistance(userLocation.latitude, userLocation.longitude, station.latitude, station.longitude)
        : null;
      return (
        <StationListItem
          key={station.id}
          station={station}
          distance={distance}
          isSelected={selectedStation?.id === station.id}
          onClick={() => {
            handleStationSelect(station);
            onToggle();
          }}
          variant="mobile"
        />
      );
    });
  };

  const SidebarHeader = ({ variant }: { variant: 'desktop' | 'mobile' }) => (
    <div className={`p-4 border-b ${variant === 'desktop' ? 'border-border/30' : 'border-border'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`${variant === 'desktop' ? 'w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent' : 'w-8 h-8 bg-primary/20 rounded-lg'} flex items-center justify-center flex-shrink-0`}>
            <svg className={`${variant === 'desktop' ? 'w-5 h-5 text-primary-foreground' : 'w-4 h-4 text-primary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {variant === 'desktop' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              ) : (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L12 22M8 6L12 2L16 6M6 10L12 4L18 10M4 14L12 6L20 14" />
                  <circle cx="12" cy="18" r="2" fill="currentColor" />
                </>
              )}
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className={`flex items-baseline ${variant === 'desktop' ? 'gap-2' : 'gap-1'}`}>
              <span className={`${variant === 'desktop' ? 'text-xl font-heading' : 'text-base'} font-bold ${variant === 'desktop' ? 'text-primary' : 'text-foreground'}`}>
                {nearbyCount}
              </span>
              <span className={`text-${variant === 'desktop' ? 'sm' : 'xs'} text-muted-foreground truncate`}>
                {userLocation ? 'nearby' : 'stations'}
              </span>
            </div>
            {userLocation && (
              <div className={`text-xs text-muted-foreground/80 ${variant === 'mobile' ? 'hidden sm:block' : ''}`}>
                within 20km radius
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={toggleTheme}
            className={`${variant === 'desktop' ? 'p-2 rounded-lg hover:bg-secondary/50' : 'touch-target rounded-lg hover:bg-accent'} transition-colors text-muted-foreground hover:text-foreground`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646z" />
              </svg>
            )}
          </button>
          {variant === 'mobile' && (
            <button onClick={onToggle} className="touch-target rounded-lg hover:bg-accent transition-colors" aria-label="Close sidebar">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div className="mobile-bottom-sheet-backdrop lg:hidden" onClick={onToggle} aria-hidden="true" />
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-[25vw] lg:min-w-[320px] lg:max-w-[450px] xl:w-[22vw] xl:min-w-[360px] xl:max-w-[480px] 2xl:w-[20vw] 2xl:min-w-[400px] 2xl:max-w-[520px] lg:shadow-none lg:mr-4 lg:max-h-full lg:overflow-hidden glass-card lg:rounded-2xl transition-all duration-300 ease-out"
        role="complementary" aria-label="Station finder sidebar"
      >
        <div className="flex flex-col h-full">
          <SidebarHeader variant="desktop" />
          <FilterControls
            filters={filters}
            onFiltersChange={onFiltersChange}
            onClearFilters={onClearFilters}
            provinces={initialProvinces}
            availableCities={availableCities}
            inspectionStatuses={initialInspectionStatuses}
            variant="desktop"
          />
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-stable" role="list" aria-label={`${stations.length} FM stations found`} aria-live="polite">
            {renderStationList('desktop')}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet */}
      <div
        className={`bottom-sheet lg:hidden ${isOpen ? 'open' : ''}`}
        onTouchStart={(e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientY); }}
        onTouchMove={(e) => setTouchEnd(e.targetTouches[0].clientY)}
        onTouchEnd={() => {
          if (!touchStart || !touchEnd) return;
          if (touchStart - touchEnd < -minSwipeDistance) onToggle();
        }}
      >
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-content">
          <SidebarHeader variant="mobile" />
          <FilterControls
            filters={filters}
            onFiltersChange={onFiltersChange}
            onClearFilters={onClearFilters}
            provinces={initialProvinces}
            availableCities={availableCities}
            inspectionStatuses={initialInspectionStatuses}
            variant="mobile"
          />
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {renderStationList('mobile')}
          </div>
        </div>
      </div>
    </>
  );
}
