'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { InterferenceSite, PropagationOverlay } from '@/types/interference';
import type { UserLocation } from '@/types/station';
import { createSectorSVG, siteToSectors, groupSiteSectors, getRankingColor } from '@/utils/sectorMarkers';
import { calculateEndpoint, validateBearing } from '@/utils/bearingUtils';

interface MapLibreMapProps {
  sites: InterferenceSite[];
  selectedSite: InterferenceSite | null;
  onSiteSelect: (site: InterferenceSite) => void;
  propagationOverlays: PropagationOverlay[];
  flyToSite: { lat: number; lng: number; timestamp: number } | null;
  userLocation?: UserLocation;
}

const SIGNAL_SCALE = [
  { color: '#ff0000', label: '-50', desc: 'Excellent' },
  { color: '#ff5500', label: '-60' },
  { color: '#ff8800', label: '-70', desc: 'Good' },
  { color: '#ffcc00', label: '-80' },
  { color: '#ffff00', label: '-85', desc: 'Fair' },
  { color: '#88ff00', label: '-90' },
  { color: '#00ff00', label: '-95', desc: 'Weak' },
  { color: '#00ffaa', label: '-100' },
  { color: '#00ccff', label: '-105', desc: 'Very Weak' },
  { color: '#0066ff', label: '-110' },
  { color: '#0000ff', label: '-115', desc: 'No Signal' },
];

function SignalLegend() {
  return (
    <div className="absolute bottom-6 right-3 z-[10] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-lg px-2.5 py-2 pointer-events-auto">
      <div className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5 text-center">
        Signal (dBm)
      </div>
      <div className="flex flex-col gap-px">
        {SIGNAL_SCALE.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div
              className="w-5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-[9px] font-mono text-gray-600 dark:text-gray-300 w-7 text-right">
              {s.label}
            </span>
            {s.desc && (
              <span className="text-[8px] text-gray-400 dark:text-gray-500">
                {s.desc}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MapLibreMap({
  sites,
  selectedSite,
  onSiteSelect,
  propagationOverlays,
  flyToSite,
  userLocation,
}: MapLibreMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastFlyTimestamp = useRef<number>(0);
  const overlayIdsRef = useRef<Set<string>>(new Set());

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [103.5, 15.0], // [lng, lat] for Thailand
      zoom: 7,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update site markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Scale markers based on zoom level
    const getMarkerScale = (zoom: number): number => {
      if (zoom >= 10) return 1;
      if (zoom >= 9) return 0.85;
      if (zoom >= 8) return 0.7;
      if (zoom >= 7) return 0.55;
      if (zoom >= 6) return 0.45;
      return 0.35;
    };

    const applyZoomScale = () => {
      const zoom = map.getZoom();
      const scale = getMarkerScale(zoom);
      // Scale the inner wrapper, not the marker element itself (MapLibre controls its transform)
      markersRef.current.forEach((marker) => {
        const inner = marker.getElement().querySelector('[data-marker-inner]') as HTMLElement | null;
        if (inner) {
          inner.style.transform = `scale(${scale})`;
        }
      });
    };

    map.on('zoom', applyZoomScale);

    // Wait for map to load
    const update = () => {
      const existingKeys = new Set(markersRef.current.keys());
      const newKeys = new Set<string>();

      // Group sites by site_code to show multi-sector icons
      const siteGroups = groupSiteSectors(sites);

      for (const [siteCode, group] of siteGroups) {
        const primarySite = group.sites[0];
        if (!primarySite.lat || !primarySite.long) continue;

        const key = `tower-${siteCode}`;
        newKeys.add(key);

        const isSelected = group.sites.some(s => s.id === selectedSite?.id);
        const isInspected = primarySite.status === 'ตรวจแล้ว';
        const isLawPaperSent = primarySite.lawPaperSent === true;
        const rankColor = getRankingColor(primarySite.ranking);

        // Determine sectors to display
        const sectors = group.sectors.length > 0 ? group.sectors : siteToSectors(primarySite.direction);

        // Create or update marker — content wrapped in inner div for zoom scaling
        let marker = markersRef.current.get(key);
        const el = document.createElement('div');
        el.style.cursor = 'pointer';

        const inner = document.createElement('div');
        inner.setAttribute('data-marker-inner', '');
        inner.style.transition = 'transform 0.15s ease-out';
        inner.style.transformOrigin = 'center center';

        if (sectors.length > 0) {
          const size = isSelected ? 56 : 48;
          inner.innerHTML = createSectorSVG(sectors, size, {
            isSelected,
            isInspected,
            rankingColor: rankColor,
            lawPaperSent: isLawPaperSent,
          });
          inner.style.width = `${size}px`;
          inner.style.height = `${size}px`;
        } else {
          const size = isSelected ? 32 : 24;
          const bgColor = isInspected ? '#22c55e' : rankColor;
          const borderColor = isInspected ? '#16a34a' : 'white';
          const shadow = isInspected
            ? '0 2px 6px rgba(0,0,0,0.3), 0 0 6px rgba(34,197,94,0.5)'
            : `0 2px 6px rgba(0,0,0,0.3)${isSelected ? `, 0 0 8px ${rankColor}` : ''}`;
          inner.innerHTML = `
            <div style="
              width: ${size}px; height: ${size}px;
              background: ${bgColor};
              border: 2.5px solid ${borderColor};
              border-radius: 50%;
              box-shadow: ${shadow};
              display: flex; align-items: center; justify-content: center;
            ">
              ${isInspected
                ? `<svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6 l2.5 2.5 4.5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>`
                : ''}
            </div>
            ${isLawPaperSent ? `<div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;background:#F59E0B;border:1.5px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;">
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M1 3l5 4 5-4M1 3v6h10V3" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>` : ''}
          `;
          inner.style.position = 'relative';
          inner.style.width = `${size}px`;
          inner.style.height = `${size}px`;
        }

        el.appendChild(inner);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSiteSelect(primarySite);
        });

        if (marker) {
          // Update existing marker element
          marker.getElement().replaceWith(el);
          marker = new maplibregl.Marker({ element: el })
            .setLngLat([primarySite.long, primarySite.lat]);
          markersRef.current.set(key, marker);
          marker.addTo(map);
        } else {
          marker = new maplibregl.Marker({ element: el })
            .setLngLat([primarySite.long, primarySite.lat])
            .addTo(map);
          markersRef.current.set(key, marker);
        }
      }

      // Add source markers and connection lines
      const sourceLineFeatures: GeoJSON.Feature[] = [];
      const directionLineFeatures: GeoJSON.Feature[] = [];

      for (const site of sites) {
        if (site.sourceLat && site.sourceLong && site.lat && site.long) {
          const srcKey = `source-${site.id}`;
          newKeys.add(srcKey);

          let srcMarker = markersRef.current.get(srcKey);
          if (!srcMarker) {
            const srcEl = document.createElement('div');
            srcEl.style.width = '20px';
            srcEl.style.height = '20px';
            srcEl.innerHTML = `
              <div style="
                width: 16px; height: 16px;
                background: #DC2626;
                border: 2px solid white;
                border-radius: 3px;
                transform: rotate(45deg);
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              "></div>
            `;
            srcEl.style.cursor = 'pointer';

            // Add popup for source marker
            const popup = new maplibregl.Popup({ offset: 14, closeButton: true, maxWidth: '250px' })
              .setHTML(`
                <div style="font-size:12px">
                  <div style="font-weight:600;color:#ef4444;margin-bottom:4px">Interference Source</div>
                  <div style="color:#666">
                    <div>For: ${site.siteName || site.siteCode || ''}</div>
                    ${site.sourceLocation1 ? `<div>${site.sourceLocation1}</div>` : ''}
                    ${site.sourceLocation2 ? `<div>${site.sourceLocation2}</div>` : ''}
                    ${site.estimateDistance != null ? `<div>Distance: ${site.estimateDistance.toFixed(2)} km</div>` : ''}
                  </div>
                </div>
              `);

            srcMarker = new maplibregl.Marker({ element: srcEl })
              .setLngLat([site.sourceLong, site.sourceLat])
              .setPopup(popup)
              .addTo(map);
            markersRef.current.set(srcKey, srcMarker);
          }

          // Connection line
          sourceLineFeatures.push({
            type: 'Feature',
            properties: { color: getRankingColor(site.ranking) },
            geometry: {
              type: 'LineString',
              coordinates: [
                [site.long, site.lat],
                [site.sourceLong, site.sourceLat],
              ],
            },
          });
        }
      }

      // Direction arc for selected site
      if (selectedSite?.lat && selectedSite?.long && selectedSite.direction != null) {
        const arcLen = Math.max(selectedSite.estimateDistance ?? 3, 1);
        const endPoint = calculateEndpoint(selectedSite.lat, selectedSite.long, selectedSite.direction, arcLen);
        const validation = validateBearing(selectedSite);
        const arcColor = validation ? (validation.isMatch ? '#6366F1' : '#EF4444') : '#6366F1';

        directionLineFeatures.push({
          type: 'Feature',
          properties: { color: arcColor },
          geometry: {
            type: 'LineString',
            coordinates: [
              [selectedSite.long, selectedSite.lat],
              [endPoint[1], endPoint[0]], // bearingUtils returns [lat, lon], MapLibre needs [lon, lat]
            ],
          },
        });
      }

      // Update GeoJSON sources for lines
      updateGeoJSONSource(map, 'source-lines', sourceLineFeatures, {
        layerId: 'source-lines-layer',
        type: 'line',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-dasharray': [6, 4],
          'line-opacity': 0.7,
        },
      });

      updateGeoJSONSource(map, 'direction-lines', directionLineFeatures, {
        layerId: 'direction-lines-layer',
        type: 'line',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-dasharray': [8, 4],
          'line-opacity': 0.8,
        },
      });

      // Remove stale markers
      for (const key of existingKeys) {
        if (!newKeys.has(key)) {
          markersRef.current.get(key)?.remove();
          markersRef.current.delete(key);
        }
      }
    };

    if (map.loaded()) {
      update();
      applyZoomScale();
    } else {
      map.on('load', () => { update(); applyZoomScale(); });
    }

    return () => {
      map.off('zoom', applyZoomScale);
    };
  }, [sites, selectedSite, onSiteSelect]);

  // Propagation overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyOverlays = () => {
      // Remove old overlays
      for (const id of overlayIdsRef.current) {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      }
      overlayIdsRef.current.clear();

      // Add new overlays
      for (const overlay of propagationOverlays) {
        const sourceId = `propagation-${overlay.siteId}`;
        const layerId = `propagation-layer-${overlay.siteId}`;

        // leafletBounds is [[south, west], [north, east]]
        const [[south, west], [north, east]] = overlay.leafletBounds;

        map.addSource(sourceId, {
          type: 'image',
          url: overlay.pngUrl,
          coordinates: [
            [west, north], // top-left
            [east, north], // top-right
            [east, south], // bottom-right
            [west, south], // bottom-left
          ],
        });

        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': 0.6,
          },
        });

        overlayIdsRef.current.add(sourceId);
        overlayIdsRef.current.add(layerId);
      }
    };

    if (map.loaded()) {
      applyOverlays();
    } else {
      map.on('load', applyOverlays);
    }
  }, [propagationOverlays]);

  // Fly to site
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToSite || flyToSite.timestamp === lastFlyTimestamp.current) return;
    lastFlyTimestamp.current = flyToSite.timestamp;
    map.flyTo({ center: [flyToSite.lng, flyToSite.lat], zoom: 13, duration: 1000 });
  }, [flyToSite]);

  // User location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          width: 16px; height: 16px;
          background: #22D3EE;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(34,211,238,0.5), 0 2px 4px rgba(0,0,0,0.3);
        "></div>
      `;

      const popup = new maplibregl.Popup({ offset: 12 })
        .setHTML(`
          <div style="font-size:12px">
            <strong>Your Location</strong>
            ${userLocation.accuracy ? `<div>Accuracy: ±${Math.round(userLocation.accuracy)}m</div>` : ''}
          </div>
        `);

      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .setPopup(popup)
        .addTo(map);
    }
  }, [userLocation]);

  return (
    <div className="relative h-full w-full">
      {propagationOverlays.length > 0 && <SignalLegend />}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

// Helper to create/update GeoJSON sources and layers
function updateGeoJSONSource(
  map: maplibregl.Map,
  sourceId: string,
  features: GeoJSON.Feature[],
  layerConfig: {
    layerId: string;
    type: 'line' | 'circle';
    paint: Record<string, unknown>;
  }
) {
  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features,
  };

  const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
  if (source) {
    source.setData(geojson);
  } else {
    map.addSource(sourceId, { type: 'geojson', data: geojson });
    map.addLayer({
      id: layerConfig.layerId,
      type: layerConfig.type as 'line',
      source: sourceId,
      paint: layerConfig.paint,
    });
  }
}
