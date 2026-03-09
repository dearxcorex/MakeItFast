'use client';

import { FilterType } from '@/types/station';

interface FilterControlsProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  onClearFilters: () => void;
  provinces: string[];
  availableCities: string[];
  inspectionStatuses: string[];
  variant: 'desktop' | 'mobile';
}

export default function FilterControls({
  filters,
  onFiltersChange,
  onClearFilters,
  provinces,
  availableCities,
  inspectionStatuses,
  variant,
}: FilterControlsProps) {
  const isMobile = variant === 'mobile';

  if (isMobile) {
    return (
      <div className="p-4 border-b border-border bg-muted/10">
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search stations..."
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

          {/* On Air / Off Air */}
          <div className="flex gap-2">
            <button
              onClick={() => onFiltersChange({ ...filters, onAir: filters.onAir === true ? undefined : true })}
              className={`flex-1 touch-target text-sm rounded-lg border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                filters.onAir === true
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-background border-border hover:border-green-500'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
              On Air
            </button>
            <button
              onClick={() => onFiltersChange({ ...filters, onAir: filters.onAir === false ? undefined : false })}
              className={`flex-1 touch-target text-sm rounded-lg border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                filters.onAir === false
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-background border-border hover:border-red-500'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 11-12.728 12.728M5.636 5.636L18.364 18.364" />
              </svg>
              Off Air
            </button>
          </div>

          {/* Province */}
          <select
            value={filters.province || ''}
            onChange={(e) => onFiltersChange({ ...filters, province: e.target.value || undefined, city: undefined })}
            className="w-full touch-target text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
          >
            <option value="">All Provinces</option>
            {provinces.map(province => (
              <option key={province} value={province}>{province}</option>
            ))}
          </select>

          {/* City */}
          {filters.province && (
            <select
              value={filters.city || ''}
              onChange={(e) => onFiltersChange({ ...filters, city: e.target.value || undefined })}
              className="w-full touch-target text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
            >
              <option value="">All Cities in {filters.province}</option>
              {availableCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          )}

          {/* Clear */}
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
    );
  }

  // Desktop variant
  return (
    <div className="p-4 border-b border-border/30" role="search" aria-label="Station filters">
      <div className="space-y-3">
        {/* Search Card */}
        <div className="p-3 bg-secondary/30 rounded-xl border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Search</span>
          </div>
          <div className="relative">
            <input
              id="search-filter"
              type="text"
              placeholder="Name, frequency, city..."
              value={filters.search || ''}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
              className="w-full pl-3 pr-9 py-2.5 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
              aria-label="Search stations by name, frequency, city, or province"
            />
            {filters.search && (
              <button
                onClick={() => onFiltersChange({ ...filters, search: undefined })}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Location Card */}
        <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Location</span>
          </div>
          <div className="space-y-2">
            <select
              id="province-filter"
              value={filters.province || ''}
              onChange={(e) => onFiltersChange({ ...filters, province: e.target.value === '' ? undefined : e.target.value, city: undefined })}
              className="w-full p-2.5 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
              aria-label="Filter by province"
            >
              <option value="">All Provinces</option>
              {provinces.map(province => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>
            <select
              id="city-filter"
              value={filters.city || ''}
              onChange={(e) => onFiltersChange({ ...filters, city: e.target.value === '' ? undefined : e.target.value })}
              className={`w-full p-2.5 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-opacity ${!filters.province ? 'opacity-50' : ''}`}
              disabled={!filters.province}
              aria-label="Filter by city"
            >
              <option value="">{filters.province ? 'All Cities' : 'Select province first'}</option>
              {availableCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Card */}
        <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Status</span>
          </div>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => onFiltersChange({ ...filters, onAir: filters.onAir === true ? undefined : true })}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                filters.onAir === true
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-background border-border hover:border-green-500/50'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${filters.onAir === true ? 'bg-white' : 'bg-green-500'}`} />
              On Air
            </button>
            <button
              onClick={() => onFiltersChange({ ...filters, onAir: filters.onAir === false ? undefined : false })}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                filters.onAir === false
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-background border-border hover:border-red-500/50'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${filters.onAir === false ? 'bg-white' : 'bg-red-500'}`} />
              Off Air
            </button>
          </div>
          <select
            value={filters.inspection69 || ''}
            onChange={(e) => onFiltersChange({ ...filters, inspection69: e.target.value === '' ? undefined : e.target.value })}
            className="w-full p-2.5 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
            aria-label="Filter by inspection status"
          >
            <option value="">All Inspection Status</option>
            {inspectionStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {(filters.search || filters.province || filters.city || filters.onAir !== undefined || filters.inspection69) && (
          <button
            onClick={onClearFilters}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-colors border border-destructive/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear All Filters
          </button>
        )}
      </div>
    </div>
  );
}
