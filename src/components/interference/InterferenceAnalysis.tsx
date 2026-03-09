'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { InterferenceSite, InterferenceFilter, PropagationOverlay } from '@/types/interference';
import type { UserLocation } from '@/types/station';
import InterferenceFilterPanel from './InterferenceFilterPanel';
import InterferenceSiteDetail from './InterferenceSiteDetail';
import CloudRFControls from './CloudRFControls';

const InterferenceMap = dynamic(() => import('./InterferenceMap'), { ssr: false });

interface InterferenceAnalysisProps {
  userLocation?: UserLocation;
}

export default function InterferenceAnalysis({ userLocation }: InterferenceAnalysisProps) {
  const [sites, setSites] = useState<InterferenceSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<InterferenceSite | null>(null);
  const [filters, setFilters] = useState<InterferenceFilter>({});
  const [propagationOverlays, setPropagationOverlays] = useState<PropagationOverlay[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [flyToSite, setFlyToSite] = useState<{ lat: number; lng: number; timestamp: number } | null>(null);

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

  const handleUpdateSite = useCallback(async (siteId: number, updates: { status?: string }) => {
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

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
      {/* Left Panel - Filters + Stats (always visible) */}
      <div className="w-full lg:w-96 flex flex-col gap-3 min-h-0">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg gradient-text">Interference Analysis</h2>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl">
            <div className="text-center">
              <div className="text-lg font-bold text-primary">{sites.length}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Sites</div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 glass-card rounded-xl">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-green-400">
                {sites.filter(s => s.status === 'ตรวจแล้ว').length}
              </span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              <span className="text-sm font-bold text-amber-400">
                {sites.filter(s => s.status !== 'ตรวจแล้ว').length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 glass-card rounded-xl">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" title="Critical" />
            <span className="text-xs font-bold text-red-400">
              {sites.filter(s => s.ranking?.toLowerCase() === 'critical').length}
            </span>
            <div className="w-px h-4 bg-border mx-0.5" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" title="Major" />
            <span className="text-xs font-bold text-amber-400">
              {sites.filter(s => s.ranking?.toLowerCase() === 'major').length}
            </span>
            <div className="w-px h-4 bg-border mx-0.5" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" title="Minor" />
            <span className="text-xs font-bold text-yellow-400">
              {sites.filter(s => s.ranking?.toLowerCase() === 'minor').length}
            </span>
          </div>
        </div>

        {/* Desktop: detail panel inline */}
        {showDetail && selectedSite ? (
          <div className="hidden lg:flex flex-1 min-h-0 flex-col gap-3">
            <button
              onClick={() => setShowDetail(false)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <InterferenceFilterPanel filters={filters} onFiltersChange={setFilters} />
        )}
      </div>

      {/* Right Panel - Map */}
      <div className="flex-1 relative min-h-[400px]">
        <div className="absolute inset-0 rounded-2xl overflow-hidden glass-card">
          <InterferenceMap
            sites={sites}
            selectedSite={selectedSite}
            onSiteSelect={handleSiteSelect}
            propagationOverlays={propagationOverlays}
            flyToSite={flyToSite}
            userLocation={userLocation}
          />
        </div>

        {/* Mobile: bottom sheet overlay on top of map */}
        {showDetail && selectedSite && (
          <div className="lg:hidden absolute inset-x-0 bottom-0 z-[1000] max-h-[60vh] flex flex-col bg-background/95 backdrop-blur-md rounded-t-2xl shadow-2xl border-t border-border/50">
            {/* Drag handle + close */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-muted-foreground/30 rounded-full" />
                <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
                  {selectedSite.siteName || selectedSite.siteCode || `Site #${selectedSite.id}`}
                </span>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
  );
}
