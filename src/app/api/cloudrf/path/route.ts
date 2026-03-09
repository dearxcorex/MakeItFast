import { NextResponse } from 'next/server';
import {
  hashRequest,
  getCachedResult,
  setCachedResult,
  callCloudRFPath,
  buildPathPayloadV2,
} from '@/utils/cloudrf';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fromLat, fromLon, toLat, toLon, profile, alt, txw, environment } = body;

    const apiKey = process.env.CLOUDRF_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CloudRF API key not configured' },
        { status: 500 }
      );
    }

    // Validate coordinates
    if (fromLat === undefined || fromLon === undefined || toLat === undefined || toLon === undefined) {
      return NextResponse.json({ error: 'fromLat, fromLon, toLat, and toLon are required' }, { status: 400 });
    }
    if (fromLat < -90 || fromLat > 90 || toLat < -90 || toLat > 90) {
      return NextResponse.json({ error: 'Latitude must be between -90 and 90' }, { status: 400 });
    }
    if (fromLon < -180 || fromLon > 180 || toLon < -180 || toLon > 180) {
      return NextResponse.json({ error: 'Longitude must be between -180 and 180' }, { status: 400 });
    }

    const payload = buildPathPayloadV2(
      { lat: fromLat, lon: fromLon },
      { lat: toLat, lon: toLon },
      { profile, alt, txw, environment }
    );

    // Check cache
    const requestHash = hashRequest(payload);
    const cached = await getCachedResult(requestHash);
    if (cached) {
      const responseData = cached.response_data as Record<string, unknown>;
      return NextResponse.json({
        pathLoss: responseData.Path_loss ?? null,
        chartUrl: responseData.chart_url ?? null,
        signalLevel: responseData.Signal_level ?? null,
        distance: responseData.Distance ?? null,
        cached: true,
      });
    }

    const result = await callCloudRFPath(payload, apiKey);

    await setCachedResult({
      requestType: 'path',
      requestHash,
      requestParams: payload,
      responseData: result,
    });

    return NextResponse.json({
      pathLoss: result.Path_loss ?? null,
      chartUrl: result.chart_url ?? null,
      signalLevel: result.Signal_level ?? null,
      distance: result.Distance ?? null,
      cached: false,
    });
  } catch (error) {
    console.error('CloudRF path error:', error);
    return NextResponse.json(
      { error: 'CloudRF path analysis failed' },
      { status: 500 }
    );
  }
}
