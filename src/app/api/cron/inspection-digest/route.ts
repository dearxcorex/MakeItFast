import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { bangkokToday } from '@/utils/bangkokDate';
import {
  buildInspectionDigest,
  type DigestInspection,
  type ProvinceProgress,
} from '@/utils/inspectionDigest';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Vercel Cron calls this daily with `Authorization: Bearer $CRON_SECRET`.
// `?date=YYYY-MM-DD` and `?dryRun=1` let a human preview a digest by hand.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const date = searchParams.get('date') ?? bangkokToday();
  if (!DATE_RE.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
    return NextResponse.json({ error: 'date must use YYYY-MM-DD format' }, { status: 400 });
  }
  const dryRun = searchParams.get('dryRun') === '1';

  let inspections: DigestInspection[];
  let progress: ProvinceProgress[];
  try {
    [inspections, progress] = await Promise.all([loadInspections(date), loadProgress()]);
  } catch (error) {
    console.error('Inspection digest query failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const payload = buildInspectionDigest(inspections, progress, date, process.env.SITE_URL);
  if (!payload) {
    return NextResponse.json({ posted: false, date, reason: 'no_inspections' });
  }
  if (dryRun) {
    return NextResponse.json({ posted: false, dryRun: true, date, payload });
  }

  // A notification problem must not look like a failed cron run; log and return 200.
  const webhookUrl = process.env.DISCORD_FIELD_OPS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('DISCORD_FIELD_OPS_WEBHOOK_URL is not set; inspection digest not posted');
    return NextResponse.json({ posted: false, date, reason: 'webhook_not_configured' });
  }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`Discord webhook returned ${res.status}: ${await res.text()}`);
      return NextResponse.json({ posted: false, date, reason: 'discord_error', status: res.status });
    }
  } catch (error) {
    console.error('Discord webhook request failed:', error);
    return NextResponse.json({ posted: false, date, reason: 'discord_error' });
  }

  const stations = new Set(inspections.map((i) => i.stationId)).size;
  return NextResponse.json({ posted: true, date, stations });
}

async function loadInspections(date: string): Promise<DigestInspection[]> {
  const rows = await prisma.station_inspection.findMany({
    where: { inspected_on: new Date(`${date}T00:00:00Z`) },
    select: {
      station_id: true,
      station: { select: { name: true, freq: true, district: true, province: true } },
      lead: { select: { display_name: true } },
      members: { select: { user_id: true } },
    },
  });
  return rows.map((r) => ({
    stationId: r.station_id,
    name: r.station.name,
    freq: r.station.freq,
    district: r.station.district,
    province: r.station.province,
    leadName: r.lead.display_name,
    helperCount: r.members.length,
  }));
}

// Denominator is every FM station in the province, matching the Field Ops
// header with the type filter on FM; revoked stations are counted, not excluded.
async function loadProgress(): Promise<ProvinceProgress[]> {
  const groups = await prisma.fm_station.groupBy({
    by: ['province', 'inspection_69', 'revoked'],
    _count: { _all: true },
  });
  const byProvince = new Map<string, ProvinceProgress>();
  for (const g of groups) {
    const province = g.province?.trim() || 'ไม่ระบุจังหวัด';
    const p = byProvince.get(province) ?? { province, inspected: 0, total: 0, revoked: 0 };
    p.total += g._count._all;
    if (g.inspection_69) p.inspected += g._count._all;
    if (g.revoked) p.revoked += g._count._all;
    byProvince.set(province, p);
  }
  return [...byProvince.values()].sort((a, b) => b.total - a.total);
}
