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
  const hasFixRef = useRef(false);

  useEffect(() => {
    if (status === 'unsupported') return;
    hasFixRef.current = false;

    const applyFix = (coords: GeolocationCoordinates) => {
      hasFixRef.current = true;
      setUserLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      });
      setStatus('granted');
    };

    const setStatusFromError = (code: number, denied: number, unavailable: number) => {
      if (code === denied) setStatus('denied');
      else if (code === unavailable) setStatus('unavailable');
      else setStatus('timeout');
    };

    // Phase 1: quick low-accuracy fix using Wi-Fi/cell — fast on iOS, often
    // returns a cached position immediately. Only propagate PERMISSION_DENIED
    // (which is terminal); TIMEOUT/UNAVAILABLE here are silently retried by
    // the high-accuracy watch in phase 2.
    navigator.geolocation.getCurrentPosition(
      (pos) => applyFix(pos.coords),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatusFromError(err.code, err.PERMISSION_DENIED, err.POSITION_UNAVAILABLE);
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );

    // Phase 2: continuous high-accuracy watch. Long timeout because iOS GPS
    // can take 20+ seconds for a cold lock. Errors are ignored once we
    // already have a fix so a single drop doesn't flip the UI to "RETRY".
    const id = navigator.geolocation.watchPosition(
      (pos) => applyFix(pos.coords),
      (err) => {
        if (hasFixRef.current) return;
        setStatusFromError(err.code, err.PERMISSION_DENIED, err.POSITION_UNAVAILABLE);
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 30000 }
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
