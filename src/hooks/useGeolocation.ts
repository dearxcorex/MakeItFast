'use client';

import { useEffect, useRef, useState } from 'react';
import type { UserLocation } from '@/types/station';

export type GeolocationStatus =
  | 'unsupported'
  | 'locating'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'timeout';

export interface UseGeolocationResult {
  userLocation: UserLocation | undefined;
  status: GeolocationStatus;
  retry: () => void;
}

export function useGeolocation(): UseGeolocationResult {
  const [userLocation, setUserLocation] = useState<UserLocation | undefined>(undefined);
  const [status, setStatus] = useState<GeolocationStatus>(
    typeof navigator !== 'undefined' && navigator.geolocation ? 'locating' : 'unsupported'
  );
  const [attempt, setAttempt] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === 'unsupported') return;

    const applyFix = (coords: GeolocationCoordinates) => {
      setUserLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      });
      setStatus('granted');
    };

    const handleError = (err: GeolocationPositionError) => {
      switch (err.code) {
        case err.PERMISSION_DENIED: setStatus('denied'); break;
        case err.POSITION_UNAVAILABLE: setStatus('unavailable'); break;
        case err.TIMEOUT: setStatus('timeout'); break;
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => applyFix(pos.coords),
      handleError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );

    const id = navigator.geolocation.watchPosition(
      (pos) => applyFix(pos.coords),
      handleError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- status is read inside effect for an early-return gate; only `attempt` should trigger re-subscription
  }, [attempt]);

  const retry = () => {
    if (status === 'unsupported') return;
    setStatus('locating');
    setAttempt((n) => n + 1);
  };

  return { userLocation, status, retry };
}
