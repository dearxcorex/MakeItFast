import { Redis } from '@upstash/redis';

// Per-user daily cap on /ask. Unlike /stat, every call costs money at DeepSeek,
// and a slash command is trivially repeatable — the cap is the spend limit.
//
// Keyed by Bangkok date so it resets at Thai midnight, not UTC. Backed by
// Upstash where configured; otherwise an in-memory Map, which on serverless
// resets at every cold start and so caps nothing. Same trade as loginThrottle:
// dev and tests run without external infra.

const KEY_PREFIX = 'ask_quota:';
// A day key is dead 24 h after it is written; 26 h covers the timezone offset.
const TTL_SECONDS = 26 * 60 * 60;
const DEFAULT_LIMIT = 30;

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = upstashUrl && upstashToken ? new Redis({ url: upstashUrl, token: upstashToken }) : null;

const fallback = new Map<string, number>();

export function dailyLimit(): number {
  const raw = Number(process.env.ASK_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : DEFAULT_LIMIT;
}

export interface QuotaDecision {
  allowed: boolean;
  used: number;
  limit: number;
}

/**
 * Count this call against the user's day and say whether it may proceed.
 * Counts the refused call too: the counter is "attempts", so hammering the
 * command does not reset anything.
 */
export async function consumeAskQuota(userId: string, day: string): Promise<QuotaDecision> {
  const limit = dailyLimit();
  const key = `${KEY_PREFIX}${day}:${userId}`;

  let used: number;
  if (redis) {
    used = await redis.incr(key);
    // INCR creates the key without a TTL, so the first call has to set one.
    if (used === 1) await redis.expire(key, TTL_SECONDS);
  } else {
    used = (fallback.get(key) ?? 0) + 1;
    fallback.set(key, used);
  }

  return { allowed: used <= limit, used, limit };
}

/** Test-only: reset in-memory fallback state. Does not touch Upstash. */
export function __resetAskQuotaForTests(): void {
  fallback.clear();
}
