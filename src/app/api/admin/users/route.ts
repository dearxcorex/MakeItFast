import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import type { PublicUser } from "@/types/user";

const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;

type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: string;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
};

function toPublic(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role === "admin" ? "admin" : "inspector",
    active: row.active,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
  };
}

export async function GET() {
  try {
    await requireAdmin();
    const rows = await prisma.user.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json({ users: rows.map(toPublic) }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireAdmin();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    const b = (body ?? {}) as Record<string, unknown>;
    const { username: raw, password, displayName, role } = b;
    if (
      typeof raw !== "string" ||
      typeof password !== "string" ||
      typeof displayName !== "string" ||
      typeof role !== "string"
    ) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    const username = raw.trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    if (!displayName.trim()) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    if (role !== "admin" && role !== "inspector") {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }

    const password_hash = await hashPassword(password);
    const created = await prisma.user.create({
      data: {
        username,
        password_hash,
        display_name: displayName.trim(),
        role,
        active: true,
        created_by: me.id,
      },
    });

    return NextResponse.json({ user: toPublic(created) }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
