import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const afterCallbacks: Array<() => unknown> = [];
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  // `after` needs a live request scope; collect the callback so tests can run it.
  after: (fn: () => unknown) => {
    afterCallbacks.push(fn);
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    station_inspection: { findUnique: vi.fn(), updateMany: vi.fn() },
    interference_inspection: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import {
  postInspectionNotice,
  queueInspectionNotice,
  queueNoticeRetraction,
} from '@/services/inspectionNotifier';

const WEBHOOK = 'https://discord.com/api/webhooks/1/tok';

const stationRow = {
  id: 77,
  discord_message_id: null,
  inspected_on: new Date('2026-09-15T00:00:00Z'),
  station: {
    name: 'คลื่นดี', freq: 99.5, district: 'เมือง', province: 'ชัยภูมิ',
    type: 'สถานีหลัก', lat: 15.8, long: 102.03,
  },
  lead: { display_name: 'Somchai' },
  members: [{ member: { display_name: 'Nok' } }],
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  afterCallbacks.length = 0;
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (_url: URL, init: RequestInit) =>
    init.method === 'POST'
      ? new Response(JSON.stringify({ id: '555' }), { status: 200 })
      : new Response(null, { status: 204 }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DISCORD_INSPECTION_WEBHOOK_URL;
});

describe('postInspectionNotice', () => {
  it('posts the station embed and stores the message id on the row', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue(stationRow as never);
    vi.mocked(prisma.station_inspection.updateMany).mockResolvedValue({ count: 1 } as never);

    await postInspectionNotice(WEBHOOK, 'fm', 77);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${WEBHOOK}?wait=true`);
    const body = JSON.parse(init.body);
    expect(body.embeds[0].title).toBe('✅ ตรวจแล้ว · คลื่นดี 99.5 MHz');
    expect(body.embeds[0].fields).toContainEqual({ name: 'ผู้ร่วมตรวจ', value: 'Nok', inline: false });
    expect(prisma.station_inspection.updateMany).toHaveBeenCalledWith({
      where: { id: 77, discord_message_id: null },
      data: { discord_message_id: '555' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not post again for a row that was already announced', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue(
      { ...stationRow, discord_message_id: '111' } as never,
    );
    await postInspectionNotice(WEBHOOK, 'fm', 77);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not post when the inspection was already undone', async () => {
    vi.mocked(prisma.interference_inspection.findUnique).mockResolvedValue(null as never);
    await postInspectionNotice(WEBHOOK, 'int', 9);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes its own message when the row is undone while posting', async () => {
    vi.mocked(prisma.station_inspection.findUnique).mockResolvedValue(stationRow as never);
    vi.mocked(prisma.station_inspection.updateMany).mockResolvedValue({ count: 0 } as never);

    await postInspectionNotice(WEBHOOK, 'fm', 77);

    const [url, init] = fetchMock.mock.calls[1];
    expect(init.method).toBe('DELETE');
    expect(String(url)).toBe(`${WEBHOOK}/messages/555`);
  });

  it('builds the interference embed from the site row', async () => {
    vi.mocked(prisma.interference_inspection.findUnique).mockResolvedValue({
      id: 9,
      discord_message_id: null,
      inspected_on: new Date('2026-09-15T00:00:00Z'),
      site: {
        site_name: 'Site A', site_code: 'KRT1', changwat: 'นครราชสีมา', ranking: 'Major',
        lat: 14.9, long: 102.1, source_lat: null, source_long: null,
      },
      lead: { display_name: 'Somchai' },
      members: [],
    } as never);
    vi.mocked(prisma.interference_inspection.updateMany).mockResolvedValue({ count: 1 } as never);

    await postInspectionNotice(WEBHOOK, 'int', 9);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.embeds[0].title).toBe('✅ ตรวจแล้ว · สัญญาณรบกวน Site A');
    expect(prisma.interference_inspection.updateMany).toHaveBeenCalled();
  });
});

describe('queueing', () => {
  it('does nothing when the webhook URL is not configured', () => {
    queueInspectionNotice('fm', 77);
    queueNoticeRetraction('555');
    expect(afterCallbacks).toHaveLength(0);
  });

  it('schedules the post after the response and logs instead of throwing', async () => {
    process.env.DISCORD_INSPECTION_WEBHOOK_URL = WEBHOOK;
    vi.mocked(prisma.station_inspection.findUnique).mockRejectedValue(new Error('DB down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    queueInspectionNotice('fm', 77);
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('retracts a stored message, and skips rows that never had one', async () => {
    process.env.DISCORD_INSPECTION_WEBHOOK_URL = WEBHOOK;
    queueNoticeRetraction(null);
    expect(afterCallbacks).toHaveLength(0);

    queueNoticeRetraction('555');
    await afterCallbacks[0]();
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${WEBHOOK}/messages/555`);
  });
});
