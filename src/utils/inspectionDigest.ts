// Builds the daily Discord webhook message for inspection_69 work.
// Pure: the cron route gathers the rows, this only formats them.

export interface DigestInspection {
  stationId: number;
  name: string | null;
  freq: number | null;
  district: string | null;
  province: string | null;
  leadName: string;
  helperCount: number;
}

export interface ProvinceProgress {
  province: string;
  inspected: number;
  total: number;
  revoked: number;
}

export interface DiscordWebhookPayload {
  allowed_mentions: { parse: [] };
  embeds: Array<{ title: string; description: string; color: number; url?: string }>;
}

const MAX_LISTED = 25;
const DESCRIPTION_LIMIT = 4096;
const NAME_MAX = 50;
const DISTRICT_MAX = 25;
// pinTokens `inspected`
const EMBED_COLOR = 0x00684a;

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

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

interface StationGroup {
  first: DigestInspection;
  teams: string[];
}

function groupByStation(inspections: DigestInspection[]): StationGroup[] {
  const groups = new Map<number, StationGroup>();
  for (const i of inspections) {
    const team = i.helperCount > 0 ? `${i.leadName} +${i.helperCount}` : i.leadName;
    const g = groups.get(i.stationId);
    if (g) g.teams.push(team);
    else groups.set(i.stationId, { first: i, teams: [team] });
  }
  return [...groups.values()].sort((a, b) =>
    (a.first.province ?? '').localeCompare(b.first.province ?? '', 'th') ||
    (a.first.freq ?? 0) - (b.first.freq ?? 0),
  );
}

function stationLine({ first: s, teams }: StationGroup): string {
  const freq = s.freq != null ? s.freq.toFixed(2) : '-';
  const name = escapeMarkdown(truncate(s.name?.trim() || 'ไม่ระบุชื่อ', NAME_MAX));
  const place = s.district
    ? `${escapeMarkdown(truncate(s.district, DISTRICT_MAX))} (${s.province ?? '-'})`
    : s.province ?? '-';
  return `• ${freq} ${name} — ${place} — ${escapeMarkdown(teams.join(', '))}`;
}

function progressLine(p: ProvinceProgress): string {
  const pct = p.total > 0 ? Math.round((p.inspected / p.total) * 100) : 0;
  const revoked = p.revoked > 0 ? ` · ถูกเพิกถอน ${p.revoked}` : '';
  return `${p.province} ${p.inspected}/${p.total} (${pct}%)${revoked}`;
}

function describe(stations: StationGroup[], progress: ProvinceProgress[], listed: number): string {
  const lines = stations.slice(0, listed).map(stationLine);
  const hidden = stations.length - listed;
  return [
    `วันนี้ตรวจ ${stations.length} สถานี`,
    '',
    ...lines,
    ...(hidden > 0 ? [`…และอีก ${hidden} สถานี`] : []),
    '',
    '**ความคืบหน้า ปี 69**',
    ...progress.map(progressLine),
  ].join('\n');
}

/** Returns null when nothing was inspected — the caller skips posting. */
export function buildInspectionDigest(
  inspections: DigestInspection[],
  progress: ProvinceProgress[],
  date: string,
  siteUrl?: string,
): DiscordWebhookPayload | null {
  if (inspections.length === 0) return null;

  const stations = groupByStation(inspections);
  let listed = Math.min(stations.length, MAX_LISTED);
  let description = describe(stations, progress, listed);
  while (description.length > DESCRIPTION_LIMIT && listed > 0) {
    listed -= 1;
    description = describe(stations, progress, listed);
  }

  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `📋 สรุปการตรวจสถานี FM — ${formatThaiDate(date)}`,
        description,
        color: EMBED_COLOR,
        ...(siteUrl ? { url: siteUrl } : {}),
      },
    ],
  };
}
