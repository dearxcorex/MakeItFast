// The /ask agent loop: DeepSeek routes, src/services/askTools.ts computes.
//
// Bounded on purpose. Discord gives a 15-minute window to edit a deferred
// reply but the route only gets 60 s, so the loop has a hard round cap and the
// last call goes out with no tools at all — that guarantees a text answer
// instead of a model that keeps asking for one more lookup.

import {
  createMessage,
  type ChatMessage,
  type ContentBlock,
} from '@/lib/deepseek';
import { TOOL_DEFINITIONS, runTool } from '@/services/askTools';
import { buildSystemPrompt } from '@/utils/askPrompt';

export const MAX_TOOL_ROUNDS = 5;

export interface AskResult {
  answer: string;
  /** Tool names in call order — logged, and useful when an answer looks wrong. */
  toolsUsed: string[];
  /** True when the loop hit MAX_TOOL_ROUNDS and was forced to conclude. */
  truncated: boolean;
}

function textOf(content: ContentBlock[]): string {
  return content
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

function toolUsesOf(content: ContentBlock[]) {
  return content.filter((b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use');
}

async function resultBlock(use: Extract<ContentBlock, { type: 'tool_use' }>): Promise<ContentBlock> {
  try {
    const output = await runTool(use.name, use.input ?? {});
    return { type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(output) };
  } catch (error) {
    console.error(`/ask tool ${use.name} failed:`, error);
    return {
      type: 'tool_result',
      tool_use_id: use.id,
      content: `เครื่องมือทำงานไม่สำเร็จ: ${error instanceof Error ? error.message : 'unknown error'}`,
      is_error: true,
    };
  }
}

export async function askAgent(question: string, today: string): Promise<AskResult> {
  const system = buildSystemPrompt(today);
  const messages: ChatMessage[] = [{ role: 'user', content: question }];
  const toolsUsed: string[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reply = await createMessage({ system, messages, tools: TOOL_DEFINITIONS });
    const uses = toolUsesOf(reply.content);

    if (!uses.length) {
      const answer = textOf(reply.content);
      if (answer) return { answer, toolsUsed, truncated: false };
      break;
    }

    messages.push({ role: 'assistant', content: reply.content });
    const results: ContentBlock[] = [];
    for (const use of uses) {
      toolsUsed.push(use.name);
      results.push(await resultBlock(use));
    }
    messages.push({ role: 'user', content: results });
  }

  // Out of rounds (or the model answered with nothing at all). Ask once more
  // with the tools taken away, so it has to write from what it already has.
  messages.push({
    role: 'user',
    content:
      'พอแล้ว ห้ามเรียกเครื่องมือเพิ่ม ให้สรุปคำตอบภาษาไทยจากข้อมูลที่มีอยู่ตอนนี้ ' +
      'ถ้าข้อมูลไม่พอให้บอกว่าไม่พอและแนะนำขั้นตอนที่เจ้าหน้าที่ควรทำต่อหน้างาน',
  });
  const final = await createMessage({ system, messages });
  return {
    answer: textOf(final.content) || 'ยังสรุปคำตอบไม่ได้ ลองถามใหม่โดยระบุความถี่และพื้นที่ให้ชัดขึ้น',
    toolsUsed,
    truncated: true,
  };
}
