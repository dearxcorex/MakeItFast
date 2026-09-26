import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DeepSeekError,
  createMessage,
  isDeepSeekConfigured,
  routerModel,
  searchModel,
  searchWeb,
} from '@/lib/deepseek';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  return { url, init, body: JSON.parse(init.body), headers: init.headers as Record<string, string> };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  process.env.DEEPSEEK_API_KEY = 'sk-test';
  delete process.env.DEEPSEEK_ROUTER_MODEL;
  delete process.env.DEEPSEEK_SEARCH_MODEL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_ROUTER_MODEL;
  delete process.env.DEEPSEEK_SEARCH_MODEL;
});

describe('configuration', () => {
  it('is configured only when the key is present', () => {
    expect(isDeepSeekConfigured()).toBe(true);
    delete process.env.DEEPSEEK_API_KEY;
    expect(isDeepSeekConfigured()).toBe(false);
  });

  it('has defaults that an env var can override without a code change', () => {
    expect(routerModel()).toBe('deepseek-v4-pro');
    expect(searchModel()).toBe('deepseek-v4-flash');
    process.env.DEEPSEEK_ROUTER_MODEL = 'deepseek-v5';
    process.env.DEEPSEEK_SEARCH_MODEL = 'deepseek-v5-flash';
    expect(routerModel()).toBe('deepseek-v5');
    expect(searchModel()).toBe('deepseek-v5-flash');
  });

  it('refuses to call out with no key rather than sending an empty header', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    await expect(createMessage({ system: 's', messages: [] })).rejects.toThrow(DeepSeekError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('createMessage', () => {
  it('posts to the Anthropic-compatible endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi' }] }));
    const out = await createMessage({ system: 'sys', messages: [{ role: 'user', content: 'q' }] });

    const { url, headers, body } = lastCall();
    expect(url).toBe('https://api.deepseek.com/anthropic/v1/messages');
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(body).toMatchObject({ model: 'deepseek-v4-pro', system: 'sys', max_tokens: 2000 });
    expect(body.tools).toBeUndefined();
    expect(out).toEqual({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi' }] });
  });

  it('sends tools when there are any', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [] }));
    await createMessage({
      system: 's',
      messages: [],
      tools: [{ name: 't', description: 'd', input_schema: { type: 'object', properties: {} } }],
    });
    expect(lastCall().body.tools).toHaveLength(1);
  });

  it('survives a response with no content array', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    expect(await createMessage({ system: 's', messages: [] })).toEqual({ stop_reason: null, content: [] });
  });

  it('throws with the status and a bounded slice of the body', async () => {
    fetchMock.mockResolvedValue(new Response('x'.repeat(2000), { status: 429 }));
    let err: unknown;
    try {
      await createMessage({ system: 's', messages: [] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DeepSeekError);
    expect((err as Error).message).toContain('429');
    expect((err as Error).message.length).toBeLessThan(600);
  });
});

describe('searchWeb', () => {
  it('asks the OpenAI-compatible endpoint with the server-side search tool', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'found it' } }] }));
    const out = await searchWeb('Thailand 145 MHz allocation');

    const { url, headers, body } = lastCall();
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(headers.Authorization).toBe('Bearer sk-test');
    expect(body.model).toBe('deepseek-v4-flash');
    expect(body.tools).toEqual([{ type: 'web_search' }]);
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Thailand 145 MHz allocation' });
    expect(out).toBe('found it');
  });

  it('appends citation URLs, deduplicated', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: 'answer',
              annotations: [
                { url_citation: { url: 'https://nbtc.go.th/a' } },
                { url_citation: { url: 'https://nbtc.go.th/a' } },
                { url_citation: { url: 'https://itu.int/b' } },
                { somethingElse: true },
              ],
            },
          },
        ],
      }),
    );
    const out = await searchWeb('q');
    expect(out).toContain('แหล่งอ้างอิง:');
    expect(out.match(/nbtc\.go\.th\/a/g)).toHaveLength(1);
    expect(out).toContain('https://itu.int/b');
  });

  it('says it found nothing rather than returning an empty string', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: '' } }] }));
    expect(await searchWeb('q')).toBe('ค้นหาไม่พบข้อมูล');
  });

  it('handles a response with no choices at all', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    expect(await searchWeb('q')).toBe('ค้นหาไม่พบข้อมูล');
  });
});
