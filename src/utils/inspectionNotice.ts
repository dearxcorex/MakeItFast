// Builds the Discord message posted when someone marks an FM station or an
// interference site as inspected. Pure: the notifier service loads the rows.

import { SUPPRESS_NOTIFICATIONS } from '@/lib/discord';
import { escapeMarkdown, formatThaiDate } from '@/utils/fmStat';

export interface StationNoticeInput {
  name: string | null;
  freq: number | null;
  district: string | null;
  province: string | null;
  type: string | null;
  lat: number | null;
  long: number | null;
  inspectedOn: string;
  lead: string;
  helpers: string[];
}

export interface SiteNoticeInput {
  siteName: string | null;
  siteCode: string | null;
  changwat: string | null;
  ranking: string | null;
  lat: number | null;
  long: number | null;
  sourceLat: number | null;
  sourceLong: number | null;
  inspectedOn: string;
  lead: string;
  helpers: string[];
}

interface EmbedField { name: string; value: string; inline?: boolean }

export interface InspectionNoticeMessage {
  flags: number;
  allowed_mentions: { parse: [] };
  embeds: Array<{
    title: string;
    description?: string;
    color: number;
    fields: EmbedField[];
    footer: { text: string };
  }>;
}

// pinTokens `inspected`
const EMBED_COLOR = 0x00684a;

function mapsLink(label: string, lat: number | null, long: number | null): string | null {
  if (lat == null || long == null) return null;
  return `[${label}](https://www.google.com/maps?q=${lat},${long})`;
}

function field(name: string, value: string | null | undefined, inline = true): EmbedField[] {
  const v = value?.trim();
  return v ? [{ name, value: escapeMarkdown(v), inline }] : [];
}

function crewFields(lead: string, helpers: string[]): EmbedField[] {
  return [
    ...field('ผู้ตรวจ', lead, false),
    ...field('ผู้ร่วมตรวจ', helpers.join(', '), false),
  ];
}

function message(
  title: string,
  links: Array<string | null>,
  fields: EmbedField[],
  inspectedOn: string,
): InspectionNoticeMessage {
  const description = links.filter(Boolean).join(' · ');
  return {
    flags: SUPPRESS_NOTIFICATIONS,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        // Embed titles do not render markdown, so they are not escaped.
        title,
        ...(description ? { description } : {}),
        color: EMBED_COLOR,
        fields,
        footer: { text: `วันที่ตรวจ ${formatThaiDate(inspectedOn)}` },
      },
    ],
  };
}

export function buildStationNotice(s: StationNoticeInput): InspectionNoticeMessage {
  const name = s.name?.trim() || 'ไม่ระบุชื่อ';
  const freq = s.freq != null ? ` ${s.freq} MHz` : '';
  const area = [s.district, s.province].map((x) => x?.trim()).filter(Boolean).join(', ');
  return message(
    `✅ ตรวจแล้ว · ${name}${freq}`,
    [mapsLink('📍 Google Maps', s.lat, s.long)],
    [...field('พื้นที่', area), ...field('ประเภท', s.type), ...crewFields(s.lead, s.helpers)],
    s.inspectedOn,
  );
}

export function buildSiteNotice(s: SiteNoticeInput): InspectionNoticeMessage {
  const name = s.siteName?.trim() || s.siteCode?.trim() || 'ไม่ระบุชื่อ';
  return message(
    `✅ ตรวจแล้ว · สัญญาณรบกวน ${name}`,
    [
      mapsLink('📍 ไซต์', s.lat, s.long),
      mapsLink('🎯 จุดต้นเหตุ', s.sourceLat, s.sourceLong),
    ],
    [
      ...field('รหัสไซต์', s.siteCode),
      ...field('จังหวัด', s.changwat),
      ...field('ระดับ', s.ranking),
      ...crewFields(s.lead, s.helpers),
    ],
    s.inspectedOn,
  );
}
