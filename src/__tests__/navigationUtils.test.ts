import { describe, it, expect } from 'vitest';
import { NavigationUtils } from '@/utils/navigationUtils';

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

  it('accepts custom travel mode', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 13.75,
      longitude: 100.5,
      travelMode: 'walking',
    });
    expect(result.isValid).toBe(true);
    expect(result.url).toContain('travelmode=walking');
  });

  it('rejects NaN coordinates', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: NaN,
      longitude: 100.5,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid coordinates: NaN values detected');
  });

  it('rejects latitude out of range', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 91,
      longitude: 100.5,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects longitude out of range', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 13.75,
      longitude: 181,
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects invalid travel mode', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 13.75,
      longitude: 100.5,
      travelMode: 'flying' as 'driving',
    });
    expect(result.isValid).toBe(false);
  });

  it('includes avoid=highways when set', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 13.75,
      longitude: 100.5,
      avoidHighways: true,
    });
    expect(result.isValid).toBe(true);
    expect(result.url).toContain('avoid=highways');
  });

  it('includes avoid=tolls when set', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 13.75,
      longitude: 100.5,
      avoidTolls: true,
    });
    expect(result.isValid).toBe(true);
    expect(result.url).toContain('avoid=tolls');
  });

  it('overrides destination when custom destination provided', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 13.75,
      longitude: 100.5,
      destination: 'Bangkok Tower',
    });
    expect(result.isValid).toBe(true);
    expect(result.url).toContain('Bangkok+Tower');
  });

  it('handles negative coordinates', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: -33.87,
      longitude: 151.21,
    });
    expect(result.isValid).toBe(true);
    expect(result.url).toContain('-33.87');
  });

  it('rejects both lat and lon out of range', () => {
    const result = NavigationUtils.generateGoogleMapsUrl({
      latitude: 100,
      longitude: 200,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBe(2);
  });
});

describe('NavigationUtils.getFallbackNavigationOptions', () => {
  it('returns 4 options', () => {
    const options = NavigationUtils.getFallbackNavigationOptions(13.75, 100.5);
    expect(options).toHaveLength(4);
  });

  it('includes Apple Maps', () => {
    const options = NavigationUtils.getFallbackNavigationOptions(13.75, 100.5);
    const apple = options.find((o) => o.name === 'Apple Maps');
    expect(apple).toBeDefined();
    expect(apple!.url).toContain('maps.apple.com');
    expect(apple!.url).toContain('13.75');
  });

  it('includes Waze', () => {
    const options = NavigationUtils.getFallbackNavigationOptions(13.75, 100.5);
    const waze = options.find((o) => o.name === 'Waze');
    expect(waze).toBeDefined();
    expect(waze!.url).toContain('waze.com');
  });

  it('includes OpenStreetMap', () => {
    const options = NavigationUtils.getFallbackNavigationOptions(13.75, 100.5);
    const osm = options.find((o) => o.name === 'OpenStreetMap');
    expect(osm).toBeDefined();
    expect(osm!.url).toContain('openstreetmap.org');
  });

  it('includes Copy Coordinates', () => {
    const options = NavigationUtils.getFallbackNavigationOptions(13.75, 100.5);
    const copy = options.find((o) => o.name === 'Copy Coordinates');
    expect(copy).toBeDefined();
    expect(copy!.url).toBe('13.75, 100.5');
  });
});
