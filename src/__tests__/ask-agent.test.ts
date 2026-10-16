import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/deepseek', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/deepseek')>()),
  createMessage: vi.fn(),
}));

vi.mock('@/services/askTools', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/askTools')>()),
  runTool: vi.fn(),
}));

import { createMessage, type ContentBlock, type MessageResponse } from '@/lib/deepseek';
import { runTool } from '@/services/askTools';
import { askAgent, DEADLINE_MS, FINAL_RESERVE_MS, MAX_TOOL_ROUNDS } from '@/services/askAgent';

const text = (t: string): MessageResponse => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }] });

const wantsTool = (name: string, input: Record<string, unknown> = {}, id = 'tu_1'): MessageResponse => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id, name, input }],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('askAgent', () => {
  it('returns the answer straight away when no tool is wanted', async () => {
    vi.mocked(createMessage).mockResolvedValue(text('ตอบเลย'));
    const out = await askAgent('สวัสดี', '2026-09-20');
    expect(out).toMatchObject({ answer: 'ตอบเลย', toolsUsed: [], truncated: false, calls: [], rounds: 1, deadlineHit: false });
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it('dates the system prompt and offers the tools', async () => {
    vi.mocked(createMessage).mockResolvedValue(text('ok'));
    await askAgent('ถาม', '2026-09-20');
    const body = vi.mocked(createMessage).mock.calls[0][0];
    expect(body.system).toContain('2026-09-20');
    expect(body.tools?.length).toBeGreaterThan(0);
    expect(body.messages).toEqual([{ role: 'user', content: 'ถาม' }]);
  });

  it('runs a tool and feeds the result back as tool_result', async () => {
    vi.mocked(createMessage)
      .mockResolvedValueOnce(wantsTool('find_oper_stations', { frequency: 91.75 }))
      .mockResolvedValueOnce(text('เจอคู่สถานี'));
    vi.mocked(runTool).mockResolvedValue({ dangerousPairsFound: 1 });

    const out = await askAgent('122.5 MHz โดนรบกวน', '2026-09-20');

    expect(runTool).toHaveBeenCalledWith('find_oper_stations', { frequency: 91.75 });
    expect(out).toMatchObject({ answer: 'เจอคู่สถานี', toolsUsed: ['find_oper_stations'], truncated: false });
    expect(out.calls).toEqual([
      {
        name: 'find_oper_stations',
        input: { frequency: 91.75 },
        output: JSON.stringify({ dangerousPairsFound: 1 }),
        isError: false,
        ms: expect.any(Number),
      },
    ]);

    const second = vi.mocked(createMessage).mock.calls[1][0].messages;
    const result = (second[2].content as ContentBlock[])[0];
    expect(result).toEqual({
      type: 'tool_result',
      tool_use_id: 'tu_1',
      content: JSON.stringify({ dangerousPairsFound: 1 }),
    });
  });

  it('hands a failing tool back to the model as an error, not a crash', async () => {
    vi.mocked(createMessage)
      .mockResolvedValueOnce(wantsTool('web_search'))
      .mockResolvedValueOnce(text('ค้นไม่ได้ แต่แนะนำได้'));
    vi.mocked(runTool).mockRejectedValue(new Error('network down'));

    const out = await askAgent('ถาม', '2026-09-20');

    expect(out.answer).toBe('ค้นไม่ได้ แต่แนะนำได้');
    const result = (vi.mocked(createMessage).mock.calls[1][0].messages[2].content as ContentBlock[])[0];
    expect(result).toMatchObject({ is_error: true });
    expect((result as { content: string }).content).toContain('network down');
    expect(out.calls[0]).toMatchObject({ name: 'web_search', isError: true });
  });

  it('runs every tool the model asks for in one turn', async () => {
    vi.mocked(createMessage)
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'a', name: 'find_stations', input: {} },
          { type: 'tool_use', id: 'b', name: 'path_loss', input: { distanceKm: 5, frequencyMHz: 100 } },
        ],
      })
      .mockResolvedValueOnce(text('ครบ'));
    vi.mocked(runTool).mockResolvedValue({});

    const out = await askAgent('ถาม', '2026-09-20');
    expect(out.toolsUsed).toEqual(['find_stations', 'path_loss']);
    expect(runTool).toHaveBeenCalledTimes(2);
  });

  it('stops after the round cap and forces a final answer with no tools', async () => {
    vi.mocked(createMessage).mockResolvedValue(wantsTool('find_stations'));
    vi.mocked(runTool).mockResolvedValue({});

    const out = await askAgent('ถามวน', '2026-09-20');

    expect(out.truncated).toBe(true);
    expect(out.toolsUsed).toHaveLength(MAX_TOOL_ROUNDS);
    expect(createMessage).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
    const last = vi.mocked(createMessage).mock.calls.at(-1)![0];
    expect(last.tools).toBeUndefined();
  });

  it('falls back to a usable message when even the wrap-up is empty', async () => {
    vi.mocked(createMessage).mockResolvedValue({ stop_reason: 'end_turn', content: [] });
    const out = await askAgent('ถาม', '2026-09-20');
    expect(out.truncated).toBe(true);
    expect(out.answer).toContain('ยังสรุปคำตอบไม่ได้');
  });

  it('lets a DeepSeek outage surface so the route can say so', async () => {
    vi.mocked(createMessage).mockRejectedValue(new Error('DeepSeek returned 503'));
    await expect(askAgent('ถาม', '2026-09-20')).rejects.toThrow('503');
  });

  it('runs the tools of one turn side by side, not one after another', async () => {
    vi.mocked(createMessage)
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'a', name: 'find_stations', input: {} },
          { type: 'tool_use', id: 'b', name: 'web_search', input: { query: 'x' } },
        ],
      })
      .mockResolvedValueOnce(text('ครบ'));
    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(runTool).mockImplementation(async () => {
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return {};
    });

    await askAgent('ถาม', '2026-09-20');
    expect(maxInFlight).toBe(2);
  });

  it('puts the earlier turns of a follow-up chain before the new question', async () => {
    vi.mocked(createMessage).mockResolvedValue(text('ต่อได้'));
    await askAgent('แล้วอีกคู่ล่ะ', '2026-09-20', { history: [{ question: 'ถามแรก', answer: 'ตอบแรก', tools: [] }] });
    expect(vi.mocked(createMessage).mock.calls[0][0].messages).toEqual([
      { role: 'user', content: 'ถามแรก' },
      { role: 'assistant', content: 'ตอบแรก' },
      { role: 'user', content: 'แล้วอีกคู่ล่ะ' },
    ]);
  });

  it('adds up token usage across rounds', async () => {
    vi.mocked(createMessage)
      .mockResolvedValueOnce({ ...wantsTool('path_loss'), usage: { input_tokens: 100, output_tokens: 10 } })
      .mockResolvedValueOnce({ ...text('ok'), usage: { input_tokens: 150, output_tokens: 40 } });
    vi.mocked(runTool).mockResolvedValue({});
    const out = await askAgent('ถาม', '2026-09-20');
    expect(out.usage).toEqual({ inputTokens: 250, outputTokens: 50 });
    expect(out.rounds).toBe(2);
  });

  describe('deadline', () => {
    it('gives each model call only the time left before the reserve', async () => {
      vi.mocked(createMessage).mockResolvedValue(text('ok'));
      await askAgent('ถาม', '2026-09-20', { now: () => 0 });
      expect(vi.mocked(createMessage).mock.calls[0][1]).toBe(DEADLINE_MS - FINAL_RESERVE_MS);
    });

    it('stops starting tool rounds once only the reserve is left, then wraps up without tools', async () => {
      let clock = 0;
      vi.mocked(createMessage)
        .mockImplementationOnce(async () => {
          clock = DEADLINE_MS - FINAL_RESERVE_MS + 1; // the first round ate the whole budget
          return wantsTool('find_stations');
        })
        .mockResolvedValueOnce(text('สรุปจากที่มี'));
      vi.mocked(runTool).mockResolvedValue({});

      const out = await askAgent('ถาม', '2026-09-20', { now: () => clock });

      expect(out).toMatchObject({ answer: 'สรุปจากที่มี', truncated: true, deadlineHit: true, rounds: 2 });
      const last = vi.mocked(createMessage).mock.calls.at(-1)!;
      expect(last[0].tools).toBeUndefined();
      expect(last[1]).toBeLessThanOrEqual(FINAL_RESERVE_MS);
    });

    it('treats a timed-out round as the deadline, not an outage', async () => {
      const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
      vi.mocked(createMessage).mockRejectedValueOnce(timeout).mockResolvedValueOnce(text('สรุป'));
      const out = await askAgent('ถาม', '2026-09-20');
      expect(out).toMatchObject({ answer: 'สรุป', truncated: true, deadlineHit: true });
    });

    it('skips the wrap-up call when there is no time left for it', async () => {
      let clock = 0;
      vi.mocked(createMessage).mockImplementationOnce(async () => {
        clock = DEADLINE_MS - 1000;
        return wantsTool('find_stations');
      });
      vi.mocked(runTool).mockResolvedValue({});
      const out = await askAgent('ถาม', '2026-09-20', { now: () => clock });
      expect(createMessage).toHaveBeenCalledTimes(1);
      expect(out).toMatchObject({ truncated: true, deadlineHit: true });
      expect(out.answer).toContain('ยังสรุปคำตอบไม่ได้');
    });

    it('cuts off a tool that runs past its budget and tells the model it timed out', async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(createMessage).mockResolvedValueOnce(wantsTool('web_search')).mockResolvedValueOnce(text('ค้นไม่ทัน'));
        vi.mocked(runTool).mockImplementation(() => new Promise(() => {}));
        const pending = askAgent('ถาม', '2026-09-20', { now: () => 0 });
        await vi.advanceTimersByTimeAsync(DEADLINE_MS);
        const out = await pending;
        expect(out.calls[0]).toMatchObject({ name: 'web_search', isError: true });
        expect(out.calls[0].output).toContain('หมดเวลา');
      } finally {
        vi.useRealTimers();
      }
    });

    it('an OPER tool cut off by the budget carries one narrowing tip', async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(createMessage)
          .mockResolvedValueOnce(wantsTool('find_oper_stations', { district: 'เมืองนครราชสีมา', source: 'BCS' }))
          .mockResolvedValueOnce(text('ค้นไม่ทัน'));
        vi.mocked(runTool).mockImplementation(() => new Promise(() => {}));
        const pending = askAgent('ถาม', '2026-09-20', { now: () => 0 });
        await vi.advanceTimersByTimeAsync(DEADLINE_MS);
        const out = await pending;
        expect(out.calls[0].output).toBe(
          'เครื่องมือทำงานไม่สำเร็จ: ระบบ OPER ไม่ตอบภายในเวลาที่กำหนด (หมดเวลา) — ลองระบุตำบลหรือความถี่เพื่อให้ค้นแคบลง',
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
