import { CELL_OPERATORS, baseOperator, type CellOperator, type CellSite } from './cellSites';

export interface CellSiteFilters {
  /** Operators to show. A shared site shows if any one of its operators is here. */
  operators: CellOperator[];
  /** Province name, or "All". */
  province: string;
  /** Matched against licence numbers and station codes. */
  search: string;
}

export const DEFAULT_CELL_FILTERS: CellSiteFilters = {
  operators: [...CELL_OPERATORS],
  province: 'All',
  search: '',
};

/** Base operators present at a site (NT* counts as NT), in AWN/NT/TUC order. */
export function operatorsAtSite(site: CellSite): CellOperator[] {
  const bases = new Set(site.operators.map(baseOperator));
  return CELL_OPERATORS.filter((op) => bases.has(op));
}

export function visibleOperators(site: CellSite, filters: CellSiteFilters): CellOperator[] {
  return operatorsAtSite(site).filter((op) => filters.operators.includes(op));
}

export function cellSiteMatchesFilter(site: CellSite, filters: CellSiteFilters): boolean {
  if (filters.province !== 'All' && site.province !== filters.province) return false;
  const visible = visibleOperators(site, filters);
  if (visible.length === 0) return false;
  const q = filters.search.trim().toLowerCase();
  if (!q) return true;
  // Only the visible operators' licences: a hit on a filtered-out operator
  // would open a site whose matching row is drawn faded.
  return visible.some((op) =>
    site.licences[op].some((l) =>
      `${l.licenseNo ?? ''} ${l.stationCode ?? ''}`.toLowerCase().includes(q)
    )
  );
}

/** Exact coordinate — the merge rule that made the site one site. */
export function cellSiteKey(site: CellSite): string {
  return `${site.lat},${site.lng}`;
}

export function cellSiteProvinces(sites: CellSite[]): string[] {
  const set = new Set<string>();
  for (const s of sites) if (s.province) set.add(s.province);
  return [...set].sort((a, b) => a.localeCompare(b, 'th'));
}

/** How many sites each operator appears at, counting only what the filter shows. */
export function countOperators(
  sites: CellSite[],
  filters: CellSiteFilters
): Record<CellOperator, number> {
  const counts: Record<CellOperator, number> = { AWN: 0, NT: 0, TUC: 0 };
  for (const s of sites) for (const op of visibleOperators(s, filters)) counts[op]++;
  return counts;
}
