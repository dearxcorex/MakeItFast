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
  if ((session.sessionEpoch ?? 0) !== (row.session_epoch ?? 0)) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // The current-password proof is waived only when BOTH the session and the
  // row agree the password is admin-issued. Both halves matter:
  //
  //  - session only: a stale cookie whose flag was already cleared elsewhere
  //    would waive the proof for a password the holder never saw.
  //  - row only: an admin reset flips the row while the user's existing
  //    session is untouched, so anyone reaching that already-unlocked session
  //    could seize the account without knowing any password.
  //
  // Requiring both means the waiver survives exactly one case -- a session
  // minted by logging in with the admin-issued password itself.
  const forced =
    session.mustChangePassword === true && row.must_change_password === true;

  if (!forced) {
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

  // Bumping the epoch revokes this user's other sessions — a password change
  // should not leave the old credential's sessions alive on other devices.
  const updated = await prisma.user.update({
    where: { id: row.id },
    data: {
      password_hash: await hashPassword(newPassword),
      must_change_password: false,
      session_epoch: { increment: 1 },
    },
  });

  // Re-acquire under the mode chosen at login before saving: `getSession()`
  // defaults to "persistent", so saving through it would quietly re-issue a
  // 2-hour "session" cookie with a 7-day lifetime.
  const current = await getSession(session.mode ?? "persistent");
  current.mustChangePassword = false;
  current.sessionEpoch = updated.session_epoch;
  await current.save();

  return NextResponse.json({ ok: true }, { status: 200 });
}
