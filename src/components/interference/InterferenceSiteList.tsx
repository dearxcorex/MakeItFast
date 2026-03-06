'use client';

import { useState } from 'react';
import type { InterferenceSite } from '@/types/interference';

interface InterferenceSiteListProps {
  sites: InterferenceSite[];
  selectedSite: InterferenceSite | null;
  onSiteSelect: (site: InterferenceSite) => void;
  loading: boolean;
}

type SortKey = 'name' | 'noise' | 'ranking' | 'distance';

const rankingOrder: Record<string, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

export default function InterferenceSiteList({
  sites,
  selectedSite,
  onSiteSelect,
  loading,
}: InterferenceSiteListProps) {
  const [sortBy, setSortBy] = useState<SortKey>('ranking');

  const sorted = [...sites].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.siteName || '').localeCompare(b.siteName || '');
      case 'noise':
        return (a.avgNiCarrier ?? 0) - (b.avgNiCarrier ?? 0);
      case 'ranking':
        return (rankingOrder[a.ranking?.toLowerCase() || ''] ?? 3) - (rankingOrder[b.ranking?.toLowerCase() || ''] ?? 3);
      case 'distance':
        return (a.estimateDistance ?? 999) - (b.estimateDistance ?? 999);
      default:
        return 0;
    }
  });

  const rankingBadge = (ranking: string | null) => {
    switch (ranking?.toLowerCase()) {
      case 'critical':
        return 'badge-error';
      case 'major':
        return 'badge-warning';
      case 'minor':
        return 'badge-peach';
      default:
        return 'badge-info';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Loading sites...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sort + count header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{sites.length} sites</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="text-xs px-2 py-1 rounded bg-input text-foreground border border-border/50"
        >
          <option value="ranking">Sort: Severity</option>
          <option value="noise">Sort: Noise</option>
          <option value="name">Sort: Name</option>
          <option value="distance">Sort: Distance</option>
        </select>
      </div>

      {/* Site list */}
      <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-stable">
        {sorted.map((site) => (
          <button
            key={site.id}
            onClick={() => onSiteSelect(site)}
            className={`w-full text-left p-3 rounded-xl transition-all border ${
              selectedSite?.id === site.id
                ? 'bg-primary/10 border-primary/30'
                : 'bg-card/50 border-border/30 hover:border-primary/20'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">
                  {site.siteName || site.siteCode || `Site #${site.id}`}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {site.changwat}{site.cellName ? ` - ${site.cellName}` : ''}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${rankingBadge(site.ranking)}`}>
                  {site.ranking || 'N/A'}
                </span>
                {site.avgNiCarrier != null && (
                  <span className="text-[10px] text-muted-foreground">
                    {site.avgNiCarrier.toFixed(1)} dBm
                  </span>
                )}
              </div>
            </div>
            {site.estimateDistance != null && (
              <div className="text-[10px] text-muted-foreground mt-1">
                Est. distance: {site.estimateDistance.toFixed(2)} km
              </div>
            )}
          </button>
        ))}
        {sites.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No sites found. Try adjusting filters or importing data.
          </div>
        )}
      </div>
    </div>
  );
}
