// src/__tests__/api-discord-interactions.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';

const pending: Array<() => unknown> = [];

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  // `after` needs a live request scope; collect the callback so tests can run it.
  after: (fn: () => unknown) => {
    pending.push(fn);
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    fm_station: { groupBy: vi.fn() },
  },
}));

// The LLM loop has its own tests; here we only care that the route defers,
// hands the question over, and formats whatever comes back.
vi.mock('@/services/askAgent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/askAgent')>()),
  askAgent: vi.fn(),
}));

// Thread memory is Upstash-backed; the store has its own tests.
vi.mock('@/lib/askThread', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/askThread')>()),
  loadThread: vi.fn(),
  saveThread: vi.fn(),
  canFollowUp: vi.fn(() => false),
}));

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { askAgent } from '@/services/askAgent';
import { canFollowUp, loadThread, saveThread, MAX_FOLLOW_UPS, type AskTurn } from '@/lib/askThread';
import { __resetAskQuotaForTests } from '@/lib/askQuota';
import { POST } from '@/app/api/discord/interactions/route';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
// Raw 32-byte key, as the Developer Portal shows it: strip the 12-byte SPKI header.
const PUBLIC_KEY_HEX = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');
const GUILD = '111111111111111111';
const APP = '222222222222222222';
const CHANNEL = '333333333333333333';
const fetchMock = vi.fn();

function signedReq(body: object, { tamper = false, signature }: { tamper?: boolean; signature?: string | null } = {}) {
  const raw = JSON.stringify(body);
  const timestamp = '1757858400';
  const sig = sign(null, Buffer.from(timestamp + raw), privateKey).toString('hex');
  const headers = new Headers({ 'content-type': 'application/json', 'x-signature-timestamp': timestamp });
  const sent = signature === undefined ? sig : signature;
  if (sent !== null) headers.set('x-signature-ed25519', sent);
  return new NextRequest('http://localhost/api/discord/interactions', {
    method: 'POST',
    headers,
    body: tamper ? raw.replace('stat', 'stax') : raw,
  });
}

const statCommand = {
  type: 2,
  token: 'interaction-token',
  guild_id: GUILD,
  channel_id: CHANNEL,
  data: { name: 'stat' },
};

const groups = [
  // 58 on air, inspected → green
  { province: 'นครราชสีมา', inspection_69: true, revoked: false, on_air: true, _count: { _all: 58 } },
  // inspected but off air → grey, still counts toward progress
  { province: 'นครราชสีมา', inspection_69: true, revoked: false, on_air: false, _count: { _all: 4 } },
  // inspected and revoked → red, still counts toward progress
  { province: 'นครราชสีมา', inspection_69: true, revoked: true, on_air: true, _count: { _all: 2 } },
  // nulls read as not revoked, off air, not inspected → grey
  { province: 'นครราชสีมา', inspection_69: null, revoked: null, on_air: null, _count: { _all: 6 } },
  // revoked with a permit → violet, counted apart from plain revoked
  { province: 'นครราชสีมา', inspection_69: false, revoked: true, on_air: false, permit: 'หจก. ก', _count: { _all: 4 } },
  { province: 'นครราชสีมา', inspection_69: false, revoked: false, on_air: true, _count: { _all: 70 } },
  { province: 'ชัยภูมิ', inspection_69: false, revoked: false, on_air: true, _count: { _all: 10 } },
];

async function runAfter() {
  const jobs = pending.splice(0);
  for (const job of jobs) await job();
}

beforeEach(() => {
  vi.clearAllMocks();
  pending.length = 0;
  process.env.DISCORD_PUBLIC_KEY = PUBLIC_KEY_HEX;
  process.env.DISCORD_GUILD_ID = GUILD;
  process.env.DISCORD_APPLICATION_ID = APP;
  process.env.DISCORD_CHANNEL_ID = CHANNEL;
  process.env.SITE_URL = 'https://fm.example.com';
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
  vi.mocked(prisma.fm_station.groupBy).mockResolvedValue(groups as never);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  process.env.DEEPSEEK_API_KEY = 'test-key';
  delete process.env.ASK_DAILY_LIMIT;
  __resetAskQuotaForTests();
  vi.mocked(askAgent).mockResolvedValue({
    answer: 'ลองสแกน 122 MHz',
    toolsUsed: ['scan_intermod'],
    truncated: false,
    calls: [],
    rounds: 2,
    ms: 1000,
    deadlineHit: false,
    usage: { inputTokens: 0, outputTokens: 0 },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.DISCORD_PUBLIC_KEY;
  delete process.env.DISCORD_GUILD_ID;
  delete process.env.DISCORD_APPLICATION_ID;
  delete process.env.DISCORD_CHANNEL_ID;
  delete process.env.SITE_URL;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.ASK_DAILY_LIMIT;
});

describe('POST /api/discord/interactions — signature', () => {
  it('rejects a request without a signature', async () => {
    const res = await POST(signedReq({ type: 1 }, { signature: null }));
    expect(res.status).toBe(401);
  });

  it('rejects a body that does not match its signature', async () => {
    const res = await POST(signedReq(statCommand, { tamper: true }));
    expect(res.status).toBe(401);
    expect(pending).toHaveLength(0);
  });

  it('rejects a malformed signature', async () => {
    const res = await POST(signedReq({ type: 1 }, { signature: 'zz' }));
    expect(res.status).toBe(401);
  });

  it('rejects everything when DISCORD_PUBLIC_KEY is not configured', async () => {
    delete process.env.DISCORD_PUBLIC_KEY;
    const res = await POST(signedReq({ type: 1 }));
    expect(res.status).toBe(401);
  });

  it('answers a signed PING with PONG', async () => {
    const res = await POST(signedReq({ type: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 1 });
  });
});

describe('POST /api/discord/interactions — /stat', () => {
  it('defers, then edits the reply with the pin-colour summary', async () => {
    const res = await POST(signedReq(statCommand));
    expect(await res.json()).toEqual({ type: 5 });
    expect(fetchMock).not.toHaveBeenCalled();

    await runAfter();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://discord.com/api/v10/webhooks/${APP}/interaction-token/messages/@original`);
    expect(init.method).toBe('PATCH');
    const body = JSON.parse(init.body);
    expect(body.allowed_mentions).toEqual({ parse: [] });
    const { description, url: link } = body.embeds[0];
    expect(link).toBe('https://fm.example.com');
    expect(description).toContain('**นครราชสีมา** (144)');
    expect(description).toContain('🟢 ตรวจแล้ว 58 · 🟡 ยังไม่ตรวจ 70 · ⚫ ไม่ออกอากาศ 10 · 🔴 เพิกถอน 2 · 🟣 เพิกถอน (มีผู้รับรายใหม่) 4');
    expect(description).toContain('ความคืบหน้า ตรวจแล้ว 64/144 (44%)');
    expect(description).toContain('รวม 154 — 🟢 58 · 🟡 80 · ⚫ 10 · 🔴 2 · 🟣 4');
    expect(description).not.toContain('วันนี้');
  });

  it('dates the title by Bangkok time, not UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-13T23:30:00Z'));
    await POST(signedReq(statCommand));
    await runAfter();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).embeds[0].title).toContain('14 ก.ย. 2569');
  });

  it('edits the reply with an error message when the database fails', async () => {
    vi.mocked(prisma.fm_station.groupBy).mockRejectedValue(new Error('DB down'));
    await POST(signedReq(statCommand));
    await runAfter();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.content).toBe('ดึงข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง');
    expect(body.embeds).toBeUndefined();
  });

  it('logs, not throws, when Discord refuses the edit', async () => {
    fetchMock.mockResolvedValue(new Response('gone', { status: 404 }));
    await POST(signedReq(statCommand));
    await expect(runAfter()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('refuses commands from another server', async () => {
    const res = await POST(signedReq({ ...statCommand, guild_id: '999' }));
    const json = await res.json();
    expect(json.type).toBe(4);
    expect(json.data.flags).toBe(64);
    expect(pending).toHaveLength(0);
  });

  it('refuses commands sent outside a server (DMs)', async () => {
    const res = await POST(signedReq({ ...statCommand, guild_id: undefined }));
    expect((await res.json()).data.flags).toBe(64);
    expect(pending).toHaveLength(0);
  });

  it('points to the bot channel when used in another channel', async () => {
    const res = await POST(signedReq({ ...statCommand, channel_id: '444' }));
    const json = await res.json();
    expect(json.data).toMatchObject({ content: `ใช้คำสั่งนี้ได้ในช่อง <#${CHANNEL}> เท่านั้น`, flags: 64 });
    expect(pending).toHaveLength(0);
  });

  it('answers in any channel when DISCORD_CHANNEL_ID is not set', async () => {
    delete process.env.DISCORD_CHANNEL_ID;
    const res = await POST(signedReq({ ...statCommand, channel_id: '444' }));
    expect(await res.json()).toEqual({ type: 5 });
  });

  it('answers an unknown command privately', async () => {
    const res = await POST(signedReq({ ...statCommand, data: { name: 'nope' } }));
    const json = await res.json();
    expect(json.data).toMatchObject({ content: 'ไม่รู้จักคำสั่งนี้', flags: 64 });
  });

  it('rejects unsupported interaction types', async () => {
    // 4 = autocomplete; buttons (3) and modal submits (5) are served now.
    const res = await POST(signedReq({ type: 4, token: 't', guild_id: GUILD }));
    expect(res.status).toBe(400);
  });
});

const askCommand = {
  type: 2,
  token: 'interaction-token',
  guild_id: GUILD,
  channel_id: CHANNEL,
  member: { user: { id: 'user-1' } },
  data: {
    name: 'ask',
    options: [{ name: 'question', type: 3, value: 'ร้องเรียนคลื่นรบกวน 122.5 MHz มาจากอะไรได้บ้าง' }],
  },
};

function editedBody() {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

describe('POST /api/discord/interactions — /ask', () => {
  it('defers, runs the agent, then edits the reply with the answer', async () => {
    const res = await POST(signedReq(askCommand));
    expect(await res.json()).toEqual({ type: 5 });
    expect(askAgent).not.toHaveBeenCalled();

    await runAfter();

    expect(askAgent).toHaveBeenCalledWith('ร้องเรียนคลื่นรบกวน 122.5 MHz มาจากอะไรได้บ้าง', expect.any(String), { history: [] });
    const body = editedBody();
    expect(body.embeds[0].title).toContain('122.5 MHz');
    expect(body.embeds[0].description).toBe('ลองสแกน 122 MHz');
    expect(body.allowed_mentions).toEqual({ parse: [] });
  });

  it('logs one JSON trace line per answer', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await POST(signedReq(askCommand));
    await runAfter();
    const lines = log.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith('{"event":"ask"'));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ rounds: 2, ms: 1000, truncated: false, tools: [] });
    log.mockRestore();
  });

  it('always stamps the recommendation disclaimer on the reply', async () => {
    await POST(signedReq(askCommand));
    await runAfter();
    expect(editedBody().embeds[0].footer.text).toContain('สันนิษฐาน/คำแนะนำ');
  });

  it('says so privately when DEEPSEEK_API_KEY is missing', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const res = await POST(signedReq(askCommand));
    const json = await res.json();
    expect(json.data.flags).toBe(64);
    expect(json.data.content).toContain('DEEPSEEK_API_KEY');
    expect(pending).toHaveLength(0);
  });

  it('asks for a question when the option is blank', async () => {
    const blank = { ...askCommand, data: { name: 'ask', options: [{ name: 'question', type: 3, value: '  ' }] } };
    const res = await POST(signedReq(blank));
    expect((await res.json()).data.flags).toBe(64);
    expect(pending).toHaveLength(0);
  });

  it('refuses privately once the user is over the daily quota', async () => {
    process.env.ASK_DAILY_LIMIT = '1';
    expect(await (await POST(signedReq(askCommand))).json()).toEqual({ type: 5 });

    const res = await POST(signedReq(askCommand));
    const json = await res.json();
    expect(json.data.flags).toBe(64);
    expect(json.data.content).toContain('โควตา');
    expect(pending).toHaveLength(1); // only the first call queued work
  });

  it('counts quota per user, not per server', async () => {
    process.env.ASK_DAILY_LIMIT = '1';
    await POST(signedReq(askCommand));
    const other = { ...askCommand, member: { user: { id: 'user-2' } } };
    expect(await (await POST(signedReq(other))).json()).toEqual({ type: 5 });
  });

  it('edits in an error message when the agent throws', async () => {
    vi.mocked(askAgent).mockRejectedValue(new Error('DeepSeek returned 503'));
    await POST(signedReq(askCommand));
    await runAfter();
    const body = editedBody();
    expect(body.content).toBe('ตอบคำถามไม่สำเร็จ ลองใหม่อีกครั้ง');
    expect(body.embeds).toBeUndefined();
  });
});

describe('POST /api/discord/interactions — channel allowlist', () => {
  const OTHER = '444444444444444444';

  it('answers in any channel named in the comma-separated list', async () => {
    process.env.DISCORD_CHANNEL_ID = `${CHANNEL}, ${OTHER}`;
    const res = await POST(signedReq({ ...askCommand, channel_id: OTHER }));
    expect(await res.json()).toEqual({ type: 5 });
  });

  it('lists every allowed room when refusing', async () => {
    process.env.DISCORD_CHANNEL_ID = `${CHANNEL},${OTHER}`;
    const res = await POST(signedReq({ ...askCommand, channel_id: '555' }));
    const { content } = (await res.json()).data;
    expect(content).toContain(`<#${CHANNEL}>`);
    expect(content).toContain(`<#${OTHER}>`);
  });

  it('tolerates a trailing comma in the allowlist', async () => {
    process.env.DISCORD_CHANNEL_ID = `${CHANNEL},`;
    expect(await (await POST(signedReq(askCommand))).json()).toEqual({ type: 5 });
  });

  it('refuses an unknown command name', async () => {
    const res = await POST(signedReq({ ...askCommand, data: { name: 'nope' } }));
    expect((await res.json()).data.content).toBe('ไม่รู้จักคำสั่งนี้');
  });
});

describe('POST /api/discord/interactions — ถามต่อ follow-ups', () => {
  const ASK_MESSAGE = '444444444444444444';
  const turn: AskTurn = { question: 'ร้องเรียน 122.5 MHz', answer: 'ลองสแกน', tools: [{ name: 'scan_intermod', input: { targetFrequency: 122.5 } }] };

  const button = {
    type: 3,
    token: 'button-token',
    guild_id: GUILD,
    channel_id: CHANNEL,
    member: { user: { id: 'user-2' } },
    message: { id: ASK_MESSAGE },
    data: { custom_id: 'ask_followup', component_type: 2 },
  };

  const submit = (value: string, parent = ASK_MESSAGE) => ({
    type: 5,
    token: 'modal-token',
    guild_id: GUILD,
    channel_id: CHANNEL,
    member: { user: { id: 'user-2' } },
    data: {
      custom_id: `ask_followup_modal:${parent}`,
      components: [{ type: 1, components: [{ type: 4, custom_id: 'question', value }] }],
    },
  });

  beforeEach(() => {
    vi.mocked(canFollowUp).mockReturnValue(false);
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: '555555555555555555' }), { status: 200 }));
  });

  it('offers the button on an /ask answer and saves the turn under the posted message', async () => {
    vi.mocked(canFollowUp).mockReturnValue(true);
    await POST(signedReq(askCommand));
    await runAfter();

    expect(editedBody().components[0].components[0]).toMatchObject({ custom_id: 'ask_followup', label: 'ถามต่อ' });
    expect(saveThread).toHaveBeenCalledWith('555555555555555555', [
      { question: 'ร้องเรียนคลื่นรบกวน 122.5 MHz มาจากอะไรได้บ้าง', answer: 'ลองสแกน 122 MHz', tools: [] },
    ]);
  });

  it('shows no button and saves nothing when thread memory is unavailable', async () => {
    await POST(signedReq(askCommand));
    await runAfter();
    expect(editedBody().components).toEqual([]);
    expect(saveThread).not.toHaveBeenCalled();
  });

  it('opens a one-field modal tied to the answer the button was on', async () => {
    vi.mocked(loadThread).mockResolvedValue([turn]);
    const res = await (await POST(signedReq(button))).json();
    expect(loadThread).toHaveBeenCalledWith(ASK_MESSAGE);
    expect(res.type).toBe(9);
    expect(res.data.custom_id).toBe(`ask_followup_modal:${ASK_MESSAGE}`);
    expect(res.data.components[0].components[0]).toMatchObject({ type: 4, custom_id: 'question', required: true });
  });

  it('says privately that an expired thread is gone, instead of opening the modal', async () => {
    vi.mocked(loadThread).mockResolvedValue(null);
    const res = await (await POST(signedReq(button))).json();
    expect(res.type).toBe(4);
    expect(res.data.flags).toBe(64);
    expect(res.data.content).toContain('หมดอายุ');
  });

  it('answers privately, not with a 500, when Redis is down', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(loadThread).mockRejectedValue(new Error('ECONNRESET'));
    const res = await POST(signedReq(button));
    expect(res.status).toBe(200);
    expect((await res.json()).data.content).toContain('ไม่สำเร็จ');
  });

  it('refuses a follow-up once the chain is full', async () => {
    vi.mocked(loadThread).mockResolvedValue(Array(MAX_FOLLOW_UPS + 1).fill(turn));
    const res = await (await POST(signedReq(button))).json();
    expect(res.data.content).toContain('ครบ');
  });

  it('answers a submitted follow-up with the earlier turns, a link back, and saves the longer chain', async () => {
    vi.mocked(loadThread).mockResolvedValue([turn]);
    vi.mocked(canFollowUp).mockReturnValue(true);

    const res = await (await POST(signedReq(submit('แล้วคู่ที่ใกล้ที่สุดอยู่อำเภอไหน')))).json();
    expect(res).toEqual({ type: 5 });
    await runAfter();

    expect(askAgent).toHaveBeenCalledWith('แล้วคู่ที่ใกล้ที่สุดอยู่อำเภอไหน', expect.any(String), { history: [turn] });
    const body = editedBody();
    expect(body.embeds[0].description).toContain(`https://discord.com/channels/${GUILD}/${CHANNEL}/${ASK_MESSAGE}`);
    expect(fetchMock.mock.calls[0][0]).toContain('/modal-token/messages/@original');
    expect(saveThread).toHaveBeenCalledWith('555555555555555555', [
      turn,
      { question: 'แล้วคู่ที่ใกล้ที่สุดอยู่อำเภอไหน', answer: 'ลองสแกน 122 MHz', tools: [] },
    ]);
  });

  it('checks expiry before spending quota on a follow-up', async () => {
    vi.mocked(loadThread).mockResolvedValue(null);
    process.env.ASK_DAILY_LIMIT = '1';
    try {
      const expired = await (await POST(signedReq(submit('ต่อ')))).json();
      expect(expired.data.content).toContain('หมดอายุ');

      vi.mocked(loadThread).mockResolvedValue([turn]);
      expect(await (await POST(signedReq(submit('ต่อ')))).json()).toEqual({ type: 5 });
    } finally {
      delete process.env.ASK_DAILY_LIMIT;
    }
  });

  it('rejects a blank follow-up question', async () => {
    const res = await (await POST(signedReq(submit('   ')))).json();
    expect(res.data.content).toContain('พิมพ์คำถาม');
    expect(loadThread).not.toHaveBeenCalled();
  });
});

