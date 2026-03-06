import { NextResponse } from 'next/server';
import {
  hashRequest,
  getCachedResult,
  setCachedResult,
  callCloudRFInterference,
} from '@/utils/cloudrf';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { signalSites, jammerSites } = body;

    const apiKey = process.env.CLOUDRF_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CloudRF API key not configured' },
        { status: 500 }
      );
    }

    if (!signalSites?.length || !jammerSites?.length) {
      return NextResponse.json(
        { error: 'Both signalSites and jammerSites arrays are required' },
        { status: 400 }
      );
    }

    // Validate and sanitize site arrays — only allow known coordinate fields
    const validateSiteArray = (arr: unknown[]): { lat: number; lon: number; alt?: number; txw?: number; frq?: number }[] =>
      arr.map((item: unknown) => {
        const s = item as Record<string, unknown>;
        if (typeof s.lat !== 'number' || s.lat < -90 || s.lat > 90) throw new Error('Invalid lat');
        if (typeof s.lon !== 'number' || s.lon < -180 || s.lon > 180) throw new Error('Invalid lon');
        return {
          lat: s.lat,
          lon: s.lon,
          ...(typeof s.alt === 'number' && { alt: s.alt }),
          ...(typeof s.txw === 'number' && { txw: s.txw }),
          ...(typeof s.frq === 'number' && { frq: s.frq }),
        };
      });

    let validSignal, validJammer;
    try {
      validSignal = validateSiteArray(signalSites);
      validJammer = validateSiteArray(jammerSites);
    } catch {
      return NextResponse.json(
        { error: 'Each site must have valid lat (-90 to 90) and lon (-180 to 180)' },
        { status: 400 }
      );
    }

    const payload = {
      signal: validSignal,
      jammer: validJammer,
    };

    // Check cache
    const requestHash = hashRequest(payload);
    const cached = await getCachedResult(requestHash);
    if (cached) {
      return NextResponse.json({
        ...(cached.response_data as Record<string, unknown>),
        cached: true,
      });
    }

    const result = await callCloudRFInterference(payload, apiKey);

    await setCachedResult({
      requestType: 'interference',
      requestHash,
      requestParams: payload,
      responseData: result,
    });

    return NextResponse.json({
      ...result,
      cached: false,
    });
  } catch (error) {
    console.error('CloudRF interference error:', error);
    return NextResponse.json(
      { error: 'CloudRF interference analysis failed' },
      { status: 500 }
    );
  }
}
