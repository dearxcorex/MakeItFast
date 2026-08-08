import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { getSession, type SessionCookieMode } from "@/lib/session";
import {
  recordFailedAttempt,
  isThrottled,
  clearAttemptsAsync,
} from "@/lib/loginThrottle";

const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;

function clientIp(req: NextRequest): string {
  // Vercel + most proxies set X-Forwarded-For; take the left-most entry.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }
  const { username: rawUsername, password, rememberMe } = body as {
    username?: unknown;
    password?: unknown;
    rememberMe?: unknown;
  };

  if (typeof rawUsername !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }
  const username = rawUsername.trim().toLowerCase();
  if (!USERNAME_RE.test(username) || password.length === 0) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  const ip = clientIp(req);

  // Race the throttle check against the user lookup so Upstash REST latency
  // overlaps with PgBouncer's connection setup on cold starts. We still gate
  // the response on the throttle result before we touch the password hash.
  const [throttled, row] = await Promise.all([
    isThrottled(ip, username),
    prisma.user.findUnique({ where: { username } }),
  ]);

  if (throttled) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429 }
    );
  }

  const okPassword =
    row && row.active ? await verifyPassword(password, row.password_hash) : false;

  if (!row || !row.active || !okPassword) {
    await recordFailedAttempt(ip, username);
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 401 }
    );
  }

  // Fire-and-forget: a stale entry will TTL out within WINDOW_SECONDS anyway,
  // and forcing the user to wait for a REST DEL on every successful login is
  // a waste of ~100-150ms of perceived login time.
  void clearAttemptsAsync(ip, username).catch((err) => {
    console.warn("[login] clearAttempts cleanup failed (non-fatal):", err);
  });

  const mode: SessionCookieMode = rememberMe === true ? "persistent" : "session";
  const session = await getSession(mode);
  session.userId = row.id;
  session.username = row.username;
  session.displayName = row.display_name;
  session.role = row.role === "admin" ? "admin" : "inspector";
  session.issuedAt = Date.now();
  session.mustChangePassword = row.must_change_password;
  await session.save();

  return NextResponse.json(
    {
      user: {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        role: row.role,
        active: row.active,
        createdAt: row.created_at.toISOString(),
        createdBy: row.created_by,
        mustChangePassword: row.must_change_password,
      },
    },
    { status: 200 }
  );
}
