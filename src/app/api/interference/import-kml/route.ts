import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

function extractSimpleData(placemark: string): Record<string, string> {
  const data: Record<string, string> = {};
  const regex = /<SimpleData name="([^"]+)">([^<]*)<\/SimpleData>/g;
  let match;
  while ((match = regex.exec(placemark)) !== null) {
    data[match[1]] = match[2];
  }
  return data;
}

function parseFloatSafe(val: string | undefined): number | null {
  if (!val || val === '') return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function str(val: string | undefined): string | null {
  return val && val !== '' ? val : null;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const provincesStr = formData.get('provinces') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.kml')) {
      return NextResponse.json({ error: 'File must be a .kml file' }, { status: 400 });
    }

    const kml = await file.text();
    const targetProvinces = provincesStr
      ? provincesStr.split(',').map(p => p.trim()).filter(Boolean)
      : null;

    // Parse placemarks
    const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
    const records: Array<Record<string, unknown>> = [];
    let match;

    while ((match = placemarkRegex.exec(kml)) !== null) {
      const fields = extractSimpleData(match[1]);
      const changwat = str(fields['CHANGWAT']);

      // Filter by province if specified
      if (targetProvinces && changwat && !targetProvinces.includes(changwat)) {
        continue;
      }

      const distMeters = parseFloatSafe(fields['Estimate Distance (m.)']);

      records.push({
        site_code: str(fields['Site']),
        site_name: str(fields['Site name']),
        lat: parseFloatSafe(fields['Lat']),
        long: parseFloatSafe(fields['Long']),
        mc_zone: str(fields['MC_ZONE']),
        changwat,
        cell_name: str(fields['Cell Name']),
        sector_name: str(fields['Sector name']),
        direction: parseFloatSafe(fields['Direction']),
        avg_ni_carrier: parseFloatSafe(fields['Average NI of Carrier']),
        day_time: parseFloatSafe(fields['Day time']),
        night_time: parseFloatSafe(fields['Night time']),
        source_lat: parseFloatSafe(fields['Latitude source']),
        source_long: parseFloatSafe(fields['Longitude source']),
        estimate_distance: distMeters !== null ? distMeters / 1000 : null,
        ranking: str(fields['Ranking']),
        status: str(fields['Status']),
        nbtc_area: str(fields['NBTC Area']),
        awn_contact: str(fields['AWN Contact']),
        lot: str(fields['Lot']),
      });
    }

    if (records.length === 0) {
      return NextResponse.json({
        imported: 0,
        skipped: 0,
        errors: ['No matching placemarks found in KML file'],
        byProvince: {},
      });
    }

    // Check for existing records by cell_name
    const cellNames = records.map(r => r.cell_name as string).filter(Boolean);
    const existing = await prisma.interference_site.findMany({
      where: { cell_name: { in: cellNames } },
      select: { cell_name: true },
    });
    const existingSet = new Set(existing.map(r => r.cell_name));

    const toInsert = records.filter(r => !existingSet.has(r.cell_name as string));
    const skipped = records.length - toInsert.length;

    // Count by province
    const byProvince: Record<string, number> = {};
    for (const r of toInsert) {
      const p = r.changwat as string;
      if (p) byProvince[p] = (byProvince[p] || 0) + 1;
    }

    let imported = 0;
    if (toInsert.length > 0) {
      const result = await prisma.interference_site.createMany({
        data: toInsert as Prisma.interference_siteCreateManyInput[],
        skipDuplicates: true,
      });
      imported = result.count;
    }

    return NextResponse.json({
      imported,
      skipped,
      errors: [],
      byProvince,
    });
  } catch (error) {
    console.error('KML import error:', error);
    return NextResponse.json(
      { error: 'Failed to import KML file' },
      { status: 500 }
    );
  }
}
