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
import { askAgent, MAX_TOOL_ROUNDS } from '@/services/askAgent';

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
    expect(out).toEqual({ answer: 'ตอบเลย', toolsUsed: [], truncated: false });
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
      .mockResolvedValueOnce(wantsTool('scan_intermod', { targetFrequency: 122.5 }))
      .mockResolvedValueOnce(text('เจอคู่สถานี'));
    vi.mocked(runTool).mockResolvedValue({ dangerousPairsFound: 1 });

    const out = await askAgent('122.5 MHz โดนรบกวน', '2026-09-20');

    expect(runTool).toHaveBeenCalledWith('scan_intermod', { targetFrequency: 122.5 });
    expect(out).toEqual({ answer: 'เจอคู่สถานี', toolsUsed: ['scan_intermod'], truncated: false });

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
});
