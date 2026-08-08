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

  it("redirects /login to / when already authenticated", async () => {
    const c = await mintCookie();
    const res = await middleware(reqWithCookie("/login", c.value));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/^http:\/\/localhost\/$/);
  });

  it("honors ?next when /login redirects an authenticated user", async () => {
    const c = await mintCookie();
    const url = new URL("http://localhost/login?next=%2Fadmin%2Fusers");
    const req = new NextRequest(url, { method: "GET" });
    req.cookies.set(COOKIE_NAME, c.value);
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/admin\/users$/);
  });

  it("ignores external ?next values to prevent open redirect", async () => {
    const c = await mintCookie();
    const url = new URL("http://localhost/login?next=https%3A%2F%2Fevil.com%2Fx");
    const req = new NextRequest(url, { method: "GET" });
    req.cookies.set(COOKIE_NAME, c.value);
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/^http:\/\/localhost\/$/);
  });

  it("ignores protocol-relative ?next values to prevent open redirect", async () => {
    // "//evil.com" starts with "/" so the old guard let it through, but
    // browsers resolve it to https://evil.com — safeNextPath now blocks it.
    const c = await mintCookie();
    const url = new URL("http://localhost/login?next=%2F%2Fevil.com%2Fx");
    const req = new NextRequest(url, { method: "GET" });
    req.cookies.set(COOKIE_NAME, c.value);
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/^http:\/\/localhost\/$/);
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

describe("middleware forced password change", () => {
  it("redirects a pending user to /change-password", async () => {
    const c = await mintCookie({ mustChangePassword: true });
    const res = await middleware(reqWithCookie("/", c.value));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/change-password$/);
  });

  it("returns 403 JSON for API calls while a change is pending", async () => {
    const c = await mintCookie({ mustChangePassword: true });
    const res = await middleware(reqWithCookie("/api/stations", c.value));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "password_change_required",
    });
  });

  it("lets the change-password page and its API through", async () => {
    const c = await mintCookie({ mustChangePassword: true });
    for (const path of [
      "/change-password",
      "/api/auth/change-password",
      "/api/auth/logout",
      "/api/auth/me",
    ]) {
      const res = await middleware(reqWithCookie(path, c.value));
      expect(res.status, path).not.toBe(307);
      expect(res.status, path).not.toBe(403);
    }
  });

  it("gates an admin too — the temp password is not an admin bypass", async () => {
    const c = await mintAdminCookie({ mustChangePassword: true });
    const res = await middleware(reqWithCookie("/api/admin/users", c.value));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "password_change_required",
    });
  });

  it("does not gate a session without the flag", async () => {
    const c = await mintCookie();
    const res = await middleware(reqWithCookie("/", c.value));
    expect(res.status).not.toBe(307);
  });

  it("still lets a settled user visit /change-password voluntarily", async () => {
    const c = await mintCookie({ mustChangePassword: false });
    const res = await middleware(reqWithCookie("/change-password", c.value));
    expect(res.status).not.toBe(307);
  });
});
