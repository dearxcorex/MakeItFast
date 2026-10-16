// Builds the Discord reply for /ask. Pure: the route runs the agent, this only
// formats the result — including the disclaimer, which is stamped here rather
// than asked of the model, so it cannot go missing from an answer.

import type { StationDetail } from '@/services/askTools';
import { DISCLAIMER } from '@/utils/askPrompt';

// https://discord.com/developers/docs/resources/message#embed-object-embed-limits
const TITLE_LIMIT = 256;
const DESCRIPTION_LIMIT = 4096;
const FOOTER_LIMIT = 2048;

// pinTokens `inspected`, matching /stat
const EMBED_COLOR = 0x00684a;

/** custom_id of the "ถามต่อ" button; the route opens the follow-up modal on it. */
export const FOLLOW_UP_BUTTON_ID = 'ask_followup';

export interface AskMessage {
  allowed_mentions: { parse: [] };
  embeds: Array<{
    title: string;
    description: string;
    color: number;
    footer: { text: string };
  }>;
  /** Always sent, empty when there is no button, so an edit also clears an old one. */
  components: Array<{
    type: 1;
    components: Array<{ type: 2; style: 2; label: string; custom_id: string; emoji: { name: string } }>;
  }>;
}

export interface AskMessageOptions {
  /** Offer the "ถามต่อ" button. */
  followUp?: boolean;
  /** For a follow-up: link back to the answer it continues. */
  parentUrl?: string;
}

export function truncate(s: string, limit: number): string {
  return s.length <= limit ? s : `${s.slice(0, limit - 1)}…`;
}

const TOOL_LABELS: Record<string, string> = {
  find_stations: 'ฐานข้อมูลสถานี',
  find_oper_stations: 'ทะเบียน OPER',
  count_oper_inspections: 'นับการตรวจ OPER',
  path_loss: 'คำนวณ FSPL',
  web_search: 'ค้นเว็บ',
};

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const BANGKOK_OFFSET_MS = 7 * 3_600_000;

/** An ISO timestamp as Thai time, Buddhist era: "16 ต.ค. 2569 10:00". Undefined when it does not parse. */
export function thaiDateTime(iso: string): string | undefined {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return undefined;
  const t = new Date(ms + BANGKOK_OFFSET_MS);
  const hh = String(t.getUTCHours()).padStart(2, '0');
  const mm = String(t.getUTCMinutes()).padStart(2, '0');
  return `${t.getUTCDate()} ${THAI_MONTHS[t.getUTCMonth()]} ${t.getUTCFullYear() + 543} ${hh}:${mm}`;
}

export interface ToolCallOutput {
  name: string;
  output: string;
  isError: boolean;
  stations?: StationDetail[];
}

/** Station details printed under an answer; more go uncounted to keep the embed readable. */
export const MAX_DETAIL_STATIONS = 10;

function stationBlock(s: StationDetail): string {
  const place = [
    s.subdistrict && `ต.${s.subdistrict}`,
    s.district && `อ.${s.district}`,
    s.province && `จ.${s.province}`,
  ].filter(Boolean);
  const coords =
    s.lat !== null && s.lng !== null
      ? `[${s.lat}, ${s.lng}](https://www.google.com/maps?q=${s.lat},${s.lng})`
      : 'ไม่มีข้อมูล';
  const phone = s.contactPhone ? [s.contactName, s.contactPhone].filter(Boolean).join(' ') : 'ไม่มีข้อมูล';
  return [
    `**${s.name ?? 'ไม่ทราบชื่อ'}**${s.frequencyMHz !== null ? ` ${s.frequencyMHz} MHz` : ''}`,
    `ที่ตั้ง: ${place.length ? place.join(' ') : 'ไม่มีข้อมูล'}`,
    `พิกัด: ${coords}`,
    `โทร: ${phone}`,
  ].join('\n');
}

/**
 * Where each OPER station found is and whom to call, read off the tool results
 * rather than written by the model, which never sees coordinates or phone numbers.
 */
export function stationDetailsText(calls: ToolCallOutput[]): string {
  const seen = new Map<string, StationDetail>();
  for (const call of calls) {
    if (call.isError) continue;
    for (const s of call.stations ?? []) seen.set(`${s.name}|${s.frequencyMHz}`, s);
  }
  const all = [...seen.values()];
  if (!all.length) return '';
  const shown = all.slice(0, MAX_DETAIL_STATIONS).map(stationBlock);
  const more = all.length > shown.length ? [`…และอีก ${all.length - shown.length} สถานี`] : [];
  return ['**📍 ที่ตั้งและผู้ติดต่อ (ทะเบียน OPER)**', ...shown, ...more].join('\n\n');
}

/**
 * Read off the find_oper_stations results, not asked of the model: how old the
 * saved register is, and whether a live walk ran out of time before the list was whole.
 */
export function operDataLines(calls: ToolCallOutput[]): string[] {
  const asOf = new Set<string>();
  const partial = new Set<string>();
  for (const call of calls) {
    if (call.name !== 'find_oper_stations' || call.isError) continue;
    let out: { as_of?: unknown; complete?: unknown; shown?: unknown; total?: unknown };
    try {
      out = JSON.parse(call.output);
    } catch {
      continue;
    }
    const when = typeof out.as_of === 'string' ? thaiDateTime(out.as_of) : undefined;
    if (when) asOf.add(`ข้อมูล OPER ณ ${when}`);
    if (out.complete === false && typeof out.shown === 'number' && typeof out.total === 'number') {
      partial.add(`รายการ OPER ไม่ครบ: แสดง ${out.shown} จาก ${out.total} สถานี (ค้นสดไม่ทันเวลา)`);
    }
  }
  return [...asOf, ...partial];
}

function footer(toolsUsed: string[], truncated: boolean, deadlineHit: boolean, calls: ToolCallOutput[]): string {
  const used = [...new Set(toolsUsed)].map((t) => TOOL_LABELS[t] ?? t);
  return truncate(
    [
      `⚠️ ${DISCLAIMER}`,
      used.length ? `ใช้: ${used.join(' · ')}` : 'ไม่ได้เรียกเครื่องมือ — ตอบจากความรู้ทั่วไป',
      ...operDataLines(calls),
      ...(truncated ? [deadlineHit ? 'สรุปก่อนกำหนด: หมดเวลาค้นข้อมูล' : 'สรุปก่อนกำหนด: ค้นข้อมูลครบรอบสูงสุดแล้ว'] : []),
    ].join('\n'),
    FOOTER_LIMIT,
  );
}

export function buildAskMessage(
  question: string,
  result: { answer: string; toolsUsed: string[]; truncated: boolean; deadlineHit?: boolean; calls?: ToolCallOutput[] },
  options: AskMessageOptions = {},
): AskMessage {
  const lead = options.parentUrl ? `↪️ ต่อจาก[คำตอบก่อนหน้า](${options.parentUrl})\n\n` : '';
  const answer = lead + result.answer;
  const details = stationDetailsText(result.calls ?? []);
  // The answer keeps its room; the details take what is left.
  const room = DESCRIPTION_LIMIT - answer.length - 2;
  const description = details && room > 0 ? `${answer}\n\n${truncate(details, room)}` : answer;
  return {
    // Neutralises any @everyone the model might emit, whatever the prompt says.
    allowed_mentions: { parse: [] },
    embeds: [
      {
        // Embed titles do not render markdown, so the question is not escaped.
        title: truncate(`🤖 ${question}`, TITLE_LIMIT),
        description: truncate(description, DESCRIPTION_LIMIT),
        color: EMBED_COLOR,
        footer: { text: footer(result.toolsUsed, result.truncated, result.deadlineHit === true, result.calls ?? []) },
      },
    ],
    components: options.followUp
      ? [
          {
            type: 1,
            components: [{ type: 2, style: 2, label: 'ถามต่อ', custom_id: FOLLOW_UP_BUTTON_ID, emoji: { name: '💬' } }],
          },
        ]
      : [],
  };
}

/** Plain-content reply for the paths where there is no answer to format. */
export function askErrorMessage(content: string) {
  return { content, allowed_mentions: { parse: [] } };
}
