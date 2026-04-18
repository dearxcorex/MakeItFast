import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import React from 'react';

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock equipmentProfiles for CloudRFControls
vi.mock('@/utils/equipmentProfiles', () => ({
  EQUIPMENT_PROFILES: {
    macro_urban: { txPower: 20, antennaHeight: 30, antennaGain: 17, downtilt: 6, bandwidth: 20, feederLoss: 2 },
    macro_suburban: { txPower: 20, antennaHeight: 45, antennaGain: 18, downtilt: 4, bandwidth: 20, feederLoss: 2 },
    macro_rural: { txPower: 40, antennaHeight: 55, antennaGain: 18, downtilt: 3, bandwidth: 20, feederLoss: 2 },
  },
  PROPAGATION_MODELS: { 1: 'ITM/Longley-Rice', 2: 'Okumura-Hata', 3: 'COST231' },
  THAILAND_ENVIRONMENT: { propagationModel: 1, climate: 1, landcover: 1, buildings: 1, diffraction: 1, reliability: 50 },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ==========================================
// InterferenceFilterPanel
// ==========================================
import InterferenceFilterPanel from '@/components/interference/InterferenceFilterPanel';

describe('InterferenceFilterPanel', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ byProvince: { Bangkok: 5, 'Chiang Mai': 3 } }),
    });
  });

  it('renders dropdowns', async () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={vi.fn()} />
    );
    expect(container.textContent).toContain('All Provinces');
  });

  it('renders ranking filter badges', () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={vi.fn()} />
    );
    expect(container.textContent).toContain('Critical');
    expect(container.textContent).toContain('Major');
    expect(container.textContent).toContain('Minor');
    expect(container.textContent).toContain('Has Source');
  });

  it('toggles ranking filter on badge click', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );
    const criticalBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Critical'
    )!;
    fireEvent.click(criticalBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ranking: 'Critical' }));
  });

  it('untoggles ranking filter when clicking active badge', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{ ranking: 'Critical' }} onFiltersChange={onChange} />
    );
    const criticalBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Critical'
    )!;
    fireEvent.click(criticalBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ranking: undefined }));
  });

  it('toggles hasSource filter', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );
    const sourceBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Has Source'
    )!;
    fireEvent.click(sourceBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hasSource: true }));
  });

  it('changes province filter via select', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );

    // Wait for provinces to load from API
    await waitFor(() => {
      const selects = container.querySelectorAll('select');
      const options = selects[0].querySelectorAll('option');
      expect(options.length).toBeGreaterThan(1);
    });

    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Bangkok' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ changwat: 'Bangkok' }));
  });

  it('changes ranking filter via badge click', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );
    const majorBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Major'
    )!;
    fireEvent.click(majorBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ranking: 'Major' }));
  });

  it('shows clear button when filters active and clears', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{ ranking: 'Critical' }} onFiltersChange={onChange} />
    );
    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Clear all')
    )!;
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('does not show clear button when no filters active', () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={vi.fn()} />
    );
    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Clear all')
    );
    expect(clearBtn).toBeUndefined();
  });

  it('renders status filter buttons', () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={vi.fn()} />
    );
    expect(container.textContent).toContain('ตรวจแล้ว');
    expect(container.textContent).toContain('ยังไม่ตรวจ');
  });

  it('toggles ตรวจแล้ว status filter on click', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );
    const statusBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('ตรวจแล้ว') && !b.textContent?.includes('ยังไม่ตรวจ')
    )!;
    fireEvent.click(statusBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'ตรวจแล้ว' }));
  });

  it('untoggles ตรวจแล้ว status filter when already active', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{ status: 'ตรวจแล้ว' }} onFiltersChange={onChange} />
    );
    const statusBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('ตรวจแล้ว') && !b.textContent?.includes('ยังไม่ตรวจ')
    )!;
    fireEvent.click(statusBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it('toggles ยังไม่ตรวจ status filter on click', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );
    const statusBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('ยังไม่ตรวจ')
    )!;
    fireEvent.click(statusBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'ยังไม่ตรวจ' }));
  });

  it('shows active class when ตรวจแล้ว status is active', () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{ status: 'ตรวจแล้ว' }} onFiltersChange={vi.fn()} />
    );
    const statusBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('ตรวจแล้ว') && !b.textContent?.includes('ยังไม่ตรวจ')
    )!;
    expect(statusBtn.className).toContain('active');
  });

  it('shows active class when ยังไม่ตรวจ status is active', () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{ status: 'ยังไม่ตรวจ' }} onFiltersChange={vi.fn()} />
    );
    const statusBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('ยังไม่ตรวจ')
    )!;
    expect(statusBtn.className).toContain('active');
  });

  it('includes status in clear all filters', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{ status: 'ตรวจแล้ว' }} onFiltersChange={onChange} />
    );
    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Clear all')
    )!;
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith({});
  });
});

// ==========================================
// CloudRFControls
// ==========================================
import CloudRFControls from '@/components/interference/CloudRFControls';

const makeControlSite = (overrides = {}) => ({
  id: 1,
  siteCode: 'AWN-001',
  siteName: 'Site Alpha',
  lat: 13.75,
  long: 100.5,
  direction: 90,
  sourceLat: 14.0,
  sourceLong: 101.0,
  changwat: null,
  cellName: null,
  sectorName: null,
  mcZone: null,
  avgNiCarrier: null,
  dayTime: null,
  nightTime: null,
  estimateDistance: null,
  ranking: null,
  status: null,
  nbtcArea: null,
  awnContact: null,
  lot: null,
  onSiteScanBy: null,
  onSiteScanDate: null,
  checkRealtime: null,
  sourceLocation1: null,
  sourceLocation2: null,
  cameraModel1: null,
  cameraModel2: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('CloudRFControls', () => {
  it('renders deployment type selector and parameters', () => {
    const { container } = render(
      <CloudRFControls site={makeControlSite()} onResult={vi.fn()} />
    );
    expect(container.textContent).toContain('CloudRF Analysis');
    expect(container.textContent).toContain('Deployment Type');
    expect(container.textContent).toContain('Power (W)');
    expect(container.textContent).toContain('Height (m)');
    expect(container.textContent).toContain('Radius (km)');
    expect(container.textContent).toContain('Run Propagation');
  });

  it('shows Point-to-Point button when source coords exist', () => {
    const { container } = render(
      <CloudRFControls site={makeControlSite()} onResult={vi.fn()} />
    );
    expect(container.textContent).toContain('Point-to-Point');
  });

  it('hides Point-to-Point button when no source coords', () => {
    const { container } = render(
      <CloudRFControls site={makeControlSite({ sourceLat: null, sourceLong: null })} onResult={vi.fn()} />
    );
    expect(container.textContent).not.toContain('Point-to-Point');
  });

  it('changes deployment type and updates params', () => {
    const { container } = render(
      <CloudRFControls site={makeControlSite()} onResult={vi.fn()} />
    );
    const select = container.querySelector('select')!;
    fireEvent.change(select, { target: { value: 'macro_rural' } });

    // Power should update to rural profile
    const powerInput = container.querySelector('input[min="0.001"]') as HTMLInputElement;
    expect(powerInput.value).toBe('40');
  });

  it('toggles advanced settings', () => {
    const { container } = render(
      <CloudRFControls site={makeControlSite()} onResult={vi.fn()} />
    );
    expect(container.textContent).not.toContain('Antenna Gain');

    const advBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Advanced Settings')
    )!;
    fireEvent.click(advBtn);

    expect(container.textContent).toContain('Antenna Gain');
    expect(container.textContent).toContain('Propagation Model');
    expect(container.textContent).toContain('Clutter/Landcover');
    expect(container.textContent).toContain('Buildings');
  });

  it('handles successful propagation calculation', async () => {
    const onResult = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pngUrl: 'http://test.png', bounds: [[0,0],[1,1]] }),
    });

    const { container } = render(
      <CloudRFControls site={makeControlSite()} onResult={onResult} />
    );

    const runBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Run Propagation')
    )!;

    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(expect.objectContaining({
        siteId: 1,
        pngUrl: 'http://test.png',
      }));
    });
  });

  it('shows error when propagation fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    const { container } = render(
      <CloudRFControls site={makeControlSite()} onResult={vi.fn()} />
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
      <CloudRFControls site={makeControlSite()} onResult={vi.fn()} />
    );

    const runBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Run Propagation')
    )!;

    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      expect(container.textContent).toContain('No coverage data');
    });
  });

  it('handles path analysis success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pathLoss: 120.5, signalLevel: -85.3, distance: 3.45 }),
    });

    const { container } = render(
      <CloudRFControls site={makeControlSite()} onResult={vi.fn()} />
    );

    const pathBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Point-to-Point')
    )!;

    await act(async () => {
      fireEvent.click(pathBtn);
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Path Analysis Result');
      expect(container.textContent).toContain('120.5');
      expect(container.textContent).toContain('-85.3');
      expect(container.textContent).toContain('3.45');
    });
  });

  it('handles path analysis error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Bad request' }),
    });

    const { container } = render(
      <CloudRFControls site={makeControlSite()} onResult={vi.fn()} />
    );

    const pathBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Point-to-Point')
    )!;

    await act(async () => {
      fireEvent.click(pathBtn);
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Bad request');
    });
  });

  it('shows clear overlays button when overlays exist', () => {
    const { container } = render(
      <CloudRFControls site={makeControlSite()} onResult={vi.fn()} onClearOverlays={vi.fn()} overlayCount={3} />
    );
    expect(container.textContent).toContain('Clear 3 overlays');
  });

  it('calls onClearOverlays when clear button clicked', () => {
    const onClear = vi.fn();
    const { container } = render(
      <CloudRFControls site={makeControlSite()} onResult={vi.fn()} onClearOverlays={onClear} overlayCount={2} />
    );
    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Clear')
    )!;
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalled();
  });

  it('handles network error in propagation', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network down'));

    const { container } = render(
      <CloudRFControls site={makeControlSite()} onResult={vi.fn()} />
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

  it('handles network error in path analysis', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));

    const { container } = render(
      <CloudRFControls site={makeControlSite()} onResult={vi.fn()} />
    );

    const pathBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Point-to-Point')
    )!;

    await act(async () => {
      fireEvent.click(pathBtn);
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Network error: Timeout');
    });
  });

  it('disables propagation button when no coords', () => {
    const { container } = render(
      <CloudRFControls site={makeControlSite({ lat: null, long: null })} onResult={vi.fn()} />
    );
    const runBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Run Propagation')
    )!;
    expect(runBtn.disabled).toBe(true);
  });
});
