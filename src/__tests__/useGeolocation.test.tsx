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
});
