import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { AuthError } from "@/lib/auth";
import { PATCH } from "@/app/api/camera-sources/[id]/route";

const { updateMany, findUnique, requireUser } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: { camera_source: { updateMany, findUnique } },
}));

vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  requireUser,
}));

const ROW = {
  id: 7, code: "KGDGM_3", lat: 14.6, long: 101.3, found_on: new Date("2026-05-26T00:00:00.000Z"),
  district: "ปากช่อง", province: "นครราชสีมา", landmark: null, cell_site_code: null, cell_site_name: null,
  cell_site_lat: null, cell_site_long: null, cell_site_operators: null, status: "ตรวจแล้ว",
  inspected_at: new Date("2026-11-23T01:00:00.000Z"), inspector: { display_name: "ผู้ตรวจ" },
};

const patch = (id: string, body: unknown) =>
  PATCH(
    new NextRequest(`http://localhost/api/camera-sources/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) }
  );

describe("PATCH /api/camera-sources/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: 3 });
    findUnique.mockResolvedValue(ROW);
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("records who inspected it and when, only if the status changes", async () => {
    const res = await patch("7", { status: "ตรวจแล้ว" });
    expect(res.status).toBe(200);
    const arg = updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 7, status: { not: "ตรวจแล้ว" } });
    expect(arg.data.inspected_by).toBe(3);
    expect(arg.data.inspected_at).toBeInstanceOf(Date);
    expect((await res.json()).camera.inspectedByName).toBe("ผู้ตรวจ");
  });

  it("clears who and when on undo", async () => {
    await patch("7", { status: "ยังไม่ตรวจ" });
    expect(updateMany.mock.calls[0][0].data).toEqual({ status: "ยังไม่ตรวจ", inspected_at: null, inspected_by: null });
  });

  it("rejects a bad id or status without writing", async () => {
    expect((await patch("abc", { status: "ตรวจแล้ว" })).status).toBe(400);
    expect((await patch("7", { status: "done" })).status).toBe(400);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown camera", async () => {
    findUnique.mockResolvedValue(null);
    expect((await patch("99", { status: "ตรวจแล้ว" })).status).toBe(404);
  });

  it("returns 401 when signed out, without writing", async () => {
    requireUser.mockRejectedValue(new AuthError(401, "not_authenticated"));
    expect((await patch("7", { status: "ตรวจแล้ว" })).status).toBe(401);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
