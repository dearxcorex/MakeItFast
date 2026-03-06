'use client';

import type { InterferenceSite } from '@/types/interference';

interface InterferenceSiteDetailProps {
  site: InterferenceSite;
}

export default function InterferenceSiteDetail({ site }: InterferenceSiteDetailProps) {
  const rankingColor = (r: string | null) => {
    switch (r?.toLowerCase()) {
      case 'critical': return 'badge-error';
      case 'major': return 'badge-warning';
      case 'minor': return 'badge-peach';
      default: return 'badge-info';
    }
  };

  // Noise gauge (normalized -130 to -80 dBm range)
  const noisePercent = site.avgNiCarrier != null
    ? Math.max(0, Math.min(100, ((site.avgNiCarrier + 130) / 50) * 100))
    : 0;
  const noiseColor = noisePercent > 70 ? '#EF4444' : noisePercent > 40 ? '#F59E0B' : '#22C55E';

  return (
    <div className="glass-card p-4 space-y-4 overflow-y-auto flex-1 scrollbar-stable">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-heading text-base text-foreground">
            {site.siteName || site.siteCode || `Site #${site.id}`}
          </h3>
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${rankingColor(site.ranking)}`}>
            {site.ranking || 'N/A'}
          </span>
        </div>
        {site.cellName && (
          <p className="text-xs text-muted-foreground">{site.cellName}</p>
        )}
      </div>

      {/* Noise Gauge */}
      <div>
        <div className="text-xs text-muted-foreground mb-1">Noise Level</div>
        <div className="grid grid-cols-3 gap-2 text-center mb-2">
          <div>
            <div className="text-lg font-bold" style={{ color: noiseColor }}>
              {site.avgNiCarrier?.toFixed(1) ?? 'N/A'}
            </div>
            <div className="text-[10px] text-muted-foreground">Avg (dBm)</div>
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">
              {site.dayTime?.toFixed(1) ?? 'N/A'}
            </div>
            <div className="text-[10px] text-muted-foreground">Day</div>
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">
              {site.nightTime?.toFixed(1) ?? 'N/A'}
            </div>
            <div className="text-[10px] text-muted-foreground">Night</div>
          </div>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${noisePercent}%`, background: noiseColor }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
          <span>-130 dBm</span>
          <span>-80 dBm</span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Detail label="Province" value={site.changwat} />
        <Detail label="MC Zone" value={site.mcZone} />
        <Detail label="NBTC Area" value={site.nbtcArea} />
        <Detail label="Direction" value={site.direction != null ? `${site.direction}°` : null} />
        <Detail label="Sector" value={site.sectorName} />
        <Detail label="Status" value={site.status} />
        <Detail label="Est. Distance" value={site.estimateDistance != null ? `${site.estimateDistance.toFixed(2)} km` : null} />
        <Detail label="Lot" value={site.lot} />
        <Detail label="AWN Contact" value={site.awnContact} />
        <Detail label="On-site Scan" value={site.onSiteScanBy} />
      </div>

      {/* Source Location */}
      {site.sourceLat && site.sourceLong && (
        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="text-xs font-medium text-destructive mb-1">Interference Source</div>
          <div className="text-xs text-muted-foreground">
            {site.sourceLat.toFixed(6)}, {site.sourceLong.toFixed(6)}
          </div>
          {site.sourceLocation1 && (
            <div className="text-xs text-muted-foreground mt-1">{site.sourceLocation1}</div>
          )}
          {site.sourceLocation2 && (
            <div className="text-xs text-muted-foreground">{site.sourceLocation2}</div>
          )}
        </div>
      )}

      {/* Notes */}
      {site.notes && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Notes</div>
          <p className="text-xs text-foreground">{site.notes}</p>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground">{value || '-'}</span>
    </div>
  );
}
