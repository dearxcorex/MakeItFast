'use client';

import { FMStation } from '@/types/station';
import StationCard from './StationCard';
import NavigateButton from './NavigateButton';

interface StationPopupSingleProps {
  station: FMStation;
  distance: number | null;
  onUpdateStation?: (stationId: string | number, updates: Partial<FMStation>) => void;
}

export default function StationPopupSingle({ station, distance, onUpdateStation }: StationPopupSingleProps) {
  return (
    <div className="w-full max-w-[300px] sm:max-w-[340px] p-3">
      <StationCard
        station={station}
        onUpdateStation={onUpdateStation}
      />

      {distance && (
        <div className="flex items-center gap-2 text-xs sm:text-sm text-primary font-semibold bg-primary/10 p-2 rounded-lg mb-4 mt-3">
          <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span>{distance.toFixed(1)} km away</span>
        </div>
      )}

      {station.description && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground leading-relaxed break-words">
            {station.description}
          </p>
        </div>
      )}

      <NavigateButton lat={station.latitude} lng={station.longitude} stationName={station.name} />
    </div>
  );
}
