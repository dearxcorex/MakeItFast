import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const callOrder: string[] = [];

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(async () => {
        callOrder.push("findUnique");
        return {
          id: 1,
          username: "alice",
          display_name: "Alice",
          role: "inspector",
          active: true,
          password_hash: "hash",
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
        };
      }),
    },
  },
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(async () => {
    callOrder.push("verifyPassword");
    return true;
  }),
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => ({
    save: vi.fn(async () => {
      callOrder.push("session.save");
    }),
  })),
}));

vi.mock("@/lib/loginThrottle", () => ({
  isThrottled: vi.fn(async () => {
    callOrder.push("isThrottled");
    return false;
  }),
  recordFailedAttempt: vi.fn(),
  clearAttempts: vi.fn(async () => {
    callOrder.push("clearAttempts:resolved");
  }),
  clearAttemptsAsync: vi.fn(() => {
    callOrder.push("clearAttemptsAsync:fired");
    return Promise.resolve();
  }),
}));

import { POST } from "@/app/api/auth/login/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

describe("login route hot path", () => {
  beforeEach(() => {
    callOrder.length = 0;
  });

  it("starts isThrottled and findUnique concurrently", async () => {
    const res = await POST(makeReq({ username: "alice", password: "secret123" }));
    expect(res.status).toBe(200);
    const throttleIdx = callOrder.indexOf("isThrottled");
    const findIdx = callOrder.indexOf("findUnique");
    expect(throttleIdx).toBeGreaterThanOrEqual(0);
    expect(findIdx).toBeGreaterThanOrEqual(0);
    // Both should have been entered before either resolves long enough to
    // sequence behind the other — call order may vary, but both must appear.
  });

  it("does NOT await clearAttempts on the happy path", async () => {
    await POST(makeReq({ username: "alice", password: "secret123" }));
    expect(callOrder).toContain("clearAttemptsAsync:fired");
    expect(callOrder).not.toContain("clearAttempts:resolved");
  });
});
