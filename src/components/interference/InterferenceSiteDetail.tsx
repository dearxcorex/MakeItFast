'use client';

import type { InterferenceSite } from '@/types/interference';
import NavigateButton from '@/components/map/NavigateButton';
import BearingValidation from './BearingValidation';
import { getCompassDirection } from '@/utils/bearingUtils';

interface InterferenceSiteDetailProps {
  site: InterferenceSite;
  onUpdateSite?: (siteId: number, updates: { status?: string }) => void;
}

export default function InterferenceSiteDetail({ site, onUpdateSite }: InterferenceSiteDetailProps) {
  const isInspected = site.status === 'ตรวจแล้ว';

  // Noise gauge (normalized -130 to -80 dBm range)
  const noisePercent = site.avgNiCarrier != null
    ? Math.max(0, Math.min(100, ((site.avgNiCarrier + 130) / 50) * 100))
    : 0;
  const noiseColor = noisePercent > 70 ? 'var(--if-critical)' : noisePercent > 40 ? 'var(--if-warning)' : 'var(--if-success)';

  return (
    <div className="space-y-4 flex-1 scrollbar-stable" style={{ color: 'var(--if-text-primary)' }}>
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold" style={{ fontFamily: "'Prompt', system-ui", color: 'var(--if-text-primary)' }}>
            {site.siteName || site.siteCode || `Site #${site.id}`}
          </h3>
          {site.ranking && (
            <span className={`if-badge ${
              site.ranking.toLowerCase() === 'critical' ? 'if-badge-critical' :
              site.ranking.toLowerCase() === 'major' ? 'if-badge-major' : 'if-badge-minor'
            }`}>
              {site.ranking}
            </span>
          )}
        </div>
        {site.cellName && (
          <p className="text-xs" style={{ color: 'var(--if-text-tertiary)', fontFamily: "'JetBrains Mono', 'SF Mono', monospace", fontSize: '0.7rem' }}>
            {site.cellName}
          </p>
        )}
      </div>

      {/* Noise Gauge */}
      <div>
        <div className="if-filter-label">Noise Level</div>
        <div className="grid grid-cols-3 gap-2 text-center mb-2">
          <div>
            <div className="text-base font-bold" style={{ color: noiseColor, fontFamily: "'JetBrains Mono', monospace" }}>
              {site.avgNiCarrier?.toFixed(1) ?? 'N/A'}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--if-text-tertiary)' }}>Avg (dBm)</div>
          </div>
          <div>
            <div className="text-base font-bold" style={{ color: 'var(--if-text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
              {site.dayTime?.toFixed(1) ?? 'N/A'}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--if-text-tertiary)' }}>Day</div>
          </div>
          <div>
            <div className="text-base font-bold" style={{ color: 'var(--if-text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
              {site.nightTime?.toFixed(1) ?? 'N/A'}
            </div>
            <div className="text-[10px]" style={{ color: 'var(--if-text-tertiary)' }}>Night</div>
          </div>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--if-border)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${noisePercent}%`, background: noiseColor }}
          />
        </div>
        <div className="flex justify-between mt-0.5" style={{ fontSize: '9px', color: 'var(--if-text-tertiary)' }}>
          <span>-130 dBm</span>
          <span>-80 dBm</span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5" style={{ fontSize: '0.75rem' }}>
        <Detail label="Province" value={site.changwat} />
        <Detail label="MC Zone" value={site.mcZone} />
        <Detail label="NBTC Area" value={site.nbtcArea} />
        <Detail label="Azimuth" value={site.direction != null ? `${site.direction}° (${getCompassDirection(site.direction)})` : null} />
        <Detail label="Sector" value={site.sectorName} />
        <Detail label="Est. Distance" value={site.estimateDistance != null ? `${site.estimateDistance.toFixed(2)} km` : null} />
        <Detail label="Lot" value={site.lot} />
        <Detail label="AWN Contact" value={site.awnContact} />
        <Detail label="On-site Scan" value={site.onSiteScanBy} />
      </div>

      {/* Bearing Validation */}
      <BearingValidation site={site} />

      {/* Inspection Status + Action */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg" style={{
        background: isInspected ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.06)',
        border: `1px solid ${isInspected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.15)'}`,
      }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: isInspected ? 'var(--if-success)' : 'var(--if-critical)' }} />
          <span className="text-xs font-medium" style={{ color: isInspected ? 'var(--if-success)' : '#F87171' }}>
            {isInspected ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ'}
          </span>
        </div>
        {onUpdateSite && (
          <button
            onClick={() => {
              const newStatus = isInspected ? 'ยังไม่ตรวจ' : 'ตรวจแล้ว';
              onUpdateSite(site.id, { status: newStatus });
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
            style={isInspected ? {
              background: 'var(--if-surface-elevated)',
              color: 'var(--if-text-secondary)',
              border: '1px solid var(--if-border)',
            } : {
              background: 'var(--if-accent)',
              color: '#0F1117',
              border: 'none',
            }}
          >
            {isInspected ? 'Undo' : 'Mark Inspected'}
          </button>
        )}
      </div>

      {/* Source Location */}
      {site.sourceLat && site.sourceLong && (
        <div className="p-3 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
          <div className="text-xs font-medium mb-1" style={{ color: '#F87171' }}>Interference Source</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--if-text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
            {site.sourceLat.toFixed(6)}, {site.sourceLong.toFixed(6)}
          </div>
          {site.sourceLocation1 && (
            <div className="mt-1" style={{ fontSize: '0.7rem', color: 'var(--if-text-secondary)' }}>{site.sourceLocation1}</div>
          )}
          {site.sourceLocation2 && (
            <div style={{ fontSize: '0.7rem', color: 'var(--if-text-secondary)' }}>{site.sourceLocation2}</div>
          )}
        </div>
      )}

      {/* Notes */}
      {site.notes && (
        <div>
          <div className="if-filter-label">Notes</div>
          <p className="text-xs" style={{ color: 'var(--if-text-secondary)' }}>{site.notes}</p>
        </div>
      )}

      {/* Navigate */}
      {site.lat != null && site.long != null && (
        <NavigateButton lat={site.lat} lng={site.long} stationName={site.siteName || site.siteCode || undefined} />
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span style={{ color: 'var(--if-text-tertiary)' }}>{label}: </span>
      <span style={{ color: 'var(--if-text-primary)' }}>{value || '-'}</span>
    </div>
  );
}
