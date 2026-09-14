import { createPublicKey, verify } from 'node:crypto';

export const DISCORD_API = 'https://discord.com/api/v10';

// https://discord.com/developers/docs/interactions/receiving-and-responding
export const InteractionType = { PING: 1, APPLICATION_COMMAND: 2 } as const;
export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
} as const;
export const EPHEMERAL = 1 << 6;
// Posts without pushing a notification to members' phones.
export const SUPPRESS_NOTIFICATIONS = 1 << 12;

export interface Interaction {
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  data?: { name: string };
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

/** Replace the deferred "thinking…" reply. No bot token needed: the interaction token authorises it. */
export async function editOriginalResponse(
  applicationId: string,
  interactionToken: string,
  body: object,
): Promise<void> {
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
