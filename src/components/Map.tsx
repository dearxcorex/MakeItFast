'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FMStation, UserLocation } from '@/types/station';
import { groupStationsByCoordinates } from '@/services/stationService';
import { calculateDistance, createLocationIcon, getStationIcon } from '@/utils/mapHelpers';
import StationPopupSingle from './map/StationPopupSingle';
import StationPopupMultiple from './map/StationPopupMultiple';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface FlyToTarget {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
  timestamp: number;
}

interface MapProps {
  stations: FMStation[];
  selectedStation?: FMStation;
  onStationSelect: (station: FMStation) => void;
  onUpdateStation?: (stationId: string | number, updates: Partial<FMStation>) => void;
  highlightedStationIds?: (string | number)[];
  flyToStations?: FlyToTarget | null;
}

function LocationTracker({ onLocationUpdate }: { onLocationUpdate: (location: UserLocation) => void }) {
  const map = useMap();

  useEffect(() => {
    let watchId: number;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          onLocationUpdate(location);
          if (map.getContainer()) {
            map.setView([location.latitude, location.longitude], 13);
          }
        },
        (error) => {
          console.warn('Initial geolocation error:', error);
          const defaultLocation = { latitude: 34.0522, longitude: -118.2437 };
          onLocationUpdate(defaultLocation);
          if (map.getContainer()) {
            map.setView([defaultLocation.latitude, defaultLocation.longitude], 10);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const location: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading || null,
            speed: position.coords.speed || null
          };
          onLocationUpdate(location);
        },
        (error) => {
          console.warn('Watch position error:', error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [map, onLocationUpdate]);

  return null;
}

function FlyToHighlightedStations({ target }: { target: FlyToTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (target) {
      const timer = setTimeout(() => {
        const bounds = L.latLngBounds(
          [target.lat1, target.lng1],
          [target.lat2, target.lng2]
        );
        map.flyToBounds(bounds, { padding: [80, 80], maxZoom: 12, duration: 1.5 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [map, target]);

  return null;
}

export default function Map({ stations, selectedStation, onStationSelect, onUpdateStation, highlightedStationIds = [], flyToStations }: MapProps) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [paginationState, setPaginationState] = useState<Record<string, number>>({});

  const updatePaginationPage = useCallback((coordKey: string, page: number) => {
    setPaginationState(prev => ({ ...prev, [coordKey]: page }));
  }, []);

  useEffect(() => {
    setIsClient(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const mapCenter = useMemo(() => {
    if (selectedStation) return [selectedStation.latitude, selectedStation.longitude] as [number, number];
    if (userLocation) return [userLocation.latitude, userLocation.longitude] as [number, number];
    return [34.0522, -118.2437] as [number, number];
  }, [selectedStation, userLocation]);

  const groupedStations = useMemo(() => groupStationsByCoordinates(stations), [stations]);

  if (!isClient) {
    return (
      <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center">
            <svg className="w-6 h-6 text-primary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="text-muted-foreground font-medium">Loading map...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={mapCenter}
        zoom={13}
        className="w-full h-full"
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LocationTracker onLocationUpdate={setUserLocation} />
        {flyToStations && <FlyToHighlightedStations target={flyToStations} />}

        {userLocation && (
          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={createLocationIcon()}
            aria-label="Your current location"
            title="Your current location"
          >
            <Popup>
              <div className="font-semibold text-card-foreground">Your Location</div>
              <div className="text-sm text-muted-foreground">
                Current position
                {userLocation.accuracy && (
                  <div className="text-xs mt-1">Accuracy: ±{Math.round(userLocation.accuracy)}m</div>
                )}
                {userLocation.speed !== null && userLocation.speed !== undefined && userLocation.speed > 0 && (
                  <div className="text-xs mt-1">Speed: {Math.round(userLocation.speed * 3.6)} km/h</div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {Array.from(groupedStations.entries()).map(([coordKey, stationGroup]) => {
          const [lat, lng] = coordKey.split(',').map(Number);
          const isMultiple = stationGroup.length > 1;
          const representativeStation = stationGroup[0];

          const distance = userLocation
            ? calculateDistance(userLocation.latitude, userLocation.longitude, lat, lng)
            : null;

          const locationLabel = isMultiple
            ? `${stationGroup.length} stations at ${representativeStation.city}, ${representativeStation.state}`
            : `${representativeStation.name} FM ${representativeStation.frequency} station in ${representativeStation.city}, ${representativeStation.state}`;

          return (
            <Marker
              key={coordKey}
              position={[lat, lng]}
              icon={getStationIcon(stationGroup, highlightedStationIds, stationGroup.length)}
              aria-label={locationLabel}
              title={isMultiple ? `${stationGroup.length} stations` : `${representativeStation.name} FM ${representativeStation.frequency}`}
              eventHandlers={{
                click: () => onStationSelect(representativeStation),
              }}
            >
              <Popup
                autoPan={false}
                keepInView={true}
                closeOnEscapeKey={true}
                maxWidth={isMobile ? 350 : 380}
                minWidth={isMobile ? 320 : 300}
                className={isMobile ? 'mobile-stable-popup' : ''}
              >
                {isMultiple ? (
                  <StationPopupMultiple
                    key={`popup-${coordKey}`}
                    stationGroup={stationGroup}
                    lat={lat}
                    lng={lng}
                    distance={distance}
                    currentPage={paginationState[coordKey] || 0}
                    setCurrentPage={(page) => updatePaginationPage(coordKey, page)}
                    isMobile={isMobile}
                    onUpdateStation={onUpdateStation}
                  />
                ) : (
                  <StationPopupSingle
                    station={representativeStation}
                    distance={distance}
                    onUpdateStation={onUpdateStation}
                  />
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
