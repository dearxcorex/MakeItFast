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

export interface AskMessage {
  allowed_mentions: { parse: [] };
  embeds: Array<{
    title: string;
    description: string;
    color: number;
    footer: { text: string };
  }>;
}

export function truncate(s: string, limit: number): string {
  return s.length <= limit ? s : `${s.slice(0, limit - 1)}…`;
}

const TOOL_LABELS: Record<string, string> = {
  find_stations: 'ฐานข้อมูลสถานี',
  scan_intermod: 'คำนวณอินเตอร์มอด',
  path_loss: 'คำนวณ FSPL',
  web_search: 'ค้นเว็บ',
};

function footer(toolsUsed: string[], truncated: boolean): string {
  const used = [...new Set(toolsUsed)].map((t) => TOOL_LABELS[t] ?? t);
  return truncate(
    [
      `⚠️ ${DISCLAIMER}`,
      used.length ? `ใช้: ${used.join(' · ')}` : 'ไม่ได้เรียกเครื่องมือ — ตอบจากความรู้ทั่วไป',
      ...(truncated ? ['สรุปก่อนกำหนด: ค้นข้อมูลครบรอบสูงสุดแล้ว'] : []),
    ].join('\n'),
    FOOTER_LIMIT,
  );
}

export function buildAskMessage(
  question: string,
  result: { answer: string; toolsUsed: string[]; truncated: boolean },
): AskMessage {
  return {
    // Neutralises any @everyone the model might emit, whatever the prompt says.
    allowed_mentions: { parse: [] },
    embeds: [
      {
        // Embed titles do not render markdown, so the question is not escaped.
        title: truncate(`🤖 ${question}`, TITLE_LIMIT),
        description: truncate(result.answer, DESCRIPTION_LIMIT),
        color: EMBED_COLOR,
        footer: { text: footer(result.toolsUsed, result.truncated) },
      },
    ],
  };
}

/** Plain-content reply for the paths where there is no answer to format. */
export function askErrorMessage(content: string) {
  return { content, allowed_mentions: { parse: [] } };
}
