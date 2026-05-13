import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { getSession, type SessionCookieMode } from "@/lib/session";
import {
  recordFailedAttempt,
  isThrottled,
  clearAttempts,
} from "@/lib/loginThrottle";

const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;

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

  if (isThrottled(username)) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429 }
    );
  }

  const row = await prisma.user.findUnique({ where: { username } });
  const okPassword =
    row && row.active ? await verifyPassword(password, row.password_hash) : false;

  if (!row || !row.active || !okPassword) {
    recordFailedAttempt(username);
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 401 }
    );
  }

  clearAttempts(username);

  const mode: SessionCookieMode = rememberMe === true ? "persistent" : "session";
  const session = await getSession(mode);
  session.userId = row.id;
  session.username = row.username;
  session.displayName = row.display_name;
  session.role = row.role === "admin" ? "admin" : "inspector";
  session.issuedAt = Date.now();
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
      },
    },
    { status: 200 }
  );
}
