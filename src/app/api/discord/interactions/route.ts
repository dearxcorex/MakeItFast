import { NextRequest, NextResponse, after } from 'next/server';
import prisma from '@/lib/prisma';
import {
  EPHEMERAL,
  InteractionResponseType,
  InteractionType,
  channelAllowed,
  editOriginalResponse,
  interactionUserId,
  stringOption,
  verifyDiscordSignature,
  type Interaction,
} from '@/lib/discord';
import { isDeepSeekConfigured } from '@/lib/deepseek';
import { consumeAskQuota } from '@/lib/askQuota';
import { askAgent } from '@/services/askAgent';
import { bangkokToday } from '@/utils/bangkokDate';
import { askErrorMessage, buildAskMessage } from '@/utils/askMessage';
import { bucketForStation } from '@/utils/pinBucket';
import { buildStatMessage, emptyBuckets, type ProvinceStat } from '@/utils/fmStat';

// /ask runs an LLM tool loop. Discord allows 15 minutes to fill a deferred
// reply, but the function itself has to live long enough to finish the loop.
export const maxDuration = 60;

// Discord posts every slash-command use here. There is no session: the Ed25519
// signature is the auth, and only commands from DISCORD_GUILD_ID are served.
export async function POST(request: NextRequest) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  const rawBody = await request.text();
  if (
    !publicKey ||
    !verifyDiscordSignature(
      rawBody,
      request.headers.get('x-signature-ed25519'),
      request.headers.get('x-signature-timestamp'),
      publicKey,
    )
  ) {
    return NextResponse.json({ error: 'invalid request signature' }, { status: 401 });
  }

  let interaction: Interaction;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  if (interaction.type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
    return NextResponse.json({ error: 'unsupported interaction type' }, { status: 400 });
  }

  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || interaction.guild_id !== guildId) {
    return ephemeral('คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์ของสำนักงานเท่านั้น');
  }

  // Optional allowlist (comma-separated) so the bot's output does not land in
  // general chat. Unset means any channel.
  const channelIds = process.env.DISCORD_CHANNEL_ID;
  if (!channelAllowed(interaction.channel_id, channelIds)) {
    const rooms = channelIds!.split(',').map((c) => `<#${c.trim()}>`).join(' หรือ ');
    return ephemeral(`ใช้คำสั่งนี้ได้ในช่อง ${rooms} เท่านั้น`);
  }

  const applicationId = process.env.DISCORD_APPLICATION_ID;
  if (!applicationId) {
    console.error('DISCORD_APPLICATION_ID is not set; cannot answer slash commands');
    return ephemeral('บอทยังตั้งค่าไม่ครบ');
  }

  switch (interaction.data?.name) {
    case 'stat':
      // Discord gives 3 s to answer; a cold Neon connection can take longer, so
      // acknowledge now and fill the reply in after the response is sent.
      after(() => answerStat(applicationId, interaction.token));
      return deferred();
    case 'ask':
      return startAsk(applicationId, interaction);
    default:
      return ephemeral('ไม่รู้จักคำสั่งนี้');
  }
}

function deferred() {
  return NextResponse.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
}

function ephemeral(content: string) {
  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } },
  });
}

async function startAsk(applicationId: string, interaction: Interaction) {
  if (!isDeepSeekConfigured()) {
    console.error('DEEPSEEK_API_KEY is not set; cannot answer /ask');
    return ephemeral('ยังไม่ได้ตั้งค่า DEEPSEEK_API_KEY บอทจึงตอบไม่ได้');
  }

  const question = stringOption(interaction, 'question');
  if (!question) return ephemeral('พิมพ์คำถามต่อท้ายคำสั่งด้วย');

  // Refused before deferring, so the user sees the reason privately and the
  // channel stays clean. Anonymous callers share one bucket rather than none.
  const quota = await consumeAskQuota(interactionUserId(interaction) ?? 'unknown', bangkokToday());
  if (!quota.allowed) {
    return ephemeral(`ใช้ครบโควตาวันนี้แล้ว (${quota.limit} ครั้ง/วัน) พรุ่งนี้เริ่มนับใหม่`);
  }

  after(() => answerAsk(applicationId, interaction.token, question));
  return deferred();
}

async function answerAsk(applicationId: string, token: string, question: string): Promise<void> {
  let body: object;
  try {
    body = buildAskMessage(question, await askAgent(question, bangkokToday()));
  } catch (error) {
    console.error('/ask failed:', error);
    body = askErrorMessage('ตอบคำถามไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
  try {
    await editOriginalResponse(applicationId, token, body);
  } catch (error) {
    console.error('/ask reply failed:', error);
  }
}

async function answerStat(applicationId: string, token: string): Promise<void> {
  let body: object;
  try {
    body = buildStatMessage(await loadProvinceStats(), bangkokToday(), process.env.SITE_URL);
  } catch (error) {
    console.error('/stat query failed:', error);
    body = { content: 'ดึงข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง', allowed_mentions: { parse: [] } };
  }
  try {
    await editOriginalResponse(applicationId, token, body);
  } catch (error) {
    console.error('/stat reply failed:', error);
  }
}

// Nulls are read the way convertToFMStation reads them, so each station lands
// in the same bucket as its pin on the map.
function stationBucket(s: { on_air: boolean | null; revoked: boolean | null; inspection_69: boolean | null }) {
  return bucketForStation({
    onAir: s.on_air || false,
    revoked: s.revoked === true,
    inspection69: s.inspection_69 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
  });
}

async function loadProvinceStats(): Promise<ProvinceStat[]> {
  const groups = await prisma.fm_station.groupBy({
    by: ['province', 'inspection_69', 'revoked', 'on_air'],
    _count: { _all: true },
  });
  const byProvince = new Map<string, ProvinceStat>();
  for (const g of groups) {
    const province = g.province?.trim() || 'ไม่ระบุจังหวัด';
    const p = byProvince.get(province) ?? { province, total: 0, inspected: 0, buckets: emptyBuckets() };
    const n = g._count._all;
    p.total += n;
    if (g.inspection_69) p.inspected += n;
    p.buckets[stationBucket(g)] += n;
    byProvince.set(province, p);
  }
  return [...byProvince.values()].sort((a, b) => b.total - a.total);
}
