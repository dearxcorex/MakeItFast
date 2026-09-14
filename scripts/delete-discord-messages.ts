/* eslint-disable no-console */
/**
 * Deletes every message posted under one author name in the office Discord
 * server — written to clear the old "Roblox" webhook that sent the daily
 * inspection digest before /stat replaced it.
 *
 * Dry run unless --delete is passed: it first lists what it would remove.
 * Without --channel it scans every text and announcement channel the bot can see.
 *
 *   npx tsx --env-file=.env scripts/delete-discord-messages.ts --author Roblox
 *   npx tsx --env-file=.env scripts/delete-discord-messages.ts --author Roblox --channel <id> --delete
 *
 * The author match is the display name on the message, case-insensitive. For
 * a webhook that is the webhook's name when it posted.
 *
 * The bot must be in the server with View Channel, Read Message History and
 * Manage Messages. The script prints the invite link when it is not.
 * Needs DISCORD_APPLICATION_ID, DISCORD_GUILD_ID and DISCORD_BOT_TOKEN (local .env only).
 */

export {}; // a module, so its names do not clash with the other scripts

const DISCORD_API = 'https://discord.com/api/v10';
// View Channel (1 << 10) | Manage Messages (1 << 13) | Read Message History (1 << 16)
const PERMISSIONS = 74752;
// Bulk delete refuses messages older than two weeks; keep an hour of margin.
const BULK_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000;
const TEXT_CHANNEL_TYPES = new Set([0, 5]); // GUILD_TEXT, GUILD_ANNOUNCEMENT

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface Message {
  id: string;
  timestamp: string;
  content: string;
  webhook_id?: string;
  author: { username: string };
  embeds?: Array<{ title?: string }>;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set`);
    process.exit(1);
  }
  return value;
}

function parseArgs(argv: string[]) {
  const args = { author: '', channel: '', delete: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--author') args.author = argv[++i] ?? '';
    else if (arg === '--channel') args.channel = argv[++i] ?? '';
    else if (arg === '--delete') args.delete = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  if (!args.author) {
    console.error('Pass --author <name>, e.g. --author Roblox');
    process.exit(1);
  }
  return args;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const applicationId = requireEnv('DISCORD_APPLICATION_ID');
const guildId = requireEnv('DISCORD_GUILD_ID');
const token = requireEnv('DISCORD_BOT_TOKEN');

/** Calls the Discord API, waiting out rate limits instead of failing. */
async function discord(path: string, init: RequestInit = {}): Promise<Response> {
  for (;;) {
    const res = await fetch(`${DISCORD_API}${path}`, {
      ...init,
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 429) {
      const { retry_after = 1 } = await res.json();
      await sleep(Math.ceil(retry_after * 1000));
      continue;
    }
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      await sleep(Number(res.headers.get('x-ratelimit-reset-after') ?? 1) * 1000);
    }
    return res;
  }
}

async function fail(res: Response, what: string): Promise<never> {
  console.error(`${what}: Discord returned ${res.status} ${await res.text()}`);
  if (res.status === 403 || res.status === 401) {
    console.error(
      '\nThe bot is probably not in the server, or lacks permissions. Invite it (keeps /stat working):\n' +
        `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot+applications.commands` +
        `&permissions=${PERMISSIONS}&guild_id=${guildId}&disable_guild_select=true`,
    );
  }
  process.exit(1);
}

async function listChannels(channelId: string): Promise<Channel[]> {
  if (channelId) {
    const res = await discord(`/channels/${channelId}`);
    if (!res.ok) return fail(res, `Reading channel ${channelId}`);
    return [await res.json()];
  }
  const res = await discord(`/guilds/${guildId}/channels`);
  if (!res.ok) return fail(res, 'Listing server channels');
  const channels: Channel[] = await res.json();
  return channels.filter((c) => TEXT_CHANNEL_TYPES.has(c.type));
}

/** Every message in the channel by `author`, newest first; null when the bot cannot read it. */
async function findMessages(channelId: string, author: string): Promise<Message[] | null> {
  const found: Message[] = [];
  let before = '';
  for (;;) {
    const query = new URLSearchParams({ limit: '100' });
    if (before) query.set('before', before);
    const res = await discord(`/channels/${channelId}/messages?${query}`);
    if (res.status === 403) return null;
    if (!res.ok) return fail(res, `Reading messages in ${channelId}`);
    const page: Message[] = await res.json();
    found.push(...page.filter((m) => m.author.username.toLowerCase() === author.toLowerCase()));
    if (page.length < 100) return found;
    before = page[page.length - 1].id;
  }
}

async function deleteMessages(channelId: string, messages: Message[]): Promise<number> {
  const now = Date.now();
  const recent = messages.filter((m) => now - Date.parse(m.timestamp) < BULK_MAX_AGE_MS).map((m) => m.id);
  const old = messages.filter((m) => now - Date.parse(m.timestamp) >= BULK_MAX_AGE_MS).map((m) => m.id);
  let deleted = 0;

  for (let i = 0; i < recent.length; i += 100) {
    const chunk = recent.slice(i, i + 100);
    // Bulk delete needs at least two ids.
    if (chunk.length === 1) {
      old.push(chunk[0]);
      continue;
    }
    const res = await discord(`/channels/${channelId}/messages/bulk-delete`, {
      method: 'POST',
      body: JSON.stringify({ messages: chunk }),
    });
    if (!res.ok) return fail(res, 'Bulk delete');
    deleted += chunk.length;
  }

  for (const id of old) {
    const res = await discord(`/channels/${channelId}/messages/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) return fail(res, `Deleting message ${id}`);
    deleted++;
    process.stdout.write(`\r  deleted ${deleted}/${messages.length}`);
  }
  if (old.length) process.stdout.write('\n');
  return deleted;
}

const day = (iso: string) => iso.slice(0, 10);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const channels = await listChannels(args.channel);
  let total = 0;
  let deleted = 0;

  for (const channel of channels) {
    const messages = await findMessages(channel.id, args.author);
    if (messages === null) {
      console.log(`#${channel.name}: skipped, the bot cannot read it`);
      continue;
    }
    if (!messages.length) continue;

    const newest = messages[0];
    const preview = (newest.content || newest.embeds?.[0]?.title || '').slice(0, 60);
    const source = messages.some((m) => m.webhook_id) ? 'webhook' : 'user/bot';
    console.log(
      `#${channel.name} (${channel.id}): ${messages.length} message(s) by "${newest.author.username}" [${source}], ` +
        `${day(messages[messages.length - 1].timestamp)} → ${day(newest.timestamp)}` +
        (preview ? `\n  latest: ${preview}` : ''),
    );
    total += messages.length;
    if (args.delete) deleted += await deleteMessages(channel.id, messages);
  }

  if (!total) console.log(`No messages by "${args.author}" found in ${channels.length} channel(s).`);
  else if (args.delete) console.log(`Deleted ${deleted} of ${total} message(s).`);
  else console.log(`\nDry run: ${total} message(s) would be deleted. Re-run with --delete to remove them.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
