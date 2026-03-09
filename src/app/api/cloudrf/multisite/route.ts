import { NextResponse } from 'next/server';
import {
  hashRequest,
  getCachedResult,
  setCachedResult,
  buildMultisitePayload,
  convertBoundsToLeaflet,
  callCloudRFMultisite,
} from '@/utils/cloudrf';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sites, environment, radius } = body;

    const apiKey = process.env.CLOUDRF_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CloudRF API key not configured' },
        { status: 500 }
      );
    }

    if (!sites || !Array.isArray(sites) || sites.length === 0) {
      return NextResponse.json(
        { error: 'At least one site is required' },
        { status: 400 }
      );
    }

    if (sites.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 sites allowed per multisite request' },
        { status: 400 }
      );
    }

    // Validate each site has valid coordinates
    for (const s of sites) {
      if (typeof s.lat !== 'number' || s.lat < -90 || s.lat > 90) {
        return NextResponse.json({ error: 'Each site must have a valid lat (-90 to 90)' }, { status: 400 });
      }
      if (typeof s.lon !== 'number' || s.lon < -180 || s.lon > 180) {
        return NextResponse.json({ error: 'Each site must have a valid lon (-180 to 180)' }, { status: 400 });
      }
    }

    const payload = buildMultisitePayload(sites, { environment, radius });

    // Check cache
    const requestHash = hashRequest(payload as unknown as Record<string, unknown>);
    const cached = await getCachedResult(requestHash);
    if (cached) {
      const cachedBounds = cached.bounds as [number, number, number, number] | null;
      return NextResponse.json({
        pngUrl: cached.png_url,
        bounds: cachedBounds ? convertBoundsToLeaflet(cachedBounds) : null,
        viewerUrl: cached.viewer_url,
        siteCount: sites.length,
        cached: true,
      });
    }

    const result = await callCloudRFMultisite(
      payload as unknown as Record<string, unknown>,
      apiKey
    );

    const pngUrl = result.PNG_Mercator || result.PNG || null;
    const bounds = result.bounds
      ? convertBoundsToLeaflet(result.bounds)
      : null;
    const viewerUrl = result.url || null;

    await setCachedResult({
      requestType: 'multisite',
      requestHash,
      requestParams: payload as unknown as Record<string, unknown>,
      responseData: result,
      pngUrl,
      bounds: result.bounds,
      viewerUrl,
    });

    return NextResponse.json({
      pngUrl,
      bounds,
      viewerUrl,
      siteCount: sites.length,
      cached: false,
    });
  } catch (error) {
    console.error('CloudRF multisite error:', error);
    return NextResponse.json(
      { error: 'CloudRF multisite analysis failed' },
      { status: 500 }
    );
  }
}
