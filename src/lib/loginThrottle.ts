const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Attempt = { count: number; firstAt: number };
const attempts = new Map<string, Attempt>();

function key(username: string) {
  return username.trim().toLowerCase();
}

export function recordFailedAttempt(username: string): void {
  const k = key(username);
  const now = Date.now();
  const cur = attempts.get(k);
  if (!cur || now - cur.firstAt > WINDOW_MS) {
    attempts.set(k, { count: 1, firstAt: now });
  } else {
    cur.count += 1;
  }
}

export function isThrottled(username: string): boolean {
  const k = key(username);
  const cur = attempts.get(k);
  if (!cur) return false;
  if (Date.now() - cur.firstAt > WINDOW_MS) {
    attempts.delete(k);
    return false;
  }
  return cur.count >= MAX_ATTEMPTS;
}

export function clearAttempts(username: string): void {
  attempts.delete(key(username));
}

/** Test-only: reset all state. Do not call from production code. */
export function __resetThrottleForTests(): void {
  attempts.clear();
}
