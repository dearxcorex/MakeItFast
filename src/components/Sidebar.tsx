'use client';

import { useRef } from 'react';
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

  // Handle station selection with scroll position preservation
  const handleStationSelect = (station: FMStation) => {
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
  };

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
      {/* Mobile Modal Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[998] lg:hidden transition-all duration-300 flex items-center justify-center p-4"
          onClick={onToggle}
          aria-hidden="true"
        >
          {/* Prevent clicks on modal content from closing */}
          <div onClick={(e) => e.stopPropagation()}>
            {/* Modal content will be rendered here by the sidebar container */}
          </div>
        </div>
      )}

      {/* Sidebar Container - Mobile Modal or Desktop Sidebar */}
      <div className={`
        ${isOpen
          ? 'fixed inset-0 z-[999] flex items-center justify-center p-4 lg:static lg:inset-auto lg:p-0 lg:block'
          : 'fixed inset-y-0 left-0 -translate-x-full lg:static lg:translate-x-0'
        }
        lg:w-80 xl:w-88
        transform transition-all duration-300 ease-in-out
        lg:flex lg:flex-col lg:shadow-none lg:border-r lg:border-border
        lg:max-h-screen lg:overflow-hidden lg:bg-background
      `}
      role="complementary"
      aria-label="Station filters and list"
      onClick={(e) => {
        // Prevent closing when clicking on modal content on mobile
        if (isOpen && window.innerWidth < 1024) {
          e.stopPropagation();
        }
      }}>

        {/* Actual Modal Content - Centered on Mobile */}
        <div className={`
          ${isOpen
            ? 'w-full max-w-sm mx-auto lg:max-w-none lg:mx-0 lg:w-full'
            : 'w-full'
          }
          flex flex-col shadow-2xl lg:shadow-none border border-border lg:border-none lg:border-r
          max-h-[85vh] lg:max-h-screen overflow-hidden bg-background
          rounded-2xl lg:rounded-none
          sidebar-modal
        `}>

        {/* Mobile-Optimized Header */}
        <div className="p-3 sm:p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* Antenna/Radio Tower Icon */}
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L12 22M8 6L12 2L16 6M6 10L12 4L18 10M4 14L12 6L20 14" />
                  <circle cx="12" cy="18" r="2" fill="currentColor" />
                </svg>
              </div>

              {/* Station Count with Mobile-Friendly Text */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1 sm:gap-2">
                  <span className="text-base sm:text-lg font-bold text-foreground">
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
                  <span className="text-xs sm:text-sm text-muted-foreground truncate">
                    {userLocation ? 'nearby' : 'stations'}
                  </span>
                </div>
                {userLocation && (
                  <div className="text-xs text-muted-foreground/80 hidden sm:block">
                    within 20km radius
                  </div>
                )}
              </div>
            </div>

            {/* Mobile-Optimized Action Buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={toggleTheme}
                className="p-2 sm:p-2.5 rounded-lg hover:bg-accent transition-colors min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 718.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              <button
                onClick={onToggle}
                className="lg:hidden p-2 sm:p-2.5 rounded-lg hover:bg-accent transition-colors min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center"
                aria-label="Close sidebar"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile-Optimized Filters Section */}
        <div className="p-3 sm:p-4 border-b border-border bg-muted/10">
          <div className="space-y-4">
            {/* Location Filters - Province First */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</label>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Province</label>
                  <select
                    value={filters.province}
                    onChange={(e) => {
                      const newProvince = e.target.value;
                      onFiltersChange({
                        ...filters,
                        province: newProvince,
                        city: '' // Clear city when province changes
                      });
                    }}
                    className="w-full px-4 py-3 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm shadow-sm"
                  >
                    <option value="">🏛️ Choose Province First</option>
                    {provinces.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">District</label>
                  <select
                    value={filters.city}
                    onChange={(e) => onFiltersChange({ ...filters, city: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!filters.province}
                  >
                    {!filters.province ? (
                      <option value="">🏙️ Select Province First</option>
                    ) : (
                      <>
                        <option value="">🏙️ All Districts</option>
                        {availableCities.map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* Status Filters */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Station Status</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Broadcast Status</label>
                  <select
                    value={filters.onAir}
                    onChange={(e) => onFiltersChange({ ...filters, onAir: e.target.value })}
                    className="w-full px-3 py-2.5 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm shadow-sm"
                  >
                    <option value="">📡 All Status</option>
                    <option value="true">🟢 On Air</option>
                    <option value="false">🔴 Off Air</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Inspection Status</label>
                  <select
                    value={filters.inspection}
                    onChange={(e) => onFiltersChange({ ...filters, inspection: e.target.value })}
                    className="w-full px-3 py-2.5 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm shadow-sm"
                  >
                    <option value="">🔍 All</option>
                    {inspectionStatuses.map(status => (
                      <option key={status} value={status}>
                        {status === 'ตรวจแล้ว' && '✅ '}
                        {status === 'ยังไม่ตรวจ' && '⏳ '}
                        {status === 'ตรงตามมาตรฐาน' && '🎯 '}
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Request Status */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Request Status</label>
                <select
                  value={filters.submitRequest}
                  onChange={(e) => onFiltersChange({ ...filters, submitRequest: e.target.value })}
                  className="w-full px-3 py-2.5 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm shadow-sm"
                >
                  <option value="">📋 All Request Status</option>
                  <option value="ไม่ยื่น">❌ ไม่ยื่น</option>
                </select>
              </div>
            </div>

            {/* Clear Filters */}
            {Object.values(filters).filter(Boolean).length > 0 && (
              <div className="pt-2">
                <button
                  onClick={onClearFilters}
                  className="w-full px-4 py-3 text-sm bg-secondary text-secondary-foreground rounded-xl hover:bg-accent transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
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

        {/* Station List */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto scrollbar-stable"
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
              <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2">
                {filteredStations.map((station) => {
                const distance = userLocation
                  ? calculateDistance(
                      userLocation.latitude, userLocation.longitude,
                      station.latitude, station.longitude
                    )
                  : null;

                return (
                  <div
                    key={station.id}
                    onClick={() => handleStationSelect(station)}
                    className={`
                      relative p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all duration-200 border
                      ${selectedStation?.id === station.id
                        ? 'bg-primary/10 border-primary shadow-sm'
                        : 'bg-card border-border hover:border-primary/50 hover:shadow-sm'
                      }
                    `}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleStationSelect(station);
                      }
                    }}
                  >
                    {/* Station Info */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-card-foreground text-sm truncate">{station.name}</h3>
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

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {station.inspection68 && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                          station.inspection68 === 'ตรวจแล้ว'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {station.inspection68 === 'ตรวจแล้ว' ? '✓' : '⏳'}
                        </span>
                      )}
                      {station.type === 'สถานีหลัก' || station.genre === 'สถานีหลัก' ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">★</span>
                      ) : null}
                    </div>

                    {/* Quick Navigation */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}&travelmode=driving`;
                        window.open(googleMapsUrl, '_blank');
                      }}
                      className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background rounded border border-border/50 hover:border-border"
                      title="Navigate"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </button>
                  </div>
                );
              })}
              </div>
            );
          })()}
        </div>

        </div> {/* Close Modal Content Container */}
      </div>
    </>
  );
}