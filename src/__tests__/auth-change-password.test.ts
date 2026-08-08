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
/** Records the cookie mode each getSession() call asks for. */
const { getSessionMode } = vi.hoisted(() => ({ getSessionMode: vi.fn() }));
vi.mock("@/lib/session", () => ({
  COOKIE_NAME: "fm_session",
  getSession: async (mode?: string) => {
    getSessionMode(mode);
    return session;
  },
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
  session_epoch: 0,
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
  session.sessionEpoch = 0;
  vi.mocked(prisma.user.update).mockResolvedValue({ session_epoch: 1 } as never);
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
          session_epoch: { increment: 1 },
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

    it("still demands the current password when only the row says forced", async () => {
      // An admin reset flips the row while an existing session sails on with
      // the flag it was sealed with. Waiving the proof here would let anyone
      // reaching that unlocked session seize the account.
      session.mustChangePassword = false;
      const res = await POST(req({ newPassword: "brandnew123" }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: "current_password_required",
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("still demands the current password when only the cookie says forced", async () => {
      // The mirror case: a cookie sealed before the change was completed on
      // another device must not waive the proof for the password it never saw.
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        row({ must_change_password: false }) as never
      );
      const res = await POST(req({ newPassword: "brandnew123" }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: "current_password_required",
      });
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

    it("bumps the epoch and carries the new value into this session", async () => {
      await POST(req({ newPassword: "brandnew123" }));
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ session_epoch: { increment: 1 } }),
        })
      );
      // The device doing the change must survive its own revocation.
      expect(session.sessionEpoch).toBe(1);
    });
  });

  describe("session revocation", () => {
    it("401s a session whose epoch is behind the row", async () => {
      session.sessionEpoch = 3;
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        row({ session_epoch: 4, must_change_password: true }) as never
      );
      const res = await POST(req({ newPassword: "brandnew123" }));
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "not_authenticated" });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("treats a cookie sealed before the column existed as epoch 0", async () => {
      delete session.sessionEpoch;
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        row({ session_epoch: 0 }) as never
      );
      const res = await POST(
        req({ currentPassword: "oldpassword", newPassword: "brandnew123" })
      );
      expect(res.status).toBe(200);
    });
  });

  describe("cookie lifetime", () => {
    it("re-issues under the mode recorded at login, not the default", async () => {
      // getSession() defaults to "persistent" (7 days). Saving through it
      // would silently promote a 2-hour non-remember-me cookie.
      session.mode = "session";
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        row({ must_change_password: true }) as never
      );
      session.mustChangePassword = true;
      await POST(req({ newPassword: "brandnew123" }));
      expect(getSessionMode).toHaveBeenCalledWith("session");
    });
  });
});
