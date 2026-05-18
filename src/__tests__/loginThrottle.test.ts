import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordFailedAttempt,
  isThrottled,
  clearAttempts,
  __resetThrottleForTests,
} from "@/lib/loginThrottle";

// These tests exercise the in-memory fallback path. UPSTASH_REDIS_REST_URL is
// not set in the test env, so the module uses its Map-backed fallback — the
// same semantics it falls back to in dev. Production-with-Upstash semantics
// are covered by manual / integration testing against a real Upstash db.

const IP = "203.0.113.1";

beforeEach(() => {
  __resetThrottleForTests();
});

describe("login throttle (in-memory fallback)", () => {
  it("allows the first 5 attempts then throttles the 6th", async () => {
    const user = "alice";
    for (let i = 0; i < 5; i++) {
      expect(await isThrottled(IP, user)).toBe(false);
      await recordFailedAttempt(IP, user);
    }
    expect(await isThrottled(IP, user)).toBe(true);
  });

  it("isolates throttle by username", async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt(IP, "alice");
    expect(await isThrottled(IP, "alice")).toBe(true);
    expect(await isThrottled(IP, "bob")).toBe(false);
  });

  it("isolates throttle by IP", async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt(IP, "alice");
    expect(await isThrottled(IP, "alice")).toBe(true);
    expect(await isThrottled("198.51.100.7", "alice")).toBe(false);
  });

  it("clears throttle when explicitly cleared (successful login)", async () => {
    for (let i = 0; i < 5; i++) await recordFailedAttempt(IP, "alice");
    expect(await isThrottled(IP, "alice")).toBe(true);
    await clearAttempts(IP, "alice");
    expect(await isThrottled(IP, "alice")).toBe(false);
  });

  it("expires the window after 15 minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    for (let i = 0; i < 5; i++) await recordFailedAttempt(IP, "alice");
    expect(await isThrottled(IP, "alice")).toBe(true);
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(await isThrottled(IP, "alice")).toBe(false);
    vi.useRealTimers();
  });
});
