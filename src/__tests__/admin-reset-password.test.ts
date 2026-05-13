import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
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
import { POST } from "@/app/api/admin/users/[id]/reset-password/route";
import { mintAdminCookie, mintCookie } from "./helpers/session";
import { COOKIE_NAME } from "@/lib/session";

const adminRow = () => ({
  id: 1,
  username: "boss",
  display_name: "Boss",
  role: "admin",
  active: true,
  password_hash: "x",
  created_at: new Date(),
  updated_at: new Date(),
  created_by: null,
});

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
  cookieStore.clear();
  vi.clearAllMocks();
});

function req(id: string, body: any) {
  return new NextRequest(
    `http://localhost/api/admin/users/${id}/reset-password`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

describe("POST /api/admin/users/[id]/reset-password", () => {
  it("403 for inspector", async () => {
    const c = await mintCookie({ role: "inspector", userId: 9 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...adminRow(),
      id: 9,
      role: "inspector",
    } as any);
    const res = await POST(req("5", { newPassword: "newpass1!" }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(403);
  });

  it("400 on weak password", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    const res = await POST(req("5", { newPassword: "short" }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(400);
  });

  it("200 on success and updates hash", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    const res = await POST(req("5", { newPassword: "longenough1" }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
        data: expect.objectContaining({ password_hash: expect.any(String) }),
      })
    );
  });
});
