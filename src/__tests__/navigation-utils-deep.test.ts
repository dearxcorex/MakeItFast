import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NavigationUtils, createEnhancedNavigationButton } from '@/utils/navigationUtils';

describe('NavigationUtils.generateGoogleMapsUrl', () => {
  it('generates valid URL with default travel mode', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 13.7563,
      longitude: 100.5018,
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.url).toContain('google.com/maps/dir');
    expect(result.url).toContain('13.7563');
    expect(result.url).toContain('100.5018');
    expect(result.url).toContain('travelmode=driving');
  });

  it('returns error for NaN coordinates', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: NaN,
      longitude: 100.5,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid coordinates: NaN values detected');
  });

  it('returns error for latitude out of range', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 95,
      longitude: 100.5,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns error for longitude out of range', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 13.75,
      longitude: 200,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('includes avoidHighways param', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 13.75,
      longitude: 100.5,
      avoidHighways: true,
    });
    expect(result.isValid).toBe(true);
    expect(result.url).toContain('avoid=highways');
  });

  it('includes avoidTolls param', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 13.75,
      longitude: 100.5,
      avoidTolls: true,
    });
    expect(result.isValid).toBe(true);
    expect(result.url).toContain('avoid=tolls');
  });

  it('uses custom destination name', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 13.75,
      longitude: 100.5,
      destination: 'FM Station Bangkok',
    });
    expect(result.isValid).toBe(true);
    expect(result.url).toContain('FM+Station+Bangkok');
  });

  it('uses walking travel mode', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 13.75,
      longitude: 100.5,
      travelMode: 'walking',
    });
    expect(result.isValid).toBe(true);
    expect(result.url).toContain('travelmode=walking');
  });
});

describe('NavigationUtils.navigateToGoogleMaps', () => {
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    windowOpenSpy = vi.spyOn(window, 'open');
    confirmSpy = vi.spyOn(window, 'confirm');
  });

  afterEach(() => {
    windowOpenSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('returns false for invalid coordinates', async () => {
    const onError = vi.fn();
    const result = await NavigationUtils.navigateToGoogleMaps(
      { latitude: NaN, longitude: 100 },
      onError
    );
    expect(result).toBe(false);
    expect(onError).toHaveBeenCalled();
  });

  it('opens window successfully', async () => {
    windowOpenSpy.mockReturnValue({ closed: false } as Window);

    const result = await NavigationUtils.navigateToGoogleMaps({
      latitude: 13.75,
      longitude: 100.5,
    });
    expect(result).toBe(true);
    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining('google.com/maps'),
      '_blank'
    );
  });

  it('falls back to same-tab navigation when popup blocked and user confirms', async () => {
    windowOpenSpy.mockReturnValue(null);
    confirmSpy.mockReturnValue(true);

    const result = await NavigationUtils.navigateToGoogleMaps({
      latitude: 13.75,
      longitude: 100.5,
    });
    expect(result).toBe(true);
  });

  it('tries clipboard when popup blocked and user declines same-tab', async () => {
    windowOpenSpy.mockReturnValue(null);
    confirmSpy.mockReturnValue(false);

    // Mock clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const result = await NavigationUtils.navigateToGoogleMaps({
      latitude: 13.75,
      longitude: 100.5,
    });
    expect(result).toBe(true);
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('NavigationUtils.testNavigation', () => {
  it('returns test results', async () => {
    vi.spyOn(window, 'open').mockReturnValue({ closed: false, close: vi.fn() } as unknown as Window);

    const result = await NavigationUtils.testNavigation();
    expect(result).toHaveProperty('popupsAllowed');
    expect(result).toHaveProperty('clipboardAvailable');
    expect(result).toHaveProperty('urlGeneration');
    expect(result.urlGeneration).toBe(true);
  });
});

describe('NavigationUtils.getFallbackNavigationOptions', () => {
  it('returns fallback options', () => {
    const options = NavigationUtils.getFallbackNavigationOptions(13.75, 100.5);
    expect(options).toHaveLength(4);
    expect(options[0].name).toBe('Apple Maps');
    expect(options[1].name).toBe('Waze');
    expect(options[2].name).toBe('OpenStreetMap');
    expect(options[3].name).toBe('Copy Coordinates');
    expect(options[0].url).toContain('13.75');
    expect(options[0].url).toContain('100.5');
  });
});

describe('NavigationUtils.createNavigationClickHandler', () => {
  it('creates a click handler function', () => {
    const handler = NavigationUtils.createNavigationClickHandler({
      latitude: 13.75,
      longitude: 100.5,
    });
    expect(typeof handler).toBe('function');
  });
});

describe('createEnhancedNavigationButton', () => {
  it('returns button props', () => {
    const props = createEnhancedNavigationButton({
      latitude: 13.75,
      longitude: 100.5,
      stationName: 'Test FM',
      children: null as unknown as React.ReactNode,
    });
    expect(props).toHaveProperty('onClick');
    expect(props).toHaveProperty('className');
    expect(props['aria-label']).toContain('Test FM');
    expect(props.title).toContain('13.7500');
    expect(props.className).toContain('cursor-pointer');
  });

  it('uses default label when no station name', () => {
    const props = createEnhancedNavigationButton({
      latitude: 13.75,
      longitude: 100.5,
      children: null as unknown as React.ReactNode,
    });
    expect(props['aria-label']).toContain('station location');
  });
});
