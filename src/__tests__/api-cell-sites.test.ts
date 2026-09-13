// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GET } from '@/app/api/cell-sites/route';
import { parseCellSitesCsv, type CellSite } from '@/utils/cellSites';

const CSV_PATH = path.join(process.cwd(), 'data', 'cell-sites', 'cell-sites-clean.csv');

describe('GET /api/cell-sites', () => {
  it('serves every site in the committed CSV', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sites: CellSite[] };
    const expected = parseCellSitesCsv(fs.readFileSync(CSV_PATH, 'utf8'));
    expect(body.sites.length).toBe(expected.length);
    expect(body.sites.length).toBeGreaterThan(0);
    expect(body.sites[0]).toEqual(expected[0]);
  });

  it('serves sites with finite coordinates and at least one operator', async () => {
    const { sites } = (await (await GET()).json()) as { sites: CellSite[] };
    expect(sites.every((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))).toBe(true);
    expect(sites.every((s) => s.operators.length > 0)).toBe(true);
  });

  it('lets the browser keep the response, privately, since it sits behind login', async () => {
    const res = await GET();
    expect(res.headers.get('cache-control')).toMatch(/^private/);
  });
});
