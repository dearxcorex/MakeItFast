import { Redis } from '@upstash/redis';

// One Upstash client for the /ask bot's state (quota, follow-up threads).
// Null when UPSTASH_REDIS_REST_URL / _TOKEN are unset — dev and tests — and
// each caller decides what that means for it.

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis: Redis | null =
  upstashUrl && upstashToken ? new Redis({ url: upstashUrl, token: upstashToken }) : null;
