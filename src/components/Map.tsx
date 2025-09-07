'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FMStation, UserLocation } from '@/types/station';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different markers
const stationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const carIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapProps {
  stations: FMStation[];
  selectedStation?: FMStation;
  onStationSelect: (station: FMStation) => void;
  onUpdateStation?: (stationId: string | number, updates: Partial<FMStation>) => void;
}

function LocationTracker({ onLocationUpdate }: { onLocationUpdate: (location: UserLocation) => void }) {
  const map = useMap();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          onLocationUpdate(location);
          map.setView([location.latitude, location.longitude], 10);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          // Default to Los Angeles if geolocation fails
          const defaultLocation = { latitude: 34.0522, longitude: -118.2437 };
          onLocationUpdate(defaultLocation);
          map.setView([defaultLocation.latitude, defaultLocation.longitude], 10);
        }
      );
    }
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
        zoom={11}
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
            icon={carIcon}
          >
            <Popup>
              <div className="font-semibold">Your Location</div>
              <div className="text-sm text-gray-600">
                Current position
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

          return (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={stationIcon}
              eventHandlers={{
                click: () => onStationSelect(station),
              }}
            >
              <Popup>
                <div className="min-w-[240px] p-2">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-lg text-card-foreground">{station.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center px-2 py-1 rounded-lg bg-primary/20 text-primary text-sm font-bold">
                          {station.frequency} FM
                        </span>
                        <span className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded-lg">
                          {station.genre}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                          station.onAir 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${station.onAir ? 'bg-green-500' : 'bg-red-500'}`} />
                          {station.onAir ? 'On Air' : 'Off Air'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{station.city}, {station.state}</span>
                    </div>
                    
                    {distance && (
                      <div className="flex items-center gap-2 text-sm text-primary font-semibold">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span>{distance.toFixed(1)} km away</span>
                      </div>
                    )}
                    
                    {/* Inspection Status */}
                    {station.inspection68 && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                            station.inspection68 === 'ตรวจแล้ว' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : station.inspection68 === 'ยังไม่ตรวจ'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {station.inspection68 === 'ตรวจแล้ว' && '✅'}
                            {station.inspection68 === 'ยังไม่ตรวจ' && '⏳'}
                            {station.inspection68 === 'ตรงตามมาตรฐาน' && '🎯'}
                            {station.inspection68}
                          </span>
                        </div>
                        {onUpdateStation && (
                          <button
                            onClick={() => {
                              const newStatus = station.inspection68 === 'ตรวจแล้ว' ? 'ยังไม่ตรวจ' : 'ตรวจแล้ว';
                              onUpdateStation(station.id, { inspection68: newStatus });
                            }}
                            className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                          >
                            Toggle
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {station.description && (
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed border-t border-border pt-3">
                      {station.description}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}