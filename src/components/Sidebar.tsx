'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { FMStation, FilterType, UserLocation } from '@/types/station';
import { useTheme } from '@/contexts/ThemeContext';

interface SidebarProps {
  stations: FMStation[]; // Now receives filtered stations
  allStations: FMStation[]; // All stations for district filtering
  onStationSelect: (station: FMStation) => void;
  selectedStation?: FMStation;
  isOpen: boolean;
  onToggle: () => void;
  userLocation?: UserLocation;
  initialOnAirStatuses: boolean[];
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

  // Swipe gesture state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Keyboard navigation state
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Minimum swipe distance (pixels)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isDownSwipe = distance < -minSwipeDistance;

    if (isDownSwipe) {
      onToggle(); // Close the bottom sheet
    }
  };

  // Handle station selection with scroll position preservation
  const handleStationSelect = useCallback((station: FMStation) => {
    // Preserve scroll position
    const currentScrollTop = scrollContainerRef.current?.scrollTop || 0;

    // Call the original handler
    onStationSelect(station);

    // Restore scroll position after React updates
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = currentScrollTop;
      }
    }, 0);
  }, [onStationSelect]);

  // Keyboard navigation handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Filter stations for keyboard navigation
      const filteredStations = userLocation
        ? stations.filter(station => {
            const distance = calculateDistance(
              userLocation.latitude, userLocation.longitude,
              station.latitude, station.longitude
            );
            return distance <= 20;
          })
        : stations;

      switch (e.key) {
        case 'Escape':
          if (isOpen) {
            onToggle();
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (filteredStations.length > 0) {
            setSelectedIndex(prev =>
              prev < filteredStations.length - 1 ? prev + 1 : 0
            );
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (filteredStations.length > 0) {
            setSelectedIndex(prev =>
              prev > 0 ? prev - 1 : filteredStations.length - 1
            );
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < filteredStations.length) {
            handleStationSelect(filteredStations[selectedIndex]);
          }
          break;

        case '/':
          e.preventDefault();
          // Focus search input
          const searchInput = document.getElementById('search-filter');
          if (searchInput) {
            searchInput.focus();
          }
          break;
      }
    };

    // Only add event listener when sidebar is open or on desktop
    if (isOpen || window.innerWidth >= 1024) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, selectedIndex, stations, userLocation, calculateDistance, onToggle, handleStationSelect]);

  // Filter data arrays from server-side props
  const cities = initialCities;
  const provinces = initialProvinces;
  const inspectionStatuses = initialInspectionStatuses;

  // Filter cities based on selected province using ALL stations (not filtered ones)
  const availableCities = filters.province
    ? cities.filter(city =>
        allStations.some(station =>
          station.state === filters.province && station.city === city
        )
      )
    : cities;

  return (
    <>
      {/* Mobile Bottom Sheet Backdrop */}
      {isOpen && (
        <div
          className="mobile-bottom-sheet-backdrop lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Desktop Sidebar */}
      <div className={`
        hidden lg:flex lg:flex-col
        lg:w-[25vw] lg:min-w-[320px] lg:max-w-[450px]
        xl:w-[22vw] xl:min-w-[360px] xl:max-w-[480px]
        2xl:w-[20vw] 2xl:min-w-[400px] 2xl:max-w-[520px]
        lg:shadow-none lg:border-r lg:border-border
        lg:max-h-screen lg:overflow-hidden lg:bg-background
        transition-all duration-300 ease-out
      `}
      role="complementary"
      aria-label="Station finder sidebar"
      >
        {/* Desktop content will be rendered here */}
        <div className="flex flex-col h-full">

        {/* Desktop Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Antenna/Radio Tower Icon */}
              <div className="w-9 h-9 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L12 22M8 6L12 2L16 6M6 10L12 4L18 10M4 14L12 6L20 14" />
                  <circle cx="12" cy="18" r="2" fill="currentColor" />
                </svg>
              </div>

              {/* Station Count */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-foreground">
                    {userLocation
                      ? stations.filter(station => {
                          const distance = calculateDistance(
                            userLocation.latitude, userLocation.longitude,
                            station.latitude, station.longitude
                          );
                          return distance <= 20;
                        }).length
                      : stations.length}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {userLocation ? 'nearby stations' : 'stations'}
                  </span>
                </div>
                {userLocation && (
                  <div className="text-xs text-muted-foreground/80">
                    within 20km radius
                  </div>
                )}
              </div>

              {/* Inspection Statistics */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/20 p-2 rounded-lg border border-border/30">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>
                    {stations.filter(station => station.inspection68 === 'ตรวจแล้ว' && station.submitRequest !== 'ไม่ยื่น').length} inspected
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>
                    {stations.filter(station => station.inspection68 === 'ยังไม่ตรวจ' && station.submitRequest !== 'ไม่ยื่น').length} pending
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop Action Buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={toggleTheme}
                className="touch-target rounded-lg hover:bg-accent transition-colors"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
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
            </div>
          </div>
        </div>

        {/* Desktop Filters Section */}
        <div className="p-4 border-b border-border bg-muted/10" role="search" aria-label="Station filters">
          <div className="space-y-4">
            {/* Search Bar */}
            <fieldset className="space-y-3">
              <legend className="section-title">Search</legend>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  id="search-filter"
                  type="text"
                  placeholder="Search by name, frequency, city, province..."
                  value={filters.search || ''}
                  onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
                  className="w-full pl-10 pr-10 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                  aria-label="Search stations by name, frequency, city, or province"
                />
                {filters.search && (
                  <button
                    onClick={() => onFiltersChange({ ...filters, search: undefined })}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </fieldset>

            {/* Location Filters */}
            <fieldset className="space-y-3">
              <legend className="section-title">Location</legend>
              <div className="space-y-2">
                <div>
                  <select
                    id="province-filter"
                    value={filters.province || ''}
                    onChange={(e) => onFiltersChange({ ...filters, province: e.target.value === '' ? undefined : e.target.value, city: undefined })}
                    className="w-full p-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                    aria-label="Filter by province"
                  >
                    <option value="">All Provinces</option>
                    {provinces.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    id="city-filter"
                    value={filters.city || ''}
                    onChange={(e) => onFiltersChange({ ...filters, city: e.target.value === '' ? undefined : e.target.value })}
                    className="w-full p-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={!filters.province}
                    aria-label="Filter by city"
                    aria-describedby={!filters.province ? "city-help" : undefined}
                  >
                    <option value="">All Cities</option>
                    {availableCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              </div>
              {!filters.province && (
                <div id="city-help" className="text-xs text-muted-foreground">
                  Select a province first to filter by city
                </div>
              )}
            </fieldset>

            {/* Status Filters */}
            <fieldset className="space-y-3">
              <legend className="section-title">Status</legend>
              <div className="space-y-2">
                <div>
                  <select
                    id="status-filter"
                    value={filters.onAir === undefined ? '' : filters.onAir.toString()}
                    onChange={(e) => onFiltersChange({ ...filters, onAir: e.target.value === '' ? undefined : e.target.value === 'true' })}
                    className="w-full p-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                    aria-label="Filter by broadcast status"
                  >
                    <option value="">All Status</option>
                    <option value="true">On Air</option>
                    <option value="false">Off Air</option>
                  </select>
                </div>
                <div>
                  <select
                    value={filters.inspection68 || ''}
                    onChange={(e) => onFiltersChange({ ...filters, inspection68: e.target.value === '' ? undefined : e.target.value })}
                    className="w-full p-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">All Inspections</option>
                    {inspectionStatuses.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Clear Filters Button */}
            {(filters.search || filters.province || filters.city || filters.onAir !== undefined || filters.inspection68) && (
              <div className="pt-2">
                <button
                  onClick={onClearFilters}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Station List */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto scrollbar-stable"
          role="list"
          aria-label={`${stations.length} FM stations found`}
          aria-live="polite"
        >
          {(() => {
            // Filter stations within 20km if user location is available
            const filteredStations = userLocation
              ? stations.filter(station => {
                  const distance = calculateDistance(
                    userLocation.latitude, userLocation.longitude,
                    station.latitude, station.longitude
                  );
                  return distance <= 20;
                })
              : stations;

            return filteredStations.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 bg-muted/50 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 0 1 7.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                </div>
                <h3 className="font-medium text-foreground mb-1">No stations found</h3>
                <p className="text-sm text-muted-foreground">
                  {userLocation
                    ? "No stations within 20km"
                    : "Try adjusting filters"}
                </p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {filteredStations.map((station, index) => {
                const distance = userLocation
                  ? calculateDistance(
                      userLocation.latitude, userLocation.longitude,
                      station.latitude, station.longitude
                    )
                  : null;

                const isSelected = selectedStation?.id === station.id;
                const isKeyboardSelected = selectedIndex === index;

                return (
                  <div
                    key={station.id}
                    onClick={() => handleStationSelect(station)}
                    className={`
                      station-card cursor-pointer
                      ${isSelected ? 'selected' : ''}
                      ${isKeyboardSelected ? 'keyboard-selected' : ''}
                    `}
                    role="listitem"
                    tabIndex={0}
                    aria-label={`${station.name}, ${station.frequency} FM, ${station.onAir ? 'On Air' : 'Off Air'}, ${station.city}, ${distance ? `${distance.toFixed(1)} km away` : ''}`}
                    aria-current={isSelected ? 'true' : undefined}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleStationSelect(station);
                      }
                    }}
                  >
                    {/* Station Info */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-base leading-tight mb-2 line-clamp-2">{station.name}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-medium">
                            {station.frequency} FM
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${station.onAir ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${station.onAir ? 'bg-green-500' : 'bg-red-500'}`} />
                            {station.onAir ? 'On' : 'Off'}
                          </span>
                        </div>
                      </div>

                      {selectedStation?.id === station.id && (
                        <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                      )}
                    </div>

                    {/* Location & Distance */}
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-muted-foreground truncate">{station.city}, {station.state}</span>
                      {distance && (
                        <span className="text-primary font-medium">{distance.toFixed(1)} km</span>
                      )}
                    </div>

                    {/* Inspection Date Only */}
                    {station.dateInspected && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded-md border border-border/30 mb-2">
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Inspected: {(() => {
                          try {
                            const date = new Date(station.dateInspected);
                            return date.toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            });
                          } catch {
                            return station.dateInspected;
                          }
                        })()}</span>
                      </div>
                    )}

                    {/* Station Type */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{station.type}</span>
                      {distance && distance <= 20 && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Navigate
                        </a>
                      )}
                    </div>
                  </div>
                );
                })}
              </div>
            );
          })()}
        </div>

        </div>
      </div>

      {/* Mobile Bottom Sheet */}
      <div
        className={`bottom-sheet lg:hidden ${isOpen ? 'open' : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Drag Handle */}
        <div className="bottom-sheet-handle" />

        {/* Bottom Sheet Content */}
        <div className="bottom-sheet-content">
          {/* Mobile Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Antenna Icon */}
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L12 22M8 6L12 2L16 6M6 10L12 4L18 10M4 14L12 6L20 14" />
                    <circle cx="12" cy="18" r="2" fill="currentColor" />
                  </svg>
                </div>

                {/* Station Count */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-bold text-foreground">
                      {userLocation
                        ? stations.filter(station => {
                            const distance = calculateDistance(
                              userLocation.latitude, userLocation.longitude,
                              station.latitude, station.longitude
                            );
                            return distance <= 20;
                          }).length
                        : stations.length}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {userLocation ? 'nearby' : 'stations'}
                    </span>
                  </div>
                  {userLocation && (
                  <div className="text-xs text-muted-foreground/80 hidden sm:block">
                    within 20km radius
                  </div>
                )}
              </div>

              {/* Mobile Inspection Statistics */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 p-1.5 rounded-lg border border-border/30">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span>
                    {stations.filter(station => station.inspection68 === 'ตรวจแล้ว' && station.submitRequest !== 'ไม่ยื่น').length} inspected
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                  <span>
                    {stations.filter(station => station.inspection68 === 'ยังไม่ตรวจ' && station.submitRequest !== 'ไม่ยื่น').length} pending
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile Action Buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={toggleTheme}
                className="touch-target rounded-lg hover:bg-accent transition-colors"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
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

              <button
                onClick={onToggle}
                className="touch-target rounded-lg hover:bg-accent transition-colors"
                aria-label="Close sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Filters */}
        <div className="p-4 border-b border-border bg-muted/10">
          <div className="space-y-3">
            {/* Mobile Search Bar */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="🔍 Search stations..."
                value={filters.search || ''}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
                className="w-full pl-10 pr-10 touch-target text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                aria-label="Search stations"
              />
              {filters.search && (
                <button
                  onClick={() => onFiltersChange({ ...filters, search: undefined })}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors touch-target"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Quick Status Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => onFiltersChange({ ...filters, onAir: filters.onAir === true ? undefined : true })}
                className={`flex-1 touch-target text-sm rounded-lg border transition-colors ${
                  filters.onAir === true
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-background border-border hover:border-green-500'
                }`}
              >
                📡 On Air
              </button>
              <button
                onClick={() => onFiltersChange({ ...filters, onAir: filters.onAir === false ? undefined : false })}
                className={`flex-1 touch-target text-sm rounded-lg border transition-colors ${
                  filters.onAir === false
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-background border-border hover:border-red-500'
                }`}
              >
                📵 Off Air
              </button>
            </div>

            {/* Province Filter */}
            <select
              value={filters.province || ''}
              onChange={(e) => onFiltersChange({ ...filters, province: e.target.value || undefined, city: undefined })}
              className="w-full touch-target text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">🏛️ All Provinces</option>
              {provinces.map(province => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>

            {/* City Filter */}
            {filters.province && (
              <select
                value={filters.city || ''}
                onChange={(e) => onFiltersChange({ ...filters, city: e.target.value || undefined })}
                className="w-full touch-target text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">🏙️ All Cities in {filters.province}</option>
                {availableCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            )}

            {/* Clear Filters */}
            {(filters.search || filters.province || filters.city || filters.onAir !== undefined) && (
              <button
                onClick={onClearFilters}
                className="w-full touch-target flex items-center justify-center gap-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Mobile Station List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {(() => {
            // Filter stations within 20km if user location is available
            const filteredStations = userLocation
              ? stations.filter(station => {
                  const distance = calculateDistance(
                    userLocation.latitude, userLocation.longitude,
                    station.latitude, station.longitude
                  );
                  return distance <= 20;
                })
              : stations;

            return filteredStations.length === 0 ? (
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
            ) : (
              filteredStations.map((station) => {
                const distance = userLocation
                  ? calculateDistance(
                      userLocation.latitude, userLocation.longitude,
                      station.latitude, station.longitude
                    )
                  : null;

                return (
                  <div
                    key={station.id}
                    onClick={() => {
                      handleStationSelect(station);
                      onToggle(); // Close bottom sheet after selection
                    }}
                    className={`
                      relative p-3 rounded-lg cursor-pointer transition-all duration-200 border
                      ${selectedStation?.id === station.id
                        ? 'bg-primary/10 border-primary shadow-sm'
                        : 'bg-card border-border hover:border-primary/50 hover:shadow-sm'
                      }
                    `}
                    role="button"
                    tabIndex={0}
                  >
                    {/* Station Info */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-card-foreground text-sm line-clamp-2">{station.name}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-medium">
                            {station.frequency} FM
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${station.onAir ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${station.onAir ? 'bg-green-500' : 'bg-red-500'}`} />
                            {station.onAir ? 'On' : 'Off'}
                          </span>
                        </div>
                      </div>

                      {selectedStation?.id === station.id && (
                        <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                      )}
                    </div>

                    {/* Location & Distance */}
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-muted-foreground truncate">{station.city}, {station.state}</span>
                      {distance && (
                        <span className="text-primary font-medium">{distance.toFixed(1)} km</span>
                      )}
                    </div>

                    {/* Navigation Button */}
                    {distance && distance <= 20 && (
                      <div className="flex justify-end">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="touch-target inline-flex items-center gap-1 px-3 py-1 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Navigate
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            );
          })()}
        </div>

        </div>
      </div>
    </>
  );
}
