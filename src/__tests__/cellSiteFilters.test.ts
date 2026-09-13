import { describe, it, expect } from 'vitest';
import type { CellSite } from '@/utils/cellSites';
import {
  DEFAULT_CELL_FILTERS,
  cellSiteKey,
  cellSiteMatchesFilter,
  cellSiteProvinces,
  countOperators,
  operatorsAtSite,
  visibleOperators,
  type CellSiteFilters,
} from '@/utils/cellSiteFilters';

function makeSite(overrides: Partial<CellSite> = {}): CellSite {
  return {
    province: 'นครราชสีมา',
    lat: 14.97,
    lng: 102.1,
    operators: ['AWN', 'NT'],
    licences: {
      AWN: [{ licenseNo: '060365103247', stationCode: '808924' }],
      NT: [{ licenseNo: '060367058273', stationCode: 'NMA0319-L23' }],
      TUC: [],
    },
    ...overrides,
  };
}

const filters = (overrides: Partial<CellSiteFilters> = {}): CellSiteFilters => ({
  ...DEFAULT_CELL_FILTERS,
  ...overrides,
});

describe('operatorsAtSite', () => {
  it('folds asterisk variants into their base operator, in AWN/NT/TUC order', () => {
    expect(operatorsAtSite(makeSite({ operators: ['TUC', 'NT*', 'AWN'] }))).toEqual(['AWN', 'NT', 'TUC']);
  });

  it('lists an operator once even if both plain and asterisk forms appear', () => {
    expect(operatorsAtSite(makeSite({ operators: ['NT', 'NT*'] }))).toEqual(['NT']);
  });
});

describe('visibleOperators', () => {
  it('keeps only operators the filter lets through', () => {
    expect(visibleOperators(makeSite(), filters({ operators: ['NT', 'TUC'] }))).toEqual(['NT']);
  });

  it('shows every operator at the site by default', () => {
    expect(visibleOperators(makeSite(), DEFAULT_CELL_FILTERS)).toEqual(['AWN', 'NT']);
  });
});

describe('cellSiteMatchesFilter', () => {
  it('matches everything under the default filters', () => {
    expect(cellSiteMatchesFilter(makeSite(), DEFAULT_CELL_FILTERS)).toBe(true);
  });

  it('keeps a shared site when any one of its operators passes', () => {
    expect(cellSiteMatchesFilter(makeSite(), filters({ operators: ['NT'] }))).toBe(true);
  });

  it('drops a site when none of its operators pass', () => {
    expect(cellSiteMatchesFilter(makeSite(), filters({ operators: ['TUC'] }))).toBe(false);
  });

  it('drops everything when no operator is selected', () => {
    expect(cellSiteMatchesFilter(makeSite(), filters({ operators: [] }))).toBe(false);
  });

  it('filters by province', () => {
    expect(cellSiteMatchesFilter(makeSite(), filters({ province: 'ชัยภูมิ' }))).toBe(false);
    expect(cellSiteMatchesFilter(makeSite(), filters({ province: 'นครราชสีมา' }))).toBe(true);
  });

  it('searches licence numbers and station codes, case-insensitively', () => {
    expect(cellSiteMatchesFilter(makeSite(), filters({ search: '0603651032' }))).toBe(true);
    expect(cellSiteMatchesFilter(makeSite(), filters({ search: 'nma0319' }))).toBe(true);
    expect(cellSiteMatchesFilter(makeSite(), filters({ search: 'nope' }))).toBe(false);
  });

  it('ignores surrounding whitespace in the search box', () => {
    expect(cellSiteMatchesFilter(makeSite(), filters({ search: '  808924 ' }))).toBe(true);
  });

  it('only searches licences of operators the filter lets through', () => {
    // 808924 belongs to AWN; with AWN filtered out the hit would point at a faded row.
    expect(cellSiteMatchesFilter(makeSite(), filters({ operators: ['NT'], search: '808924' }))).toBe(false);
  });
});

describe('cellSiteKey', () => {
  it('is the exact coordinate, which is what makes a site one site', () => {
    expect(cellSiteKey(makeSite({ lat: 15.4575, lng: 102.824721 }))).toBe('15.4575,102.824721');
  });
});

describe('cellSiteProvinces', () => {
  it('lists distinct provinces, sorted, skipping blanks', () => {
    const sites = [
      makeSite({ province: 'นครราชสีมา' }),
      makeSite({ province: 'ชัยภูมิ' }),
      makeSite({ province: null }),
      makeSite({ province: 'นครราชสีมา' }),
    ];
    expect(cellSiteProvinces(sites)).toEqual(['ชัยภูมิ', 'นครราชสีมา'].sort((a, b) => a.localeCompare(b, 'th')));
  });
});

describe('countOperators', () => {
  it('counts each visible operator once per site', () => {
    const sites = [
      makeSite({ operators: ['AWN', 'NT'] }),
      makeSite({ operators: ['TUC'] }),
      makeSite({ operators: ['NT*'] }),
    ];
    expect(countOperators(sites, DEFAULT_CELL_FILTERS)).toEqual({ AWN: 1, NT: 2, TUC: 1 });
    expect(countOperators(sites, filters({ operators: ['NT'] }))).toEqual({ AWN: 0, NT: 2, TUC: 0 });
  });
});
