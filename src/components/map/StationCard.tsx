'use client';

import { useState } from 'react';
import { FMStation } from '@/types/station';
import { formatInspectionDate } from '@/utils/mapHelpers';
import LoadingSpinner from './LoadingSpinner';

interface StationCardProps {
  station: FMStation;
  onUpdateStation?: (stationId: string | number, updates: Partial<FMStation>) => void;
  isMobile?: boolean;
  showStationIndex?: { current: number; total: number };
}

export default function StationCard({
  station,
  onUpdateStation,
  isMobile = false,
  showStationIndex,
}: StationCardProps) {
  const [loadingOnAir, setLoadingOnAir] = useState(false);
  const [loadingInspection69, setLoadingInspection69] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

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

  const handleInspection69Toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onUpdateStation || loadingInspection69) return;
    setLoadingInspection69(true);
    try {
      const newStatus = station.inspection69 === 'ตรวจแล้ว' ? 'ยังไม่ตรวจ' : 'ตรวจแล้ว';
      await onUpdateStation(station.id, { inspection69: newStatus });
      await new Promise(resolve => setTimeout(resolve, isMobile ? 300 : 500));
    } finally {
      setLoadingInspection69(false);
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

  const isLoading = loadingOnAir || loadingInspection69 || loadingDetails;
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

      {/* Inspection Status Row */}
      <div className={`flex items-center justify-between gap-2 p-2 ${isMobile ? 'bg-muted/30 rounded border' : 'bg-muted/20 rounded-lg border'} border-border/50 mb-${isMobile ? '2' : '3'}`}>
        <span className={`inline-flex items-center gap-${isMobile ? '1' : '2'} px-2 py-1 rounded-md text-xs font-medium ${
          station.inspection69 === 'ตรวจแล้ว' ? 'badge-success' : 'badge-warning'
        }`}>
          {station.inspection69 === 'ตรวจแล้ว' ? '✅' : '⏳'}
          <span className={`break-words ${isMobile ? 'text-xs' : ''}`}>{station.inspection69 || 'ยังไม่ตรวจ'}</span>
        </span>
        {onUpdateStation && (
          <button
            onClick={handleInspection69Toggle}
            disabled={loadingInspection69}
            className={`px-3 py-1.5 text-xs rounded${isMobile ? '' : '-md'} font-medium whitespace-nowrap transition-all duration-200 ${
              loadingInspection69
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
            aria-label={`Toggle ${station.name} inspection status`}
          >
            {loadingInspection69 ? (
              <LoadingSpinner size="sm" text={isMobile ? 'Save...' : 'Saving...'} />
            ) : (
              station.inspection69 === 'ตรวจแล้ว' ? 'Inspected' : 'Inspect'
            )}
          </button>
        )}
      </div>

      {/* Inspection Date */}
      {station.dateInspected && (
        <div className={`flex items-center gap-2 text-xs ${isMobile ? '' : 'sm:text-sm'} text-muted-foreground ${isMobile ? 'bg-muted/30 p-2 rounded border' : 'bg-muted/20 p-2 rounded-lg border'} border-border/50 mb-${isMobile ? '2' : '3'}`}>
          <svg className={`w-3 h-3 ${isMobile ? '' : 'sm:w-4 sm:h-4'} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Inspected: {formatInspectionDate(station.dateInspected)}</span>
        </div>
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
