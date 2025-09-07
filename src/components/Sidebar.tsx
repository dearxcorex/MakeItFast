'use client';

import { useState } from 'react';
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
  initialOnAirStatuses,
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
  const onAirStatuses = initialOnAirStatuses;
  const cities = initialCities;
  const provinces = initialProvinces;
  const inspectionStatuses = initialInspectionStatuses;

  return (
    <>
      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-[1000] w-72 sm:w-80 transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col shadow-2xl border-r border-border
      `}
      style={{ background: 'var(--sidebar-bg)' }}>
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
                className="p-2 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all duration-200 hover:scale-105"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
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
                className="lg:hidden p-2 rounded-xl bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all duration-200 hover:scale-105"
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
              <span className="text-lg font-bold">{stations.length}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-border bg-muted/30">
          <div className="space-y-5">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search stations, cities, provinces..."
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-card border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 text-card-foreground placeholder:text-muted-foreground"
              />
            </div>

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
                  <label className="block text-xs font-medium text-muted-foreground mb-2">Province</label>
                  <select
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
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    District {filters.province && (
                      <span className="text-primary font-semibold">in {filters.province}</span>
                    )}
                  </label>
                  <select
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
                  <label className="block text-xs font-medium text-muted-foreground mb-2">Broadcast Status</label>
                  <select
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
                  <label className="block text-xs font-medium text-muted-foreground mb-2">Inspection Status</label>
                  <select
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
            </div>


            {/* Clear filters */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                {Object.values(filters).filter(Boolean).length} filter(s) active
              </div>
              <button
                onClick={onClearFilters}
                className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-accent transition-all duration-200 hover:scale-[1.02] font-medium flex items-center gap-2"
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
          {stations.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.034 0-3.952.617-5.542 1.673M3 9.5v7.5A2.5 2.5 0 005.5 19H7M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-foreground mb-1">No stations found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your search filters</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {stations.map((station, index) => {
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
                      group relative p-4 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02] animate-fade-in border backdrop-blur-sm
                      ${selectedStation?.id === station.id 
                        ? 'bg-primary/10 border-primary shadow-lg shadow-primary/20' 
                        : 'bg-card border-border hover:border-primary/50 hover:shadow-md'
                      }
                    `}
                    style={{ animationDelay: `${index * 50}ms` }}
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
                              station.inspection68 === 'Passed' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : station.inspection68 === 'Failed'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                station.inspection68 === 'Passed' 
                                  ? 'bg-green-500' 
                                  : station.inspection68 === 'Failed'
                                  ? 'bg-red-500'
                                  : 'bg-yellow-500'
                              }`} />
                              {station.inspection68}
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
                    
                    {/* Power Info */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Power: {(station.transmitterPower / 1000).toFixed(0)}kW</span>
                      </div>
                      
                      <div className={`transition-opacity duration-200 ${selectedStation?.id === station.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <span className="text-primary font-medium">View on map →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}