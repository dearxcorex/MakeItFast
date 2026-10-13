import { NextRequest, NextResponse, after } from 'next/server';
import prisma from '@/lib/prisma';
import {
  EPHEMERAL,
  InteractionResponseType,
  InteractionType,
  channelAllowed,
  editOriginalResponse,
  interactionUserId,
  messageUrl,
  modalTextValue,
  stringOption,
  verifyDiscordSignature,
  type Interaction,
} from '@/lib/discord';
import { isDeepSeekConfigured } from '@/lib/deepseek';
import { consumeAskQuota } from '@/lib/askQuota';
import { MAX_FOLLOW_UPS, canFollowUp, loadThread, saveThread, type AskTurn } from '@/lib/askThread';
import { askAgent, askTraceLine } from '@/services/askAgent';
import { bangkokToday } from '@/utils/bangkokDate';
import { FOLLOW_UP_BUTTON_ID, askErrorMessage, buildAskMessage } from '@/utils/askMessage';
import { bucketForStation } from '@/utils/pinBucket';
import { buildStatMessage, emptyBuckets, type ProvinceStat } from '@/utils/fmStat';

// /ask runs an LLM tool loop. Discord allows 15 minutes to fill a deferred
// reply, but the function itself has to live long enough to finish the loop.
export const maxDuration = 60;

const FOLLOW_UP_MODAL_PREFIX = 'ask_followup_modal:';
const FOLLOW_UP_INPUT_ID = 'question';
const THREAD_EXPIRED = 'คำถามนี้หมดอายุแล้ว (เก็บไว้ 24 ชั่วโมง) ใช้ /ask เพื่อถามใหม่';
const THREAD_FULL = `ถามต่อครบ ${MAX_FOLLOW_UPS} ครั้งแล้ว ใช้ /ask เพื่อเริ่มคำถามใหม่`;
const THREAD_UNREACHABLE = 'ดึงบทสนทนาเดิมไม่สำเร็จ ลองใหม่อีกครั้ง หรือใช้ /ask';

// Discord posts every slash-command use here, plus the "ถามต่อ" button press
// and the follow-up modal it opens. There is no session: the Ed25519
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

  const served: number[] = [InteractionType.APPLICATION_COMMAND, InteractionType.MESSAGE_COMPONENT, InteractionType.MODAL_SUBMIT];
  if (!served.includes(interaction.type)) {
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

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) return openFollowUp(interaction);
  if (interaction.type === InteractionType.MODAL_SUBMIT) return startFollowUp(applicationId, guildId, interaction);

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

/**
 * The checks every question passes before it costs anything, /ask and
 * follow-up alike. Refused before deferring, so the user sees the reason
 * privately and the channel stays clean. Null means go ahead.
 */
async function askRefusal(interaction: Interaction) {
  if (!isDeepSeekConfigured()) {
    console.error('DEEPSEEK_API_KEY is not set; cannot answer /ask');
    return ephemeral('ยังไม่ได้ตั้งค่า DEEPSEEK_API_KEY บอทจึงตอบไม่ได้');
  }
  // Anonymous callers share one bucket rather than none. A follow-up counts
  // against whoever pressed the button, not whoever asked first.
  const quota = await consumeAskQuota(interactionUserId(interaction) ?? 'unknown', bangkokToday());
  if (!quota.allowed) {
    return ephemeral(`ใช้ครบโควตาวันนี้แล้ว (${quota.limit} ครั้ง/วัน) พรุ่งนี้เริ่มนับใหม่`);
  }
  return null;
}

async function startAsk(applicationId: string, interaction: Interaction) {
  const question = stringOption(interaction, 'question');
  if (!question) return ephemeral('พิมพ์คำถามต่อท้ายคำสั่งด้วย');

  const refusal = await askRefusal(interaction);
  if (refusal) return refusal;

  after(() => answerAsk(applicationId, interaction.token, question, []));
  return deferred();
}

/**
 * The turns behind an answer, or the ephemeral reply to send instead. Redis
 * failing must still get an answer inside Discord's 3 s, not a 500.
 */
async function threadOrRefusal(messageId: string): Promise<{ turns: AskTurn[] } | { refusal: NextResponse }> {
  let turns: AskTurn[] | null;
  try {
    turns = await loadThread(messageId);
  } catch (error) {
    console.error('/ask thread load failed:', error);
    return { refusal: ephemeral(THREAD_UNREACHABLE) };
  }
  if (!turns) return { refusal: ephemeral(THREAD_EXPIRED) };
  if (turns.length > MAX_FOLLOW_UPS) return { refusal: ephemeral(THREAD_FULL) };
  return { turns };
}

/** "ถามต่อ" pressed: open a one-field modal, if the thread behind that answer is still alive. */
async function openFollowUp(interaction: Interaction) {
  const messageId = interaction.message?.id;
  if (interaction.data?.custom_id !== FOLLOW_UP_BUTTON_ID || !messageId) return ephemeral('ไม่รู้จักปุ่มนี้');

  const thread = await threadOrRefusal(messageId);
  if ('refusal' in thread) return thread.refusal;

  return NextResponse.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `${FOLLOW_UP_MODAL_PREFIX}${messageId}`,
      title: 'ถามต่อ',
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: FOLLOW_UP_INPUT_ID,
              style: 2,
              label: 'คำถามต่อจากคำตอบนี้',
              required: true,
              max_length: 1000,
            },
          ],
        },
      ],
    },
  });
}

/** The follow-up modal was submitted: answer it with the earlier turns, as a new public message. */
async function startFollowUp(applicationId: string, guildId: string, interaction: Interaction) {
  const customId = interaction.data?.custom_id ?? '';
  if (!customId.startsWith(FOLLOW_UP_MODAL_PREFIX)) return ephemeral('ไม่รู้จักฟอร์มนี้');
  const parentId = customId.slice(FOLLOW_UP_MODAL_PREFIX.length);

  const question = modalTextValue(interaction, FOLLOW_UP_INPUT_ID);
  if (!question) return ephemeral('พิมพ์คำถามด้วย');

  // Expiry is checked before the quota, so a dead thread costs nothing.
  const thread = await threadOrRefusal(parentId);
  if ('refusal' in thread) return thread.refusal;
  const history = thread.turns;

  const refusal = await askRefusal(interaction);
  if (refusal) return refusal;

  const parentUrl = interaction.channel_id ? messageUrl(guildId, interaction.channel_id, parentId) : undefined;
  after(() => answerAsk(applicationId, interaction.token, question, history, parentUrl));
  return deferred();
}

async function answerAsk(
  applicationId: string,
  token: string,
  question: string,
  history: AskTurn[],
  parentUrl?: string,
): Promise<void> {
  let body: object;
  let turns: AskTurn[] | null = null;
  try {
    const result = await askAgent(question, bangkokToday(), { history });
    console.log(askTraceLine(question, result));
    const chain = [...history, { question, answer: result.answer, tools: result.calls.map(({ name, input }) => ({ name, input })) }];
    const followUp = canFollowUp(chain.length);
    if (followUp) turns = chain;
    body = buildAskMessage(question, result, { followUp, parentUrl });
  } catch (error) {
    console.error('/ask failed:', error);
    body = askErrorMessage('ตอบคำถามไม่สำเร็จ ลองใหม่อีกครั้ง');
  }

  let messageId: string;
  try {
    messageId = await editOriginalResponse(applicationId, token, body);
  } catch (error) {
    console.error('/ask reply failed:', error);
    return;
  }
  if (!turns) return;
  try {
    await saveThread(messageId, turns);
  } catch (error) {
    // The answer is already up; its button will just report the thread as expired.
    console.error('/ask thread save failed:', error);
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
function stationBucket(s: {
  on_air: boolean | null;
  revoked: boolean | null;
  inspection_69: boolean | null;
  permit: string | null;
}) {
  return bucketForStation({
    onAir: s.on_air || false,
    revoked: s.revoked === true,
    inspection69: s.inspection_69 ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ',
    permit: s.permit ?? undefined,
  });
}

async function loadProvinceStats(): Promise<ProvinceStat[]> {
  const groups = await prisma.fm_station.groupBy({
    by: ['province', 'inspection_69', 'revoked', 'on_air', 'permit'],
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
