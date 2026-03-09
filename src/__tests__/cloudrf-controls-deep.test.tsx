import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock leaflet
vi.mock('leaflet', () => ({
  default: { divIcon: vi.fn((opts) => ({ options: opts })), icon: vi.fn((opts) => ({ options: opts })) },
  divIcon: vi.fn((opts) => ({ options: opts })),
  icon: vi.fn((opts) => ({ options: opts })),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => <div />,
  Marker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ flyTo: vi.fn() }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

import CloudRFControls from '@/components/interference/CloudRFControls';

const makeSite = (overrides = {}) => ({
  id: 1, siteCode: 'AWN-001', siteName: 'Test Site',
  lat: 13.75, long: 100.5, mcZone: 'Zone1', changwat: 'กรุงเทพ',
  cellName: 'Cell-A', sectorName: 'S1', direction: 120, avgNiCarrier: -85.5,
  dayTime: -82, nightTime: -88, sourceLat: 13.76, sourceLong: 100.51,
  estimateDistance: 1.5, ranking: 'Critical', status: 'Active',
  nbtcArea: 'Area1', awnContact: null, lot: null, onSiteScanBy: null,
  onSiteScanDate: null, checkRealtime: null, sourceLocation1: null,
  sourceLocation2: null, cameraModel1: null, cameraModel2: null,
  notes: null, createdAt: new Date(), updatedAt: new Date(),
  ...overrides,
});

describe('CloudRFControls - handleCalculate', () => {
  it('calls API and invokes onResult on success', async () => {
    const onResult = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        pngUrl: 'http://example.com/img.png',
        bounds: [[13, 100], [14, 101]],
      }),
    });

    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={onResult} />
    );

    const runBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Run Propagation')
    )!;

    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith({
        siteId: 1,
        pngUrl: 'http://example.com/img.png',
        leafletBounds: [[13, 100], [14, 101]],
      });
    });
  });

  it('shows error when API returns error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const runBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Run Propagation')
    )!;

    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Server error');
    });
  });

  it('shows error when no coverage data returned', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const runBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Run Propagation')
    )!;

    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      expect(container.textContent).toContain('No coverage data returned');
    });
  });

  it('shows network error on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network down'));

    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const runBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Run Propagation')
    )!;

    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Network error: Network down');
    });
  });

  it('does not call API when lat/long are null', async () => {
    const { container } = render(
      <CloudRFControls site={makeSite({ lat: null, long: null })} onResult={vi.fn()} />
    );

    const runBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Run Propagation')
    )!;

    await act(async () => {
      fireEvent.click(runBtn);
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('CloudRFControls - handlePathAnalysis', () => {
  it('calls path API and shows result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        pathLoss: 120.5,
        signalLevel: -85.3,
        distance: 1.5,
      }),
    });

    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const p2pBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Point-to-Point')
    )!;

    await act(async () => {
      fireEvent.click(p2pBtn);
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Path Analysis Result');
      expect(container.textContent).toContain('120.5');
      expect(container.textContent).toContain('-85.3');
      expect(container.textContent).toContain('1.50');
    });
  });

  it('shows path API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Bad request' }),
    });

    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const p2pBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Point-to-Point')
    )!;

    await act(async () => {
      fireEvent.click(p2pBtn);
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Bad request');
    });
  });

  it('shows network error on path fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));

    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const p2pBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Point-to-Point')
    )!;

    await act(async () => {
      fireEvent.click(p2pBtn);
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Network error: Timeout');
    });
  });

  it('does not call path API when source coords missing', async () => {
    const { container } = render(
      <CloudRFControls site={makeSite({ sourceLat: null, sourceLong: null })} onResult={vi.fn()} />
    );

    // Point-to-Point button should not be rendered
    const p2pBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Point-to-Point')
    );
    expect(p2pBtn).toBeFalsy();
  });
});

describe('CloudRFControls - advanced settings', () => {
  it('toggles advanced settings panel', () => {
    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    // Advanced settings should be hidden initially
    expect(container.textContent).not.toContain('Antenna Gain (dBi)');

    // Click advanced settings button
    const advBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Advanced Settings')
    )!;
    fireEvent.click(advBtn);

    expect(container.textContent).toContain('Antenna Gain (dBi)');
    expect(container.textContent).toContain('Propagation Model');
    expect(container.textContent).toContain('Clutter/Landcover');
    expect(container.textContent).toContain('Buildings');
  });

  it('changes deployment type and updates params', () => {
    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const deploySelect = container.querySelectorAll('select')[0];
    fireEvent.change(deploySelect, { target: { value: 'macro_rural' } });

    // Power should update to 40W for rural
    const powerInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(Number(powerInput.value)).toBe(40);
  });

  it('changes power input', () => {
    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const inputs = container.querySelectorAll('input[type="number"]');
    const powerInput = inputs[0] as HTMLInputElement;
    fireEvent.change(powerInput, { target: { value: '50' } });
    expect(Number(powerInput.value)).toBe(50);
  });

  it('changes height input', () => {
    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const inputs = container.querySelectorAll('input[type="number"]');
    const heightInput = inputs[1] as HTMLInputElement;
    fireEvent.change(heightInput, { target: { value: '60' } });
    expect(Number(heightInput.value)).toBe(60);
  });

  it('changes radius input', () => {
    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const inputs = container.querySelectorAll('input[type="number"]');
    const radiusInput = inputs[2] as HTMLInputElement;
    fireEvent.change(radiusInput, { target: { value: '10' } });
    expect(Number(radiusInput.value)).toBe(10);
  });

  it('changes azimuth slider', () => {
    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const azimuthSlider = container.querySelector('input[type="range"]') as HTMLInputElement;
    fireEvent.change(azimuthSlider, { target: { value: '180' } });
    expect(container.textContent).toContain('180°');
  });

  it('toggles clutter checkbox in advanced', () => {
    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    // Open advanced
    const advBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Advanced Settings')
    )!;
    fireEvent.click(advBtn);

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const clutterCheckbox = checkboxes[0] as HTMLInputElement;
    expect(clutterCheckbox.checked).toBe(true);
    fireEvent.change(clutterCheckbox, { target: { checked: false } });
  });

  it('toggles buildings checkbox in advanced', () => {
    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const advBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Advanced Settings')
    )!;
    fireEvent.click(advBtn);

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const buildingsCheckbox = checkboxes[1] as HTMLInputElement;
    expect(buildingsCheckbox.checked).toBe(true);
    fireEvent.change(buildingsCheckbox, { target: { checked: false } });
  });

  it('changes propagation model in advanced', () => {
    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const advBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Advanced Settings')
    )!;
    fireEvent.click(advBtn);

    const selects = container.querySelectorAll('select');
    // Second select is propagation model (first is deployment type)
    const propModelSelect = selects[1];
    fireEvent.change(propModelSelect, { target: { value: '11' } });
  });

  it('changes antenna gain in advanced', () => {
    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const advBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Advanced Settings')
    )!;
    fireEvent.click(advBtn);

    const numberInputs = container.querySelectorAll('input[type="number"]');
    // After advanced opens: power, height, radius, antennaGain
    const gainInput = numberInputs[3] as HTMLInputElement;
    fireEvent.change(gainInput, { target: { value: '20' } });
    expect(Number(gainInput.value)).toBe(20);
  });

  it('changes downtilt slider in advanced', () => {
    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const advBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Advanced Settings')
    )!;
    fireEvent.click(advBtn);

    const sliders = container.querySelectorAll('input[type="range"]');
    // Second slider is downtilt (first is azimuth)
    const downtiltSlider = sliders[1] as HTMLInputElement;
    fireEvent.change(downtiltSlider, { target: { value: '10' } });
  });

  it('clear overlay button calls onClearOverlays', () => {
    const onClear = vi.fn();
    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} onClearOverlays={onClear} overlayCount={2} />
    );

    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Clear 2 overlays')
    )!;
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });

  it('sends environment overrides when advanced settings differ', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pngUrl: 'http://x.com/i.png', bounds: [[13, 100], [14, 101]] }),
    });

    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    // Open advanced and disable clutter
    const advBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Advanced Settings')
    )!;
    fireEvent.click(advBtn);

    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    // Use click instead of change for checkboxes
    fireEvent.click(checkboxes[0]); // toggle clutter off

    const runBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Run Propagation')
    )!;

    await act(async () => {
      fireEvent.click(runBtn);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/cloudrf/area', expect.objectContaining({
      method: 'POST',
    }));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.environment).toBeDefined();
    expect(body.environment.landcover).toBe(0);
  });

  it('shows Calculating... while loading', async () => {
    let resolvePromise: (v: unknown) => void;
    const promise = new Promise((resolve) => { resolvePromise = resolve; });
    mockFetch.mockReturnValueOnce(promise);

    const { container } = render(
      <CloudRFControls site={makeSite()} onResult={vi.fn()} />
    );

    const runBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Run Propagation')
    )!;

    act(() => {
      fireEvent.click(runBtn);
    });

    expect(container.textContent).toContain('Calculating...');

    // Resolve to cleanup
    await act(async () => {
      resolvePromise!({ ok: true, json: () => Promise.resolve({}) });
    });
  });
});
