'use client';

import { useState, useEffect } from 'react';
import type { InterferenceSite, PropagationOverlay, DeploymentType, EnvironmentConfig } from '@/types/interference';
import { EQUIPMENT_PROFILES, PROPAGATION_MODELS, THAILAND_ENVIRONMENT } from '@/utils/equipmentProfiles';

interface CloudRFControlsProps {
  site: InterferenceSite;
  onResult: (overlay: PropagationOverlay) => void;
  onClearOverlays?: () => void;
  overlayCount?: number;
}

export default function CloudRFControls({ site, onResult, onClearOverlays, overlayCount = 0 }: CloudRFControlsProps) {
  const [deploymentType, setDeploymentType] = useState<DeploymentType>('macro_urban');
  const [power, setPower] = useState(EQUIPMENT_PROFILES.macro_urban.txPower);
  const [height, setHeight] = useState(EQUIPMENT_PROFILES.macro_urban.antennaHeight);
  const [radius, setRadius] = useState(5);
  const [azimuth, setAzimuth] = useState(site.direction ?? 0);
  const [antennaGain, setAntennaGain] = useState(EQUIPMENT_PROFILES.macro_urban.antennaGain);
  const [downtilt, setDowntilt] = useState(EQUIPMENT_PROFILES.macro_urban.downtilt);
  const [propagationModel, setPropagationModel] = useState(THAILAND_ENVIRONMENT.propagationModel);
  const [clutterEnabled, setClutterEnabled] = useState(true);
  const [buildingsEnabled, setBuildingsEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pathLoading, setPathLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathError, setPathError] = useState<string | null>(null);
  const [pathResult, setPathResult] = useState<{ pathLoss: number; signalLevel: number; distance: number } | null>(null);

  // Auto-fill params when deployment type changes
  useEffect(() => {
    const profile = EQUIPMENT_PROFILES[deploymentType];
    setPower(profile.txPower);
    setHeight(profile.antennaHeight);
    setAntennaGain(profile.antennaGain);
    setDowntilt(profile.downtilt);
  }, [deploymentType]);

  const getEnvironmentOverrides = (): Partial<EnvironmentConfig> | undefined => {
    const overrides: Partial<EnvironmentConfig> = {};
    if (propagationModel !== THAILAND_ENVIRONMENT.propagationModel) overrides.propagationModel = propagationModel;
    if (!clutterEnabled) overrides.landcover = 0;
    if (!buildingsEnabled) overrides.buildings = 0;
    return Object.keys(overrides).length > 0 ? overrides : undefined;
  };

  const handleCalculate = async (aziOverride?: number) => {
    if (!site.lat || !site.long) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cloudrf/area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: site.id,
          lat: site.lat,
          lon: site.long,
          alt: height,
          txw: power,
          azi: aziOverride ?? azimuth,
          rad: radius,
          profile: deploymentType,
          antennaGain,
          downtilt,
          bandwidth: EQUIPMENT_PROFILES[deploymentType].bandwidth,
          environment: getEnvironmentOverrides(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `API error: ${res.status}`);
        return;
      }
      if (data.pngUrl && data.bounds) {
        onResult({ siteId: site.id, pngUrl: data.pngUrl, leafletBounds: data.bounds });
      } else {
        setError('No coverage data returned. The site may be outside CloudRF coverage area.');
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePathAnalysis = async () => {
    if (!site.lat || !site.long || !site.sourceLat || !site.sourceLong) return;
    setPathLoading(true);
    setPathError(null);
    try {
      const res = await fetch('/api/cloudrf/path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromLat: site.lat,
          fromLon: site.long,
          toLat: site.sourceLat,
          toLon: site.sourceLong,
          profile: deploymentType,
          alt: height,
          txw: power,
          environment: getEnvironmentOverrides(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPathError(data.error || `API error: ${res.status}`);
        return;
      }
      setPathResult({
        pathLoss: data.pathLoss,
        signalLevel: data.signalLevel,
        distance: data.distance,
      });
    } catch (err) {
      setPathError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPathLoading(false);
    }
  };

  return (
    <div className="glass-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          CloudRF Analysis
        </div>
        {overlayCount > 0 && onClearOverlays && (
          <button
            onClick={onClearOverlays}
            className="text-[10px] text-destructive hover:text-destructive/80 transition-colors"
          >
            Clear {overlayCount} overlay{overlayCount > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Deployment type selector */}
      <div>
        <label className="text-[10px] text-muted-foreground">Deployment Type</label>
        <select
          value={deploymentType}
          onChange={(e) => setDeploymentType(e.target.value as DeploymentType)}
          className="w-full px-2 py-1 rounded bg-input text-foreground text-xs border border-border/50"
        >
          <option value="macro_urban">Macro Urban (30m, 20W, 17dBi)</option>
          <option value="macro_suburban">Macro Suburban (45m, 20W, 18dBi)</option>
          <option value="macro_rural">Macro Rural (55m, 40W, 18dBi)</option>
        </select>
      </div>

      {/* Parameter overrides */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground">Power (W)</label>
          <input
            type="number"
            value={power}
            onChange={(e) => setPower(Number(e.target.value))}
            className="w-full px-2 py-1 rounded bg-input text-foreground text-xs border border-border/50"
            min={0.001}
            max={200}
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Height (m)</label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="w-full px-2 py-1 rounded bg-input text-foreground text-xs border border-border/50"
            min={1}
            max={200}
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Radius (km)</label>
          <input
            type="number"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full px-2 py-1 rounded bg-input text-foreground text-xs border border-border/50"
            min={0.1}
            max={100}
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Azimuth ({azimuth}°)</label>
          <input
            type="range"
            value={azimuth}
            onChange={(e) => setAzimuth(Number(e.target.value))}
            className="w-full h-6"
            min={0}
            max={360}
            step={1}
          />
        </div>
      </div>

      {/* Advanced Settings */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        <svg className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Advanced Settings
      </button>
      {showAdvanced && (
        <div className="space-y-2 p-2 rounded-lg bg-muted/30 border border-border/30">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Antenna Gain (dBi)</label>
              <input
                type="number"
                value={antennaGain}
                onChange={(e) => setAntennaGain(Number(e.target.value))}
                className="w-full px-2 py-1 rounded bg-input text-foreground text-xs border border-border/50"
                min={0}
                max={30}
                step={0.5}
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Downtilt ({downtilt}°)</label>
              <input
                type="range"
                value={downtilt}
                onChange={(e) => setDowntilt(Number(e.target.value))}
                className="w-full h-6"
                min={0}
                max={15}
                step={0.5}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Propagation Model</label>
            <select
              value={propagationModel}
              onChange={(e) => setPropagationModel(Number(e.target.value))}
              className="w-full px-2 py-1 rounded bg-input text-foreground text-xs border border-border/50"
            >
              {Object.entries(PROPAGATION_MODELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={clutterEnabled}
                onChange={(e) => setClutterEnabled(e.target.checked)}
                className="rounded border-border/50"
              />
              Clutter/Landcover
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={buildingsEnabled}
                onChange={(e) => setBuildingsEnabled(e.target.checked)}
                className="rounded border-border/50"
              />
              Buildings
            </label>
          </div>
        </div>
      )}

      {/* Scan Direction hint for sites without source */}
      {site.direction != null && !site.sourceLat && !site.sourceLong && (
        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
          <div className="font-medium mb-1">No known source location</div>
          <div className="text-muted-foreground">
            Run propagation along antenna direction ({site.direction}°) to identify potential interference sources.
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleCalculate()}
          disabled={loading || !site.lat || !site.long}
          className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Calculating...' : 'Run Propagation'}
        </button>
        {site.direction != null && !site.sourceLat && !site.sourceLong && (
          <button
            onClick={() => {
              setAzimuth(site.direction!); // sync slider UI only
              handleCalculate(site.direction!); // uses aziOverride, not stale state
            }}
            disabled={loading || !site.lat || !site.long}
            className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Scanning...' : 'Scan Direction'}
          </button>
        )}
        {site.sourceLat && site.sourceLong && (
          <button
            onClick={handlePathAnalysis}
            disabled={pathLoading}
            className="flex-1 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {pathLoading ? 'Analyzing...' : 'Point-to-Point'}
          </button>
        )}
      </div>

      {/* Error messages */}
      {error && (
        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          {error}
        </div>
      )}
      {pathError && (
        <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          {pathError}
        </div>
      )}

      {/* Path result */}
      {pathResult && (
        <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-xs">
          <div className="font-medium text-accent mb-1">Path Analysis Result</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="font-bold text-foreground">{pathResult.pathLoss?.toFixed(1) ?? 'N/A'}</div>
              <div className="text-muted-foreground">Path Loss (dB)</div>
            </div>
            <div>
              <div className="font-bold text-foreground">{pathResult.signalLevel?.toFixed(1) ?? 'N/A'}</div>
              <div className="text-muted-foreground">Signal (dBm)</div>
            </div>
            <div>
              <div className="font-bold text-foreground">{pathResult.distance?.toFixed(2) ?? 'N/A'}</div>
              <div className="text-muted-foreground">Dist. (km)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
