import { describe, it, expect } from 'vitest';
import { createLocationIcon } from '@/utils/mapHelpers';

// --- createLocationIcon ---
describe('createLocationIcon', () => {
  it('returns a DivIcon', () => {
    const icon = createLocationIcon();
    expect(icon).toBeDefined();
    expect(icon.options.className).toBe('custom-location-icon');
  });

  it('uses the new larger dimensions to fit the cone', () => {
    const icon = createLocationIcon();
    expect(icon.options.iconSize).toEqual([80, 80]);
    expect(icon.options.iconAnchor).toEqual([40, 40]);
  });

  it('always contains the dot and pulse halo', () => {
    const html = createLocationIcon().options.html as string;
    expect(html).toContain('location-pulse');
    expect(html).toContain('location-dot');
  });

  it('cold start (no heading) hides the cone', () => {
    const html = createLocationIcon().options.html as string;
    expect(html).not.toContain('heading-cone');
  });

  it('renders a rotated cone when heading is provided', () => {
    const html = createLocationIcon({ heading: 90, stale: false })
      .options.html as string;
    expect(html).toContain('heading-cone');
    expect(html).toContain('rotate(90.0deg)');
    expect(html).not.toContain('heading-cone--stale');
  });

  it('applies the stale modifier and pauses the pulse when stale', () => {
    const html = createLocationIcon({ heading: 270, stale: true })
      .options.html as string;
    expect(html).toContain('heading-cone--stale');
    expect(html).toContain('rotate(270.0deg)');
    expect(html).toContain('location-pulse--paused');
  });

  it('rounds non-integer headings to one decimal in the transform', () => {
    const html = createLocationIcon({ heading: 359.249, stale: false })
      .options.html as string;
    expect(html).toContain('rotate(359.2deg)');
  });
});
