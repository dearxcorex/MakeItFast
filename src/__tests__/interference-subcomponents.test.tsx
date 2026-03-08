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
// ImportDialog
// ==========================================
import ImportDialog from '@/components/interference/ImportDialog';

describe('ImportDialog', () => {
  it('renders dialog with title and buttons', () => {
    const { container } = render(<ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />);
    expect(container.textContent).toContain('Import Interference Data');
    expect(container.textContent).toContain('Cancel');
    expect(container.textContent).toContain('Import');
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<ImportDialog onClose={onClose} onImportComplete={vi.fn()} />);
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Cancel')
    )!;
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<ImportDialog onClose={onClose} onImportComplete={vi.fn()} />);
    // Backdrop is the first div with bg-black
    const backdrop = container.querySelector('.bg-black\\/60');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('disables import button when no file selected', () => {
    const { container } = render(<ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />);
    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Import'
    )!;
    expect(importBtn.disabled).toBe(true);
  });

  it('shows file info after selection', async () => {
    const { container } = render(<ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.csv', { type: 'text/csv' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    expect(container.textContent).toContain('test.csv');
  });

  it('handles successful import', async () => {
    vi.useFakeTimers();
    const onImportComplete = vi.fn();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, imported: 5 }),
    });

    const { container } = render(<ImportDialog onClose={vi.fn()} onImportComplete={onImportComplete} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Import'
    )!;

    // Click and flush promises
    await act(async () => {
      fireEvent.click(importBtn);
      // Allow the async handleImport to run
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Successfully imported 5 records');

    // onImportComplete called after 1500ms timeout
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(onImportComplete).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('handles import error', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, error: 'Invalid file format' }),
    });

    const { container } = render(<ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Import'
    )!;

    await act(async () => {
      fireEvent.click(importBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Error: Invalid file format');
  });

  it('handles network error during import', async () => {
    mockFetch.mockRejectedValue(new Error('Network failed'));

    const { container } = render(<ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'test.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Import'
    )!;

    await act(async () => {
      fireEvent.click(importBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Error:');
  });
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

  it('renders search input and dropdowns', async () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={vi.fn()} />
    );
    expect(container.querySelector('input[type="text"]')).toBeTruthy();
    expect(container.textContent).toContain('All Provinces');
    expect(container.textContent).toContain('All Rankings');
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

  it('changes ranking filter via select', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );
    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[1], { target: { value: 'Major' } });
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

  it('debounces search input', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );
    const searchInput = container.querySelector('input[type="text"]')!;
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Not called immediately
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: 'test' }));
    vi.useRealTimers();
  });
});

// ==========================================
// InterferenceSiteList
// ==========================================
import InterferenceSiteList from '@/components/interference/InterferenceSiteList';

const makeSite = (overrides = {}) => ({
  id: 1,
  siteCode: 'AWN-001',
  siteName: 'Site Alpha',
  lat: 13.75,
  long: 100.5,
  changwat: 'Bangkok',
  ranking: 'Critical',
  mcZone: null,
  cellName: 'Cell-A',
  sectorName: null,
  direction: 90,
  avgNiCarrier: -80,
  dayTime: null,
  nightTime: null,
  sourceLat: null,
  sourceLong: null,
  estimateDistance: 2.5,
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

describe('InterferenceSiteList', () => {
  it('shows loading state', () => {
    const { container } = render(
      <InterferenceSiteList sites={[]} selectedSite={null} onSiteSelect={vi.fn()} loading={true} />
    );
    expect(container.textContent).toContain('Loading sites...');
  });

  it('shows empty state', () => {
    const { container } = render(
      <InterferenceSiteList sites={[]} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    expect(container.textContent).toContain('No sites found');
  });

  it('renders site list with count', () => {
    const sites = [makeSite(), makeSite({ id: 2, siteName: 'Site Beta', ranking: 'Major' })];
    const { container } = render(
      <InterferenceSiteList sites={sites} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    expect(container.textContent).toContain('2 sites');
    expect(container.textContent).toContain('Site Alpha');
    expect(container.textContent).toContain('Site Beta');
  });

  it('shows changwat and cell name', () => {
    const { container } = render(
      <InterferenceSiteList sites={[makeSite()]} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    expect(container.textContent).toContain('Bangkok');
    expect(container.textContent).toContain('Cell-A');
  });

  it('shows ranking badge', () => {
    const { container } = render(
      <InterferenceSiteList sites={[makeSite()]} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    expect(container.textContent).toContain('Critical');
  });

  it('shows noise level', () => {
    const { container } = render(
      <InterferenceSiteList sites={[makeSite()]} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    expect(container.textContent).toContain('-80.0 dBm');
  });

  it('shows distance', () => {
    const { container } = render(
      <InterferenceSiteList sites={[makeSite()]} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    expect(container.textContent).toContain('2.50 km');
  });

  it('calls onSiteSelect when site is clicked', () => {
    const onSelect = vi.fn();
    const site = makeSite();
    const { container } = render(
      <InterferenceSiteList sites={[site]} selectedSite={null} onSiteSelect={onSelect} loading={false} />
    );
    const siteBtn = container.querySelector('button[class*="w-full"]')!;
    fireEvent.click(siteBtn);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('highlights selected site', () => {
    const site = makeSite();
    const { container } = render(
      <InterferenceSiteList sites={[site]} selectedSite={site} onSiteSelect={vi.fn()} loading={false} />
    );
    const siteBtn = container.querySelector('button[class*="w-full"]')!;
    expect(siteBtn.className).toContain('bg-primary/10');
  });

  it('sorts by name', () => {
    const sites = [
      makeSite({ id: 1, siteName: 'Zulu', ranking: 'Minor' }),
      makeSite({ id: 2, siteName: 'Alpha', ranking: 'Critical' }),
    ];
    const { container } = render(
      <InterferenceSiteList sites={sites} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    // Change sort to name
    const select = container.querySelector('select')!;
    fireEvent.change(select, { target: { value: 'name' } });

    const buttons = container.querySelectorAll('button[class*="w-full"]');
    expect(buttons[0].textContent).toContain('Alpha');
    expect(buttons[1].textContent).toContain('Zulu');
  });

  it('sorts by noise', () => {
    const sites = [
      makeSite({ id: 1, siteName: 'Loud', avgNiCarrier: -60 }),
      makeSite({ id: 2, siteName: 'Quiet', avgNiCarrier: -90 }),
    ];
    const { container } = render(
      <InterferenceSiteList sites={sites} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    const select = container.querySelector('select')!;
    fireEvent.change(select, { target: { value: 'noise' } });

    const buttons = container.querySelectorAll('button[class*="w-full"]');
    expect(buttons[0].textContent).toContain('Quiet');
    expect(buttons[1].textContent).toContain('Loud');
  });

  it('sorts by distance', () => {
    const sites = [
      makeSite({ id: 1, siteName: 'Far', estimateDistance: 10 }),
      makeSite({ id: 2, siteName: 'Near', estimateDistance: 1 }),
    ];
    const { container } = render(
      <InterferenceSiteList sites={sites} selectedSite={null} onSiteSelect={vi.fn()} loading={false} />
    );
    const select = container.querySelector('select')!;
    fireEvent.change(select, { target: { value: 'distance' } });

    const buttons = container.querySelectorAll('button[class*="w-full"]');
    expect(buttons[0].textContent).toContain('Near');
    expect(buttons[1].textContent).toContain('Far');
  });

  it('falls back to siteCode or id when siteName is null', () => {
    const { container } = render(
      <InterferenceSiteList
        sites={[makeSite({ id: 42, siteName: null, siteCode: 'CODE-42' })]}
        selectedSite={null}
        onSiteSelect={vi.fn()}
        loading={false}
      />
    );
    expect(container.textContent).toContain('CODE-42');
  });

  it('falls back to Site #id when both siteName and siteCode are null', () => {
    const { container } = render(
      <InterferenceSiteList
        sites={[makeSite({ id: 99, siteName: null, siteCode: null })]}
        selectedSite={null}
        onSiteSelect={vi.fn()}
        loading={false}
      />
    );
    expect(container.textContent).toContain('Site #99');
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
