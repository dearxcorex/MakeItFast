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
    station_inspection: { findMany: vi.fn() },
    fm_station: { groupBy: vi.fn() },
  },
}));

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { POST } from '@/app/api/discord/interactions/route';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
// Raw 32-byte key, as the Developer Portal shows it: strip the 12-byte SPKI header.
const PUBLIC_KEY_HEX = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');
const GUILD = '111111111111111111';
const APP = '222222222222222222';
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

const statCommand = { type: 2, token: 'interaction-token', guild_id: GUILD, data: { name: 'stat' } };

const groups = [
  // 58 on air, inspected → green
  { province: 'นครราชสีมา', inspection_69: true, revoked: false, on_air: true, _count: { _all: 58 } },
  // inspected but off air → grey, still counts toward progress
  { province: 'นครราชสีมา', inspection_69: true, revoked: false, on_air: false, _count: { _all: 4 } },
  // inspected and revoked → red, still counts toward progress
  { province: 'นครราชสีมา', inspection_69: true, revoked: true, on_air: true, _count: { _all: 2 } },
  // nulls read as not revoked, off air, not inspected → grey
  { province: 'นครราชสีมา', inspection_69: null, revoked: null, on_air: null, _count: { _all: 6 } },
  { province: 'นครราชสีมา', inspection_69: false, revoked: true, on_air: false, _count: { _all: 4 } },
  { province: 'นครราชสีมา', inspection_69: false, revoked: false, on_air: true, _count: { _all: 70 } },
  { province: 'ชัยภูมิ', inspection_69: false, revoked: false, on_air: true, _count: { _all: 10 } },
];

const inspectionRow = {
  station_id: 5520014,
  station: {
    name: 'สถานีวิทยุชุมชนปากช่อง',
    freq: 98.5,
    district: 'ปากช่อง',
    province: 'นครราชสีมา',
    on_air: false,
    revoked: false,
    inspection_69: true,
  },
};

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
  process.env.SITE_URL = 'https://fm.example.com';
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
  vi.mocked(prisma.fm_station.groupBy).mockResolvedValue(groups as never);
  vi.mocked(prisma.station_inspection.findMany).mockResolvedValue([inspectionRow] as never);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete process.env.DISCORD_PUBLIC_KEY;
  delete process.env.DISCORD_GUILD_ID;
  delete process.env.DISCORD_APPLICATION_ID;
  delete process.env.SITE_URL;
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
    expect(description).toContain('🟢 ตรวจแล้ว 58 · 🟡 ยังไม่ตรวจ 70 · ⚫ ไม่ออกอากาศ 10 · 🔴 เพิกถอน 6');
    expect(description).toContain('ความคืบหน้า ตรวจแล้ว 64/144 (44%)');
    expect(description).toContain('รวม 154 — 🟢 58 · 🟡 80 · ⚫ 10 · 🔴 6');
    // inspected today but off air → grey dot, same as its map pin
    expect(description).toContain('⚫ 98.50 สถานีวิทยุชุมชนปากช่อง — ปากช่อง (นครราชสีมา)');
  });

  it("reads today's inspections by the Bangkok date, not UTC", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-13T23:30:00Z'));
    await POST(signedReq(statCommand));
    await runAfter();
    expect(vi.mocked(prisma.station_inspection.findMany).mock.calls[0][0]).toMatchObject({
      where: { inspected_on: new Date('2026-09-14T00:00:00Z') },
    });
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

  it('answers an unknown command privately', async () => {
    const res = await POST(signedReq({ ...statCommand, data: { name: 'nope' } }));
    const json = await res.json();
    expect(json.data).toMatchObject({ content: 'ไม่รู้จักคำสั่งนี้', flags: 64 });
  });

  it('rejects unsupported interaction types', async () => {
    const res = await POST(signedReq({ type: 3, token: 't', guild_id: GUILD }));
    expect(res.status).toBe(400);
  });
});
