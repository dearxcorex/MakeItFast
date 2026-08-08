import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: idStr } = await ctx.params;
    const id = Number.parseInt(idStr, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }
    const b = (body ?? {}) as Record<string, unknown>;
    const { newPassword } = b;
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    // An admin now knows this password, so it is a handover credential only:
    // the user must replace it before the account is usable again.
    const password_hash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id },
      data: { password_hash, must_change_password: true },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
