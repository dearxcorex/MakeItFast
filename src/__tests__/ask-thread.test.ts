import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, { value: unknown; ex?: number }>();
const fakeRedis = {
  set: vi.fn(async (key: string, value: unknown, opts?: { ex?: number }) => {
    store.set(key, { value, ex: opts?.ex });
    return 'OK';
  }),
  get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
};
let redisOn = true;
vi.mock('@/lib/redis', () => ({
  get redis() {
    return redisOn ? fakeRedis : null;
  },
}));

import { MAX_FOLLOW_UPS, TTL_SECONDS, canFollowUp, loadThread, saveThread, type AskTurn } from '@/lib/askThread';
import { historyMessages } from '@/services/askAgent';
import { buildAskMessage } from '@/utils/askMessage';
import { modalTextValue, messageUrl, type Interaction } from '@/lib/discord';

const turn: AskTurn = {
  question: 'ร้องเรียน 122.5 MHz',
  answer: 'ลองสแกนคู่ 107.75 กับ 93',
  tools: [{ name: 'scan_intermod', input: { targetFrequency: 122.5 } }],
};

beforeEach(() => {
  store.clear();
  redisOn = true;
  vi.clearAllMocks();
});

describe('thread store', () => {
  it('round-trips the turns under the message id, with a 24 h expiry', async () => {
    await saveThread('m1', [turn]);
    expect(store.get('ask_thread:m1')?.ex).toBe(TTL_SECONDS);
    expect(TTL_SECONDS).toBe(24 * 60 * 60);
    expect(await loadThread('m1')).toEqual([turn]);
  });

  it('reads an unknown or expired message as null', async () => {
    expect(await loadThread('gone')).toBeNull();
  });

  it('allows the first answer plus MAX_FOLLOW_UPS follow-ups, then stops', () => {
    expect(canFollowUp(1)).toBe(true);
    expect(canFollowUp(MAX_FOLLOW_UPS)).toBe(true);
    expect(canFollowUp(MAX_FOLLOW_UPS + 1)).toBe(false);
  });

  it('turns itself off entirely without Redis — no in-memory fallback', async () => {
    redisOn = false;
    expect(canFollowUp(1)).toBe(false);
    await saveThread('m1', [turn]);
    expect(fakeRedis.set).not.toHaveBeenCalled();
    expect(await loadThread('m1')).toBeNull();
  });
});

describe('historyMessages', () => {
  it('replays a turn as question, its tool calls with stub results, then the answer', () => {
    const out = historyMessages([turn]);
    expect(out).toHaveLength(4);
    expect(out[0]).toEqual({ role: 'user', content: 'ร้องเรียน 122.5 MHz' });
    expect(out[1]).toEqual({
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'history_0_0', name: 'scan_intermod', input: { targetFrequency: 122.5 } }],
    });
    expect(out[2].role).toBe('user');
    expect(out[2].content).toEqual([
      { type: 'tool_result', tool_use_id: 'history_0_0', content: expect.stringContaining('เรียกเครื่องมืออีกครั้ง') },
    ]);
    expect(out[3]).toEqual({ role: 'assistant', content: 'ลองสแกนคู่ 107.75 กับ 93' });
  });

  it('skips the tool exchange for a turn that used no tools, keeping ids unique per turn', () => {
    const out = historyMessages([{ question: 'ต่อ', answer: 'ตอบ', tools: [] }, turn]);
    expect(out.slice(0, 2)).toEqual([
      { role: 'user', content: 'ต่อ' },
      { role: 'assistant', content: 'ตอบ' },
    ]);
    expect((out[3].content as Array<{ id: string }>)[0].id).toBe('history_1_0');
  });
});

describe('buildAskMessage follow-up parts', () => {
  const result = { answer: 'คำตอบ', toolsUsed: [], truncated: false };

  it('adds the ถามต่อ button only when asked to', () => {
    expect(buildAskMessage('q', result).components).toEqual([]);
    const button = buildAskMessage('q', result, { followUp: true }).components[0].components[0];
    expect(button).toMatchObject({ type: 2, custom_id: 'ask_followup', label: 'ถามต่อ' });
  });

  it('links a follow-up back to the answer it continues', () => {
    const msg = buildAskMessage('q', result, { parentUrl: 'https://discord.com/channels/1/2/3' });
    expect(msg.embeds[0].description).toMatch(/^↪️ .*\(https:\/\/discord\.com\/channels\/1\/2\/3\)\n\nคำตอบ$/);
  });

  it('says a deadline cut, not the round cap, ended the search', () => {
    const msg = buildAskMessage('q', { ...result, truncated: true, deadlineHit: true });
    expect(msg.embeds[0].footer?.text).toContain('หมดเวลา');
  });
});

describe('modal helpers', () => {
  it('reads a text input from the action-row and the label layouts', () => {
    const rows = { type: 5, token: 't', data: { components: [{ type: 1, components: [{ type: 4, custom_id: 'question', value: ' ถาม ' }] }] } };
    const label = { type: 5, token: 't', data: { components: [{ type: 18, component: { type: 4, custom_id: 'question', value: 'ถาม' } }] } };
    expect(modalTextValue(rows as Interaction, 'question')).toBe('ถาม');
    expect(modalTextValue(label as Interaction, 'question')).toBe('ถาม');
    expect(modalTextValue(rows as Interaction, 'other')).toBeUndefined();
  });

  it('builds a message link', () => {
    expect(messageUrl('g', 'c', 'm')).toBe('https://discord.com/channels/g/c/m');
  });
});
