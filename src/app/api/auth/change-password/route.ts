import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getSession } from "@/lib/session";

export const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }
  const { currentPassword, newPassword } = (body ?? {}) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  };

  if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  const row = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!row || !row.active) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // A forced change is already gated by the login that issued the session, so
  // we don't demand the temporary password back. A voluntary change is not
  // gated by anything, so it must prove possession of the current one --
  // otherwise a borrowed unlocked session could silently seize the account.
  if (!row.must_change_password) {
    if (typeof currentPassword !== "string" || currentPassword.length === 0) {
      return NextResponse.json({ error: "current_password_required" }, { status: 400 });
    }
    const ok = await verifyPassword(currentPassword, row.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }
  }

  // Reusing the admin-issued password would leave a credential someone else has
  // seen in force, which is the whole thing this flow exists to end.
  if (await verifyPassword(newPassword, row.password_hash)) {
    return NextResponse.json({ error: "password_reused" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: row.id },
    data: {
      password_hash: await hashPassword(newPassword),
      must_change_password: false,
    },
  });

  session.mustChangePassword = false;
  await session.save();

  return NextResponse.json({ ok: true }, { status: 200 });
}
