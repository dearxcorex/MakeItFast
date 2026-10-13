import { createPublicKey, verify } from 'node:crypto';

export const DISCORD_API = 'https://discord.com/api/v10';

// https://discord.com/developers/docs/interactions/receiving-and-responding
export const InteractionType = { PING: 1, APPLICATION_COMMAND: 2, MESSAGE_COMPONENT: 3, MODAL_SUBMIT: 5 } as const;
export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  MODAL: 9,
} as const;
export const EPHEMERAL = 1 << 6;
// Posts without pushing a notification to members' phones.
export const SUPPRESS_NOTIFICATIONS = 1 << 12;

export interface InteractionOption {
  name: string;
  type?: number;
  value?: string | number | boolean;
}

export interface Interaction {
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  /** Present for a guild command; `user` is only populated in DMs. */
  member?: { user?: { id?: string } };
  user?: { id?: string };
  /** `name` for a command; `custom_id` (and `components` for a modal) for a button or modal submit. */
  data?: { name?: string; options?: InteractionOption[]; custom_id?: string; components?: unknown[] };
  /** The message a button was pressed on. */
  message?: { id: string };
}

/** The invoking user's id, wherever Discord happened to put it. */
export function interactionUserId(interaction: Interaction): string | undefined {
  return interaction.member?.user?.id ?? interaction.user?.id;
}

/** A command option's value, only when it really is a non-empty string. */
export function stringOption(interaction: Interaction, name: string): string | undefined {
  const value = interaction.data?.options?.find((o) => o.name === name)?.value;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * A text input's value from a modal submit. Walks the component tree, so it
 * reads both the action-row layout and the newer label layout.
 */
export function modalTextValue(interaction: Interaction, customId: string): string | undefined {
  const stack: unknown[] = [...(interaction.data?.components ?? [])];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    const c = node as { custom_id?: unknown; value?: unknown; components?: unknown[]; component?: unknown };
    if (c.custom_id === customId && typeof c.value === 'string') return c.value.trim() || undefined;
    if (Array.isArray(c.components)) stack.push(...c.components);
    if (c.component) stack.push(c.component);
  }
  return undefined;
}

/** Link that opens a message in the Discord client. */
export function messageUrl(guildId: string, channelId: string, messageId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

/**
 * Comma-separated allowlist, so /stat can stay in the field-ops channel while
 * /ask lives in its own room. Empty or unset means every channel is allowed.
 */
export function channelAllowed(channelId: string | undefined, allowlist: string | undefined): boolean {
  const allowed = (allowlist ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.length === 0 || (Boolean(channelId) && allowed.includes(channelId!));
}

// SPKI DER header for a raw 32-byte Ed25519 public key.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * Discord signs every interaction with the app's Ed25519 key over
 * `timestamp + rawBody`. Anything that fails must get a 401 — Discord probes
 * the endpoint with bad signatures before it accepts the URL.
 */
export function verifyDiscordSignature(
  rawBody: string,
  signatureHex: string | null,
  timestamp: string | null,
  publicKeyHex: string,
): boolean {
  if (!signatureHex || !timestamp) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]),
      format: 'der',
      type: 'spki',
    });
    return verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Replace the deferred "thinking…" reply and return the message's id. No bot
 * token needed: the interaction token authorises it.
 */
export async function editOriginalResponse(
  applicationId: string,
  interactionToken: string,
  body: object,
): Promise<string> {
  const res = await fetch(
    `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(`Discord edit returned ${res.status}: ${await res.text()}`);
  }
  const message = (await res.json()) as { id: string };
  return message.id;
}

/** Post through a channel webhook and return the new message's id. */
export async function executeWebhook(webhookUrl: string, body: object): Promise<string> {
  const url = new URL(webhookUrl);
  // Without wait=true Discord answers 204 and never says which message it made.
  url.searchParams.set('wait', 'true');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook returned ${res.status}: ${await res.text()}`);
  }
  const message = (await res.json()) as { id: string };
  return message.id;
}

/** Delete a message the webhook posted. Already gone (404) counts as done. */
export async function deleteWebhookMessage(webhookUrl: string, messageId: string): Promise<void> {
  const url = new URL(webhookUrl);
  url.pathname = `${url.pathname.replace(/\/$/, '')}/messages/${messageId}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Discord webhook delete returned ${res.status}: ${await res.text()}`);
  }
}
