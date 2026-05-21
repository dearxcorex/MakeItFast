import { Redis } from "@upstash/redis";

// Persistent login throttle, keyed by (client IP, username). Backed by Upstash
// Redis in production — survives serverless cold starts, which the previous
// in-memory Map did not, making the throttle effectively useless on Vercel.
//
// In dev/test (or when UPSTASH_REDIS_REST_URL/TOKEN aren't set), we fall back
// to an in-memory Map so `npm run dev` and the unit tests still work without
// external infra.

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;
const KEY_PREFIX = "login_throttle:";

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  upstashUrl && upstashToken
    ? new Redis({ url: upstashUrl, token: upstashToken })
    : null;

if (!redis && process.env.NODE_ENV === "production") {
  console.warn(
    "[loginThrottle] UPSTASH_REDIS_REST_URL/TOKEN missing in production — " +
      "login throttle is falling back to in-memory and will reset on every " +
      "serverless cold start. Set these env vars to enable persistent throttling."
  );
}

type Attempt = { count: number; firstAt: number };
const fallback = new Map<string, Attempt>();

function makeKey(ip: string, username: string): string {
  return `${KEY_PREFIX}${ip}:${username.trim().toLowerCase()}`;
}

export async function isThrottled(ip: string, username: string): Promise<boolean> {
  const key = makeKey(ip, username);
  if (redis) {
    const count = (await redis.get<number>(key)) ?? 0;
    return count >= MAX_ATTEMPTS;
  }
  const cur = fallback.get(key);
  if (!cur) return false;
  if (Date.now() - cur.firstAt > WINDOW_SECONDS * 1000) {
    fallback.delete(key);
    return false;
  }
  return cur.count >= MAX_ATTEMPTS;
}

export async function recordFailedAttempt(ip: string, username: string): Promise<void> {
  const key = makeKey(ip, username);
  if (redis) {
    const newCount = await redis.incr(key);
    if (newCount === 1) {
      // First attempt in this window — set the TTL so the counter doesn't
      // live forever. INCR creates a key with no TTL.
      await redis.expire(key, WINDOW_SECONDS);
    }
    return;
  }
  const now = Date.now();
  const cur = fallback.get(key);
  if (!cur || now - cur.firstAt > WINDOW_SECONDS * 1000) {
    fallback.set(key, { count: 1, firstAt: now });
  } else {
    cur.count += 1;
  }
}

export async function clearAttempts(ip: string, username: string): Promise<void> {
  const key = makeKey(ip, username);
  if (redis) {
    await redis.del(key);
    return;
  }
  fallback.delete(key);
}

/**
 * Same as clearAttempts but returns the unawaited promise so callers can
 * fire-and-forget on the success path. The Upstash REST DEL adds ~100–150ms
 * to a happy-path login otherwise, and a stale entry naturally expires.
 *
 * In tests, callers can still `await` the returned promise.
 */
export function clearAttemptsAsync(ip: string, username: string): Promise<void> {
  return clearAttempts(ip, username);
}

/** Test-only: reset in-memory fallback state. Does not touch Upstash. */
export function __resetThrottleForTests(): void {
  fallback.clear();
}
