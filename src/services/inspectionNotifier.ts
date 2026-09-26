// src/services/inspectionNotifier.ts
//
// Announces inspections in Discord through a channel webhook, and deletes the
// announcement when the inspection is undone. Runs after the PATCH response
// via `after()`: Discord is a mirror, so a slow or failed post never touches
// the toggle. Without DISCORD_INSPECTION_WEBHOOK_URL every call is a no-op.
import { after } from 'next/server';
import prisma from '@/lib/prisma';
import { deleteWebhookMessage, executeWebhook } from '@/lib/discord';
import { buildSiteNotice, buildStationNotice } from '@/utils/inspectionNotice';

export type InspectionKind = 'fm' | 'int';

function webhookUrl(): string | undefined {
  return process.env.DISCORD_INSPECTION_WEBHOOK_URL || undefined;
}

const crew = {
  lead: { select: { display_name: true } },
  members: { include: { member: { select: { display_name: true } } } },
} as const;

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function loadNotice(kind: InspectionKind, inspectionId: number) {
  if (kind === 'fm') {
    const row = await prisma.station_inspection.findUnique({
      where: { id: inspectionId },
      include: { ...crew, station: true },
    });
    if (!row) return null;
    return {
      messageId: row.discord_message_id,
      body: buildStationNotice({
        idFm: row.station.id_fm,
        name: row.station.name,
        freq: row.station.freq,
        district: row.station.district,
        province: row.station.province,
        type: row.station.type,
        lat: row.station.lat,
        long: row.station.long,
        inspectedOn: dateOnly(row.inspected_on),
        lead: row.lead.display_name,
        helpers: row.members.map((m) => m.member.display_name),
      }),
    };
  }
  const row = await prisma.interference_inspection.findUnique({
    where: { id: inspectionId },
    include: { ...crew, site: true },
  });
  if (!row) return null;
  return {
    messageId: row.discord_message_id,
    body: buildSiteNotice({
      siteName: row.site.site_name,
      siteCode: row.site.site_code,
      changwat: row.site.changwat,
      ranking: row.site.ranking,
      lat: row.site.lat,
      long: row.site.long,
      sourceLat: row.site.source_lat,
      sourceLong: row.site.source_long,
      inspectedOn: dateOnly(row.inspected_on),
      lead: row.lead.display_name,
      helpers: row.members.map((m) => m.member.display_name),
    }),
  };
}

/** Store the message id only if the row still exists and has none yet. */
async function claimMessage(kind: InspectionKind, inspectionId: number, messageId: string) {
  const args = {
    where: { id: inspectionId, discord_message_id: null },
    data: { discord_message_id: messageId },
  };
  const { count } =
    kind === 'fm'
      ? await prisma.station_inspection.updateMany(args)
      : await prisma.interference_inspection.updateMany(args);
  return count === 1;
}

export async function postInspectionNotice(
  url: string,
  kind: InspectionKind,
  inspectionId: number,
): Promise<void> {
  const notice = await loadNotice(kind, inspectionId);
  // Gone (undone already) or announced by an earlier toggle the same day.
  if (!notice || notice.messageId) return;

  const messageId = await executeWebhook(url, notice.body);
  if (!(await claimMessage(kind, inspectionId, messageId))) {
    // The inspection was undone while we posted, or a parallel toggle claimed
    // the row first. Either way this message must not stay.
    await deleteWebhookMessage(url, messageId);
  }
}

export function queueInspectionNotice(kind: InspectionKind, inspectionId: number): void {
  const url = webhookUrl();
  if (!url) return;
  after(() =>
    postInspectionNotice(url, kind, inspectionId).catch((err) => {
      console.error(`Discord inspection notice failed (${kind} inspection ${inspectionId}):`, err);
    }),
  );
}

export function queueNoticeRetraction(messageId: string | null | undefined): void {
  const url = webhookUrl();
  if (!url || !messageId) return;
  after(() =>
    deleteWebhookMessage(url, messageId).catch((err) => {
      console.error(`Discord notice delete failed (message ${messageId}):`, err);
    }),
  );
}
