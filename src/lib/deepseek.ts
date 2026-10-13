// Thin client for DeepSeek, used by the /ask bot.
//
// Everything goes through the Anthropic-compatible Messages API: its
// tool_use / tool_result shape is the one askAgent is written against, and it is
// the only endpoint that offers the server-side `web_search` tool. The
// OpenAI-compatible Chat Completions API rejects it (422, "expected `function`").
//
// Model ids are env-overridable: DeepSeek renames models faster than this repo
// gets deployed, and a rename should be a Vercel env edit, not a code change.

export const DEEPSEEK_ANTHROPIC_BASE = 'https://api.deepseek.com/anthropic';

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
  usage?: { input_tokens: number; output_tokens: number };
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
    ...(json.usage && { usage: json.usage }),
  };
}

interface SearchBlock {
  type: string;
  text?: string;
  content?: unknown;
}

/**
 * Citation URLs out of the `web_search_tool_result` blocks. A failed search
 * (e.g. max_uses_exceeded) carries an error object instead of a result list.
 */
function resultUrls(blocks: SearchBlock[]): string[] {
  return blocks
    .filter((b) => b.type === 'web_search_tool_result' && Array.isArray(b.content))
    .flatMap((b) => b.content as Array<{ url?: unknown }>)
    .map((r) => r.url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
}

/**
 * The answer is the trailing run of text blocks. Earlier text blocks are the
 * model narrating between searches ("Let me check another source").
 */
function finalText(blocks: SearchBlock[]): string {
  const tail: string[] = [];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (b.type === 'thinking') continue;
    if (b.type !== 'text') break;
    tail.unshift(b.text ?? '');
  }
  return tail.join('').trim();
}

/**
 * One-shot web search. DeepSeek runs the search server-side and answers with
 * prose, so this returns text the agent can quote, plus whatever result URLs
 * came back — the bot is expected to show its sources.
 */
export async function searchWeb(query: string, timeoutMs = 30_000): Promise<string> {
  const json = (await postJson(
    `${DEEPSEEK_ANTHROPIC_BASE}/v1/messages`,
    { 'x-api-key': apiKey(), 'anthropic-version': '2023-06-01' },
    {
      model: searchModel(),
      max_tokens: 1500,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      system:
        'Answer the search query factually and briefly. Prefer official regulator, ' +
        'standards-body and equipment-manufacturer sources. Always state the source.',
      messages: [{ role: 'user', content: query }],
    },
    timeoutMs,
  )) as { content?: SearchBlock[] };

  const blocks = Array.isArray(json.content) ? json.content : [];
  const text = finalText(blocks);
  const unique = [...new Set(resultUrls(blocks))].slice(0, 5);

  if (!text && !unique.length) return 'ค้นหาไม่พบข้อมูล';
  return unique.length ? `${text}\n\nแหล่งอ้างอิง:\n${unique.map((u) => `- ${u}`).join('\n')}` : text;
}
