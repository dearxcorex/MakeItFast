'use client';

import { FMStation, FilterType, UserLocation } from '@/types/station';
import { useTheme } from '@/contexts/ThemeContext';

interface SidebarProps {
  stations: FMStation[]; // Now receives filtered stations
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
  
  // Filter data arrays from server-side props
  const cities = initialCities;
  const provinces = initialProvinces;
  const inspectionStatuses = initialInspectionStatuses;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[999] lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-[1000] w-72 sm:w-80 transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col shadow-2xl border-r border-border
      `}
      style={{ background: 'var(--sidebar-bg)' }}
      role="complementary"
      aria-label="Station filters and list">
        {/* Header */}
        <div className="p-6 border-b border-border" style={{ background: 'var(--header-bg)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">FM Tracker</h2>
                <p className="text-white/80 text-sm">Radio Station Finder</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-3 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all duration-200 hover:scale-105 min-w-[44px] min-h-[44px] flex items-center justify-center"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              
              <button
                onClick={onToggle}
                className="lg:hidden p-3 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all duration-200 hover:scale-105 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center justify-between text-white">
              <span className="text-sm font-medium">Stations Found</span>
              <span className="text-lg font-bold">
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
            </div>
            {userLocation && (
              <div className="text-xs text-white/70 mt-1">
                Within 20km radius
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-border bg-muted/30">
          <div className="space-y-5">

            {/* Location Filters */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Location
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {/* Province filter */}
                <div>
                  <label htmlFor="province-filter" className="block text-xs font-medium text-muted-foreground mb-2">Province</label>
                  <select
                    id="province-filter"
                    aria-label="Filter stations by province"
                    value={filters.province}
                    onChange={(e) => onFiltersChange({ ...filters, province: e.target.value })}
                    className="w-full px-3 py-2 bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 text-card-foreground text-sm"
                  >
                    <option value="">All Provinces</option>
                    {provinces.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                </div>

                {/* City filter */}
                <div>
                  <label htmlFor="city-filter" className="block text-xs font-medium text-muted-foreground mb-2">
                    District {filters.province && (
                      <span className="text-primary font-semibold">in {filters.province}</span>
                    )}
                  </label>
                  <select
                    id="city-filter"
                    aria-label="Filter stations by district or city"
                    value={filters.city}
                    onChange={(e) => onFiltersChange({ ...filters, city: e.target.value })}
                    className="w-full px-3 py-2 bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 text-card-foreground text-sm"
                    disabled={!filters.province && cities.length === 0}
                  >
                    <option value="">{filters.province ? `All Districts in ${filters.province}` : 'All Districts'}</option>
                    {cities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Status Filters */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Status
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {/* On Air Status filter */}
                <div>
                  <label htmlFor="onair-filter" className="block text-xs font-medium text-muted-foreground mb-2">Broadcast Status</label>
                  <select
                    id="onair-filter"
                    aria-label="Filter stations by broadcast status"
                    value={filters.onAir}
                    onChange={(e) => onFiltersChange({ ...filters, onAir: e.target.value })}
                    className="w-full px-3 py-2 bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 text-card-foreground text-sm"
                  >
                    <option value="">All Stations</option>
                    <option value="true">🟢 On Air</option>
                    <option value="false">🔴 Off Air</option>
                  </select>
                </div>

                {/* Inspection Status filter */}
                <div>
                  <label htmlFor="inspection-filter" className="block text-xs font-medium text-muted-foreground mb-2">Inspection Status</label>
                  <select
                    id="inspection-filter"
                    aria-label="Filter stations by inspection status"
                    value={filters.inspection}
                    onChange={(e) => onFiltersChange({ ...filters, inspection: e.target.value })}
                    className="w-full px-3 py-2 bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 text-card-foreground text-sm"
                  >
                    <option value="">All Status</option>
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

              {/* Submit Request filter */}
              <div>
                <label htmlFor="submit-request-filter" className="block text-xs font-medium text-muted-foreground mb-2">Submit Request Status</label>
                <select
                  id="submit-request-filter"
                  aria-label="Filter stations by submit request status"
                  value={filters.submitRequest}
                  onChange={(e) => onFiltersChange({ ...filters, submitRequest: e.target.value })}
                  className="w-full px-3 py-2 bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 text-card-foreground text-sm"
                >
                  <option value="">All Stations</option>
                  <option value="ไม่ยื่น">📋 ไม่ยื่น</option>
                </select>
              </div>
            </div>


            {/* Clear filters */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                {Object.values(filters).filter(Boolean).length} filter(s) active
              </div>
              <button
                onClick={onClearFilters}
                className="px-4 py-3 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-accent transition-all duration-200 hover:scale-[1.02] font-medium flex items-center gap-2 min-h-[44px]"
                aria-label="Clear all filters"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* Station List */}
        <div className="flex-1 overflow-y-auto">
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
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.034 0-3.952.617-5.542 1.673M3 9.5v7.5A2.5 2.5 0 005.5 19H7M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-medium text-foreground mb-1">No stations found</h3>
                <p className="text-sm text-muted-foreground">
                  {userLocation
                    ? "No stations within 20km. Try a different location or adjust filters."
                    : "Try adjusting your search filters"}
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {filteredStations.map((station, index) => {
                const distance = userLocation 
                  ? calculateDistance(
                      userLocation.latitude, userLocation.longitude,
                      station.latitude, station.longitude
                    )
                  : null;

                return (
                  <div
                    key={station.id}
                    onClick={() => onStationSelect(station)}
                    className={`
                      group relative p-4 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02] animate-fade-in border backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                      ${selectedStation?.id === station.id
                        ? 'bg-primary/10 border-primary shadow-lg shadow-primary/20'
                        : 'bg-card border-border hover:border-primary/50 hover:shadow-md'
                      }
                    `}
                    style={{ animationDelay: `${index * 50}ms` }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select ${station.name} FM ${station.frequency} station in ${station.city}, ${station.state}${distance ? ` - ${distance.toFixed(1)} km away` : ''}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onStationSelect(station);
                      }
                    }}
                  >
                    {/* Station Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-card-foreground truncate text-lg">{station.name}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-primary/20 text-primary text-xs font-bold">
                            {station.frequency} FM
                          </span>
                          <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-lg">
                            {station.genre}
                          </span>
                          {station.inspection68 && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                              station.inspection68 === 'ตรวจแล้ว'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : station.inspection68 === 'ยังไม่ตรวจ'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                station.inspection68 === 'ตรวจแล้ว'
                                  ? 'bg-green-500'
                                  : station.inspection68 === 'ยังไม่ตรวจ'
                                  ? 'bg-yellow-500'
                                  : 'bg-blue-500'
                              }`} />
                              {station.inspection68}
                            </span>
                          )}
                          {station.submitRequest === 'ไม่ยื่น' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-black text-white dark:bg-gray-800 dark:text-gray-200">
                              <div className="w-1.5 h-1.5 rounded-full bg-black dark:bg-gray-600" />
                              📋 ไม่ยื่น
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {selectedStation?.id === station.id && (
                        <div className="w-3 h-3 bg-primary rounded-full flex-shrink-0 animate-pulse" />
                      )}
                    </div>
                    
                    {/* Location & Distance */}
                    <div className="flex items-center justify-between text-sm mb-3">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{station.city}, {station.state}</span>
                      </div>
                      
                      {distance && (
                        <div className="flex items-center gap-1 text-primary font-semibold">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span>{distance.toFixed(1)} km</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Description */}
                    {station.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
                        {station.description}
                      </p>
                    )}
                    
                    {/* Navigation buttons */}
                    <div className="flex justify-end gap-2 text-xs group/nav">
                      <div className={`transition-opacity duration-200 group-hover/nav:opacity-0 ${selectedStation?.id === station.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <span className="text-primary font-medium">View on map →</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}&travelmode=driving`;
                          window.open(googleMapsUrl, '_blank');
                        }}
                        className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200 flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 min-w-[44px] min-h-[44px] justify-center"
                        title="Navigate with Google Maps"
                        aria-label={`Navigate to ${station.name} with Google Maps`}
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
                        </svg>
                        Navigate
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}