import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { authErrorResponse } from "@/services/stationAdmin";
import { CAMERA_INCLUDE, convertToCameraSource } from "@/services/cameraSourceService";
import { CAMERA_INSPECTED, CAMERA_PENDING } from "@/utils/cameraSources";

/** Mark a camera inspected or undo it. Any signed-in user may do either. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await requireUser();
    const { id } = await params;
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      return NextResponse.json({ error: "Invalid camera ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const status = body?.status;
    if (status !== CAMERA_INSPECTED && status !== CAMERA_PENDING) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Only a real change writes, so a repeated tap cannot take over the credit
    // from whoever inspected the camera first.
    await prisma.camera_source.updateMany({
      where: { id: numId, status: { not: status } },
      data:
        status === CAMERA_INSPECTED
          ? { status, inspected_at: new Date(), inspected_by: me.id }
          : { status, inspected_at: null, inspected_by: null },
    });

    const row = await prisma.camera_source.findUnique({
      where: { id: numId },
      include: CAMERA_INCLUDE,
    });
    if (!row) {
      return NextResponse.json({ error: "Camera not found" }, { status: 404 });
    }
    return NextResponse.json({ camera: convertToCameraSource(row) });
  } catch (err) {
    const res = authErrorResponse(err);
    if (res) return res;
    console.error("Camera source update error:", err);
    return NextResponse.json({ error: "Failed to update camera" }, { status: 500 });
  }
}
