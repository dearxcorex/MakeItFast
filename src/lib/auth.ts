import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { COOKIE_NAME, readSessionFromCookie } from "@/lib/session";
import type { PublicUser } from "@/types/user";

export class AuthError extends Error {
  status: 401 | 403;
  code: "not_authenticated" | "forbidden";
  constructor(status: 401 | 403, code: AuthError["code"], message?: string) {
    super(message ?? code);
    this.name = "AuthError";
    this.status = status;
    this.code = code;
  }
}

function toPublic(row: {
  id: number;
  username: string;
  display_name: string;
  role: string;
  active: boolean;
  created_at: Date;
  created_by: number | null;
  must_change_password?: boolean;
}): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role === "admin" ? "admin" : "inspector",
    active: row.active,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
    mustChangePassword: row.must_change_password ?? false,
  };
}

export async function requireUser(): Promise<PublicUser> {
  const store = await cookies();
  const cookieValue = store.get(COOKIE_NAME)?.value;
  const session = await readSessionFromCookie(cookieValue);
  if (!session) {
    throw new AuthError(401, "not_authenticated");
  }
  const row = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!row || !row.active) {
    throw new AuthError(401, "not_authenticated");
  }
  return toPublic(row);
}

export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new AuthError(403, "forbidden");
  }
  return user;
}
