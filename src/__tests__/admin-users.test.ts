import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
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
import { GET, POST } from "@/app/api/admin/users/route";
import { mintAdminCookie, mintCookie } from "./helpers/session";
import { COOKIE_NAME } from "@/lib/session";

const adminRow = (over: Partial<any> = {}) => ({
  id: 1,
  username: "boss",
  display_name: "Boss",
  role: "admin",
  active: true,
  password_hash: "x",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  created_by: null,
  ...over,
});

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
  cookieStore.clear();
  vi.clearAllMocks();
});

describe("GET /api/admin/users", () => {
  it("returns 403 for inspectors", async () => {
    const c = await mintCookie({ role: "inspector", userId: 9 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      adminRow({ id: 9, role: "inspector" }) as any
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 list for admins, no password_hash in payload", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      adminRow(),
      adminRow({
        id: 2,
        username: "alice",
        display_name: "Alice",
        role: "inspector",
      }),
    ] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(2);
    expect(JSON.stringify(body)).not.toContain("password_hash");
  });
});

describe("POST /api/admin/users", () => {
  const validBody = {
    username: "newone",
    password: "longenough1",
    displayName: "New One",
    role: "inspector",
  };

  function req(body: any) {
    return new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("403 for inspector", async () => {
    const c = await mintCookie({ role: "inspector", userId: 9 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      adminRow({ id: 9, role: "inspector" }) as any
    );
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
  });

  it("400 on weak password", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    const res = await POST(req({ ...validBody, password: "short" }));
    expect(res.status).toBe(400);
  });

  it("400 on bad username", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    const res = await POST(req({ ...validBody, username: "BadName!!" }));
    expect(res.status).toBe(400);
  });

  it("409 on duplicate username", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(adminRow() as any)
      .mockResolvedValueOnce(adminRow({ id: 5 }) as any);
    const res = await POST(req(validBody));
    expect(res.status).toBe(409);
  });

  it("201 on success and returns PublicUser with no password_hash", async () => {
    const c = await mintAdminCookie();
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(adminRow() as any)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.user.create).mockResolvedValue(
      adminRow({
        id: 7,
        username: "newone",
        display_name: "New One",
        role: "inspector",
        password_hash: "SHOULD-NEVER-LEAK",
        created_by: 1,
      }) as any
    );
    const res = await POST(req(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.id).toBe(7);
    expect(JSON.stringify(body)).not.toContain("SHOULD-NEVER-LEAK");
  });
});

import { PATCH } from "@/app/api/admin/users/[id]/route";

function patchReq(id: string, body: any) {
  return new NextRequest(`http://localhost/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/users/[id]", () => {
  it("updates active flag and returns 200", async () => {
    const c = await mintAdminCookie({ userId: 1 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    vi.mocked(prisma.user.update).mockResolvedValue(
      adminRow({ id: 5, active: false }) as any
    );
    const res = await PATCH(patchReq("5", { active: false }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejects self-disable with 400 cannot_modify_self", async () => {
    const c = await mintAdminCookie({ userId: 1 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    const res = await PATCH(patchReq("1", { active: false }), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("cannot_modify_self");
  });

  it("rejects self-demote with 400", async () => {
    const c = await mintAdminCookie({ userId: 1 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminRow() as any);
    const res = await PATCH(patchReq("1", { role: "inspector" }), {
      params: Promise.resolve({ id: "1" }),
    });
    expect(res.status).toBe(400);
  });

  it("403 for inspector", async () => {
    const c = await mintCookie({ role: "inspector", userId: 9 });
    cookieStore.set(COOKIE_NAME, c.value);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      adminRow({ id: 9, role: "inspector" }) as any
    );
    const res = await PATCH(patchReq("5", { active: false }), {
      params: Promise.resolve({ id: "5" }),
    });
    expect(res.status).toBe(403);
  });
});
