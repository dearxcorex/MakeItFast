import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { user: { findUnique: vi.fn() } },
}));

// Mock next/headers cookies() to return a fake cookie store keyed by our helper
const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v ? { name, value: v } : undefined;
    },
  }),
}));

import prisma from "@/lib/prisma";
import { requireUser, requireAdmin, AuthError } from "@/lib/auth";
import { mintCookie, mintAdminCookie } from "./helpers/session";
import { COOKIE_NAME } from "@/lib/session";

beforeEach(() => {
  cookieStore.clear();
  vi.clearAllMocks();
});

describe("requireUser", () => {
  it("throws AuthError(401) when no cookie", async () => {
    await expect(requireUser()).rejects.toMatchObject({
      name: "AuthError",
      status: 401,
    });
  });

  it("returns the user when cookie is valid and user is active", async () => {
    const cookie = await mintCookie({ userId: 42 });
    cookieStore.set(COOKIE_NAME, cookie.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 42,
      username: "tester",
      display_name: "Tester",
      role: "inspector",
      active: true,
      password_hash: "x",
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null,
    } as any);

    const user = await requireUser();
    expect(user.id).toBe(42);
    expect(user.role).toBe("inspector");
  });

  it("throws 401 when DB says user is inactive", async () => {
    const cookie = await mintCookie({ userId: 42 });
    cookieStore.set(COOKIE_NAME, cookie.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 42,
      username: "tester",
      display_name: "Tester",
      role: "inspector",
      active: false,
      password_hash: "x",
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null,
    } as any);

    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
});

describe("requireAdmin", () => {
  it("throws 403 for an inspector cookie", async () => {
    const cookie = await mintCookie({ userId: 42, role: "inspector" });
    cookieStore.set(COOKIE_NAME, cookie.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 42,
      username: "tester",
      display_name: "Tester",
      role: "inspector",
      active: true,
      password_hash: "x",
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null,
    } as any);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });

  it("returns user for an admin", async () => {
    const cookie = await mintAdminCookie({ userId: 1 });
    cookieStore.set(COOKIE_NAME, cookie.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 1,
      username: "boss",
      display_name: "Boss",
      role: "admin",
      active: true,
      password_hash: "x",
      created_at: new Date(),
      updated_at: new Date(),
      created_by: null,
    } as any);
    const user = await requireAdmin();
    expect(user.role).toBe("admin");
  });
});
