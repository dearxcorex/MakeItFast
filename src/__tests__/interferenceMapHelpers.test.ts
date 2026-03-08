import { describe, it, expect } from 'vitest';
import { getRankingColor, createTowerIcon, createSourceIcon } from '@/utils/interferenceMapHelpers';

describe('getRankingColor', () => {
  it('returns red for Critical', () => {
    expect(getRankingColor('Critical')).toBe('#EF4444');
    expect(getRankingColor('critical')).toBe('#EF4444');
  });

  it('returns amber for Major', () => {
    expect(getRankingColor('Major')).toBe('#F59E0B');
    expect(getRankingColor('major')).toBe('#F59E0B');
  });

  it('returns yellow for Minor', () => {
    expect(getRankingColor('Minor')).toBe('#FACC15');
    expect(getRankingColor('minor')).toBe('#FACC15');
  });

  it('returns grey for unknown ranking', () => {
    expect(getRankingColor('Unknown')).toBe('#6B7280');
    expect(getRankingColor(null)).toBe('#6B7280');
  });
});

describe('createTowerIcon', () => {
  it('returns a Leaflet DivIcon', () => {
    const icon = createTowerIcon('Critical');
    expect(icon).toBeDefined();
    expect(icon.options.className).toBe('interference-tower-marker');
  });

  it('uses larger size when selected', () => {
    const normal = createTowerIcon('Critical', false);
    const selected = createTowerIcon('Critical', true);
    expect(selected.options.iconSize![0]).toBeGreaterThan(normal.options.iconSize![0]);
  });

  it('renders ranking color in HTML', () => {
    const icon = createTowerIcon('Critical');
    expect(icon.options.html).toContain('#EF4444');
  });

  it('renders Major color in HTML', () => {
    const icon = createTowerIcon('Major');
    expect(icon.options.html).toContain('#F59E0B');
  });

  it('handles null ranking', () => {
    const icon = createTowerIcon(null);
    expect(icon.options.html).toContain('#6B7280');
  });

  it('sets correct iconAnchor for default size', () => {
    const icon = createTowerIcon('Minor', false);
    // size=28, anchor=[14, 34]
    expect(icon.options.iconAnchor![0]).toBe(14);
    expect(icon.options.iconAnchor![1]).toBe(34);
  });

  it('sets correct iconAnchor for selected size', () => {
    const icon = createTowerIcon('Minor', true);
    // size=36, anchor=[18, 42]
    expect(icon.options.iconAnchor![0]).toBe(18);
    expect(icon.options.iconAnchor![1]).toBe(42);
  });

  it('adds glow shadow when selected', () => {
    const icon = createTowerIcon('Critical', true);
    expect(icon.options.html).toContain('0 0 8px');
  });
});

describe('createSourceIcon', () => {
  it('returns a Leaflet DivIcon', () => {
    const icon = createSourceIcon();
    expect(icon).toBeDefined();
    expect(icon.options.className).toBe('interference-source-marker');
  });

  it('has correct icon size', () => {
    const icon = createSourceIcon();
    expect(icon.options.iconSize).toEqual([20, 20]);
  });

  it('has correct anchor', () => {
    const icon = createSourceIcon();
    expect(icon.options.iconAnchor).toEqual([10, 10]);
  });

  it('uses red color', () => {
    const icon = createSourceIcon();
    expect(icon.options.html).toContain('#DC2626');
  });

  it('has rotated square style', () => {
    const icon = createSourceIcon();
    expect(icon.options.html).toContain('rotate(45deg)');
  });
});
