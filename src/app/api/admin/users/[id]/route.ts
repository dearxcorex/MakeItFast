import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AuthError, requireAdmin } from "@/lib/auth";
import type { PublicUser } from "@/types/user";

function toPublic(row: any): PublicUser {
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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireAdmin();
    const { id: idStr } = await ctx.params;
    const id = Number.parseInt(idStr, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    const data: { active?: boolean; role?: string; display_name?: string } = {};
    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.role === "string") {
      if (body.role !== "admin" && body.role !== "inspector") {
        return NextResponse.json(
          { error: "validation_error" },
          { status: 400 }
        );
      }
      data.role = body.role;
    }
    if (typeof body.displayName === "string") {
      const dn = body.displayName.trim();
      if (!dn) {
        return NextResponse.json(
          { error: "validation_error" },
          { status: 400 }
        );
      }
      data.display_name = dn;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "validation_error" }, { status: 400 });
    }

    // Self-protection
    if (id === me.id) {
      if (data.active === false) {
        return NextResponse.json(
          { error: "cannot_modify_self" },
          { status: 400 }
        );
      }
      if (data.role !== undefined && data.role !== me.role) {
        return NextResponse.json(
          { error: "cannot_modify_self" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
    });

    return NextResponse.json({ user: toPublic(updated) }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
