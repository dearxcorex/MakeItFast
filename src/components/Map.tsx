'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FMStation, UserLocation } from '@/types/station';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different markers
const greenStationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redStationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const blackStationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const greyStationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Create a custom Google Maps style location icon
const createLocationIcon = () => {
  return L.divIcon({
    className: 'custom-location-icon',
    html: `
      <div style="
        width: 20px;
        height: 20px;
        background: #4285F4;
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        position: relative;
      ">
        <div style="
          width: 40px;
          height: 40px;
          background: rgba(66, 133, 244, 0.2);
          border-radius: 50%;
          position: absolute;
          top: -13px;
          left: -13px;
          animation: locationPulse 2s infinite;
        "></div>
      </div>
      <style>
        @keyframes locationPulse {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      </style>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
  });
};

interface MapProps {
  stations: FMStation[];
  selectedStation?: FMStation;
  onStationSelect: (station: FMStation) => void;
  onUpdateStation?: (stationId: string | number, updates: Partial<FMStation>) => void;
}

function LocationTracker({ onLocationUpdate }: { onLocationUpdate: (location: UserLocation) => void }) {
  const map = useMap();

  useEffect(() => {
    let watchId: number;

    if (navigator.geolocation) {
      // Initial position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          onLocationUpdate(location);
          map.setView([location.latitude, location.longitude], 13);
        },
        (error) => {
          console.warn('Initial geolocation error:', error);
          const defaultLocation = { latitude: 34.0522, longitude: -118.2437 };
          onLocationUpdate(defaultLocation);
          map.setView([defaultLocation.latitude, defaultLocation.longitude], 10);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );

      // Continuous tracking for driving
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

          // Smooth pan to new location (don't change zoom for driving)
          map.panTo([location.latitude, location.longitude], {
            animate: true,
            duration: 1.0,
            easeLinearity: 0.25
          });
        },
        (error) => {
          console.warn('Watch position error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000 // Cache for 30 seconds max for smooth updates
        }
      );
    }

    // Cleanup function
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [map, onLocationUpdate]);

  return null;
}

export default function Map({ stations, selectedStation, onStationSelect, onUpdateStation }: MapProps) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const mapCenter = useMemo(() => {
    if (selectedStation) {
      return [selectedStation.latitude, selectedStation.longitude] as [number, number];
    }
    if (userLocation) {
      return [userLocation.latitude, userLocation.longitude] as [number, number];
    }
    return [34.0522, -118.2437] as [number, number]; // Default to Los Angeles
  }, [selectedStation, userLocation]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getStationIcon = (station: FMStation) => {
    // If station submit request equals "ไม่ยื่น", use black pin
    if (station.submitRequest === 'ไม่ยื่น') {
      return blackStationIcon;
    }

    // If station is off air, use grey pin
    if (!station.onAir) {
      return greyStationIcon;
    }

    // If station is on air, check inspection status
    if (station.inspection68 === 'ตรวจแล้ว') {
      return greenStationIcon; // Inspected - green pin
    } else if (station.inspection68 === 'ยังไม่ตรวจ') {
      return redStationIcon; // Not inspected - red pin
    }

    // Default to red pin for other cases
    return redStationIcon;
  };

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

        {/* User location marker */}
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
                  <div className="text-xs mt-1">
                    Accuracy: ±{Math.round(userLocation.accuracy)}m
                  </div>
                )}
                {userLocation.speed !== null && userLocation.speed !== undefined && userLocation.speed > 0 && (
                  <div className="text-xs mt-1">
                    Speed: {Math.round(userLocation.speed * 3.6)} km/h
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* FM Station markers */}
        {stations.map((station) => {
          const distance = userLocation
            ? calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                station.latitude,
                station.longitude
              )
            : null;

          const statusText = station.onAir ? 'On Air' : 'Off Air';
          const inspectionText = station.inspection68 || 'Not inspected';
          const distanceText = distance ? ` - ${distance.toFixed(1)} km away` : '';

          return (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={getStationIcon(station)}
              aria-label={`${station.name} FM ${station.frequency} station in ${station.city}, ${station.state} - ${statusText} - ${inspectionText}${distanceText}`}
              title={`${station.name} FM ${station.frequency}`}
              eventHandlers={{
                click: () => onStationSelect(station),
              }}
            >
              <Popup>
                <div className="w-full max-w-[280px] sm:max-w-[320px] p-3 sm:p-4">
                  {/* Header Section */}
                  <div className="mb-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm sm:text-base text-card-foreground leading-tight break-words">{station.name}</h3>
                        <div className="flex items-center gap-1 sm:gap-2 mt-2 flex-wrap">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-primary/20 text-primary text-xs font-bold">
                            {station.frequency} FM
                          </span>
                          <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-lg">
                            {station.genre}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* On Air Status with Toggle */}
                    <div className="flex items-center justify-between gap-2 p-2 bg-muted/20 rounded-lg border border-border/50">
                      <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium ${
                        station.onAir
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${station.onAir ? 'bg-green-500' : 'bg-red-500'}`} />
                        {station.onAir ? 'On Air' : 'Off Air'}
                      </span>
                      {onUpdateStation && (
                        <button
                          onClick={() => {
                            onUpdateStation(station.id, { onAir: !station.onAir });
                          }}
                          className="px-2 sm:px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-accent transition-colors font-medium whitespace-nowrap"
                          aria-label={`Toggle ${station.name} broadcast status - currently ${station.onAir ? 'on air' : 'off air'}`}
                        >
                          {station.onAir ? 'Set Off' : 'Set On'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inspection Status */}
                  {station.inspection68 && (
                    <div className="flex items-center justify-between gap-2 p-2 bg-muted/20 rounded-lg border border-border/50 mb-3">
                      <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium ${
                        station.inspection68 === 'ตรวจแล้ว'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : station.inspection68 === 'ยังไม่ตรวจ'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {station.inspection68 === 'ตรวจแล้ว' && '✅'}
                        {station.inspection68 === 'ยังไม่ตรวจ' && '⏳'}
                        {station.inspection68 === 'ตรงตามมาตรฐาน' && '🎯'}
                        <span className="break-words">{station.inspection68}</span>
                      </span>
                      {onUpdateStation && (
                        <button
                          onClick={() => {
                            const newStatus = station.inspection68 === 'ตรวจแล้ว' ? 'ยังไม่ตรวจ' : 'ตรวจแล้ว';
                            onUpdateStation(station.id, { inspection68: newStatus });
                          }}
                          className="px-2 sm:px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium whitespace-nowrap"
                          aria-label={`Toggle ${station.name} inspection status - currently ${station.inspection68 || 'not inspected'}`}
                        >
                          {station.inspection68 === 'ยังไม่ตรวจ' ? 'Inspect' : 'Inspected'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Distance Information */}
                  {distance && (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-primary font-semibold bg-primary/10 p-2 rounded-lg mb-4">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span>{distance.toFixed(1)} km away</span>
                    </div>
                  )}

                  {station.description && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground leading-relaxed break-words">
                        {station.description}
                      </p>
                    </div>
                  )}

                  {/* Navigation Button */}
                  <div className="mt-4 pt-3 border-t border-border">
                    <button
                      onClick={() => {
                        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}&travelmode=driving`;
                        window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 hover:scale-[1.02] font-medium text-xs sm:text-sm min-h-[44px]"
                      aria-label={`Navigate to ${station.name} with Google Maps`}
                    >
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span className="hidden sm:inline">Navigate with Google Maps</span>
                      <span className="sm:hidden">Navigate</span>
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}