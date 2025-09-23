'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FMStation, UserLocation } from '@/types/station';
import { groupStationsByCoordinates } from '@/services/stationService';

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

          // Update location without auto-panning to prevent screen shake
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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

  // Group stations by coordinates
  const groupedStations = useMemo(() => {
    return groupStationsByCoordinates(stations);
  }, [stations]);

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

  const getStationIcon = (stationOrGroup: FMStation | FMStation[], count?: number) => {
    // If it's an array (multiple stations), use the first station's status
    const station = Array.isArray(stationOrGroup) ? stationOrGroup[0] : stationOrGroup;
    const isMultiple = count && count > 1;
    const isMainStation = station.type === 'สถานีหลัก' || station.genre === 'สถานีหลัก';

    // Get base icon based on station status
    let baseIcon;
    if (station.submitRequest === 'ไม่ยื่น') {
      baseIcon = blackStationIcon;
    } else if (!station.onAir) {
      baseIcon = greyStationIcon;
    } else if (station.inspection68 === 'ตรวจแล้ว') {
      baseIcon = greenStationIcon;
    } else if (station.inspection68 === 'ยังไม่ตรวจ') {
      baseIcon = redStationIcon;
    } else {
      baseIcon = redStationIcon;
    }

    // Create custom icon with main station symbol or count badge
    if (isMainStation || isMultiple) {
      return L.divIcon({
        className: 'custom-station-icon',
        html: `
          <div style="position: relative;">
            <img src="${baseIcon.options.iconUrl}"
                 style="width: 25px; height: 41px;"
                 alt="Station marker" />
            ${isMainStation ? `
              <div style="
                position: absolute;
                top: -6px;
                right: -6px;
                background: #4285F4;
                color: white;
                border-radius: 50%;
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              ">★</div>
            ` : ''}
            ${isMultiple && !isMainStation ? `
              <div style="
                position: absolute;
                top: -8px;
                right: -8px;
                background: #ff4444;
                color: white;
                border-radius: 50%;
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              ">${count}</div>
            ` : ''}
            ${isMultiple && isMainStation ? `
              <div style="
                position: absolute;
                top: -8px;
                right: -8px;
                background: #4285F4;
                color: white;
                border-radius: 50%;
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 9px;
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              ">★${count}</div>
            ` : ''}
          </div>
        `,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
      });
    }

    return baseIcon;
  };

  // Function to format inspection date
  const formatInspectionDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };


  // Component to render single station popup
  const SingleStationPopup = ({ station, distance }: { station: FMStation; distance: number | null }) => {
    const [loadingOnAir, setLoadingOnAir] = useState(false);
    const [loadingInspection, setLoadingInspection] = useState(false);

    const handleOnAirToggle = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onUpdateStation || loadingOnAir) return;
      setLoadingOnAir(true);
      try {
        await onUpdateStation(station.id, { onAir: !station.onAir });
        // Small delay to show success state
        await new Promise(resolve => setTimeout(resolve, 500));
      } finally {
        setLoadingOnAir(false);
      }
    };

    const handleInspectionToggle = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onUpdateStation || loadingInspection) return;
      setLoadingInspection(true);
      try {
        const newStatus = station.inspection68 === 'ตรวจแล้ว' ? 'ยังไม่ตรวจ' : 'ตรวจแล้ว';
        await onUpdateStation(station.id, { inspection68: newStatus });
        // Small delay to show success state
        await new Promise(resolve => setTimeout(resolve, 500));
      } finally {
        setLoadingInspection(false);
      }
    };

    return (
    <div className="w-full max-w-[300px] sm:max-w-[340px] p-3">
      <div className="mb-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-card-foreground leading-tight break-words">{station.name}</h3>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/20 text-primary text-xs font-medium">
                {station.frequency} FM
              </span>
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                {station.genre}
              </span>
              {(station.type === 'สถานีหลัก' || station.genre === 'สถานีหลัก') && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
                  <span>★</span>
                  <span>Main</span>
                </span>
              )}
            </div>
          </div>
        </div>

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
              onClick={handleOnAirToggle}
              disabled={loadingOnAir}
              className={`px-2 sm:px-3 py-1 text-xs rounded-md font-medium whitespace-nowrap transition-all duration-200 ${
                loadingOnAir
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
              aria-label={`Toggle ${station.name} broadcast status - currently ${station.onAir ? 'on air' : 'off air'}`}
            >
              {loadingOnAir ? (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Saving...</span>
                </div>
              ) : (
                station.onAir ? 'Set Off' : 'Set On'
              )}
            </button>
          )}
        </div>
      </div>

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
              onClick={handleInspectionToggle}
              disabled={loadingInspection}
              className={`px-2 sm:px-3 py-1 text-xs rounded-md font-medium whitespace-nowrap transition-all duration-200 ${
                loadingInspection
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
              aria-label={`Toggle ${station.name} inspection status - currently ${station.inspection68 || 'not inspected'}`}
            >
              {loadingInspection ? (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Saving...</span>
                </div>
              ) : (
                station.inspection68 === 'ยังไม่ตรวจ' ? 'Inspect' : 'Inspected'
              )}
            </button>
          )}
        </div>
      )}

      {/* Inspection Date Only */}
      {station.dateInspected && (
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground bg-muted/20 p-2 rounded-lg border border-border/50 mb-3">
          <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Inspected: {formatInspectionDate(station.dateInspected)}</span>
        </div>
      )}


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

      {/* Hashtag Selection */}
      {onUpdateStation && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="mb-2">
            <label className="text-xs font-medium text-foreground">Station Details:</label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const newDetails = station.details === '#deviation' ? '' : '#deviation';
                onUpdateStation(station.id, { details: newDetails });
              }}
              className={`px-2 py-1 text-xs rounded-md font-medium transition-all duration-200 ${
                station.details === '#deviation'
                  ? 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
                  : 'bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              #deviation
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const newDetails = station.details === '#intermod' ? '' : '#intermod';
                onUpdateStation(station.id, { details: newDetails });
              }}
              className={`px-2 py-1 text-xs rounded-md font-medium transition-all duration-200 ${
                station.details === '#intermod'
                  ? 'bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700'
                  : 'bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              #intermod
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-border/30 flex justify-center">
        <button
          onClick={() => {
            const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}&travelmode=driving`;
            window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
          }}
          className="inline-flex items-center justify-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-full text-xs font-medium transition-all duration-200 hover:shadow-sm"
          aria-label={`Navigate to ${station.name} with Google Maps`}
        >
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span>Navigate</span>
        </button>
      </div>
    </div>
    );
  };

  // Component to render multiple stations popup - iOS Safari aggressive fix
  const MultipleStationsPopup = ({ stationGroup, lat, lng, distance }: { stationGroup: FMStation[]; lat: number; lng: number; distance: number | null }) => {
    const [loadingStations, setLoadingStations] = useState<Set<string | number>>(new Set());
    const [currentPage, setCurrentPage] = useState(0);
    const [manualScrollY, setManualScrollY] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);
    const touchStartRef = useRef({ y: 0, scrollY: 0 });

    // On iOS, use pagination instead of scrolling to completely avoid iOS Safari scroll issues
    const itemsPerPage = isMobile ? 1 : 3; // Show 1 station per page on mobile
    const totalPages = Math.ceil(stationGroup.length / itemsPerPage);
    const currentStations = isMobile
      ? [stationGroup[currentPage]]
      : stationGroup.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

    // Debug state changes
    useEffect(() => {
      console.log('MultipleStationsPopup state:', {
        currentPage,
        totalPages,
        stationGroupLength: stationGroup.length,
        isMobile,
        currentStationId: currentStations[0]?.id
      });
    }, [currentPage, totalPages, stationGroup.length, isMobile, currentStations]);

    // iOS Safari minimal scroll prevention - only block container scrolling, not button clicks
    useEffect(() => {
      if (!isMobile || !containerRef.current) return;

      const container = containerRef.current;

      // Disable scroll restoration for this session only
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
      }

      // Only prevent scroll events, not touch events on interactive elements
      const preventScrollOnly = (e: Event) => {
        // Only prevent default if it's a scroll event, not touch on buttons/interactive elements
        if (e.type === 'scroll' || e.type === 'wheel') {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      // Add minimal event prevention - only for scroll, not touch interactions
      container.addEventListener('scroll', preventScrollOnly, { passive: false });
      container.addEventListener('wheel', preventScrollOnly, { passive: false });

      return () => {
        container.removeEventListener('scroll', preventScrollOnly);
        container.removeEventListener('wheel', preventScrollOnly);
      };
    }, []);

    const handleStationToggle = async (e: React.MouseEvent, stationId: string | number, field: 'onAir' | 'inspection68' | 'details', value: boolean | string) => {
      e.stopPropagation();
      if (!onUpdateStation || loadingStations.has(stationId)) return;

      setLoadingStations(prev => new Set(prev).add(stationId));
      try {
        await onUpdateStation(stationId, { [field]: value });
        // Shorter delay for better responsiveness
        await new Promise<void>(resolve => setTimeout(resolve, 300));
      } finally {
        setLoadingStations(prev => {
          const newSet = new Set(prev);
          newSet.delete(stationId);
          return newSet;
        });
      }
    };

    return (
    <div
      className={`w-full p-3 ${isMobile ? 'max-w-[320px]' : 'max-w-[320px] sm:max-w-[380px]'}`}
      style={{
        // iOS Safari popup stability fixes - allow interactions
        contain: isMobile ? 'layout style paint' : 'none',
        transform: isMobile ? 'translate3d(0, 0, 0)' : 'none',
        willChange: isMobile ? 'auto' : 'auto',
        touchAction: 'manipulation', // Allow button interactions but prevent zoom
        pointerEvents: 'auto' // Ensure all interactions work
      }}
    >
      <div className="mb-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm sm:text-base text-card-foreground leading-tight break-words">
              {stationGroup.length} Stations at this Location
            </h3>
            <div className="text-xs text-muted-foreground mt-1">
              {stationGroup[0].city}, {stationGroup[0].state}
            </div>
          </div>
        </div>

        {distance && (
          <div className="flex items-center gap-2 text-xs sm:text-sm text-primary font-semibold bg-primary/10 p-2 rounded-lg mb-4">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>{distance.toFixed(1)} km away</span>
          </div>
        )}

        {/* Mobile: Use pagination to completely avoid iOS Safari scroll issues */}
        {isMobile ? (
          <div
            ref={containerRef}
            className="space-y-2"
            style={{
              maxHeight: '400px', // Increased max height to show full station details
              minHeight: '200px', // Minimum height for consistency
              overflow: 'visible', // Allow content to be fully visible
              touchAction: 'manipulation', // Allow button clicks but prevent zoom
              contain: 'layout style paint'
            }}
          >
            {/* Pagination controls for mobile */}
            {totalPages > 1 && (
              <div
                className="flex items-center justify-between mb-3 p-2 bg-primary/10 rounded-lg"
                style={{
                  isolation: 'isolate',
                  position: 'relative',
                  zIndex: 9999
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newPage = Math.max(0, currentPage - 1);
                    console.log('Previous clicked:', currentPage, '->', newPage);
                    setCurrentPage(newPage);
                  }}
                  disabled={currentPage === 0}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                    currentPage === 0
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                  style={{
                    isolation: 'isolate',
                    position: 'relative',
                    zIndex: 10000
                  }}
                >
                  ← Previous
                </button>
                <span className="text-xs font-medium text-primary">
                  Station {currentPage + 1} of {stationGroup.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newPage = Math.min(totalPages - 1, currentPage + 1);
                    console.log('Next clicked:', currentPage, '->', newPage);
                    setCurrentPage(newPage);
                  }}
                  disabled={currentPage === totalPages - 1}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                    currentPage === totalPages - 1
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                  style={{
                    isolation: 'isolate',
                    position: 'relative',
                    zIndex: 10000
                  }}
                >
                  Next →
                </button>
              </div>
            )}

            {/* Station content - no scrolling on mobile, full height */}
            <div className="space-y-2" style={{ minHeight: 'auto' }}>
              {currentStations.map((station) => (
            <div
              key={station.id}
              className="border rounded-lg p-3 bg-muted/20 hover:bg-muted/30 transition-colors"
              style={{
                // iOS Safari layout stability fixes - allow full height expansion and touch
                contain: isMobile ? 'layout style' : 'none',
                transform: isMobile ? 'translateZ(0)' : 'none',
                willChange: isMobile ? 'auto' : 'auto',
                touchAction: 'manipulation', // Allow all button clicks and interactions
                height: 'auto', // Allow full height
                overflow: 'visible', // Show all content
                pointerEvents: 'auto' // Ensure all interactions work
              }}
            >
              {station.unwanted && (
                <div className="flex justify-end mb-2">
                  <span className="text-xs font-medium text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-1 rounded">
                    ⚠️ Unwanted
                  </span>
                </div>
              )}
              <div className="flex items-start gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-sm text-card-foreground break-words">{station.name}</h4>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/20 text-primary text-xs font-bold">
                      {station.frequency} FM
                    </span>
                    <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                      {station.genre}
                    </span>
                    {(station.type === 'สถานีหลัก' || station.genre === 'สถานีหลัก') && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
                        <span>★</span>
                        <span>Main</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded border border-border/50 mb-2">
                <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium ${
                  station.onAir
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${station.onAir ? 'bg-green-500' : 'bg-red-500'}`} />
                  {station.onAir ? 'On Air' : 'Off Air'}
                </span>
                {onUpdateStation && (
                  <button
                    onClick={(e) => handleStationToggle(e, station.id, 'onAir', !station.onAir)}
                    disabled={loadingStations.has(station.id)}
                    className={`px-2 py-1 text-xs rounded font-medium whitespace-nowrap transition-all duration-200 ${
                      loadingStations.has(station.id)
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-secondary text-secondary-foreground hover:bg-accent'
                    }`}
                  >
                    {loadingStations.has(station.id) ? (
                      <div className="flex items-center gap-1">
                        <svg className="w-2.5 h-2.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Save...</span>
                      </div>
                    ) : (
                      station.onAir ? 'Set Off' : 'Set On'
                    )}
                  </button>
                )}
              </div>

              {station.inspection68 && (
                <div className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded border border-border/50 mb-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                    station.inspection68 === 'ตรวจแล้ว'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : station.inspection68 === 'ยังไม่ตรวจ'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {station.inspection68 === 'ตรวจแล้ว' && '✅'}
                    {station.inspection68 === 'ยังไม่ตรวจ' && '⏳'}
                    {station.inspection68 === 'ตรงตามมาตรฐาน' && '🎯'}
                    <span className="break-words text-xs">{station.inspection68}</span>
                  </span>
                  {onUpdateStation && (
                    <button
                      onClick={(e) => {
                        const newStatus = station.inspection68 === 'ตรวจแล้ว' ? 'ยังไม่ตรวจ' : 'ตรวจแล้ว';
                        handleStationToggle(e, station.id, 'inspection68', newStatus);
                      }}
                      disabled={loadingStations.has(station.id)}
                      className={`px-2 py-1 text-xs rounded font-medium whitespace-nowrap transition-all duration-200 ${
                        loadingStations.has(station.id)
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      {loadingStations.has(station.id) ? (
                        <div className="flex items-center gap-1">
                          <svg className="w-2.5 h-2.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Save...</span>
                        </div>
                      ) : (
                        station.inspection68 === 'ยังไม่ตรวจ' ? 'Inspect' : 'Inspected'
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Inspection Date Only for Multiple Stations */}
              {station.dateInspected && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-border/50 mt-2">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Inspected: {formatInspectionDate(station.dateInspected)}</span>
                </div>
              )}

              {/* Hashtag Selection for Multiple Stations */}
              {onUpdateStation && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <div className="mb-1.5">
                    <label className="text-xs font-medium text-foreground">Details:</label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newDetails = station.details === '#deviation' ? '' : '#deviation';
                        handleStationToggle(e, station.id, 'details' as 'onAir' | 'inspection68' | 'details', newDetails);
                      }}
                      disabled={loadingStations.has(station.id)}
                      className={`px-1.5 py-0.5 text-xs rounded font-medium transition-all duration-200 ${
                        station.details === '#deviation'
                          ? 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
                          : 'bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground'
                      } ${loadingStations.has(station.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      #deviation
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newDetails = station.details === '#intermod' ? '' : '#intermod';
                        handleStationToggle(e, station.id, 'details' as 'onAir' | 'inspection68' | 'details', newDetails);
                      }}
                      disabled={loadingStations.has(station.id)}
                      className={`px-1.5 py-0.5 text-xs rounded font-medium transition-all duration-200 ${
                        station.details === '#intermod'
                          ? 'bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700'
                          : 'bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground'
                      } ${loadingStations.has(station.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      #intermod
                    </button>
                  </div>
                </div>
              )}

                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Desktop: Use normal scrolling */
          <div
            className="space-y-2 max-h-[280px] overflow-y-auto"
            style={{
              WebkitOverflowScrolling: 'touch',
              transform: 'translateZ(0)'
            }}
          >
            {stationGroup.map((station, index) => (
              <div
                key={station.id}
                className="border rounded-lg p-3 bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                {stationGroup.length > 1 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                      Station {index + 1} of {stationGroup.length}
                    </span>
                    {station.unwanted && (
                      <span className="text-xs font-medium text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-1 rounded">
                        ⚠️ Unwanted
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-start gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm text-card-foreground break-words">{station.name}</h4>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/20 text-primary text-xs font-bold">
                        {station.frequency} FM
                      </span>
                      <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                        {station.genre}
                      </span>
                      {(station.type === 'สถานีหลัก' || station.genre === 'สถานีหลัก') && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
                          <span>★</span>
                          <span>Main</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded border border-border/50 mb-2">
                  <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium ${
                    station.onAir
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${station.onAir ? 'bg-green-500' : 'bg-red-500'}`} />
                    {station.onAir ? 'On Air' : 'Off Air'}
                  </span>
                  {onUpdateStation && (
                    <button
                      onClick={(e) => handleStationToggle(e, station.id, 'onAir', !station.onAir)}
                      disabled={loadingStations.has(station.id)}
                      className={`px-2 py-1 text-xs rounded font-medium whitespace-nowrap transition-all duration-200 ${
                        loadingStations.has(station.id)
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-secondary text-secondary-foreground hover:bg-accent'
                      }`}
                    >
                      {loadingStations.has(station.id) ? (
                        <div className="flex items-center gap-1">
                          <svg className="w-2.5 h-2.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Save...</span>
                        </div>
                      ) : (
                        station.onAir ? 'Set Off' : 'Set On'
                      )}
                    </button>
                  )}
                </div>

                {station.inspection68 && (
                  <div className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded border border-border/50 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                      station.inspection68 === 'ตรวจแล้ว'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : station.inspection68 === 'ยังไม่ตรวจ'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {station.inspection68 === 'ตรวจแล้ว' && '✅'}
                      {station.inspection68 === 'ยังไม่ตรวจ' && '⏳'}
                      {station.inspection68 === 'ตรงตามมาตรฐาน' && '🎯'}
                      <span className="break-words text-xs">{station.inspection68}</span>
                    </span>
                    {onUpdateStation && (
                      <button
                        onClick={(e) => {
                          const newStatus = station.inspection68 === 'ตรวจแล้ว' ? 'ยังไม่ตรวจ' : 'ตรวจแล้ว';
                          handleStationToggle(e, station.id, 'inspection68', newStatus);
                        }}
                        disabled={loadingStations.has(station.id)}
                        className={`px-2 py-1 text-xs rounded font-medium whitespace-nowrap transition-all duration-200 ${
                          loadingStations.has(station.id)
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        }`}
                      >
                        {loadingStations.has(station.id) ? (
                          <div className="flex items-center gap-1">
                            <svg className="w-2.5 h-2.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Save...</span>
                          </div>
                        ) : (
                          station.inspection68 === 'ยังไม่ตรวจ' ? 'Inspect' : 'Inspected'
                        )}
                      </button>
                    )}
                  </div>
                )}

                {station.dateInspected && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-border/50 mt-2">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Inspected: {formatInspectionDate(station.dateInspected)}</span>
                  </div>
                )}

                {onUpdateStation && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <div className="mb-1.5">
                      <label className="text-xs font-medium text-foreground">Details:</label>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const newDetails = station.details === '#deviation' ? '' : '#deviation';
                          handleStationToggle(e, station.id, 'details' as 'onAir' | 'inspection68' | 'details', newDetails);
                        }}
                        disabled={loadingStations.has(station.id)}
                        className={`px-1.5 py-0.5 text-xs rounded font-medium transition-all duration-200 ${
                          station.details === '#deviation'
                            ? 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700'
                            : 'bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground'
                        } ${loadingStations.has(station.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        #deviation
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const newDetails = station.details === '#intermod' ? '' : '#intermod';
                          handleStationToggle(e, station.id, 'details' as 'onAir' | 'inspection68' | 'details', newDetails);
                        }}
                        disabled={loadingStations.has(station.id)}
                        className={`px-1.5 py-0.5 text-xs rounded font-medium transition-all duration-200 ${
                          station.details === '#intermod'
                            ? 'bg-orange-100 text-orange-700 border border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700'
                            : 'bg-muted text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground'
                        } ${loadingStations.has(station.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        #intermod
                      </button>
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-border/30 flex justify-center">
          <button
            onClick={() => {
              const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
              window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
            }}
            className="inline-flex items-center justify-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-full text-xs font-medium transition-all duration-200 hover:shadow-sm"
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>Navigate</span>
          </button>
        </div>
      </div>
    </div>
    );
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

        {Array.from(groupedStations.entries()).map(([coordKey, stationGroup]) => {
          const [lat, lng] = coordKey.split(',').map(Number);
          const isMultiple = stationGroup.length > 1;
          const representativeStation = stationGroup[0];

          const distance = userLocation
            ? calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                lat,
                lng
              )
            : null;

          const locationLabel = isMultiple
            ? `${stationGroup.length} stations at ${representativeStation.city}, ${representativeStation.state}`
            : `${representativeStation.name} FM ${representativeStation.frequency} station in ${representativeStation.city}, ${representativeStation.state}`;

          return (
            <Marker
              key={coordKey}
              position={[lat, lng]}
              icon={getStationIcon(stationGroup, stationGroup.length)}
              aria-label={locationLabel}
              title={isMultiple ? `${stationGroup.length} stations` : `${representativeStation.name} FM ${representativeStation.frequency}`}
              eventHandlers={{
                click: () => {
                  if (isMultiple) {
                    onStationSelect(representativeStation);
                  } else {
                    onStationSelect(representativeStation);
                  }
                },
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
                  <MultipleStationsPopup
                    key={`popup-${coordKey}`}
                    stationGroup={stationGroup}
                    lat={lat}
                    lng={lng}
                    distance={distance}
                  />
                ) : (
                  <SingleStationPopup
                    station={representativeStation}
                    distance={distance}
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