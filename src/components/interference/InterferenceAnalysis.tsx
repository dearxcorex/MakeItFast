'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { InterferenceSite, InterferenceFilter, PropagationOverlay } from '@/types/interference';
import type { UserLocation } from '@/types/station';
import { validateBearing } from '@/utils/bearingUtils';
import InterferenceFilterPanel from './InterferenceFilterPanel';
import InterferenceSiteDetail from './InterferenceSiteDetail';
import CloudRFControls from './CloudRFControls';

const InterferenceMap = dynamic(() => import('./MapLibreMap'), { ssr: false });

export interface InterferenceStats {
  total: number;
  inspected: number;
  pending: number;
  critical: number;
  major: number;
  minor: number;
}

interface InterferenceAnalysisProps {
  userLocation?: UserLocation;
  onStatsChange?: (stats: InterferenceStats) => void;
}

export default function InterferenceAnalysis({ userLocation, onStatsChange }: InterferenceAnalysisProps) {
  const [sites, setSites] = useState<InterferenceSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<InterferenceSite | null>(null);
  const [filters, setFilters] = useState<InterferenceFilter>({});
  const [propagationOverlays, setPropagationOverlays] = useState<PropagationOverlay[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [flyToSite, setFlyToSite] = useState<{ lat: number; lng: number; timestamp: number } | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const fetchSites = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.changwat) params.set('changwat', filters.changwat);
      if (filters.ranking) params.set('ranking', filters.ranking);
      if (filters.mcZone) params.set('mcZone', filters.mcZone);
      if (filters.nbtcArea) params.set('nbtcArea', filters.nbtcArea);
      if (filters.hasSource) params.set('hasSource', 'true');
      if (filters.search) params.set('search', filters.search);
      if (filters.status) params.set('status', filters.status);
      if (filters.lawPaperSent) params.set('lawPaperSent', filters.lawPaperSent);

      const res = await fetch(`/api/interference?${params.toString()}`);
      const data = await res.json();
      setSites(data.sites || []);
    } catch (error) {
      console.error('Failed to fetch interference sites:', error);
    }
  }, [filters]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  // Report stats to parent
  useEffect(() => {
    if (onStatsChange) {
      onStatsChange({
        total: sites.length,
        inspected: sites.filter(s => s.status === 'ตรวจแล้ว').length,
        pending: sites.filter(s => s.status !== 'ตรวจแล้ว').length,
        critical: sites.filter(s => s.ranking?.toLowerCase() === 'critical').length,
        major: sites.filter(s => s.ranking?.toLowerCase() === 'major').length,
        minor: sites.filter(s => s.ranking?.toLowerCase() === 'minor').length,
      });
    }
  }, [sites, onStatsChange]);

  // Direction validation stats and client-side filtering
  const directionStats = useMemo(() => {
    let match = 0;
    let mismatch = 0;
    for (const site of sites) {
      const v = validateBearing(site);
      if (v) {
        if (v.isMatch) match++;
        else mismatch++;
      }
    }
    return { total: match + mismatch, match, mismatch };
  }, [sites]);

  const displaySites = useMemo(() => {
    if (!filters.directionMatch) return sites;
    return sites.filter((site) => {
      const v = validateBearing(site);
      if (!v) return false; // skip sites without enough data
      return filters.directionMatch === 'match' ? v.isMatch : !v.isMatch;
    });
  }, [sites, filters.directionMatch]);

  const handleSiteSelect = useCallback((site: InterferenceSite) => {
    setSelectedSite(site);
    setShowDetail(true);
    if (site.lat && site.long) {
      setFlyToSite({ lat: site.lat, lng: site.long, timestamp: Date.now() });
    }
  }, []);

  const handlePropagationResult = useCallback((overlay: PropagationOverlay) => {
    setPropagationOverlays((prev) => {
      const filtered = prev.filter((o) => o.siteId !== overlay.siteId);
      return [...filtered, overlay];
    });
  }, []);

  const handleClearOverlays = useCallback(() => {
    setPropagationOverlays([]);
  }, []);

  const handleUpdateSite = useCallback(async (siteId: number, updates: { status?: string; lawPaperSent?: boolean }) => {
    // Optimistic update
    setSites((prev) =>
      prev.map((s) => (s.id === siteId ? { ...s, ...updates } : s))
    );
    if (selectedSite?.id === siteId) {
      setSelectedSite((prev) => (prev ? { ...prev, ...updates } : prev));
    }

    try {
      const res = await fetch(`/api/interference/${siteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        // Revert on failure
        fetchSites();
      }
    } catch {
      fetchSites();
    }
  }, [selectedSite, fetchSites]);

  const inspectedCount = sites.filter(s => s.status === 'ตรวจแล้ว').length;
  const criticalCount = sites.filter(s => s.ranking?.toLowerCase() === 'critical').length;
  const lawPaperSentCount = sites.filter(s => s.lawPaperSent === true).length;

  return (
    <div className="interference-theme flex-1 flex flex-col min-h-0">
      {/* Summary Bar */}
      <div className="if-summary-bar">
        <div className="if-summary-item">
          <span>Sites</span>
          <span className="if-summary-value">{sites.length}</span>
        </div>
        <div className="if-summary-item">
          <span className="if-summary-dot" style={{ background: 'var(--if-success)' }} />
          <span className="if-summary-value" style={{ color: 'var(--if-success)' }}>{inspectedCount}</span>
          <span>inspected</span>
        </div>
        <div className="if-summary-item">
          <span className="if-summary-dot" style={{ background: 'var(--if-critical)' }} />
          <span className="if-summary-value" style={{ color: 'var(--if-critical)' }}>{criticalCount}</span>
          <span>critical</span>
        </div>
        <div className="if-summary-item">
          <span className="if-summary-dot" style={{ background: 'var(--if-warning)' }} />
          <span className="if-summary-value" style={{ color: 'var(--if-warning)' }}>{lawPaperSentCount}</span>
          <span>sent</span>
        </div>
        {activeFilterCount > 0 && (
          <div className="if-summary-item">
            <span
              data-testid="filter-count-badge"
              className="if-badge"
              style={{ background: 'var(--if-accent-muted)', color: 'var(--if-accent)' }}
            >
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left Panel — Compact Filter Sidebar */}
        <div className="w-full lg:w-72 flex flex-col min-h-0 flex-shrink-0 lg:flex-shrink-0 if-panel">
          <button
            type="button"
            data-testid="filter-toggle"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className="flex items-center justify-between w-full lg:hidden mb-2"
          >
            <span className="if-panel-heading" style={{ marginBottom: 0 }}>Filters</span>
            <svg
              className={`w-4 h-4 transition-transform ${mobileFiltersOpen ? 'rotate-180' : ''}`}
              style={{ color: 'var(--if-text-tertiary)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Desktop: detail panel inline */}
          {showDetail && selectedSite ? (
            <div className="hidden lg:flex flex-1 min-h-0 flex-col gap-2">
              <button
                onClick={() => setShowDetail(false)}
                className="text-xs flex items-center gap-1 mb-1"
                style={{ color: 'var(--if-text-tertiary)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to filters
              </button>
              <div className="flex-1 overflow-y-auto space-y-3 scrollbar-stable">
                <InterferenceSiteDetail site={selectedSite} onUpdateSite={handleUpdateSite} />
                <CloudRFControls
                  site={selectedSite}
                  onResult={handlePropagationResult}
                  onClearOverlays={handleClearOverlays}
                  overlayCount={propagationOverlays.length}
                />
              </div>
            </div>
          ) : (
            <div
              id="filter-panel-wrapper"
              data-testid="filter-panel-wrapper"
              className={`${mobileFiltersOpen ? 'block max-h-[55vh] overflow-y-auto' : 'hidden'} lg:block lg:max-h-none lg:overflow-visible`}
            >
              <InterferenceFilterPanel filters={filters} onFiltersChange={setFilters} directionStats={directionStats} onRefreshSites={fetchSites} />
            </div>
          )}
        </div>

        {/* Right Panel — Map (dominant) */}
        <div className="flex-1 relative min-h-[300px]">
          <div className="absolute inset-0">
            <InterferenceMap
              sites={displaySites}
              selectedSite={selectedSite}
              onSiteSelect={handleSiteSelect}
              propagationOverlays={propagationOverlays}
              flyToSite={flyToSite}
              userLocation={userLocation}
            />
          </div>

          {/* Mobile: bottom sheet overlay on top of map */}
          {showDetail && selectedSite && (
            <div className="lg:hidden absolute inset-x-0 bottom-0 z-[1000] max-h-[60vh] flex flex-col"
              style={{ background: 'var(--if-surface)', boxShadow: '0 -4px 24px rgba(0,0,0,0.5)' }}
            >
              {/* Header bar */}
              <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--if-border)' }}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {selectedSite.ranking && (
                    <span className={`if-badge ${
                      selectedSite.ranking.toLowerCase() === 'critical' ? 'if-badge-critical' :
                      selectedSite.ranking.toLowerCase() === 'major' ? 'if-badge-major' : 'if-badge-minor'
                    }`}>
                      {selectedSite.ranking}
                    </span>
                  )}
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--if-text-primary)', fontFamily: "'Prompt', system-ui" }}>
                    {selectedSite.siteName || selectedSite.siteCode || `Site #${selectedSite.id}`}
                  </span>
                </div>
                <button
                  onClick={() => setShowDetail(false)}
                  className="p-2 rounded-md transition-colors flex-shrink-0"
                  style={{ color: 'var(--if-text-tertiary)', background: 'var(--if-surface-elevated)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <InterferenceSiteDetail site={selectedSite} onUpdateSite={handleUpdateSite} />
                <CloudRFControls
                  site={selectedSite}
                  onResult={handlePropagationResult}
                  onClearOverlays={handleClearOverlays}
                  overlayCount={propagationOverlays.length}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
