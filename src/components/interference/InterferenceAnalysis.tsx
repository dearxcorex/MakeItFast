'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { InterferenceSite, InterferenceFilter, PropagationOverlay } from '@/types/interference';
import InterferenceFilterPanel from './InterferenceFilterPanel';
import InterferenceSiteList from './InterferenceSiteList';
import InterferenceSiteDetail from './InterferenceSiteDetail';
import CloudRFControls from './CloudRFControls';
import ImportDialog from './ImportDialog';

const InterferenceMap = dynamic(() => import('./InterferenceMap'), { ssr: false });

export default function InterferenceAnalysis() {
  const [sites, setSites] = useState<InterferenceSite[]>([]);
  const [selectedSite, setSelectedSite] = useState<InterferenceSite | null>(null);
  const [filters, setFilters] = useState<InterferenceFilter>({});
  const [propagationOverlays, setPropagationOverlays] = useState<PropagationOverlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [flyToSite, setFlyToSite] = useState<{ lat: number; lng: number; timestamp: number } | null>(null);
  const [multisiteLoading, setMultisiteLoading] = useState(false);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.changwat) params.set('changwat', filters.changwat);
      if (filters.ranking) params.set('ranking', filters.ranking);
      if (filters.mcZone) params.set('mcZone', filters.mcZone);
      if (filters.nbtcArea) params.set('nbtcArea', filters.nbtcArea);
      if (filters.hasSource) params.set('hasSource', 'true');
      if (filters.search) params.set('search', filters.search);

      const res = await fetch(`/api/interference?${params.toString()}`);
      const data = await res.json();
      setSites(data.sites || []);
    } catch (error) {
      console.error('Failed to fetch interference sites:', error);
    } finally {
      setLoading(false);
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

  const handleImportComplete = useCallback(() => {
    setShowImport(false);
    fetchSites();
  }, [fetchSites]);

  const handleMultisiteAnalysis = useCallback(async () => {
    const sitesWithCoords = sites.filter((s) => s.lat && s.long);
    if (sitesWithCoords.length === 0) return;

    // Limit to first 20 sites
    const selectedSites = sitesWithCoords.slice(0, 20).map((s) => ({
      lat: s.lat!,
      lon: s.long!,
      azi: s.direction ?? 0,
    }));

    setMultisiteLoading(true);
    try {
      const res = await fetch('/api/cloudrf/multisite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites: selectedSites }),
      });
      const data = await res.json();
      if (res.ok && data.pngUrl && data.bounds) {
        setPropagationOverlays((prev) => [
          ...prev,
          { siteId: -1, pngUrl: data.pngUrl, leafletBounds: data.bounds },
        ]);
      }
    } catch (error) {
      console.error('Multisite analysis failed:', error);
    } finally {
      setMultisiteLoading(false);
    }
  }, [sites]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
      {/* Left Panel - Filters + List or Detail */}
      <div className="w-full lg:w-96 flex flex-col gap-3 min-h-0">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg gradient-text">Interference Analysis</h2>
          <div className="flex gap-2">
            <button
              onClick={handleMultisiteAnalysis}
              disabled={multisiteLoading || sites.filter((s) => s.lat && s.long).length === 0}
              className="px-3 py-1.5 text-xs rounded-lg bg-accent/20 text-accent-foreground hover:bg-accent/30 disabled:opacity-50 transition-colors"
            >
              {multisiteLoading ? 'Analyzing...' : 'Multi-Site'}
            </button>
            <button
              onClick={() => setShowImport(true)}
              className="px-3 py-1.5 text-xs rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
            >
              Import CSV
            </button>
          </div>
        </div>

        {showDetail && selectedSite ? (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <button
              onClick={() => setShowDetail(false)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to list
            </button>
            <InterferenceSiteDetail site={selectedSite} />
            <CloudRFControls
              site={selectedSite}
              onResult={handlePropagationResult}
              onClearOverlays={handleClearOverlays}
              overlayCount={propagationOverlays.length}
            />
          </div>
        ) : (
          <>
            <InterferenceFilterPanel filters={filters} onFiltersChange={setFilters} />
            <InterferenceSiteList
              sites={sites}
              selectedSite={selectedSite}
              onSiteSelect={handleSiteSelect}
              loading={loading}
            />
          </>
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
          />
        </div>
      </div>

      {/* Modals */}
      {showImport && (
        <ImportDialog onClose={() => setShowImport(false)} onImportComplete={handleImportComplete} />
      )}
    </div>
  );
}
