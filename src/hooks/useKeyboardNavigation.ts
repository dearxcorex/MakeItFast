import { useEffect, useState, useCallback } from 'react';
import { FMStation, UserLocation } from '@/types/station';

interface UseKeyboardNavigationOptions {
  stations: FMStation[];
  isOpen: boolean;
  userLocation?: UserLocation;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  onToggle: () => void;
  onStationSelect: (station: FMStation) => void;
}

export function useKeyboardNavigation({
  stations,
  isOpen,
  userLocation,
  calculateDistance,
  onToggle,
  onStationSelect,
}: UseKeyboardNavigationOptions) {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const getFilteredStations = useCallback(() => {
    if (!userLocation) return stations;
    return stations.filter(station => {
      const distance = calculateDistance(
        userLocation.latitude, userLocation.longitude,
        station.latitude, station.longitude
      );
      return distance <= 20;
    });
  }, [stations, userLocation, calculateDistance]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const filteredStations = getFilteredStations();

      switch (e.key) {
        case 'Escape':
          if (isOpen) onToggle();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (filteredStations.length > 0) {
            setSelectedIndex(prev => prev < filteredStations.length - 1 ? prev + 1 : 0);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (filteredStations.length > 0) {
            setSelectedIndex(prev => prev > 0 ? prev - 1 : filteredStations.length - 1);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < filteredStations.length) {
            onStationSelect(filteredStations[selectedIndex]);
          }
          break;
        case '/':
          e.preventDefault();
          document.getElementById('search-filter')?.focus();
          break;
      }
    };

    if (isOpen || window.innerWidth >= 1024) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, selectedIndex, getFilteredStations, onToggle, onStationSelect]);

  return { selectedIndex };
}
