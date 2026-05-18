import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from '@/hooks/useGeolocation';

type GeolocationMock = {
  getCurrentPosition: ReturnType<typeof vi.fn>;
  watchPosition: ReturnType<typeof vi.fn>;
  clearWatch: ReturnType<typeof vi.fn>;
};

let geoMock: GeolocationMock;
let originalGeolocation: Geolocation | undefined;

function installGeolocationMock() {
  geoMock = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(() => 1),
    clearWatch: vi.fn(),
  };
  originalGeolocation = navigator.geolocation;
  Object.defineProperty(navigator, 'geolocation', {
    value: geoMock,
    configurable: true,
  });
}

function restoreGeolocation() {
  Object.defineProperty(navigator, 'geolocation', {
    value: originalGeolocation,
    configurable: true,
  });
}

function makePosition(over: Partial<GeolocationCoordinates> = {}): GeolocationPosition {
  return {
    coords: {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 42,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
      ...over,
    } as GeolocationCoordinates,
    timestamp: Date.now(),
    toJSON: () => ({}),
  } as GeolocationPosition;
}

describe('useGeolocation', () => {
  beforeEach(() => installGeolocationMock());
  afterEach(() => restoreGeolocation());

  it('starts in "locating" status with no userLocation', () => {
    geoMock.getCurrentPosition.mockImplementation(() => {});
    geoMock.watchPosition.mockImplementation(() => 1);
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe('locating');
    expect(result.current.userLocation).toBeUndefined();
  });

  it('transitions to "granted" and exposes userLocation when getCurrentPosition succeeds', () => {
    geoMock.getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success(makePosition({ latitude: 13.75, longitude: 100.5, accuracy: 25 }));
    });

    const { result } = renderHook(() => useGeolocation());

    expect(result.current.status).toBe('granted');
    expect(result.current.userLocation).toEqual({
      latitude: 13.75,
      longitude: 100.5,
      accuracy: 25,
    });
  });

  it('transitions to "denied" when getCurrentPosition errors with PERMISSION_DENIED', () => {
    geoMock.getCurrentPosition.mockImplementation((_s: PositionCallback, error: PositionErrorCallback) => {
      error({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'denied',
      } as GeolocationPositionError);
    });

    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe('denied');
    expect(result.current.userLocation).toBeUndefined();
  });

  it('updates userLocation when watchPosition delivers a new fix', () => {
    let watchSuccess: PositionCallback | null = null;
    geoMock.getCurrentPosition.mockImplementation((s: PositionCallback) => {
      s(makePosition({ latitude: 13.75, longitude: 100.5, accuracy: 25 }));
    });
    geoMock.watchPosition.mockImplementation((s: PositionCallback) => {
      watchSuccess = s;
      return 99;
    });

    const { result } = renderHook(() => useGeolocation());
    expect(result.current.userLocation?.latitude).toBe(13.75);

    expect(watchSuccess).not.toBeNull();
    act(() => {
      watchSuccess!(makePosition({ latitude: 14.0, longitude: 101.0, accuracy: 18 }));
    });

    expect(result.current.userLocation).toEqual({
      latitude: 14.0,
      longitude: 101.0,
      accuracy: 18,
    });
  });

  it('does NOT expose heading or speed (no rotation, no heading cone)', () => {
    geoMock.getCurrentPosition.mockImplementation((s: PositionCallback) => {
      s(makePosition({ latitude: 13.75, longitude: 100.5, heading: 90, speed: 5 }));
    });
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.userLocation?.heading).toBeUndefined();
    expect(result.current.userLocation?.speed).toBeUndefined();
  });

  it('calls clearWatch on unmount', () => {
    geoMock.watchPosition.mockReturnValue(77);
    geoMock.getCurrentPosition.mockImplementation(() => {});
    const { unmount } = renderHook(() => useGeolocation());
    unmount();
    expect(geoMock.clearWatch).toHaveBeenCalledWith(77);
  });

  it('does NOT downgrade status from "granted" when watchPosition later errors with TIMEOUT', () => {
    let watchError: PositionErrorCallback | null = null;
    geoMock.getCurrentPosition.mockImplementation((s: PositionCallback) => {
      s(makePosition({ latitude: 13.75, longitude: 100.5, accuracy: 25 }));
    });
    geoMock.watchPosition.mockImplementation((_s: PositionCallback, error: PositionErrorCallback) => {
      watchError = error;
      return 42;
    });

    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe('granted');
    expect(result.current.userLocation?.latitude).toBe(13.75);

    act(() => {
      watchError!({
        code: 3,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'timeout',
      } as GeolocationPositionError);
    });

    expect(result.current.status).toBe('granted');
    expect(result.current.userLocation?.latitude).toBe(13.75);
  });

  it('silently ignores phase-1 TIMEOUT so phase-2 watch can still succeed', () => {
    let watchSuccess: PositionCallback | null = null;
    geoMock.getCurrentPosition.mockImplementation((_s: PositionCallback, error: PositionErrorCallback) => {
      error({
        code: 3,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'timeout',
      } as GeolocationPositionError);
    });
    geoMock.watchPosition.mockImplementation((s: PositionCallback) => {
      watchSuccess = s;
      return 7;
    });

    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe('locating');

    act(() => {
      watchSuccess!(makePosition({ latitude: 14.0, longitude: 101.0, accuracy: 20 }));
    });
    expect(result.current.status).toBe('granted');
    expect(result.current.userLocation?.latitude).toBe(14.0);
  });

  it('retry() re-invokes getCurrentPosition', () => {
    geoMock.getCurrentPosition.mockImplementation((_s: PositionCallback, error: PositionErrorCallback) => {
      error({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'denied',
      } as GeolocationPositionError);
    });
    const { result, rerender } = renderHook(() => useGeolocation());
    expect(geoMock.getCurrentPosition).toHaveBeenCalledTimes(1);

    result.current.retry();
    rerender();
    expect(geoMock.getCurrentPosition).toHaveBeenCalledTimes(2);
  });
});
