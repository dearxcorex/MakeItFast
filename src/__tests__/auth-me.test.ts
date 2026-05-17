import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { user: { findUnique: vi.fn() } },
}));

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v ? { name, value: v } : undefined;
    },
    set: () => {},
    delete: () => {},
  }),
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/auth/me/route";
import { mintCookie } from "./helpers/session";
import { COOKIE_NAME } from "@/lib/session";

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
  cookieStore.clear();
  vi.clearAllMocks();
});

describe("GET /api/auth/me", () => {
  it("returns 401 when no cookie", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with PublicUser and no password_hash for valid session", async () => {
    const c = await mintCookie({ userId: 5 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 5,
      username: "tester",
      display_name: "Tester",
      role: "inspector",
      active: true,
      password_hash: "SHOULD-NEVER-LEAK",
      created_at: new Date("2026-01-01"),
      updated_at: new Date("2026-01-01"),
      created_by: null,
    } as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe(5);
    expect(body.user.displayName).toBe("Tester");
    expect(JSON.stringify(body)).not.toContain("SHOULD-NEVER-LEAK");
    expect(body.user.password_hash).toBeUndefined();
  });

  it("returns 401 for cookie whose user is disabled", async () => {
    const c = await mintCookie({ userId: 5 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 5,
      username: "tester",
      display_name: "Tester",
      role: "inspector",
      active: false,
      password_hash: "x",
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null,
    } as any);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
