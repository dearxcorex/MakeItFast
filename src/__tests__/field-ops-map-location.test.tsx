import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { UserLocation } from '@/types/station';

vi.mock('leaflet', async () => {
  return {
    default: {
      divIcon: (opts: { html: string; className?: string }) => ({ options: opts, _html: opts.html }),
      icon: () => ({}),
    },
    divIcon: (opts: { html: string }) => ({ options: opts, _html: opts.html }),
  };
});

vi.mock('react-leaflet', async () => {
  return {
    MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
    TileLayer: () => null,
    Marker: ({ position, icon }: { position: [number, number]; icon: { _html?: string } }) => (
      <div
        data-testid="marker"
        data-lat={position[0]}
        data-lng={position[1]}
        data-html={icon?._html ?? ''}
      />
    ),
    Polyline: () => null,
    useMap: () => ({ flyTo: vi.fn(), setView: vi.fn() }),
    useMapEvents: () => null,
  };
});

vi.mock('react-leaflet-cluster', async () => {
  return { default: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

import { FieldOpsMap } from '@/components/field-ops/FieldOpsMap';

describe('FieldOpsMap — current location pin', () => {
  it('renders a static location marker (no cone) when userLocation is provided', () => {
    const userLocation: UserLocation = {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 25,
    };
    const { getAllByTestId } = render(
      <FieldOpsMap
        stations={[]}
        interference={[]}
        selection={null}
        onSelect={vi.fn()}
        flyTarget={null}
        userLocation={userLocation}
      />
    );
    const markers = getAllByTestId('marker');
    const locMarker = markers.find(
      (m) => m.getAttribute('data-lat') === '13.7563' && m.getAttribute('data-lng') === '100.5018'
    );
    expect(locMarker).toBeDefined();
    const html = locMarker!.getAttribute('data-html') ?? '';
    expect(html).toContain('location-dot');
    expect(html).not.toContain('heading-cone');
  });

  it('renders NO location marker when userLocation is undefined', () => {
    const { container, queryAllByTestId } = render(
      <FieldOpsMap
        stations={[]}
        interference={[]}
        selection={null}
        onSelect={vi.fn()}
        flyTarget={null}
      />
    );
    const markers = queryAllByTestId('marker').filter((m) => container.contains(m));
    const locMarker = markers.find((m) =>
      (m.getAttribute('data-html') ?? '').includes('location-dot')
    );
    expect(locMarker).toBeUndefined();
  });
});
