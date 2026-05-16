'use client';

import { useEffect, useState } from 'react';
import { FMStation } from '@/types/station';
import LoadingSpinner from './LoadingSpinner';
import type { StationInspection } from '@/types/inspection';
import InspectionPanel from '@/components/inspection/InspectionPanel';

interface StationCardProps {
  station: FMStation;
  onUpdateStation?: (stationId: string | number, updates: Partial<FMStation>) => void;
  inspectionHistory?: StationInspection[];
  inspectors?: { id: number; username: string; displayName: string }[];
  currentUser?: { id: number; displayName: string };
  onLoadInspections?: (stationId: number) => void;
  onCreateInspection?: (input: {
    stationId: number; inspectedOn: string; helperUserIds: number[]; notes?: string;
  }) => Promise<void>;
  isMobile?: boolean;
  showStationIndex?: { current: number; total: number };
}

export default function StationCard({
  station,
  onUpdateStation,
  inspectionHistory,
  inspectors,
  currentUser,
  onLoadInspections,
  onCreateInspection,
  isMobile = false,
  showStationIndex,
}: StationCardProps) {
  const [loadingOnAir, setLoadingOnAir] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    onLoadInspections?.(Number(station.id));
  }, [station.id, onLoadInspections]);

  const handleOnAirToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUpdateStation || loadingOnAir) return;
    setLoadingOnAir(true);
    try {
      await onUpdateStation(station.id, { onAir: !station.onAir });
      await new Promise(resolve => setTimeout(resolve, isMobile ? 300 : 500));
    } finally {
      setLoadingOnAir(false);
    }
  };

  const handleDetailsToggle = async (e: React.MouseEvent, hashtag: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUpdateStation || loadingDetails) return;
    setLoadingDetails(true);
    try {
      const newDetails = station.details === hashtag ? '' : hashtag;
      await onUpdateStation(station.id, { details: newDetails });
    } finally {
      setLoadingDetails(false);
    }
  };

  const isLoading = loadingOnAir || loadingDetails;
  const borderClass = isMobile ? 'border rounded-lg p-3 bg-muted/20 hover:bg-muted/30 transition-colors' : '';
  const containerStyle = isMobile ? {
    contain: 'layout style' as const,
    transform: 'translateZ(0)',
    touchAction: 'manipulation' as const,
    height: 'auto',
    overflow: 'visible' as const,
    pointerEvents: 'auto' as const,
  } : {};

  return (
    <div className={borderClass} style={containerStyle}>
      {showStationIndex && !isMobile && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
            Station {showStationIndex.current} of {showStationIndex.total}
          </span>
        </div>
      )}

      {/* Station Header */}
      <div className="flex items-start gap-2 mb-2">
        {!isMobile && (
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className={`font-semibold text-sm text-card-foreground ${isMobile ? 'break-words' : 'leading-tight break-words'}`}>
            {station.name}
          </h4>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded bg-primary/20 text-primary text-xs ${isMobile ? 'font-bold' : 'font-medium'}`}>
              {station.frequency} FM
            </span>
            <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
              {station.genre}
            </span>
            {(station.type === 'สถานีหลัก' || station.genre === 'สถานีหลัก') && (
              <span className={`inline-flex items-center gap-${isMobile ? '0.5' : '1'} px-${isMobile ? '1.5' : '2'} py-${isMobile ? '0.5' : '1'} rounded${isMobile ? '' : '-lg'} badge-info text-xs font-medium`}>
                <span>★</span>
                <span>Main</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* On Air Status Row */}
      <div className={`flex items-center justify-between gap-2 p-2 ${isMobile ? 'bg-muted/30 rounded border' : 'bg-muted/20 rounded-lg border'} border-border/50 mb-2`}>
        <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium ${
          station.onAir ? 'badge-success' : 'badge-error'
        }`}>
          <div className={`w-${isMobile ? '1.5' : '2'} h-${isMobile ? '1.5' : '2'} rounded-full`} style={{ background: station.onAir ? 'var(--syntax-green)' : 'var(--syntax-red)' }} />
          {station.onAir ? 'On Air' : 'Off Air'}
        </span>
        {onUpdateStation && (
          station.submitRequest === 'ไม่ยื่น' && !station.onAir ? (
            <span className={`px-3 py-1.5 text-xs rounded${isMobile ? '' : '-md'} font-medium text-muted-foreground bg-muted`}>
              ไม่ยื่นคำขอ
            </span>
          ) : (
            <button
              onClick={handleOnAirToggle}
              disabled={loadingOnAir}
              className={`px-3 py-1.5 text-xs rounded${isMobile ? '' : '-md'} font-medium whitespace-nowrap transition-all duration-200 ${
                loadingOnAir
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
              aria-label={`Toggle ${station.name} broadcast status`}
            >
              {loadingOnAir ? (
                <LoadingSpinner size="sm" text={isMobile ? 'Save...' : 'Saving...'} />
              ) : (
                station.onAir ? 'Set Off' : 'Set On'
              )}
            </button>
          )
        )}
      </div>

      {/* Inspection Panel */}
      {onCreateInspection && currentUser && inspectors && (
        <InspectionPanel
          stationId={Number(station.id)}
          history={inspectionHistory ?? []}
          currentUser={currentUser}
          inspectors={inspectors}
          onCreate={onCreateInspection}
        />
      )}

      {/* Hashtag Details */}
      {onUpdateStation && (
        <div className={`mt-2 pt-2 border-t border-border/${isMobile ? '30' : '50'}`}>
          <div className={`mb-${isMobile ? '1.5' : '2'}`}>
            <label className="text-xs font-medium text-foreground">{isMobile ? 'Details:' : 'Station Details:'}</label>
          </div>
          <div className={`flex flex-wrap gap-${isMobile ? '1.5' : '2'}`}>
            <button
              onClick={(e) => handleDetailsToggle(e, '#deviation')}
              disabled={isLoading}
              className={`px-3 py-1.5 text-xs rounded${isMobile ? '' : '-md'} font-medium transition-all duration-200 ${
                station.details === '#deviation'
                  ? 'badge-error'
                  : 'bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loadingDetails ? '...' : '#deviation'}
            </button>
            <button
              onClick={(e) => handleDetailsToggle(e, '#intermod')}
              disabled={isLoading}
              className={`px-3 py-1.5 text-xs rounded${isMobile ? '' : '-md'} font-medium transition-all duration-200 ${
                station.details === '#intermod'
                  ? 'badge-peach'
                  : 'bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loadingDetails ? '...' : '#intermod'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
