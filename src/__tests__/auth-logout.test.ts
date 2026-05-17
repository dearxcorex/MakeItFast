import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const cookieMutations: { name: string; value: string; options: any }[] = [];
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ name: "fm_session", value: "anything" }),
    set: (name: string, value: string, options: any) => {
      cookieMutations.push({ name, value, options });
    },
    delete: (name: string) => {
      cookieMutations.push({ name, value: "", options: { maxAge: 0 } });
    },
  }),
}));

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
  cookieMutations.length = 0;
});

import { POST } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout", () => {
  it("clears the session cookie and returns 200", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/auth/logout", { method: "POST" })
    );
    expect(res.status).toBe(200);
    const cleared = cookieMutations.find((c) => c.name === "fm_session");
    expect(cleared).toBeDefined();
    expect(cleared!.options.maxAge === 0 || cleared!.value === "").toBe(true);
  });
});
