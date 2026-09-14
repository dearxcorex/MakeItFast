/* eslint-disable no-console */
/**
 * Registers the bot's slash commands in the office Discord server.
 *
 * Bulk PUT: the list below replaces whatever the server had, so it is safe to
 * re-run after changing a command. Guild commands appear instantly; global
 * ones can take an hour and would show in every server the app joins.
 *
 * Needs DISCORD_APPLICATION_ID, DISCORD_GUILD_ID and DISCORD_BOT_TOKEN. The
 * bot token lives only in the local .env — the deployed site never needs it.
 *
 *   npx tsx --env-file=.env scripts/register-discord-commands.ts
 */

export {}; // a module, so its names do not clash with the other scripts

const DISCORD_API = 'https://discord.com/api/v10';

const COMMANDS = [
  {
    name: 'stat',
    type: 1, // CHAT_INPUT
    description: 'สรุปการตรวจสถานี FM ตามสีหมุดบนแผนที่',
    contexts: [0], // guild only, never DMs
    integration_types: [0], // installed to the server, not to users
  },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const applicationId = requireEnv('DISCORD_APPLICATION_ID');
  const guildId = requireEnv('DISCORD_GUILD_ID');
  const token = requireEnv('DISCORD_BOT_TOKEN');

  const res = await fetch(`${DISCORD_API}/applications/${applicationId}/guilds/${guildId}/commands`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(COMMANDS),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error(`Discord returned ${res.status}:`, JSON.stringify(body, null, 2));
    process.exit(1);
  }
  console.log(`Registered ${body.length} command(s): ${body.map((c: { name: string }) => `/${c.name}`).join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
