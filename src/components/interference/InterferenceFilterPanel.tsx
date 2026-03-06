'use client';

import { useState, useEffect } from 'react';
import type { InterferenceFilter } from '@/types/interference';

interface InterferenceFilterPanelProps {
  filters: InterferenceFilter;
  onFiltersChange: (filters: InterferenceFilter) => void;
}

export default function InterferenceFilterPanel({
  filters,
  onFiltersChange,
}: InterferenceFilterPanelProps) {
  const [changwats, setChangwats] = useState<string[]>([]);
  const [rankings] = useState<string[]>(['Critical', 'Major', 'Minor']);
  const [searchInput, setSearchInput] = useState(filters.search || '');

  useEffect(() => {
    fetch('/api/interference/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.byProvince) {
          setChangwats(Object.keys(data.byProvince).sort());
        }
      })
      .catch(console.error);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.search || '')) {
        onFiltersChange({ ...filters, search: searchInput || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters, onFiltersChange]);

  const rankingColor = (r: string) => {
    switch (r.toLowerCase()) {
      case 'critical': return 'badge-error';
      case 'major': return 'badge-warning';
      case 'minor': return 'badge-peach';
      default: return 'badge-info';
    }
  };

  return (
    <div className="glass-card p-3 space-y-3">
      {/* Search */}
      <input
        type="text"
        placeholder="Search sites..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-input text-foreground text-sm border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
      />

      <div className="grid grid-cols-2 gap-2">
        {/* Province */}
        <select
          value={filters.changwat || ''}
          onChange={(e) => onFiltersChange({ ...filters, changwat: e.target.value || undefined })}
          className="px-2 py-1.5 rounded-lg bg-input text-foreground text-xs border border-border/50"
        >
          <option value="">All Provinces</option>
          {changwats.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Ranking */}
        <select
          value={filters.ranking || ''}
          onChange={(e) => onFiltersChange({ ...filters, ranking: e.target.value || undefined })}
          className="px-2 py-1.5 rounded-lg bg-input text-foreground text-xs border border-border/50"
        >
          <option value="">All Rankings</option>
          {rankings.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Ranking badges + source toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        {rankings.map((r) => (
          <button
            key={r}
            onClick={() =>
              onFiltersChange({
                ...filters,
                ranking: filters.ranking === r ? undefined : r,
              })
            }
            className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
              filters.ranking === r
                ? rankingColor(r)
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            {r}
          </button>
        ))}
        <button
          onClick={() =>
            onFiltersChange({ ...filters, hasSource: !filters.hasSource })
          }
          className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
            filters.hasSource
              ? 'badge-purple'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          Has Source
        </button>
      </div>

      {/* Clear filters */}
      {Object.values(filters).some(Boolean) && (
        <button
          onClick={() => {
            onFiltersChange({});
            setSearchInput('');
          }}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
