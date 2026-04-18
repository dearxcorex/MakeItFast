import { NextRequest, NextResponse } from 'next/server';
import { fetchInterferenceSites } from '@/services/interferenceService';
import type { InterferenceFilter } from '@/types/interference';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const filters: InterferenceFilter = {};
    if (searchParams.get('changwat')) filters.changwat = searchParams.get('changwat')!;
    if (searchParams.get('ranking')) filters.ranking = searchParams.get('ranking')!;
    if (searchParams.get('mcZone')) filters.mcZone = searchParams.get('mcZone')!;
    if (searchParams.get('nbtcArea')) filters.nbtcArea = searchParams.get('nbtcArea')!;
    if (searchParams.get('hasSource') === 'true') filters.hasSource = true;
    if (searchParams.get('search')) filters.search = searchParams.get('search')!;
    if (searchParams.get('status')) filters.status = searchParams.get('status')!;
    const rawMin = parseFloat(searchParams.get('noiseMin') ?? '');
    if (!isNaN(rawMin)) filters.noiseMin = rawMin;
    const rawMax = parseFloat(searchParams.get('noiseMax') ?? '');
    if (!isNaN(rawMax)) filters.noiseMax = rawMax;
    const lpParam = searchParams.get('lawPaperSent');
    if (lpParam === 'sent' || lpParam === 'not_sent') filters.lawPaperSent = lpParam;

    const sites = await fetchInterferenceSites(
      Object.keys(filters).length > 0 ? filters : undefined
    );

    return NextResponse.json({ sites, total: sites.length });
  } catch (error) {
    console.error('Interference fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interference sites' },
      { status: 500 }
    );
  }
}
