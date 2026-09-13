import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseCellSitesCsv, type CellSite } from '@/utils/cellSites';

// The committed output of scripts/clean-cell-sites.ts. Traced into the function
// bundle by `outputFileTracingIncludes` in next.config.ts. Login is enforced by
// middleware, like every other API route.
const CSV_PATH = path.join(process.cwd(), 'data', 'cell-sites', 'cell-sites-clean.csv');

// The file only changes with a deploy, so parse it once per server instance.
let cached: Promise<CellSite[]> | null = null;

function loadSites(): Promise<CellSite[]> {
  cached ??= readFile(CSV_PATH, 'utf8')
    .then(parseCellSitesCsv)
    .catch((err) => {
      cached = null;
      throw err;
    });
  return cached;
}

export async function GET() {
  try {
    const sites = await loadSites();
    return NextResponse.json(
      { sites },
      { headers: { 'Cache-Control': 'private, max-age=3600' } }
    );
  } catch (error) {
    console.error('Cell sites load error:', error);
    return NextResponse.json({ error: 'cell_sites_unavailable' }, { status: 500 });
  }
}
