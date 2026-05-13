import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

beforeEach(() => {
  process.env.SESSION_PASSWORD =
    "test-session-password-32-chars-or-more!!!";
});

import { middleware } from "@/middleware";
import { mintCookie, mintAdminCookie } from "./helpers/session";
import { COOKIE_NAME } from "@/lib/session";

function reqWithCookie(path: string, cookieValue?: string) {
  const url = new URL(`http://localhost${path}`);
  const req = new NextRequest(url, { method: "GET" });
  if (cookieValue) {
    req.cookies.set(COOKIE_NAME, cookieValue);
  }
  return req;
}

describe("middleware", () => {
  it("allows /login without a session", async () => {
    const res = await middleware(reqWithCookie("/login"));
    expect(res.status).not.toBe(307);
  });

  it("allows /api/auth/login without a session", async () => {
    const res = await middleware(reqWithCookie("/api/auth/login"));
    expect(res.status).not.toBe(307);
  });

  it("redirects unauthenticated requests to /login with ?next", async () => {
    const res = await middleware(reqWithCookie("/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?next=%2F");
  });

  it("lets an authenticated request through", async () => {
    const c = await mintCookie();
    const res = await middleware(reqWithCookie("/", c.value));
    expect(res.status).not.toBe(307);
  });

  it("redirects an inspector hitting /admin/users to /", async () => {
    const c = await mintCookie({ role: "inspector" });
    const res = await middleware(reqWithCookie("/admin/users", c.value));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/^http:\/\/localhost\/$/);
  });

  it("returns 403 JSON for an inspector hitting /api/admin/users", async () => {
    const c = await mintCookie({ role: "inspector" });
    const res = await middleware(reqWithCookie("/api/admin/users", c.value));
    expect(res.status).toBe(403);
  });

  it("lets an admin through /admin/users", async () => {
    const c = await mintAdminCookie();
    const res = await middleware(reqWithCookie("/admin/users", c.value));
    expect(res.status).not.toBe(307);
  });
});
