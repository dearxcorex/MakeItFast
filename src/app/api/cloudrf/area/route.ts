import { NextResponse } from 'next/server';
import { fetchInterferenceSiteById } from '@/services/interferenceService';
import {
  hashRequest,
  getCachedResult,
  setCachedResult,
  buildAreaPayload,
  convertBoundsToLeaflet,
  callCloudRFArea,
} from '@/utils/cloudrf';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { siteId, lat, lon, alt, txw, azi, rad, profile, antennaGain, downtilt, hbw, bandwidth, environment } = body;

    const apiKey = process.env.CLOUDRF_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CloudRF API key not configured' },
        { status: 500 }
      );
    }

    // Validate inputs
    if (!siteId && (lat === undefined || lon === undefined)) {
      return NextResponse.json(
        { error: 'Either siteId or lat/lon coordinates are required' },
        { status: 400 }
      );
    }
    if (lat !== undefined && (lat < -90 || lat > 90)) {
      return NextResponse.json({ error: 'Latitude must be between -90 and 90' }, { status: 400 });
    }
    if (lon !== undefined && (lon < -180 || lon > 180)) {
      return NextResponse.json({ error: 'Longitude must be between -180 and 180' }, { status: 400 });
    }

    // Build payload
    let site = null;
    if (siteId) {
      site = await fetchInterferenceSiteById(siteId);
    }

    const areaOptions = { alt, txw, rad, azi, hbw, profile, antennaGain, downtilt, bandwidth, environment };

    const payload = site
      ? buildAreaPayload(site, areaOptions)
      : buildAreaPayload(
          {
            id: 0,
            siteCode: `CUSTOM-${Date.now()}`,
            siteName: null,
            lat,
            long: lon,
            mcZone: null,
            changwat: null,
            cellName: null,
            sectorName: null,
            direction: azi ?? 0,
            avgNiCarrier: null,
            dayTime: null,
            nightTime: null,
            sourceLat: null,
            sourceLong: null,
            estimateDistance: null,
            ranking: null,
            status: null,
            nbtcArea: null,
            awnContact: null,
            lot: null,
            onSiteScanBy: null,
            onSiteScanDate: null,
            checkRealtime: null,
            sourceLocation1: null,
            sourceLocation2: null,
            cameraModel1: null,
            cameraModel2: null,
            notes: null,
            lawPaperSent: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          areaOptions
        );

    // Check cache
    const requestHash = hashRequest(payload as Record<string, unknown>);
    const cached = await getCachedResult(requestHash);
    if (cached) {
      const responseData = cached.response_data as Record<string, unknown>;
      const cachedBounds = cached.bounds as [number, number, number, number] | null;
      return NextResponse.json({
        pngUrl: cached.png_url,
        bounds: cachedBounds ? convertBoundsToLeaflet(cachedBounds) : null,
        coverage: responseData.area ?? null,
        viewerUrl: cached.viewer_url,
        cached: true,
      });
    }

    // Call CloudRF API
    const result = await callCloudRFArea(
      payload as Record<string, unknown>,
      apiKey
    );

    // Extract results
    const pngUrl = result.PNG_Mercator || result.PNG || null;
    const bounds = result.bounds
      ? convertBoundsToLeaflet(result.bounds)
      : null;
    const viewerUrl = result.url || null;

    // Cache result
    await setCachedResult({
      requestType: 'area',
      requestHash,
      requestParams: payload as Record<string, unknown>,
      responseData: result,
      pngUrl,
      bounds: result.bounds,
      viewerUrl,
      siteId: siteId ?? undefined,
    });

    return NextResponse.json({
      pngUrl,
      bounds,
      coverage: result.area ?? null,
      viewerUrl,
      cached: false,
    });
  } catch (error) {
    console.error('CloudRF area error:', error);
    return NextResponse.json(
      { error: 'CloudRF area analysis failed' },
      { status: 500 }
    );
  }
}
