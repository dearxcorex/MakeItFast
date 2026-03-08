import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

import InterferenceSiteDetail from '@/components/interference/InterferenceSiteDetail';

afterEach(() => {
  cleanup();
});

const makeSite = (overrides = {}) => ({
  id: 1,
  siteCode: 'AWN-001',
  siteName: 'Site Alpha',
  lat: 13.75,
  long: 100.5,
  changwat: 'Bangkok',
  ranking: 'Critical',
  mcZone: 'Zone-A',
  cellName: 'Cell-1',
  sectorName: 'Sector-B',
  direction: 90,
  avgNiCarrier: -95,
  dayTime: -90,
  nightTime: -100,
  sourceLat: 14.0,
  sourceLong: 101.0,
  sourceLocation1: 'Near factory',
  sourceLocation2: 'Industrial area',
  estimateDistance: 3.45,
  status: 'Active',
  nbtcArea: 'Area-1',
  awnContact: 'John',
  lot: 'Lot-5',
  onSiteScanBy: 'Team A',
  onSiteScanDate: null,
  checkRealtime: null,
  cameraModel1: null,
  cameraModel2: null,
  notes: 'Severe interference during peak hours',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('InterferenceSiteDetail', () => {
  it('renders site name and ranking badge', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite()} />);
    expect(container.textContent).toContain('Site Alpha');
    expect(container.textContent).toContain('Critical');
  });

  it('renders cell name', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite()} />);
    expect(container.textContent).toContain('Cell-1');
  });

  it('renders noise gauge data', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite()} />);
    expect(container.textContent).toContain('-95.0');
    expect(container.textContent).toContain('-90.0');
    expect(container.textContent).toContain('-100.0');
    expect(container.textContent).toContain('Avg (dBm)');
    expect(container.textContent).toContain('Day');
    expect(container.textContent).toContain('Night');
  });

  it('renders detail grid fields', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite()} />);
    expect(container.textContent).toContain('Bangkok');
    expect(container.textContent).toContain('Zone-A');
    expect(container.textContent).toContain('Area-1');
    expect(container.textContent).toContain('90°');
    expect(container.textContent).toContain('Sector-B');
    expect(container.textContent).toContain('Active');
    expect(container.textContent).toContain('3.45 km');
    expect(container.textContent).toContain('Lot-5');
    expect(container.textContent).toContain('John');
    expect(container.textContent).toContain('Team A');
  });

  it('renders interference source info', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite()} />);
    expect(container.textContent).toContain('Interference Source');
    expect(container.textContent).toContain('14.000000');
    expect(container.textContent).toContain('101.000000');
    expect(container.textContent).toContain('Near factory');
    expect(container.textContent).toContain('Industrial area');
  });

  it('hides source section when no source coords', () => {
    const { container } = render(
      <InterferenceSiteDetail site={makeSite({ sourceLat: null, sourceLong: null })} />
    );
    expect(container.textContent).not.toContain('Interference Source');
  });

  it('renders notes', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite()} />);
    expect(container.textContent).toContain('Severe interference during peak hours');
  });

  it('hides notes when null', () => {
    const { container } = render(<InterferenceSiteDetail site={makeSite({ notes: null })} />);
    expect(container.textContent).not.toContain('Notes');
  });

  it('shows N/A for null noise values', () => {
    const { container } = render(
      <InterferenceSiteDetail site={makeSite({ avgNiCarrier: null, dayTime: null, nightTime: null })} />
    );
    const naCount = (container.textContent?.match(/N\/A/g) || []).length;
    expect(naCount).toBeGreaterThanOrEqual(3);
  });

  it('falls back to siteCode when siteName is null', () => {
    const { container } = render(
      <InterferenceSiteDetail site={makeSite({ siteName: null })} />
    );
    expect(container.textContent).toContain('AWN-001');
  });

  it('falls back to Site #id when both names are null', () => {
    const { container } = render(
      <InterferenceSiteDetail site={makeSite({ siteName: null, siteCode: null })} />
    );
    expect(container.textContent).toContain('Site #1');
  });

  it('renders ranking badge for Major', () => {
    const { container } = render(
      <InterferenceSiteDetail site={makeSite({ ranking: 'Major' })} />
    );
    expect(container.textContent).toContain('Major');
  });

  it('renders ranking badge for Minor', () => {
    const { container } = render(
      <InterferenceSiteDetail site={makeSite({ ranking: 'Minor' })} />
    );
    expect(container.textContent).toContain('Minor');
  });

  it('renders N/A for null ranking', () => {
    const { container } = render(
      <InterferenceSiteDetail site={makeSite({ ranking: null })} />
    );
    expect(container.textContent).toContain('N/A');
  });

  it('hides cellName when null', () => {
    const site = makeSite({ cellName: null });
    const { container } = render(<InterferenceSiteDetail site={site} />);
    // cellName section uses a conditional render
    const cellText = container.querySelector('p.text-xs.text-muted-foreground');
    // Should not contain cell-specific element
    expect(container.textContent).not.toContain('Cell-1');
  });
});
