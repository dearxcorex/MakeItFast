'use client';

import { useEffect, useRef } from 'react';
import { FMStation } from '@/types/station';
import StationCard from './StationCard';
import NavigateButton from './NavigateButton';

interface StationPopupMultipleProps {
  stationGroup: FMStation[];
  lat: number;
  lng: number;
  distance: number | null;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  isMobile: boolean;
  onUpdateStation?: (stationId: string | number, updates: Partial<FMStation>) => void;
}

export default function StationPopupMultiple({
  stationGroup,
  lat,
  lng,
  distance,
  currentPage,
  setCurrentPage,
  isMobile,
  onUpdateStation,
}: StationPopupMultipleProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const itemsPerPage = isMobile ? 1 : 3;
  const totalPages = Math.ceil(stationGroup.length / itemsPerPage);
  const currentStations = isMobile
    ? [stationGroup[currentPage]]
    : stationGroup.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  // iOS Safari minimal scroll prevention
  useEffect(() => {
    if (!isMobile || !containerRef.current) return;

    const container = containerRef.current;

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    const preventScrollOnly = (e: Event) => {
      if (e.type === 'scroll' || e.type === 'wheel') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    container.addEventListener('scroll', preventScrollOnly, { passive: false });
    container.addEventListener('wheel', preventScrollOnly, { passive: false });

    return () => {
      container.removeEventListener('scroll', preventScrollOnly);
      container.removeEventListener('wheel', preventScrollOnly);
    };
  }, [isMobile]);

  const PaginationControls = () => {
    if (totalPages <= 1) return null;

    const stopPropagation = (e: React.SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    return (
      <div
        className="flex items-center justify-between mb-3 p-2 bg-primary/10 rounded-lg"
        style={isMobile ? { isolation: 'isolate', position: 'relative', zIndex: 9999 } : {}}
        onClick={stopPropagation}
        onPointerDown={isMobile ? stopPropagation : undefined}
        onTouchStart={isMobile ? stopPropagation : undefined}
      >
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCurrentPage(Math.max(0, currentPage - 1));
          }}
          onPointerDown={isMobile ? stopPropagation : undefined}
          onTouchStart={isMobile ? stopPropagation : undefined}
          disabled={currentPage === 0}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
            currentPage === 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
          style={isMobile ? { isolation: 'isolate', position: 'relative', zIndex: 10000 } : {}}
        >
          ← Previous
        </button>
        <span className="text-xs font-medium text-primary">
          {isMobile
            ? `Station ${currentPage + 1} of ${stationGroup.length}`
            : `Page ${currentPage + 1} of ${totalPages}`
          }
        </span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCurrentPage(Math.min(totalPages - 1, currentPage + 1));
          }}
          onPointerDown={isMobile ? stopPropagation : undefined}
          onTouchStart={isMobile ? stopPropagation : undefined}
          disabled={currentPage === totalPages - 1}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
            currentPage === totalPages - 1
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
          style={isMobile ? { isolation: 'isolate', position: 'relative', zIndex: 10000 } : {}}
        >
          Next →
        </button>
      </div>
    );
  };

  return (
    <div
      className={`w-full p-3 ${isMobile ? 'max-w-[320px]' : 'max-w-[320px] sm:max-w-[380px]'}`}
      style={{
        contain: isMobile ? 'layout style paint' : 'none',
        transform: isMobile ? 'translate3d(0, 0, 0)' : 'none',
        touchAction: 'manipulation',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm sm:text-base text-card-foreground leading-tight break-words">
              {stationGroup.length} Stations at this Location
            </h3>
            <div className="text-xs text-muted-foreground mt-1">
              {stationGroup[0].city}, {stationGroup[0].state}
            </div>
          </div>
        </div>

        {distance && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-primary font-semibold bg-primary/10 p-2 rounded-lg mb-4">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>{distance.toFixed(1)} km away</span>
          </div>
        )}

        {/* Station list */}
        {isMobile ? (
          <div
            ref={containerRef}
            className="space-y-2"
            style={{
              maxHeight: '400px',
              minHeight: '200px',
              overflow: 'visible',
              touchAction: 'manipulation',
              contain: 'layout style paint',
            }}
          >
            <PaginationControls />
            <div className="space-y-2" style={{ minHeight: 'auto' }}>
              {currentStations.map((station) => (
                <StationCard
                  key={station.id}
                  station={station}
                  onUpdateStation={onUpdateStation}
                  isMobile
                />
              ))}
            </div>
          </div>
        ) : (
          <div
            className="space-y-2 max-h-[280px] overflow-y-auto"
            style={{ WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)' }}
          >
            {stationGroup.map((station, index) => (
              <StationCard
                key={station.id}
                station={station}
                onUpdateStation={onUpdateStation}
                showStationIndex={stationGroup.length > 1 ? { current: index + 1, total: stationGroup.length } : undefined}
              />
            ))}
          </div>
        )}

        <NavigateButton lat={lat} lng={lng} />
      </div>
    </div>
  );
}
