import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import React from 'react';

// Mock intermod calculation utilities
const mockFindPairsForTargetFrequency = vi.fn();
const mockAssessInterferenceRisk = vi.fn();
const mockCalculateThirdOrderProducts = vi.fn();
const mockFormatDistance = vi.fn((d: number) => `${d.toFixed(1)} km`);
const mockGetRiskLevelColor = vi.fn((level: string) => {
  const map: Record<string, string> = { CRITICAL: 'text-red-500', HIGH: 'text-orange-500', MEDIUM: 'text-yellow-500', LOW: 'text-green-500' };
  return map[level] || 'text-gray-500';
});
const mockGetRiskLevelBgColor = vi.fn((level: string) => {
  const map: Record<string, string> = { CRITICAL: 'bg-red-500/10', HIGH: 'bg-orange-500/10', MEDIUM: 'bg-yellow-500/10', LOW: 'bg-green-500/10' };
  return map[level] || 'bg-gray-500/10';
});
const mockSummarizeByService = vi.fn(() => ({}));
const mockFilterRiskAssessments = vi.fn((assessments: unknown[]) => assessments);

vi.mock('@/utils/intermodCalculations', () => ({
  findPairsForTargetFrequency: (...args: unknown[]) => mockFindPairsForTargetFrequency(...args),
  assessInterferenceRisk: (...args: unknown[]) => mockAssessInterferenceRisk(...args),
  calculateThirdOrderProducts: (...args: unknown[]) => mockCalculateThirdOrderProducts(...args),
  formatDistance: (d: number) => mockFormatDistance(d),
  getRiskLevelColor: (l: string) => mockGetRiskLevelColor(l),
  getRiskLevelBgColor: (l: string) => mockGetRiskLevelBgColor(l),
  summarizeByService: (...args: unknown[]) => mockSummarizeByService(...args),
  filterRiskAssessments: (...args: unknown[]) => mockFilterRiskAssessments(...args),
}));

import IntermodCalculator from '@/components/IntermodCalculator';
import type { FMStation } from '@/types/station';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const makeStation = (overrides: Partial<FMStation> = {}): FMStation => ({
  id: '1',
  name: 'Test FM',
  frequency: 98.5,
  latitude: 13.75,
  longitude: 100.5,
  city: 'Bangkok',
  state: 'Bangkok',
  genre: 'FM',
  onAir: true,
  ...overrides,
});

const stations: FMStation[] = [
  makeStation({ id: '1', name: 'Station A', frequency: 88.0 }),
  makeStation({ id: '2', name: 'Station B', frequency: 98.5 }),
  makeStation({ id: '3', name: 'Station C', frequency: 102.0 }),
];

describe('IntermodCalculator - Deep Tests', () => {
  it('defaults to aircraft-check mode', () => {
    const { container } = render(<IntermodCalculator stations={stations} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('aircraft-check');
    expect(container.textContent).toContain('Aircraft Frequency');
  });

  it('switches to specific-frequency mode', () => {
    const { container } = render(<IntermodCalculator stations={stations} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'specific-frequency' } });
    expect(container.textContent).toContain('FM Frequency 1 (MHz)');
    expect(container.textContent).toContain('FM Frequency 2 (MHz)');
    expect(container.textContent).not.toContain('Aircraft Frequency');
  });

  it('switches back to aircraft-check mode', () => {
    const { container } = render(<IntermodCalculator stations={stations} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'specific-frequency' } });
    fireEvent.change(select, { target: { value: 'aircraft-check' } });
    expect(container.textContent).toContain('Aircraft Frequency');
  });

  it('updates frequency inputs in specific-frequency mode', () => {
    const { container } = render(<IntermodCalculator stations={stations} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'specific-frequency' } });

    const inputs = container.querySelectorAll('input[type="number"]');
    const freq1Input = inputs[0] as HTMLInputElement;
    const freq2Input = inputs[1] as HTMLInputElement;

    fireEvent.change(freq1Input, { target: { value: '98.0' } });
    fireEvent.change(freq2Input, { target: { value: '88.0' } });

    expect(freq1Input.value).toBe('98.0');
    expect(freq2Input.value).toBe('88.0');
  });

  it('shows formula calculation in specific-frequency mode', () => {
    const { container } = render(<IntermodCalculator stations={stations} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'specific-frequency' } });

    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '98.0' } });
    fireEvent.change(inputs[1], { target: { value: '88.0' } });

    // 2 x 98 - 88 = 108.00 MHz and 2 x 88 - 98 = 78.00 MHz
    expect(container.textContent).toContain('108.00');
    expect(container.textContent).toContain('78.00');
  });

  it('triggers calculation in specific-frequency mode', async () => {
    vi.useFakeTimers();
    mockCalculateThirdOrderProducts.mockReturnValue([
      { type: '2f1-f2', frequency: 108.0, inAviationBand: true, affectedService: 'VOR/ILS' },
      { type: '2f2-f1', frequency: 78.0, inAviationBand: false },
    ]);

    const { container } = render(<IntermodCalculator stations={stations} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'specific-frequency' } });

    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '98.0' } });
    fireEvent.change(inputs[1], { target: { value: '88.0' } });

    const calcBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Calculate')
    )!;
    fireEvent.click(calcBtn);

    // Advance the setTimeout(50ms) inside handleCalculate
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(mockCalculateThirdOrderProducts).toHaveBeenCalledWith(98.0, 88.0);
    // Results should now be rendered
    expect(container.textContent).toContain('3rd Order Intermodulation Products');
    expect(container.textContent).toContain('AVIATION BAND');

    vi.useRealTimers();
  });

  it('triggers calculation in aircraft-check mode', async () => {
    vi.useFakeTimers();
    const mockPairs = [
      {
        station1: makeStation({ id: '1', name: 'Station A', frequency: 88.0 }),
        station2: makeStation({ id: '2', name: 'Station B', frequency: 98.5 }),
        distance: 5.2,
        products: [{ type: '2f1-f2', frequency: 121.5, inAviationBand: true, affectedService: 'Emergency' }],
        aviationProducts: [{ type: '2f1-f2', frequency: 121.5, inAviationBand: true, affectedService: 'Emergency' }],
      },
    ];
    mockFindPairsForTargetFrequency.mockReturnValue({
      totalPairsChecked: 3,
      dangerousPairs: mockPairs,
      calculationTimeMs: 12.5,
    });
    mockAssessInterferenceRisk.mockReturnValue([
      {
        pair: mockPairs[0],
        targetFrequency: 121.5,
        frequencyDelta: 0,
        lineOfSight: true,
        riskLevel: 'CRITICAL',
        riskScore: 100,
      },
    ]);

    const { container } = render(<IntermodCalculator stations={stations} />);

    // Enter aircraft frequency
    const freqInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(freqInput, { target: { value: '121.5' } });

    // Target should be displayed
    expect(container.textContent).toContain('Target: 121.5 MHz');

    const findBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Find FM Pairs')
    )!;
    fireEvent.click(findBtn);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(mockFindPairsForTargetFrequency).toHaveBeenCalledWith(stations, 121.5);
    expect(mockAssessInterferenceRisk).toHaveBeenCalled();

    // Results should display
    expect(container.textContent).toContain('121.5 MHz');
    expect(container.textContent).toContain('CRITICAL');

    vi.useRealTimers();
  });

  it('displays risk level summary with counts', async () => {
    vi.useFakeTimers();
    const pair = {
      station1: makeStation({ id: '1', frequency: 88.0 }),
      station2: makeStation({ id: '2', frequency: 98.5 }),
      distance: 5,
      products: [{ type: '2f1-f2', frequency: 121.5, inAviationBand: true }],
      aviationProducts: [{ type: '2f1-f2', frequency: 121.5, inAviationBand: true }],
    };
    mockFindPairsForTargetFrequency.mockReturnValue({
      totalPairsChecked: 1,
      dangerousPairs: [pair],
      calculationTimeMs: 5.0,
    });
    mockAssessInterferenceRisk.mockReturnValue([
      { pair, targetFrequency: 121.5, frequencyDelta: 0, lineOfSight: true, riskLevel: 'CRITICAL', riskScore: 100 },
      { pair, targetFrequency: 121.5, frequencyDelta: 0.1, lineOfSight: true, riskLevel: 'HIGH', riskScore: 80 },
    ]);
    mockFilterRiskAssessments.mockImplementation((assessments: unknown[]) => assessments);

    const { container } = render(<IntermodCalculator stations={stations} />);
    const freqInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(freqInput, { target: { value: '121.5' } });

    const findBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Find FM Pairs')
    )!;
    fireEvent.click(findBtn);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Summary section should show counts
    expect(container.textContent).toContain('Critical');
    expect(container.textContent).toContain('High');
    expect(container.textContent).toContain('Medium');
    expect(container.textContent).toContain('Low');

    vi.useRealTimers();
  });

  it('shows empty results state: no interference found', async () => {
    vi.useFakeTimers();
    mockFindPairsForTargetFrequency.mockReturnValue({
      totalPairsChecked: 3,
      dangerousPairs: [],
      calculationTimeMs: 2.0,
    });
    mockAssessInterferenceRisk.mockReturnValue([]);

    const { container } = render(<IntermodCalculator stations={stations} />);
    const freqInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(freqInput, { target: { value: '121.5' } });

    const findBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Find FM Pairs')
    )!;
    fireEvent.click(findBtn);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(container.textContent).toContain('No Interference Found');

    vi.useRealTimers();
  });

  it('disables Find FM Pairs button when no frequency is entered', () => {
    const { container } = render(<IntermodCalculator stations={stations} />);
    const findBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Find FM Pairs')
    )!;
    expect(findBtn.disabled).toBe(true);
  });

  it('enables Find FM Pairs button when frequency is entered', () => {
    const { container } = render(<IntermodCalculator stations={stations} />);
    const freqInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(freqInput, { target: { value: '121.5' } });

    const findBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Find FM Pairs')
    )!;
    expect(findBtn.disabled).toBe(false);
  });

  it('clears all inputs and results when Clear All is clicked', async () => {
    vi.useFakeTimers();
    mockFindPairsForTargetFrequency.mockReturnValue({
      totalPairsChecked: 0,
      dangerousPairs: [],
      calculationTimeMs: 0,
    });
    mockAssessInterferenceRisk.mockReturnValue([]);

    const { container } = render(<IntermodCalculator stations={stations} />);
    const freqInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(freqInput, { target: { value: '121.5' } });

    const findBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Find FM Pairs')
    )!;
    fireEvent.click(findBtn);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Clear All')
    )!;
    fireEvent.click(clearBtn);

    expect(freqInput.value).toBe('');
    expect(container.textContent).toContain('No Results Yet');

    vi.useRealTimers();
  });

  it('shows station count from props', () => {
    const { container } = render(<IntermodCalculator stations={stations} />);
    expect(container.textContent).toContain(`${stations.length} FM stations`);
  });

  it('calls onHighlightStations and onSwitchToStations when result is clicked', async () => {
    vi.useFakeTimers();
    const onHighlight = vi.fn();
    const onSwitch = vi.fn();

    const pair = {
      station1: makeStation({ id: 'st1', name: 'Station A', frequency: 88.0 }),
      station2: makeStation({ id: 'st2', name: 'Station B', frequency: 98.5 }),
      distance: 5,
      products: [{ type: '2f1-f2', frequency: 121.5, inAviationBand: true, affectedService: 'Emergency' }],
      aviationProducts: [{ type: '2f1-f2', frequency: 121.5, inAviationBand: true, affectedService: 'Emergency' }],
    };
    const risk = {
      pair,
      targetFrequency: 121.5,
      frequencyDelta: 0,
      lineOfSight: true,
      riskLevel: 'CRITICAL',
      riskScore: 100,
    };
    mockFindPairsForTargetFrequency.mockReturnValue({
      totalPairsChecked: 1,
      dangerousPairs: [pair],
      calculationTimeMs: 5,
    });
    mockAssessInterferenceRisk.mockReturnValue([risk]);
    mockFilterRiskAssessments.mockReturnValue([risk]);

    const { container } = render(
      <IntermodCalculator
        stations={stations}
        onHighlightStations={onHighlight}
        onSwitchToStations={onSwitch}
      />
    );

    const freqInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(freqInput, { target: { value: '121.5' } });

    const findBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Find FM Pairs')
    )!;
    fireEvent.click(findBtn);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Click the result card - find an element with onClick that contains station info
    // The result cards have cursor-pointer in their className
    const resultCards = Array.from(container.querySelectorAll('div')).filter(
      (el) => el.className.includes('cursor-pointer')
    );
    expect(resultCards.length).toBeGreaterThan(0);
    fireEvent.click(resultCards[0]);

    expect(onHighlight).toHaveBeenCalledWith('st1', 'st2');
    expect(onSwitch).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('renders risk filter buttons after results', async () => {
    vi.useFakeTimers();
    const pair = {
      station1: makeStation({ id: '1', frequency: 88.0 }),
      station2: makeStation({ id: '2', frequency: 98.5 }),
      distance: 5,
      products: [],
      aviationProducts: [{ type: '2f1-f2', frequency: 121.5, inAviationBand: true }],
    };
    mockFindPairsForTargetFrequency.mockReturnValue({
      totalPairsChecked: 1,
      dangerousPairs: [pair],
      calculationTimeMs: 5,
    });
    mockAssessInterferenceRisk.mockReturnValue([
      { pair, targetFrequency: 121.5, frequencyDelta: 0, lineOfSight: true, riskLevel: 'CRITICAL', riskScore: 100 },
    ]);
    mockFilterRiskAssessments.mockImplementation((a: unknown[]) => a);

    const { container } = render(<IntermodCalculator stations={stations} />);
    const freqInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(freqInput, { target: { value: '121.5' } });

    const findBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Find FM Pairs')
    )!;
    fireEvent.click(findBtn);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Filter buttons: ALL, CRITICAL, HIGH, MEDIUM, LOW
    expect(container.textContent).toContain('Filter by risk:');
    const filterBtns = Array.from(container.querySelectorAll('button')).filter((b) =>
      ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(b.textContent?.trim() || '')
    );
    expect(filterBtns.length).toBe(5);

    vi.useRealTimers();
  });

  it('renders specific-frequency results with no aviation products', async () => {
    vi.useFakeTimers();
    mockCalculateThirdOrderProducts.mockReturnValue([
      { type: '2f1-f2', frequency: 78.0, inAviationBand: false },
      { type: '2f2-f1', frequency: 58.0, inAviationBand: false },
    ]);

    const { container } = render(<IntermodCalculator stations={stations} />);
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'specific-frequency' } });

    const inputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(inputs[0], { target: { value: '88.0' } });
    fireEvent.change(inputs[1], { target: { value: '98.0' } });

    const calcBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Calculate')
    )!;
    fireEvent.click(calcBtn);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    // Should show "No products fall within Aviation Band" since no aviation products
    // The result has 0 dangerousPairs because aviationProducts is empty
    // so it creates empty dangerousPairs array, and displays "No Interference Found"
    // Actually looking at the code, dangerousPairs will be empty since aviationProducts.length === 0
    expect(container.textContent).toContain('No Interference Found');

    vi.useRealTimers();
  });

  it('handles aircraft location inputs', () => {
    const { container } = render(<IntermodCalculator stations={stations} />);

    // Open the optional aircraft location details
    const details = container.querySelectorAll('details');
    const locationDetails = Array.from(details).find((d) =>
      d.textContent?.includes('Aircraft Location')
    )!;
    // Open it
    fireEvent.click(locationDetails.querySelector('summary')!);

    const latInput = locationDetails.querySelector('input[placeholder="13.75"]') as HTMLInputElement;
    const lngInput = locationDetails.querySelector('input[placeholder="100.50"]') as HTMLInputElement;
    expect(latInput).toBeTruthy();
    expect(lngInput).toBeTruthy();

    fireEvent.change(latInput, { target: { value: '13.75' } });
    fireEvent.change(lngInput, { target: { value: '100.50' } });

    expect(latInput.value).toBe('13.75');
    expect(lngInput.value).toBe('100.50');
  });
});
