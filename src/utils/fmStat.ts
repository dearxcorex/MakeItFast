// Builds the Discord `/stat` reply: FM stations counted by map pin colour per
// province, plus the stations inspected today. Pure: the interactions route
// gathers the rows, this only formats them.

import type { PinBucket } from '@/utils/pinBucket';

export type BucketCounts = Record<PinBucket, number>;

export interface ProvinceStat {
  province: string;
  total: number;
  /** Stations with `inspection_69` set, whatever their pin colour. */
  inspected: number;
  buckets: BucketCounts;
}

export interface TodayStation {
  stationId: number;
  name: string | null;
  freq: number | null;
  district: string | null;
  province: string | null;
  bucket: PinBucket;
}

export interface DiscordMessage {
  allowed_mentions: { parse: [] };
  embeds: Array<{ title: string; description: string; color: number; url?: string }>;
}

const MAX_LISTED = 25;
const DESCRIPTION_LIMIT = 4096;
const NAME_MAX = 50;
const DISTRICT_MAX = 25;
// pinTokens `inspected`
const EMBED_COLOR = 0x00684a;

// Left to right in the reply: done work first, the legal-risk count last.
const BUCKET_LABELS: Array<[PinBucket, string, string]> = [
  ['inspected', '🟢', 'ตรวจแล้ว'],
  ['pending', '🟡', 'ยังไม่ตรวจ'],
  ['offair', '⚫', 'ไม่ออกอากาศ'],
  ['critical', '🔴', 'เพิกถอน'],
];

const BUCKET_EMOJI: Record<PinBucket, string> = Object.fromEntries(
  BUCKET_LABELS.map(([bucket, emoji]) => [bucket, emoji]),
) as Record<PinBucket, string>;

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export function emptyBuckets(): BucketCounts {
  return { critical: 0, pending: 0, offair: 0, inspected: 0 };
}

/** `2026-09-13` → `13 ก.ย. 2569` */
export function formatThaiDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function escapeMarkdown(s: string): string {
  return s.replace(/([\\*_~`|>])/g, '\\$1');
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function bucketLine(b: BucketCounts, withLabels: boolean): string {
  return BUCKET_LABELS.map(([bucket, emoji, label]) =>
    withLabels ? `${emoji} ${label} ${b[bucket]}` : `${emoji} ${b[bucket]}`,
  ).join(' · ');
}

function provinceBlock(p: ProvinceStat): string[] {
  return [
    `**${escapeMarkdown(p.province)}** (${p.total})`,
    bucketLine(p.buckets, true),
    `ความคืบหน้า ตรวจแล้ว ${p.inspected}/${p.total} (${percent(p.inspected, p.total)}%)`,
    '',
  ];
}

function totalLine(provinces: ProvinceStat[]): string {
  const sum = emptyBuckets();
  let total = 0;
  for (const p of provinces) {
    total += p.total;
    for (const [bucket] of BUCKET_LABELS) sum[bucket] += p.buckets[bucket];
  }
  return `รวม ${total} — ${bucketLine(sum, false)}`;
}

function stationLine(s: TodayStation): string {
  const freq = s.freq != null ? s.freq.toFixed(2) : '-';
  const name = escapeMarkdown(truncate(s.name?.trim() || 'ไม่ระบุชื่อ', NAME_MAX));
  const province = escapeMarkdown(s.province ?? '-');
  const place = s.district
    ? `${escapeMarkdown(truncate(s.district, DISTRICT_MAX))} (${province})`
    : province;
  return `${BUCKET_EMOJI[s.bucket]} ${freq} ${name} — ${place}`;
}

function dedupeAndSort(today: TodayStation[]): TodayStation[] {
  const byId = new Map<number, TodayStation>();
  for (const s of today) if (!byId.has(s.stationId)) byId.set(s.stationId, s);
  return [...byId.values()].sort((a, b) =>
    (a.province ?? '').localeCompare(b.province ?? '', 'th') ||
    (a.freq ?? 0) - (b.freq ?? 0),
  );
}

function describe(provinces: ProvinceStat[], today: TodayStation[], listed: number): string {
  const todayLines =
    today.length === 0
      ? ['วันนี้ยังไม่มีการตรวจ']
      : [
          `**วันนี้ตรวจ ${today.length} สถานี**`,
          ...today.slice(0, listed).map(stationLine),
          ...(today.length > listed ? [`…และอีก ${today.length - listed} สถานี`] : []),
        ];
  return [
    ...provinces.flatMap(provinceBlock),
    totalLine(provinces),
    '',
    ...todayLines,
  ].join('\n');
}

export function buildStatMessage(
  provinces: ProvinceStat[],
  today: TodayStation[],
  date: string,
  siteUrl?: string,
): DiscordMessage {
  const stations = dedupeAndSort(today);
  let listed = Math.min(stations.length, MAX_LISTED);
  let description = describe(provinces, stations, listed);
  while (description.length > DESCRIPTION_LIMIT && listed > 0) {
    listed -= 1;
    description = describe(provinces, stations, listed);
  }

  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `📊 สรุปสถานี FM — ${formatThaiDate(date)}`,
        description,
        color: EMBED_COLOR,
        ...(siteUrl ? { url: siteUrl } : {}),
      },
    ],
  };
}
