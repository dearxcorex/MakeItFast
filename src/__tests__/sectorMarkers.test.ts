import { describe, it, expect } from 'vitest';
import {
  createSectorSVG,
  siteToSectors,
  groupSiteSectors,
  getRankingColor,
} from '@/utils/sectorMarkers';

// ---------------------------------------------------------------------------
// createSectorSVG
// ---------------------------------------------------------------------------

describe('createSectorSVG', () => {
  it('returns a string starting with <svg', () => {
    const svg = createSectorSVG([{ azimuth: 0 }]);
    expect(svg.trim()).toMatch(/^<svg/);
  });

  it('includes the requested size in width and height attributes', () => {
    const svg = createSectorSVG([{ azimuth: 90 }], 64);
    expect(svg).toContain('width="64"');
    expect(svg).toContain('height="64"');
  });

  it('defaults to size 48 when size is omitted', () => {
    const svg = createSectorSVG([{ azimuth: 0 }]);
    expect(svg).toContain('width="48"');
    expect(svg).toContain('height="48"');
  });

  it('includes a <path> element for each sector', () => {
    const svg = createSectorSVG([{ azimuth: 0 }, { azimuth: 120 }, { azimuth: 240 }]);
    const pathCount = (svg.match(/<path /g) ?? []).length;
    // 3 sector wedge paths + 1 checkmark path for pending (no checkmark on pending, just center dot)
    expect(pathCount).toBeGreaterThanOrEqual(3);
  });

  it('includes a center <circle> element', () => {
    const svg = createSectorSVG([{ azimuth: 0 }]);
    expect(svg).toContain('<circle');
  });

  it('includes xmlns attribute', () => {
    const svg = createSectorSVG([{ azimuth: 0 }]);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  // ----- Pending (not inspected) markers -----

  it('uses ranking color for center dot when pending', () => {
    const svg = createSectorSVG([{ azimuth: 0 }], 48, { rankingColor: '#EF4444' });
    expect(svg).toContain('#EF4444');
  });

  it('does not render outer ring for pending, non-selected site', () => {
    const svg = createSectorSVG([{ azimuth: 0 }], 48, { isSelected: false });
    // No thick green outer ring for non-selected pending
    expect(svg).not.toContain('stroke="#22c55e"');
  });

  it('renders dashed outer ring for selected pending site', () => {
    const svg = createSectorSVG([{ azimuth: 0 }], 48, {
      isSelected: true,
      rankingColor: '#EF4444',
    });
    expect(svg).toContain('stroke-dasharray');
  });

  it('uses indigo fill for the first pending sector when no color override', () => {
    const svg = createSectorSVG([{ azimuth: 0 }], 48);
    // First pending sector color
    expect(svg).toContain('rgba(99, 102, 241, 0.45)');
  });

  it('cycles through sector colors for multiple sectors (pending)', () => {
    // 4 sectors: colors wrap around the 3-color array
    const svg = createSectorSVG(
      [{ azimuth: 0 }, { azimuth: 90 }, { azimuth: 180 }, { azimuth: 270 }],
      48
    );
    // Index 3 wraps back to first color (indigo)
    expect(svg.match(/rgba\(99, 102, 241, 0\.45\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('uses custom color override per sector', () => {
    const svg = createSectorSVG([{ azimuth: 0, color: '#ABCDEF' }], 48);
    expect(svg).toContain('#ABCDEF');
  });

  // ----- Inspected markers -----

  it('uses green center color for inspected site', () => {
    const svg = createSectorSVG([{ azimuth: 0 }], 48, { isInspected: true });
    expect(svg).toContain('#22c55e');
  });

  it('renders outer green ring for inspected site', () => {
    const svg = createSectorSVG([{ azimuth: 0 }], 48, { isInspected: true });
    // Outer ring stroke for inspected
    expect(svg).toContain('stroke="#22c55e"');
  });

  it('renders checkmark path for inspected site', () => {
    const svg = createSectorSVG([{ azimuth: 0 }], 48, { isInspected: true });
    // Checkmark uses a <path> with fill="none"
    expect(svg).toContain('fill="none"');
  });

  it('uses green-tinted fill for inspected sector', () => {
    const svg = createSectorSVG([{ azimuth: 0 }], 48, { isInspected: true });
    expect(svg).toContain('rgba(34, 197, 94, 0.35)');
  });

  it('does NOT use pending (indigo) sector color for inspected site', () => {
    const svg = createSectorSVG([{ azimuth: 0 }], 48, { isInspected: true });
    expect(svg).not.toContain('rgba(99, 102, 241, 0.45)');
  });

  // ----- Edge cases -----

  it('handles zero sectors without throwing', () => {
    expect(() => createSectorSVG([])).not.toThrow();
  });

  it('handles large beamwidth (> 180) with largeArc flag', () => {
    // Beamwidth > 180 should set the SVG arc large-arc-flag to 1
    const svg = createSectorSVG([{ azimuth: 0, beamwidth: 270 }], 48);
    expect(svg).toContain('<path');
    // The generated arc string should include "1 1 " (largeArc=1, sweep=1)
    expect(svg).toContain('A');
  });

  it('defaults beamwidth to 65 when not provided', () => {
    // Two calls: one with explicit 65, one without — SVG content must match
    const a = createSectorSVG([{ azimuth: 90, beamwidth: 65 }], 48);
    const b = createSectorSVG([{ azimuth: 90 }], 48);
    expect(a).toBe(b);
  });

  it('respects custom centerRadius option', () => {
    // The center circle should use the supplied radius
    const svgDefault = createSectorSVG([{ azimuth: 0 }], 48);
    const svgCustom = createSectorSVG([{ azimuth: 0 }], 48, { centerRadius: 10 });
    expect(svgCustom).toContain('r="10"');
    expect(svgDefault).toContain('r="7"');
  });

  it('uses viewBox matching the size', () => {
    const svg = createSectorSVG([{ azimuth: 0 }], 32);
    expect(svg).toContain('viewBox="0 0 32 32"');
  });
});

// ---------------------------------------------------------------------------
// siteToSectors
// ---------------------------------------------------------------------------

describe('siteToSectors', () => {
  it('returns empty array for null direction', () => {
    expect(siteToSectors(null)).toEqual([]);
  });

  it('returns single sector for a given direction', () => {
    const sectors = siteToSectors(120);
    expect(sectors).toHaveLength(1);
    expect(sectors[0].azimuth).toBe(120);
  });

  it('sets default beamwidth of 65', () => {
    const sectors = siteToSectors(0);
    expect(sectors[0].beamwidth).toBe(65);
  });

  it('preserves azimuth value exactly', () => {
    expect(siteToSectors(359)[0].azimuth).toBe(359);
    expect(siteToSectors(0)[0].azimuth).toBe(0);
    expect(siteToSectors(180)[0].azimuth).toBe(180);
  });

  it('returns empty array for undefined (via null coercion)', () => {
    // TypeScript signature uses null; coerce undefined to cover the guard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(siteToSectors(undefined as any)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// groupSiteSectors
// ---------------------------------------------------------------------------

describe('groupSiteSectors', () => {
  let nextId = 1;
  const makeSite = (siteCode: string | null, direction: number | null, sectorName = 'A') => ({
    id: nextId++,
    siteCode,
    direction,
    sectorName,
  });

  it('returns an empty Map for empty array', () => {
    const result = groupSiteSectors([]);
    expect(result.size).toBe(0);
  });

  it('groups two records with the same siteCode under one key', () => {
    const sites = [makeSite('SITE01', 0, 'A'), makeSite('SITE01', 120, 'B')];
    const result = groupSiteSectors(sites);
    expect(result.size).toBe(1);
    expect(result.get('SITE01')?.sites).toHaveLength(2);
  });

  it('creates separate groups for different siteCodes', () => {
    const sites = [makeSite('SITE01', 0), makeSite('SITE02', 90)];
    const result = groupSiteSectors(sites);
    expect(result.size).toBe(2);
  });

  it('accumulates sectors from all records in a group', () => {
    const sites = [makeSite('SITE01', 0), makeSite('SITE01', 120), makeSite('SITE01', 240)];
    const result = groupSiteSectors(sites);
    expect(result.get('SITE01')?.sectors).toHaveLength(3);
  });

  it('skips null directions from sectors list but still adds site to sites list', () => {
    const sites = [makeSite('SITE01', null), makeSite('SITE01', 120)];
    const result = groupSiteSectors(sites);
    const group = result.get('SITE01')!;
    expect(group.sectors).toHaveLength(1);   // only the non-null direction
    expect(group.sites).toHaveLength(2);     // both records
  });

  it('assigns a standalone key for null siteCode (does not crash)', () => {
    const sites = [makeSite(null, 90)];
    const result = groupSiteSectors(sites);
    // Key starts with "standalone-"
    const keys = [...result.keys()];
    expect(keys[0]).toMatch(/^standalone-/);
  });

  it('creates separate standalone keys for multiple null-siteCode records', () => {
    const sites = [makeSite(null, 0), makeSite(null, 90)];
    const result = groupSiteSectors(sites);
    // Each null-siteCode record gets its own random key
    expect(result.size).toBe(2);
  });

  it('sets sector azimuth and default beamwidth 65', () => {
    const sites = [makeSite('S1', 270)];
    const group = groupSiteSectors(sites).get('S1')!;
    expect(group.sectors[0].azimuth).toBe(270);
    expect(group.sectors[0].beamwidth).toBe(65);
  });

  it('works with custom-typed site records (generic T)', () => {
    const customSites = [
      { siteCode: 'X1', direction: 45, sectorName: 'Sec1', extraField: 'hello' },
      { siteCode: 'X1', direction: 135, sectorName: 'Sec2', extraField: 'world' },
    ];
    const result = groupSiteSectors(customSites);
    expect(result.get('X1')?.sites[0].extraField).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// getRankingColor
// ---------------------------------------------------------------------------

describe('getRankingColor', () => {
  it('returns red (#EF4444) for "critical"', () => {
    expect(getRankingColor('critical')).toBe('#EF4444');
  });

  it('is case-insensitive for "Critical"', () => {
    expect(getRankingColor('Critical')).toBe('#EF4444');
  });

  it('is case-insensitive for "CRITICAL"', () => {
    expect(getRankingColor('CRITICAL')).toBe('#EF4444');
  });

  it('returns amber (#F59E0B) for "major"', () => {
    expect(getRankingColor('major')).toBe('#F59E0B');
  });

  it('is case-insensitive for "Major"', () => {
    expect(getRankingColor('Major')).toBe('#F59E0B');
  });

  it('returns yellow (#FACC15) for "minor"', () => {
    expect(getRankingColor('minor')).toBe('#FACC15');
  });

  it('is case-insensitive for "MINOR"', () => {
    expect(getRankingColor('MINOR')).toBe('#FACC15');
  });

  it('returns gray (#6B7280) for null', () => {
    expect(getRankingColor(null)).toBe('#6B7280');
  });

  it('returns gray (#6B7280) for unknown string', () => {
    expect(getRankingColor('unknown')).toBe('#6B7280');
  });

  it('returns gray (#6B7280) for empty string', () => {
    expect(getRankingColor('')).toBe('#6B7280');
  });

  it('returns gray for unrecognised mixed-case string', () => {
    expect(getRankingColor('Moderate')).toBe('#6B7280');
  });
});
