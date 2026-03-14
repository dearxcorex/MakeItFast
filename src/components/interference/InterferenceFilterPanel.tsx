'use client';

import { useState, useEffect } from 'react';
import type { InterferenceFilter } from '@/types/interference';

interface DirectionMatchStats {
  total: number;    // sites with both direction and source
  match: number;
  mismatch: number;
}

interface InterferenceFilterPanelProps {
  filters: InterferenceFilter;
  onFiltersChange: (filters: InterferenceFilter) => void;
  directionStats?: DirectionMatchStats;
}

export default function InterferenceFilterPanel({
  filters,
  onFiltersChange,
  directionStats,
}: InterferenceFilterPanelProps) {
  const [changwats, setChangwats] = useState<string[]>([]);
  const [rankings] = useState<string[]>(['Critical', 'Major', 'Minor']);

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
      {/* Province */}
      <select
        value={filters.changwat || ''}
        onChange={(e) => onFiltersChange({ ...filters, changwat: e.target.value || undefined })}
        className="w-full px-2 py-1.5 rounded-lg bg-input text-foreground text-xs border border-border/50"
      >
        <option value="">All Provinces</option>
        {changwats.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Ranking badges + source toggle + status filter */}
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

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Status:</span>
        <button
          onClick={() =>
            onFiltersChange({
              ...filters,
              status: filters.status === 'ตรวจแล้ว' ? undefined : 'ตรวจแล้ว',
            })
          }
          className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
            filters.status === 'ตรวจแล้ว'
              ? 'badge-success'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          ✅ ตรวจแล้ว
        </button>
        <button
          onClick={() =>
            onFiltersChange({
              ...filters,
              status: filters.status === 'ยังไม่ตรวจ' ? undefined : 'ยังไม่ตรวจ',
            })
          }
          className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
            filters.status === 'ยังไม่ตรวจ'
              ? 'badge-warning'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          ⏳ ยังไม่ตรวจ
        </button>
      </div>

      {/* Direction match filter */}
      {directionStats && directionStats.total > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground mb-1">
            Direction Validation ({directionStats.match}/{directionStats.total} match)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  directionMatch: filters.directionMatch === 'match' ? undefined : 'match',
                })
              }
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                filters.directionMatch === 'match'
                  ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              Match ({directionStats.match})
            </button>
            <button
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  directionMatch: filters.directionMatch === 'mismatch' ? undefined : 'mismatch',
                })
              }
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                filters.directionMatch === 'mismatch'
                  ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              Mismatch ({directionStats.mismatch})
            </button>
          </div>
        </div>
      )}

      {/* Clear filters */}
      {Object.values(filters).some(Boolean) && (
        <button
          onClick={() => onFiltersChange({})}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
