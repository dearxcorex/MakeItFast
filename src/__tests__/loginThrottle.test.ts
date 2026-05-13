import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordFailedAttempt,
  isThrottled,
  clearAttempts,
  __resetThrottleForTests,
} from "@/lib/loginThrottle";

beforeEach(() => {
  __resetThrottleForTests();
});

describe("login throttle", () => {
  it("allows the first 5 attempts then throttles the 6th", () => {
    const user = "alice";
    for (let i = 0; i < 5; i++) {
      expect(isThrottled(user)).toBe(false);
      recordFailedAttempt(user);
    }
    expect(isThrottled(user)).toBe(true);
  });

  it("isolates throttle by username", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("alice");
    expect(isThrottled("alice")).toBe(true);
    expect(isThrottled("bob")).toBe(false);
  });

  it("clears throttle when explicitly cleared (successful login)", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt("alice");
    expect(isThrottled("alice")).toBe(true);
    clearAttempts("alice");
    expect(isThrottled("alice")).toBe(false);
  });

  it("expires the window after 15 minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    for (let i = 0; i < 5; i++) recordFailedAttempt("alice");
    expect(isThrottled("alice")).toBe(true);
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(isThrottled("alice")).toBe(false);
    vi.useRealTimers();
  });
});
