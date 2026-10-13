// The /ask agent loop: DeepSeek routes, src/services/askTools.ts computes.
//
// Bounded on purpose. Discord gives a 15-minute window to edit a deferred
// reply but the route only gets 60 s, so the loop has two brakes: a round cap
// and a wall-clock deadline. Either one ends in a last call with no tools at
// all — that guarantees a text answer instead of a model that keeps asking for
// one more lookup, and it leaves the route time to post that answer.

import {
  createMessage,
  type ChatMessage,
  type ContentBlock,
} from '@/lib/deepseek';
import type { AskTurn } from '@/lib/askThread';
import { TOOL_DEFINITIONS, runTool } from '@/services/askTools';
import { buildSystemPrompt } from '@/utils/askPrompt';

export const MAX_TOOL_ROUNDS = 5;
/** The whole loop, final answer included. The route's maxDuration is 60 s; the rest is posting. */
export const DEADLINE_MS = 48_000;
/** Kept back for the tool-free wrap-up: no tool round starts, or runs on, inside it. */
export const FINAL_RESERVE_MS = 12_000;
/** Below this there is no point asking for a wrap-up; the fallback text goes out instead. */
const MIN_FINAL_MS = 3_000;
const MAX_CALL_MS = 40_000;

const HISTORY_RESULT_STUB =
  'ผลเต็มของรอบก่อนไม่ได้เก็บไว้ ตัวเลขที่ใช้ได้อยู่ในคำตอบถัดไป ถ้าต้องการตัวเลขใหม่ให้เรียกเครื่องมืออีกครั้ง';

const FALLBACK_ANSWER = 'ยังสรุปคำตอบไม่ได้ ลองถามใหม่โดยระบุความถี่และพื้นที่ให้ชัดขึ้น';

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  /** The tool_result content string, as sent back to the model. */
  output: string;
  isError: boolean;
  ms: number;
}

export interface AskResult {
  answer: string;
  /** Tool names in call order — logged, and useful when an answer looks wrong. */
  toolsUsed: string[];
  /** True when the loop was forced to conclude — by the round cap or the deadline. */
  truncated: boolean;
  /** Every tool call with its input and the exact output the model saw — for traces and the eval. */
  calls: ToolCall[];
  /** Model calls made, wrap-up included. */
  rounds: number;
  ms: number;
  /** True when the deadline, not the round cap, ended the tool rounds. */
  deadlineHit: boolean;
  usage: { inputTokens: number; outputTokens: number };
}

export interface AskOptions {
  /** Earlier turns of a follow-up chain, oldest first. */
  history?: AskTurn[];
  /** Injectable clock for tests. */
  now?: () => number;
}

/**
 * Earlier turns, replayed in the shape the model itself produced them: the
 * question, the tool calls it made, and its answer. Tool results are not kept —
 * they can be long — so each gets a stub saying so. A native tool_use block,
 * unlike a text note, is not something the model copies into its next answer.
 */
export function historyMessages(history: AskTurn[]): ChatMessage[] {
  return history.flatMap((turn, t): ChatMessage[] => {
    const uses: ToolUseBlock[] = turn.tools.map((tool, i) => ({
      type: 'tool_use',
      id: `history_${t}_${i}`,
      name: tool.name,
      input: tool.input,
    }));
    return [
      { role: 'user', content: turn.question },
      ...(uses.length
        ? ([
            { role: 'assistant', content: uses },
            {
              role: 'user',
              content: uses.map((use): ToolResultBlock => ({ type: 'tool_result', tool_use_id: use.id, content: HISTORY_RESULT_STUB })),
            },
          ] satisfies ChatMessage[])
        : []),
      { role: 'assistant', content: turn.answer },
    ];
  });
}

type ToolUseBlock = Extract<ContentBlock, { type: 'tool_use' }>;
type ToolResultBlock = Extract<ContentBlock, { type: 'tool_result' }>;

function textOf(content: ContentBlock[]): string {
  return content
    .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

function toolUsesOf(content: ContentBlock[]) {
  return content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function errorResult(use: ToolUseBlock, message: string): ToolResultBlock {
  return { type: 'tool_result', tool_use_id: use.id, content: `เครื่องมือทำงานไม่สำเร็จ: ${message}`, is_error: true };
}

async function resultBlock(use: ToolUseBlock, budgetMs: number): Promise<ToolResultBlock> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ToolResultBlock>((resolve) => {
    timer = setTimeout(() => resolve(errorResult(use, 'หมดเวลา')), Math.max(budgetMs, 0));
  });
  const run = (async (): Promise<ToolResultBlock> => {
    try {
      const output = await runTool(use.name, use.input ?? {});
      return { type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(output) };
    } catch (error) {
      console.error(`/ask tool ${use.name} failed:`, error);
      return errorResult(use, error instanceof Error ? error.message : 'unknown error');
    }
  })();
  try {
    return await Promise.race([run, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function askAgent(question: string, today: string, options: AskOptions = {}): Promise<AskResult> {
  const now = options.now ?? Date.now;
  const startedAt = now();
  const remaining = () => startedAt + DEADLINE_MS - now();
  const toolBudget = () => Math.min(MAX_CALL_MS, remaining() - FINAL_RESERVE_MS);

  const system = buildSystemPrompt(today);
  const messages: ChatMessage[] = [...historyMessages(options.history ?? []), { role: 'user', content: question }];
  const toolsUsed: string[] = [];
  const calls: ToolCall[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let rounds = 0;
  let deadlineHit = false;

  const call = async (withTools: boolean, timeoutMs: number) => {
    rounds++;
    const reply = await createMessage({ system, messages, ...(withTools && { tools: TOOL_DEFINITIONS }) }, timeoutMs);
    usage.inputTokens += reply.usage?.input_tokens ?? 0;
    usage.outputTokens += reply.usage?.output_tokens ?? 0;
    return reply;
  };
  const done = (answer: string, truncated: boolean): AskResult => ({
    answer,
    toolsUsed,
    truncated,
    calls,
    rounds,
    ms: now() - startedAt,
    deadlineHit,
    usage,
  });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (toolBudget() <= 0) {
      deadlineHit = true;
      break;
    }

    let reply;
    try {
      reply = await call(true, toolBudget());
    } catch (error) {
      if (!isTimeout(error)) throw error;
      deadlineHit = true;
      break;
    }
    const uses = toolUsesOf(reply.content);

    if (!uses.length) {
      const answer = textOf(reply.content);
      if (answer) return done(answer, false);
      break;
    }

    // Tools in one turn are independent lookups, so they run side by side.
    messages.push({ role: 'assistant', content: reply.content });
    const budget = toolBudget();
    const startedTools = now();
    const results = await Promise.all(uses.map((use) => resultBlock(use, budget)));
    const toolsMs = now() - startedTools;
    uses.forEach((use, i) => {
      toolsUsed.push(use.name);
      calls.push({
        name: use.name,
        input: use.input ?? {},
        output: results[i].content,
        isError: results[i].is_error === true,
        ms: toolsMs,
      });
    });
    messages.push({ role: 'user', content: results });
  }

  // Out of rounds or time (or the model answered with nothing at all). Ask
  // once more with the tools taken away, so it has to write from what it has.
  const finalBudget = Math.min(MAX_CALL_MS, remaining());
  if (finalBudget < MIN_FINAL_MS) return done(FALLBACK_ANSWER, true);
  messages.push({
    role: 'user',
    content:
      'พอแล้ว ห้ามเรียกเครื่องมือเพิ่ม ให้สรุปคำตอบภาษาไทยจากข้อมูลที่มีอยู่ตอนนี้ ' +
      'ถ้าข้อมูลไม่พอให้บอกว่าไม่พอและแนะนำขั้นตอนที่เจ้าหน้าที่ควรทำต่อหน้างาน',
  });
  try {
    const final = await call(false, finalBudget);
    return done(textOf(final.content) || FALLBACK_ANSWER, true);
  } catch (error) {
    if (!isTimeout(error)) throw error;
    deadlineHit = true;
    return done(FALLBACK_ANSWER, true);
  }
}

/**
 * One JSON log line per /ask, for Vercel logs. Tool outputs are left out —
 * they can be long, and the eval keeps full traces when those are needed.
 */
export function askTraceLine(question: string, result: AskResult): string {
  return JSON.stringify({
    event: 'ask',
    question,
    ms: result.ms,
    rounds: result.rounds,
    truncated: result.truncated,
    deadlineHit: result.deadlineHit,
    ...result.usage,
    answerChars: result.answer.length,
    tools: result.calls.map(({ name, input, ms, isError }) => ({ name, input, ms, isError })),
  });
}
