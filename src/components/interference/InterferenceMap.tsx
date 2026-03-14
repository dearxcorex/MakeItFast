'use client';

import { Fragment, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, ImageOverlay, useMap } from 'react-leaflet';
import type { InterferenceSite, PropagationOverlay } from '@/types/interference';
import type { UserLocation } from '@/types/station';
import { createTowerIcon, createSourceIcon, getRankingColor } from '@/utils/interferenceMapHelpers';
import { createLocationIcon } from '@/utils/mapHelpers';
import { calculateEndpoint, validateBearing } from '@/utils/bearingUtils';
import NavigateButton from '@/components/map/NavigateButton';
import 'leaflet/dist/leaflet.css';

interface InterferenceMapProps {
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
    <div className="absolute bottom-6 right-3 z-[1000] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-lg px-2.5 py-2 pointer-events-auto">
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

function FlyToHandler({ flyToSite }: { flyToSite: InterferenceMapProps['flyToSite'] }) {
  const map = useMap();
  const lastTimestamp = useRef<number>(0);

  useEffect(() => {
    if (flyToSite && flyToSite.timestamp !== lastTimestamp.current) {
      lastTimestamp.current = flyToSite.timestamp;
      map.flyTo([flyToSite.lat, flyToSite.lng], 13, { duration: 1 });
    }
  }, [flyToSite, map]);

  return null;
}

function DirectionArc({ site }: { site: InterferenceSite }) {
  if (!site.lat || !site.long || site.direction == null) return null;
  const arcLen = Math.max(site.estimateDistance ?? 3, 1); // min 1km for visibility
  const endPoint = calculateEndpoint(site.lat, site.long, site.direction, arcLen);
  const validation = validateBearing(site);
  const arcColor = validation ? (validation.isMatch ? '#6366F1' : '#EF4444') : '#6366F1';

  return (
    <Polyline
      positions={[[site.lat, site.long], endPoint]}
      pathOptions={{ color: arcColor, weight: 2, dashArray: '8, 4', opacity: 0.8 }}
    />
  );
}

export default function InterferenceMap({
  sites,
  selectedSite,
  onSiteSelect,
  propagationOverlays,
  flyToSite,
  userLocation,
}: InterferenceMapProps) {
  return (
    <div className="relative h-full w-full">
    {propagationOverlays.length > 0 && <SignalLegend />}
    <MapContainer
      center={[15.0, 103.5]}
      zoom={7}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FlyToHandler flyToSite={flyToSite} />

      {/* User location marker */}
      {userLocation && (
        <Marker
          position={[userLocation.latitude, userLocation.longitude]}
          icon={createLocationIcon()}
        >
          <Popup>
            <div className="interference-popup">
              <div className="interference-popup-title">Your Location</div>
              <div className="interference-popup-details">
                Current position
                {userLocation.accuracy && (
                  <div>Accuracy: ±{Math.round(userLocation.accuracy)}m</div>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Propagation overlays */}
      {propagationOverlays.map((overlay) => (
        <ImageOverlay
          key={`overlay-${overlay.siteId}`}
          url={overlay.pngUrl}
          bounds={overlay.leafletBounds}
          opacity={0.6}
        />
      ))}

      {/* Tower markers — click only, no popup */}
      {sites.map((site) => {
        if (!site.lat || !site.long) return null;
        const isSelected = selectedSite?.id === site.id;

        return (
          <Marker
            key={`tower-${site.id}`}
            position={[site.lat, site.long]}
            icon={createTowerIcon(site.ranking, isSelected, site.status)}
            eventHandlers={{ click: () => onSiteSelect(site) }}
          />
        );
      })}

      {/* Source markers + connection lines */}
      {sites.map((site) => {
        if (!site.sourceLat || !site.sourceLong || !site.lat || !site.long) return null;

        return (
          <Fragment key={`source-group-${site.id}`}>
            <Marker
              position={[site.sourceLat, site.sourceLong]}
              icon={createSourceIcon()}
            >
              <Popup>
                <div className="interference-popup">
                  <div className="interference-popup-title" style={{ color: '#ef4444' }}>
                    Interference Source
                  </div>
                  <div className="interference-popup-details">
                    <div>For: {site.siteName || site.siteCode}</div>
                    {site.sourceLocation1 && <div>{site.sourceLocation1}</div>}
                    {site.sourceLocation2 && <div>{site.sourceLocation2}</div>}
                    {site.estimateDistance != null && (
                      <div>Distance: {site.estimateDistance.toFixed(2)} km</div>
                    )}
                  </div>
                  <NavigateButton lat={site.sourceLat} lng={site.sourceLong} stationName={site.siteName ? `Source: ${site.siteName}` : 'Interference Source'} />
                </div>
              </Popup>
            </Marker>

            <Polyline
              positions={[
                [site.lat, site.long],
                [site.sourceLat, site.sourceLong],
              ]}
              pathOptions={{
                color: getRankingColor(site.ranking),
                weight: 2,
                dashArray: '6, 4',
                opacity: 0.7,
              }}
            />
          </Fragment>
        );
      })}
      {/* Direction arc for selected site */}
      {selectedSite && <DirectionArc site={selectedSite} />}
    </MapContainer>
    </div>
  );
}
