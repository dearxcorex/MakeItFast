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

vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async (pw: string) => `hash:${pw}`),
  verifyPassword: vi.fn(async (pw: string, hash: string) => hash === `hash:${pw}`),
}));

const session: Record<string, unknown> & { save: ReturnType<typeof vi.fn> } = {
  save: vi.fn(),
};
vi.mock("@/lib/session", () => ({
  COOKIE_NAME: "fm_session",
  getSession: async () => session,
}));

import prisma from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { POST } from "@/app/api/auth/change-password/route";

const row = (over: Record<string, unknown> = {}) => ({
  id: 7,
  username: "field",
  display_name: "Field",
  role: "inspector",
  active: true,
  password_hash: "hash:oldpassword",
  must_change_password: false,
  created_at: new Date(),
  updated_at: new Date(),
  created_by: 1,
  ...over,
});

function req(body: unknown) {
  return new NextRequest("http://localhost/api/auth/change-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(session)) {
    if (k !== "save") delete session[k];
  }
  session.userId = 7;
  session.mustChangePassword = false;
});

describe("POST /api/auth/change-password", () => {
  it("401 without a session", async () => {
    delete session.userId;
    const res = await POST(req({ newPassword: "brandnew123" }));
    expect(res.status).toBe(401);
  });

  it("400 on a malformed body", async () => {
    const bad = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect((await POST(bad)).status).toBe(400);
  });

  it("400 when the new password is under 8 chars", async () => {
    const res = await POST(
      req({ currentPassword: "oldpassword", newPassword: "short" })
    );
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("401 when the session points at a missing or disabled user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);
    expect((await POST(req({ newPassword: "brandnew123" }))).status).toBe(401);

    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      row({ active: false }) as never
    );
    expect((await POST(req({ newPassword: "brandnew123" }))).status).toBe(401);
  });

  describe("voluntary change", () => {
    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(row() as never);
    });

    it("400 when the current password is missing", async () => {
      const res = await POST(req({ newPassword: "brandnew123" }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: "current_password_required",
      });
    });

    it("401 when the current password is wrong", async () => {
      const res = await POST(
        req({ currentPassword: "guess", newPassword: "brandnew123" })
      );
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({
        error: "invalid_credentials",
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("200 and rehashes when the current password checks out", async () => {
      vi.mocked(prisma.user.update).mockResolvedValue({} as never);
      const res = await POST(
        req({ currentPassword: "oldpassword", newPassword: "brandnew123" })
      );
      expect(res.status).toBe(200);
      expect(hashPassword).toHaveBeenCalledWith("brandnew123");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: {
          password_hash: "hash:brandnew123",
          must_change_password: false,
        },
      });
    });
  });

  describe("forced change", () => {
    beforeEach(() => {
      session.mustChangePassword = true;
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        row({ must_change_password: true }) as never
      );
      vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    });

    it("does not demand the admin-issued password back", async () => {
      const res = await POST(req({ newPassword: "brandnew123" }));
      expect(res.status).toBe(200);
      // Only the reuse check runs — no current-password verification.
      expect(verifyPassword).toHaveBeenCalledTimes(1);
      expect(verifyPassword).toHaveBeenCalledWith("brandnew123", "hash:oldpassword");
    });

    it("rejects reusing the admin-issued password", async () => {
      const res = await POST(req({ newPassword: "oldpassword" }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: "password_reused" });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("clears the flag in the DB and in the session", async () => {
      await POST(req({ newPassword: "brandnew123" }));
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ must_change_password: false }),
        })
      );
      expect(session.mustChangePassword).toBe(false);
      expect(session.save).toHaveBeenCalled();
    });
  });
});
