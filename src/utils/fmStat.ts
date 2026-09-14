// Builds the Discord `/stat` reply: FM stations counted by map pin colour per
// province. Pure: the interactions route gathers the rows, this only formats them.

import type { PinBucket } from '@/utils/pinBucket';

export type BucketCounts = Record<PinBucket, number>;

export interface ProvinceStat {
  province: string;
  total: number;
  /** Stations with `inspection_69` set, whatever their pin colour. */
  inspected: number;
  buckets: BucketCounts;
}

export interface DiscordMessage {
  allowed_mentions: { parse: [] };
  embeds: Array<{ title: string; description: string; color: number; url?: string }>;
}

// pinTokens `inspected`
const EMBED_COLOR = 0x00684a;

// Left to right in the reply: done work first, the legal-risk count last.
const BUCKET_LABELS: Array<[PinBucket, string, string]> = [
  ['inspected', '🟢', 'ตรวจแล้ว'],
  ['pending', '🟡', 'ยังไม่ตรวจ'],
  ['offair', '⚫', 'ไม่ออกอากาศ'],
  ['critical', '🔴', 'เพิกถอน'],
];

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

export function escapeMarkdown(s: string): string {
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

export function buildStatMessage(
  provinces: ProvinceStat[],
  date: string,
  siteUrl?: string,
): DiscordMessage {
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `📊 สรุปสถานี FM — ${formatThaiDate(date)}`,
        description: [...provinces.flatMap(provinceBlock), totalLine(provinces)].join('\n'),
        color: EMBED_COLOR,
        ...(siteUrl ? { url: siteUrl } : {}),
      },
    ],
  };
}
