'use client';

import { FMStation } from '@/types/station';

interface StationListItemProps {
  station: FMStation;
  distance: number | null;
  isSelected: boolean;
  isKeyboardSelected?: boolean;
  onClick: () => void;
  variant: 'desktop' | 'mobile';
}

export default function StationListItem({
  station,
  distance,
  isSelected,
  isKeyboardSelected = false,
  onClick,
  variant,
}: StationListItemProps) {
  if (variant === 'mobile') {
    return (
      <div
        onClick={onClick}
        className={`relative p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
          isSelected
            ? 'bg-primary/10 border-primary shadow-sm'
            : 'bg-card border-border hover:border-primary/50 hover:shadow-sm'
        }`}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-card-foreground text-sm line-clamp-2">{station.name}</h3>
            <div className="flex items-center gap-1 mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-medium">
                {station.frequency} FM
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${station.onAir ? 'badge-success' : 'badge-error'}`}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: station.onAir ? 'var(--syntax-green)' : 'var(--syntax-red)' }} />
                {station.onAir ? 'On' : 'Off'}
              </span>
            </div>
          </div>
          {isSelected && <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
        </div>

        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted-foreground truncate">{station.city}, {station.state}</span>
          {distance && <span className="text-primary font-medium">{distance.toFixed(1)} km</span>}
        </div>

        {distance && distance <= 20 && (
          <div className="flex justify-end">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="touch-target inline-flex items-center gap-1 px-3 py-1 text-xs bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Navigate
            </a>
          </div>
        )}
      </div>
    );
  }

  // Desktop variant
  return (
    <div
      onClick={onClick}
      className={`station-card cursor-pointer ${isSelected ? 'selected' : ''} ${isKeyboardSelected ? 'keyboard-selected' : ''}`}
      role="listitem"
      tabIndex={0}
      aria-label={`${station.name}, ${station.frequency} FM, ${station.onAir ? 'On Air' : 'Off Air'}, ${station.city}, ${distance ? `${distance.toFixed(1)} km away` : ''}`}
      aria-current={isSelected ? 'true' : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-base leading-tight mb-2 line-clamp-2">{station.name}</h3>
          <div className="flex items-center gap-1 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-medium">
              {station.frequency} FM
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${station.onAir ? 'badge-success' : 'badge-error'}`}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: station.onAir ? 'var(--syntax-green)' : 'var(--syntax-red)' }} />
              {station.onAir ? 'On' : 'Off'}
            </span>
          </div>
        </div>
        {isSelected && <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
      </div>

      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-muted-foreground truncate">{station.city}, {station.state}</span>
        {distance && <span className="text-primary font-medium">{distance.toFixed(1)} km</span>}
      </div>

      {station.dateInspected && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded-md border border-border/30 mb-2">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Inspected: {(() => {
            try {
              return new Date(station.dateInspected).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
            } catch {
              return station.dateInspected;
            }
          })()}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{station.type}</span>
        {distance && distance <= 20 && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Navigate
          </a>
        )}
      </div>
    </div>
  );
}
