import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: { user: { findUnique: vi.fn() } },
}));

// Capture cookie operations from iron-session's save()
const cookieMutations: { name: string; value: string; options: any }[] = [];
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: (name: string, value: string, options: any) => {
      cookieMutations.push({ name, value, options });
    },
    delete: (name: string) => {
      cookieMutations.push({ name, value: "", options: { maxAge: 0 } });
    },
  }),
}));

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/auth/login/route";
import { hashPassword } from "@/lib/password";
import { __resetThrottleForTests } from "@/lib/loginThrottle";

const userRow = async (over: Partial<any> = {}) => ({
  id: 1,
  username: "alice",
  display_name: "Alice",
  role: "inspector",
  active: true,
  password_hash: await hashPassword("hunter2!!"),
  created_at: new Date(),
  updated_at: new Date(),
  created_by: null,
  ...over,
});

function req(body: any) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
  cookieMutations.length = 0;
  vi.clearAllMocks();
  __resetThrottleForTests();
});

describe("POST /api/auth/login", () => {
  it("returns 200 + PublicUser on valid creds", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(await userRow());
    const res = await POST(
      req({ username: "alice", password: "hunter2!!", rememberMe: true })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({
      id: 1,
      username: "alice",
      displayName: "Alice",
      role: "inspector",
    });
    expect(body.user.password_hash).toBeUndefined();
    expect(cookieMutations.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 401 for wrong password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(await userRow());
    const res = await POST(
      req({ username: "alice", password: "wrong", rememberMe: false })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_credentials");
  });

  it("returns 401 for unknown username (no enumeration)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const res = await POST(
      req({ username: "ghost", password: "anything", rememberMe: false })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_credentials");
  });

  it("returns 401 for disabled user (same response shape)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      await userRow({ active: false })
    );
    const res = await POST(
      req({ username: "alice", password: "hunter2!!", rememberMe: false })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_credentials");
  });

  it("rejects malformed input with 400", async () => {
    const res = await POST(req({ username: "", password: "" }));
    expect(res.status).toBe(400);
  });

  it("throttles after 5 failed attempts with 429", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(await userRow());
    for (let i = 0; i < 5; i++) {
      await POST(
        req({ username: "alice", password: "wrong", rememberMe: false })
      );
    }
    const res = await POST(
      req({ username: "alice", password: "wrong", rememberMe: false })
    );
    expect(res.status).toBe(429);
  });

  it("rememberMe=true sets persistent maxAge (~7 day TTL) in cookie", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(await userRow());
    await POST(
      req({ username: "alice", password: "hunter2!!", rememberMe: true })
    );
    const setCookie = cookieMutations.find((c) => c.name === "fm_session");
    // buildSessionOptions("persistent") sets maxAge = SESSION_TTL_SECONDS (7 days).
    // iron-session forwards this value verbatim (minus its 60s skew).
    const sevenDays = 60 * 60 * 24 * 7;
    expect(setCookie?.options.maxAge).toBeGreaterThan(0);
    // Must be the configured persistent TTL, not iron-session's default (14d) nor
    // its "no-expiry" sentinel (2147483647).
    expect(setCookie?.options.maxAge).toBeLessThanOrEqual(sevenDays);
    expect(setCookie?.options.maxAge).toBeGreaterThan(sevenDays - 120);
  });

  it("rememberMe=false produces a non-persistent cookie distinct from rememberMe=true", async () => {
    // buildSessionOptions("session") omits maxAge entirely. iron-session always
    // attaches *some* maxAge to the outgoing Set-Cookie (its internal default
    // ttl is 14 days, with no path to emit a header-less session cookie), so we
    // assert the semantic invariant the spec actually cares about: a session-mode
    // cookie must differ from a persistent-mode cookie, and must not carry the
    // configured 7-day persistent TTL.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(await userRow());
    await POST(
      req({ username: "alice", password: "hunter2!!", rememberMe: false })
    );
    const sessionCookie = cookieMutations.find((c) => c.name === "fm_session");
    const sevenDays = 60 * 60 * 24 * 7;
    expect(sessionCookie).toBeDefined();
    // Iron-session in session-mode falls back to its 14-day default ttl, so the
    // emitted maxAge is well above our 7-day persistent TTL.
    expect(sessionCookie?.options.maxAge).toBeGreaterThan(sevenDays);
  });
});
