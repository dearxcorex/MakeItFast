// Thin client for DeepSeek, used by the /ask bot.
//
// Two endpoints, on purpose:
//  - the Anthropic-compatible Messages API drives the tool loop, because its
//    tool_use / tool_result shape is the one askAgent is written against;
//  - the OpenAI-compatible Chat Completions API serves web search, because the
//    server-side `web_search` tool is offered there.
//
// Model ids are env-overridable: DeepSeek renames models faster than this repo
// gets deployed, and a rename should be a Vercel env edit, not a code change.

export const DEEPSEEK_ANTHROPIC_BASE = 'https://api.deepseek.com/anthropic';
export const DEEPSEEK_OPENAI_BASE = 'https://api.deepseek.com';

/** Routes tools and writes the final Thai answer. */
export function routerModel(): string {
  return process.env.DEEPSEEK_ROUTER_MODEL || 'deepseek-v4-pro';
}

/** Runs the server-side web search. Cheaper, and the search tool lives here. */
export function searchModel(): string {
  return process.env.DEEPSEEK_SEARCH_MODEL || 'deepseek-v4-flash';
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface MessageResponse {
  stop_reason: string | null;
  content: ContentBlock[];
}

export class DeepSeekError extends Error {}

function apiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new DeepSeekError('DEEPSEEK_API_KEY is not set');
  return key;
}

/** True when the bot is configured enough to answer at all. */
export function isDeepSeekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

async function postJson(url: string, headers: HeadersInit, body: object, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    // The body can carry the key back in an echoed request; only keep the text.
    throw new DeepSeekError(`DeepSeek returned ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  return res.json();
}

export async function createMessage(
  body: {
    system: string;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    max_tokens?: number;
  },
  timeoutMs = 40_000,
): Promise<MessageResponse> {
  const json = (await postJson(
    `${DEEPSEEK_ANTHROPIC_BASE}/v1/messages`,
    { 'x-api-key': apiKey(), 'anthropic-version': '2023-06-01' },
    {
      model: routerModel(),
      max_tokens: body.max_tokens ?? 2000,
      system: body.system,
      messages: body.messages,
      ...(body.tools?.length ? { tools: body.tools } : {}),
    },
    timeoutMs,
  )) as Partial<MessageResponse>;

  return {
    stop_reason: json.stop_reason ?? null,
    content: Array.isArray(json.content) ? json.content : [],
  };
}

interface SearchChoice {
  message?: {
    content?: string | null;
    annotations?: Array<{ url_citation?: { url?: string; title?: string } }>;
  };
}

/**
 * One-shot web search. DeepSeek runs the search server-side and answers with
 * prose, so this returns text the agent can quote, plus whatever citation URLs
 * came back — the bot is expected to show its sources.
 */
export async function searchWeb(query: string, timeoutMs = 25_000): Promise<string> {
  const json = (await postJson(
    `${DEEPSEEK_OPENAI_BASE}/chat/completions`,
    { Authorization: `Bearer ${apiKey()}` },
    {
      model: searchModel(),
      tools: [{ type: 'web_search' }],
      messages: [
        {
          role: 'system',
          content:
            'Answer the search query factually and briefly. Prefer official regulator, ' +
            'standards-body and equipment-manufacturer sources. Always state the source.',
        },
        { role: 'user', content: query },
      ],
    },
    timeoutMs,
  )) as { choices?: SearchChoice[] };

  const message = json.choices?.[0]?.message;
  const text = message?.content?.trim() || '';
  const urls = (message?.annotations ?? [])
    .map((a) => a.url_citation?.url)
    .filter((u): u is string => Boolean(u));
  const unique = [...new Set(urls)].slice(0, 5);

  if (!text && !unique.length) return 'ค้นหาไม่พบข้อมูล';
  return unique.length ? `${text}\n\nแหล่งอ้างอิง:\n${unique.map((u) => `- ${u}`).join('\n')}` : text;
}
