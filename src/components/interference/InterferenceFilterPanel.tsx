'use client';

import { useState, useEffect } from 'react';
import type { InterferenceFilter } from '@/types/interference';
import KmlImportDialog from './KmlImportDialog';

interface DirectionMatchStats {
  total: number;
  match: number;
  mismatch: number;
}

interface InterferenceFilterPanelProps {
  filters: InterferenceFilter;
  onFiltersChange: (filters: InterferenceFilter) => void;
  directionStats?: DirectionMatchStats;
  onRefreshSites?: () => void;
}

export default function InterferenceFilterPanel({
  filters,
  onFiltersChange,
  directionStats,
  onRefreshSites,
}: InterferenceFilterPanelProps) {
  const [changwats, setChangwats] = useState<string[]>([]);

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

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      {/* Province */}
      <div className="if-filter-group">
        <div className="if-filter-label">Province</div>
        <select
          value={filters.changwat || ''}
          onChange={(e) => onFiltersChange({ ...filters, changwat: e.target.value || undefined })}
          className="if-select"
        >
          <option value="">All Provinces</option>
          {changwats.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Ranking */}
      <div className="if-filter-group">
        <div className="if-filter-label">Ranking</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {['Critical', 'Major', 'Minor'].map((r) => {
            const isActive = filters.ranking === r;
            const pillClass = r === 'Critical' ? 'if-pill-critical' : r === 'Major' ? 'if-pill-warning' : '';
            return (
              <button
                key={r}
                onClick={() => onFiltersChange({ ...filters, ranking: isActive ? undefined : r })}
                className={`if-pill ${pillClass} ${isActive ? 'active' : ''}`}
              >
                {r}
              </button>
            );
          })}
          <button
            onClick={() => onFiltersChange({ ...filters, hasSource: !filters.hasSource })}
            className={`if-pill ${filters.hasSource ? 'active' : ''}`}
          >
            Has Source
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="if-filter-group">
        <div className="if-filter-label">Status</div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onFiltersChange({ ...filters, status: filters.status === 'ตรวจแล้ว' ? undefined : 'ตรวจแล้ว' })}
            className={`if-pill if-pill-success ${filters.status === 'ตรวจแล้ว' ? 'active' : ''}`}
          >
            ตรวจแล้ว
          </button>
          <button
            onClick={() => onFiltersChange({ ...filters, status: filters.status === 'ยังไม่ตรวจ' ? undefined : 'ยังไม่ตรวจ' })}
            className={`if-pill if-pill-warning ${filters.status === 'ยังไม่ตรวจ' ? 'active' : ''}`}
          >
            ยังไม่ตรวจ
          </button>
        </div>
      </div>

      {/* Direction Validation */}
      {directionStats && directionStats.total > 0 && (
        <div className="if-filter-group">
          <div className="if-filter-label">
            Direction ({directionStats.match}/{directionStats.total} match)
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onFiltersChange({ ...filters, directionMatch: filters.directionMatch === 'match' ? undefined : 'match' })}
              className={`if-pill if-pill-success ${filters.directionMatch === 'match' ? 'active' : ''}`}
            >
              Match ({directionStats.match})
            </button>
            <button
              onClick={() => onFiltersChange({ ...filters, directionMatch: filters.directionMatch === 'mismatch' ? undefined : 'mismatch' })}
              className={`if-pill if-pill-critical ${filters.directionMatch === 'mismatch' ? 'active' : ''}`}
            >
              Mismatch ({directionStats.mismatch})
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid var(--if-border)' }}>
        <KmlImportDialog onImportComplete={() => onRefreshSites?.()} />
        {hasActiveFilters && (
          <button
            onClick={() => onFiltersChange({})}
            className="text-xs transition-colors"
            style={{ color: 'var(--if-text-tertiary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--if-accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--if-text-tertiary)')}
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
