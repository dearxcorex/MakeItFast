// Follow-up memory for /ask: the turns behind each answer, keyed by the
// Discord message id the answer was posted as. Pressing "ถามต่อ" on that
// message loads them, so the next answer sees the conversation so far.
//
// Short-lived on purpose. This is thread memory, not a case record (those were
// dropped from scope): turns expire after TTL_SECONDS and a chain stops taking
// follow-ups after MAX_FOLLOW_UPS. Upstash only — an in-memory fallback on
// serverless would forget at random, so without Redis the button is not shown.
//
// Nothing here is new data leaving the country: a turn is the question, the
// answer DeepSeek already wrote, and tool names with their inputs.

import { redis } from '@/lib/redis';

const KEY_PREFIX = 'ask_thread:';
export const TTL_SECONDS = 24 * 60 * 60;
/** Follow-ups after the first /ask; the chain is at most 1 + this many turns. */
export const MAX_FOLLOW_UPS = 3;

export interface AskTurn {
  question: string;
  answer: string;
  tools: Array<{ name: string; input: Record<string, unknown> }>;
}

export function threadMemoryAvailable(): boolean {
  return redis !== null;
}

/** Whether an answer that closes a chain of `turns` turns may offer another follow-up. */
export function canFollowUp(turns: number): boolean {
  return threadMemoryAvailable() && turns <= MAX_FOLLOW_UPS;
}

export async function saveThread(messageId: string, turns: AskTurn[]): Promise<void> {
  if (!redis) return;
  await redis.set(`${KEY_PREFIX}${messageId}`, turns, { ex: TTL_SECONDS });
}

/** The turns behind an answer, or null when they expired or never existed. */
export async function loadThread(messageId: string): Promise<AskTurn[] | null> {
  if (!redis) return null;
  const turns = await redis.get<AskTurn[]>(`${KEY_PREFIX}${messageId}`);
  return Array.isArray(turns) ? turns : null;
}
