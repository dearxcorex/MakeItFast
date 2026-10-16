// Builds the Discord reply for /ask. Pure: the route runs the agent, this only
// formats the result — including the disclaimer, which is stamped here rather
// than asked of the model, so it cannot go missing from an answer.

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

function footer(toolsUsed: string[], truncated: boolean, deadlineHit: boolean): string {
  const used = [...new Set(toolsUsed)].map((t) => TOOL_LABELS[t] ?? t);
  return truncate(
    [
      `⚠️ ${DISCLAIMER}`,
      used.length ? `ใช้: ${used.join(' · ')}` : 'ไม่ได้เรียกเครื่องมือ — ตอบจากความรู้ทั่วไป',
      ...(truncated ? [deadlineHit ? 'สรุปก่อนกำหนด: หมดเวลาค้นข้อมูล' : 'สรุปก่อนกำหนด: ค้นข้อมูลครบรอบสูงสุดแล้ว'] : []),
    ].join('\n'),
    FOOTER_LIMIT,
  );
}

export function buildAskMessage(
  question: string,
  result: { answer: string; toolsUsed: string[]; truncated: boolean; deadlineHit?: boolean },
  options: AskMessageOptions = {},
): AskMessage {
  const lead = options.parentUrl ? `↪️ ต่อจาก[คำตอบก่อนหน้า](${options.parentUrl})\n\n` : '';
  return {
    // Neutralises any @everyone the model might emit, whatever the prompt says.
    allowed_mentions: { parse: [] },
    embeds: [
      {
        // Embed titles do not render markdown, so the question is not escaped.
        title: truncate(`🤖 ${question}`, TITLE_LIMIT),
        description: truncate(lead + result.answer, DESCRIPTION_LIMIT),
        color: EMBED_COLOR,
        footer: { text: footer(result.toolsUsed, result.truncated, result.deadlineHit === true) },
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
