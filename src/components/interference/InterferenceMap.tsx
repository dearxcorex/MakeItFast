'use client';

import { Fragment, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import type { InterferenceSite } from '@/types/interference';
import type { UserLocation } from '@/types/station';
import { createTowerIcon, createSourceIcon } from '@/utils/interferenceMapHelpers';
import { createLocationIcon } from '@/utils/mapHelpers';
import { calculateEndpoint, validateBearing } from '@/utils/bearingUtils';
import NavigateButton from '@/components/map/NavigateButton';
import NavigationPill from './NavigationPill';
import 'leaflet/dist/leaflet.css';

interface InterferenceMapProps {
  sites: InterferenceSite[];
  selectedSite: InterferenceSite | null;
  onSiteSelect: (site: InterferenceSite) => void;
  flyToSite: { lat: number; lng: number; timestamp: number } | null;
  userLocation?: UserLocation;
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
  flyToSite,
  userLocation,
}: InterferenceMapProps) {
  return (
    <div className="relative h-full w-full">
    {selectedSite && (selectedSite.direction != null || (selectedSite.sourceLat !== null && selectedSite.sourceLong !== null)) && (
      <div className="absolute top-3 left-3 z-[1000] pointer-events-none">
        <NavigationPill
          bearing={selectedSite.direction ?? null}
          distance={
            selectedSite.sourceLat !== null && selectedSite.sourceLong !== null
              ? selectedSite.estimateDistance ?? null
              : null
          }
        />
      </div>
    )}
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
          icon={createLocationIcon({
            heading: userLocation.heading,
            stale: userLocation.stale,
          })}
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
                color: 'var(--fo-accent)',
                weight: 3,
                opacity: 0.85,
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
