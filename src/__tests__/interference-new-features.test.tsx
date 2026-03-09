/**
 * Tests for interference analysis new features:
 * 1. User location marker on InterferenceMap
 * 2. Inspection status in InterferenceMap popup
 * 3. Inspection status toggle in InterferenceSiteDetail
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock NavigateButton
vi.mock('@/components/map/NavigateButton', () => ({
  default: ({ lat, lng, stationName }: { lat: number; lng: number; stationName?: string }) => (
    <div
      data-testid="navigate-button"
      data-lat={lat}
      data-lng={lng}
      data-station-name={stationName ?? ''}
    />
  ),
}));

// Mock leaflet CSS
vi.mock('leaflet/dist/leaflet.css', () => ({}));

// Mock leaflet
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn((opts) => ({ options: opts })),
    icon: vi.fn((opts) => ({ options: opts })),
  },
  divIcon: vi.fn((opts) => ({ options: opts })),
  icon: vi.fn((opts) => ({ options: opts })),
}));

// Mock react-leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  Polyline: () => <div data-testid="polyline" />,
  ImageOverlay: () => <div data-testid="image-overlay" />,
  useMap: () => ({ flyTo: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

import InterferenceMap from '@/components/interference/InterferenceMap';
import InterferenceSiteDetail from '@/components/interference/InterferenceSiteDetail';

// ==========================================
// Helper factory
// ==========================================
const makeSite = (overrides = {}) => ({
  id: 1,
  siteCode: 'AWN-001',
  siteName: 'Site Alpha',
  lat: 13.75,
  long: 100.5,
  changwat: 'Bangkok',
  ranking: 'Critical',
  mcZone: 'Zone-A',
  cellName: 'Cell-A',
  sectorName: 'Sector-B',
  direction: 90,
  avgNiCarrier: -85.5,
  dayTime: -82,
  nightTime: -88,
  sourceLat: 13.76,
  sourceLong: 100.51,
  sourceLocation1: null,
  sourceLocation2: null,
  estimateDistance: 2.5,
  ranking2: null,
  status: null,
  nbtcArea: 'Area-1',
  awnContact: null,
  lot: null,
  onSiteScanBy: null,
  onSiteScanDate: null,
  checkRealtime: null,
  cameraModel1: null,
  cameraModel2: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const defaultMapProps = {
  sites: [] as ReturnType<typeof makeSite>[],
  selectedSite: null,
  onSiteSelect: vi.fn(),
  propagationOverlays: [],
  flyToSite: null,
};

// ==========================================
// InterferenceMap — User Location Marker
// ==========================================
describe('InterferenceMap - User Location Marker', () => {
  it('renders user location marker when userLocation is provided', () => {
    const userLocation = { latitude: 13.8, longitude: 100.6, accuracy: 50 };
    const { container } = render(
      <InterferenceMap {...defaultMapProps} userLocation={userLocation} />
    );
    // Extra marker for user location
    const markers = container.querySelectorAll('[data-testid="marker"]');
    expect(markers.length).toBe(1); // Only user location marker, no sites
  });

  it('does not render user location marker when userLocation is undefined', () => {
    const { container } = render(
      <InterferenceMap {...defaultMapProps} />
    );
    const markers = container.querySelectorAll('[data-testid="marker"]');
    expect(markers.length).toBe(0);
  });

  it('shows "Your Location" popup text', () => {
    const userLocation = { latitude: 13.8, longitude: 100.6 };
    const { container } = render(
      <InterferenceMap {...defaultMapProps} userLocation={userLocation} />
    );
    expect(container.textContent).toContain('Your Location');
    expect(container.textContent).toContain('Current position');
  });

  it('shows accuracy when available', () => {
    const userLocation = { latitude: 13.8, longitude: 100.6, accuracy: 42 };
    const { container } = render(
      <InterferenceMap {...defaultMapProps} userLocation={userLocation} />
    );
    expect(container.textContent).toContain('Accuracy: ±42m');
  });

  it('does not show accuracy when not available', () => {
    const userLocation = { latitude: 13.8, longitude: 100.6 };
    const { container } = render(
      <InterferenceMap {...defaultMapProps} userLocation={userLocation} />
    );
    expect(container.textContent).not.toContain('Accuracy');
  });

  it('renders user location marker alongside site markers', () => {
    const userLocation = { latitude: 13.8, longitude: 100.6 };
    const sites = [makeSite({ id: 1, sourceLat: null, sourceLong: null })];
    const { container } = render(
      <InterferenceMap {...defaultMapProps} sites={sites} userLocation={userLocation} />
    );
    const markers = container.querySelectorAll('[data-testid="marker"]');
    // 1 user location + 1 tower marker
    expect(markers.length).toBe(2);
  });
});


