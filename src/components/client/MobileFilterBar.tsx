'use client';

import { FMStation, FilterType } from '@/types/station';

interface MobileFilterBarProps {
  filters: FilterType;
  setFilters: (filters: FilterType) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  clearFilters: () => void;
  initialProvinces: string[];
  initialCities: string[];
  initialInspectionStatuses: string[];
  stations: FMStation[];
}

export default function MobileFilterBar({
  filters,
  setFilters,
  showFilters,
  setShowFilters,
  clearFilters,
  initialProvinces,
  initialCities,
  initialInspectionStatuses,
  stations,
}: MobileFilterBarProps) {
  const activeFilterCount = [
    filters.province,
    filters.city,
    filters.onAir !== undefined ? 'set' : undefined,
    filters.inspection69,
  ].filter(Boolean).length;

  return (
    <div className="glass-card rounded-xl p-3">
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search stations..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
            className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          {filters.search && (
            <button
              onClick={() => setFilters({ ...filters, search: undefined })}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter toggle - mobile only */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="lg:hidden relative flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-background hover:bg-muted transition-all flex-shrink-0"
          aria-label="Toggle filters"
        >
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Collapsible filters */}
      <div className={`${showFilters ? 'max-h-[200px] opacity-100 mt-2' : 'max-h-0 opacity-0'} lg:max-h-none lg:opacity-100 lg:mt-2 overflow-hidden transition-all duration-200 ease-in-out`}>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filters.province || ''}
            onChange={(e) => setFilters({ ...filters, province: e.target.value || undefined, city: undefined })}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent min-w-[140px]"
          >
            <option value="">All Provinces</option>
            {initialProvinces.map(province => (
              <option key={province} value={province}>{province}</option>
            ))}
          </select>

          <select
            value={filters.city || ''}
            onChange={(e) => setFilters({ ...filters, city: e.target.value || undefined })}
            className={`px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent min-w-[140px] ${!filters.province ? 'opacity-50' : ''}`}
            disabled={!filters.province}
          >
            <option value="">{filters.province ? 'All Cities' : 'Select province'}</option>
            {filters.province && initialCities
              .filter(city => stations.some(s => s.state === filters.province && s.city === city))
              .map(city => (
                <option key={city} value={city}>{city}</option>
              ))
            }
          </select>

          <div className="flex gap-1">
            <button
              onClick={() => setFilters({ ...filters, onAir: filters.onAir === true ? undefined : true })}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                filters.onAir === true
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-background border-border hover:border-green-500/50'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${filters.onAir === true ? 'bg-white' : 'bg-green-500'}`} />
              On Air
            </button>
            <button
              onClick={() => setFilters({ ...filters, onAir: filters.onAir === false ? undefined : false })}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
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
            onChange={(e) => setFilters({ ...filters, inspection69: e.target.value || undefined })}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent min-w-[140px]"
          >
            <option value="">All Inspection</option>
            {initialInspectionStatuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          {(filters.search || filters.province || filters.city || filters.onAir !== undefined || filters.inspection69) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg border border-destructive/20 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
