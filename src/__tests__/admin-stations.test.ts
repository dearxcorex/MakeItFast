import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => {
  const m = {
    user: { findUnique: vi.fn() },
    fm_station: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    data_change: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  // Interactive transactions run the callback against the same mock, so the
  // assertions below can see both the row write and the log write.
  m.$transaction.mockImplementation(async (fn: (tx: typeof m) => unknown) => fn(m));
  return { default: m };
});

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieStore.get(name);
      return v ? { name, value: v } : undefined;
    },
    set: () => {},
    delete: () => {},
  }),
}));

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/admin/stations/route";
import { PATCH, DELETE } from "@/app/api/admin/stations/[id]/route";
import { mintAdminCookie, mintCookie } from "./helpers/session";
import { COOKIE_NAME } from "@/lib/session";

const userRow = (over: Partial<any> = {}) => ({
  id: 1,
  username: "boss",
  display_name: "Boss",
  role: "admin",
  active: true,
  password_hash: "x",
  created_at: new Date("2026-01-01"),
  updated_at: new Date("2026-01-01"),
  created_by: null,
  session_epoch: 0,
  ...over,
});

const stationRow = (over: Partial<any> = {}) => ({
  id: 10,
  id_fm: "RFXL680004",
  register_station_id: 5550002,
  name: "สถานีเดิม",
  freq: 99.5,
  lat: 14.97,
  long: 102.1,
  district: "เมืองนครราชสีมา",
  province: "นครราชสีมา",
  type: "บริการธุรกิจ",
  inspection_69: false,
  on_air: true,
  submit_a_request: true,
  date_inspected: null,
  revoked: false,
  revoked_note: null,
  permit: null,
  ...over,
});

const body = (over: Record<string, unknown> = {}) => ({
  name: "สถานีใหม่",
  freq: 101.25,
  lat: 15.1,
  long: 102.0,
  district: "โนนสูง",
  province: "นครราชสีมา",
  type: "บริการชุมชน",
  ...over,
});

function req(method: string, payload?: unknown, url = "http://x/api/admin/stations") {
  return new NextRequest(url, {
    method,
    body: payload === undefined ? undefined : JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function asAdmin() {
  const c = await mintAdminCookie();
  cookieStore.set(COOKIE_NAME, c.value);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(userRow() as any);
}

async function asInspector() {
  const c = await mintCookie({ role: "inspector", userId: 9 });
  cookieStore.set(COOKIE_NAME, c.value);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(
    userRow({ id: 9, role: "inspector" }) as any
  );
}

beforeEach(() => {
  process.env.SESSION_PASSWORD = "test-session-password-32-chars-or-more!!!";
  cookieStore.clear();
  vi.mocked(prisma.fm_station.findMany).mockReset();
  vi.mocked(prisma.fm_station.findFirst).mockReset();
  vi.mocked(prisma.fm_station.findUnique).mockReset();
  vi.mocked(prisma.fm_station.create).mockReset();
  vi.mocked(prisma.fm_station.update).mockReset();
  vi.mocked(prisma.fm_station.delete).mockReset();
  vi.mocked(prisma.data_change.create).mockReset();
  vi.mocked(prisma.user.findUnique).mockReset();
});

describe("admin station routes: access", () => {
  it("refuses anonymous callers with 401 on every method", async () => {
    expect((await GET()).status).toBe(401);
    expect((await POST(req("POST", body()))).status).toBe(401);
    expect((await PATCH(req("PATCH", body()), ctx("10"))).status).toBe(401);
    expect((await DELETE(req("DELETE"), ctx("10"))).status).toBe(401);
  });

  it("refuses inspectors with 403 and writes nothing", async () => {
    await asInspector();
    expect((await GET()).status).toBe(403);
    expect((await POST(req("POST", body()))).status).toBe(403);
    expect((await PATCH(req("PATCH", body()), ctx("10"))).status).toBe(403);
    expect((await DELETE(req("DELETE"), ctx("10"))).status).toBe(403);
    expect(prisma.fm_station.create).not.toHaveBeenCalled();
    expect(prisma.fm_station.update).not.toHaveBeenCalled();
    expect(prisma.fm_station.delete).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/stations", () => {
  it("lists stations camelCased with their inspection count", async () => {
    await asAdmin();
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([
      { ...stationRow(), _count: { inspections: 3 } },
    ] as any);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stations[0]).toMatchObject({
      id: 10,
      idFm: "RFXL680004",
      registerStationId: 5550002,
      name: "สถานีเดิม",
      freq: 99.5,
      submitRequest: true,
      inspectionCount: 3,
    });
  });
});

describe("POST /api/admin/stations", () => {
  it("creates the station and logs it in the same transaction", async () => {
    await asAdmin();
    vi.mocked(prisma.fm_station.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([]);
    vi.mocked(prisma.fm_station.create).mockResolvedValue(stationRow({ id: 77 }) as any);

    const res = await POST(req("POST", body()));
    expect(res.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(vi.mocked(prisma.fm_station.create).mock.calls[0][0].data).toMatchObject({
      name: "สถานีใหม่",
      freq: 101.25,
      province: "นครราชสีมา",
    });
    expect(vi.mocked(prisma.data_change.create).mock.calls[0][0].data).toMatchObject({
      table_name: "fm_station",
      row_id: 77,
      action: "create",
      user_id: 1,
    });
  });

  it("returns field errors and writes nothing on invalid input", async () => {
    await asAdmin();
    const res = await POST(req("POST", body({ freq: 120, province: "บุรีรัมย์" })));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("validation_error");
    expect(Object.keys(json.fields)).toEqual(expect.arrayContaining(["freq", "province"]));
    expect(prisma.fm_station.create).not.toHaveBeenCalled();
  });

  it("refuses an id_fm that another station already holds", async () => {
    await asAdmin();
    vi.mocked(prisma.fm_station.findFirst).mockResolvedValue(stationRow() as any);
    const res = await POST(req("POST", body({ idFm: "RFXL680004" })));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("id_fm_taken");
    expect(prisma.fm_station.create).not.toHaveBeenCalled();
  });

  it("warns on the same freq + district, and lets force override it", async () => {
    await asAdmin();
    vi.mocked(prisma.fm_station.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([stationRow()] as any);

    const warn = await POST(req("POST", body({ freq: 99.5, district: "เมืองนครราชสีมา" })));
    expect(warn.status).toBe(409);
    const json = await warn.json();
    expect(json.error).toBe("possible_duplicate");
    expect(json.matches[0]).toMatchObject({ id: 10, name: "สถานีเดิม" });
    expect(prisma.fm_station.create).not.toHaveBeenCalled();

    vi.mocked(prisma.fm_station.create).mockResolvedValue(stationRow({ id: 78 }) as any);
    const forced = await POST(
      req("POST", { ...body({ freq: 99.5, district: "เมืองนครราชสีมา" }), force: true })
    );
    expect(forced.status).toBe(201);
  });
});

describe("PATCH /api/admin/stations/[id]", () => {
  it("returns 404 for an unknown station", async () => {
    await asAdmin();
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);
    const res = await PATCH(req("PATCH", body()), ctx("999"));
    expect(res.status).toBe(404);
  });

  it("updates and logs before/after", async () => {
    await asAdmin();
    const before = stationRow();
    const after = stationRow({ name: "ชื่อใหม่" });
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(before as any);
    vi.mocked(prisma.fm_station.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.fm_station.update).mockResolvedValue(after as any);

    const res = await PATCH(
      req("PATCH", body({ name: "ชื่อใหม่", freq: 99.5, district: "เมืองนครราชสีมา", idFm: "RFXL680004" })),
      ctx("10")
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.fm_station.update).mock.calls[0][0].where).toEqual({ id: 10 });
    const log = vi.mocked(prisma.data_change.create).mock.calls[0][0].data;
    expect(log).toMatchObject({ action: "update", row_id: 10, user_id: 1 });
    expect(log.before).toMatchObject({ name: "สถานีเดิม" });
    expect(log.after).toMatchObject({ name: "ชื่อใหม่" });
  });

  it("never writes the columns the toggles and register sync own", async () => {
    await asAdmin();
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(stationRow() as any);
    vi.mocked(prisma.fm_station.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([]);
    vi.mocked(prisma.fm_station.update).mockResolvedValue(stationRow() as any);

    await PATCH(
      req("PATCH", {
        ...body(),
        onAir: false,
        inspection69: true,
        registerStationId: 1,
        on_air: false,
        register_station_id: 1,
      }),
      ctx("10")
    );
    const data = vi.mocked(prisma.fm_station.update).mock.calls[0][0].data;
    for (const k of ["on_air", "inspection_69", "date_inspected", "register_station_id"]) {
      expect(data).not.toHaveProperty(k);
    }
  });

  it("does not warn about a duplicate when freq and district are unchanged", async () => {
    await asAdmin();
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(stationRow() as any);
    vi.mocked(prisma.fm_station.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.fm_station.findMany).mockResolvedValue([stationRow({ id: 11 })] as any);
    vi.mocked(prisma.fm_station.update).mockResolvedValue(stationRow() as any);

    const res = await PATCH(
      req("PATCH", body({ freq: 99.5, district: "เมืองนครราชสีมา" })),
      ctx("10")
    );
    expect(res.status).toBe(200);
  });

  it("refuses an id_fm held by a different station", async () => {
    await asAdmin();
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(stationRow() as any);
    vi.mocked(prisma.fm_station.findFirst).mockResolvedValue(stationRow({ id: 11 }) as any);
    const res = await PATCH(req("PATCH", body({ idFm: "TAKEN" })), ctx("10"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("id_fm_taken");
    const where = vi.mocked(prisma.fm_station.findFirst).mock.calls[0][0]?.where;
    expect(where).toMatchObject({ id_fm: "TAKEN", NOT: { id: 10 } });
  });
});

describe("DELETE /api/admin/stations/[id]", () => {
  it("returns 404 for an unknown station", async () => {
    await asAdmin();
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue(null);
    expect((await DELETE(req("DELETE"), ctx("999"))).status).toBe(404);
  });

  it("blocks deleting a station that has inspection history", async () => {
    await asAdmin();
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({
      ...stationRow(),
      _count: { inspections: 2 },
    } as any);
    const res = await DELETE(req("DELETE"), ctx("10"));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "has_inspections", count: 2 });
    expect(prisma.fm_station.delete).not.toHaveBeenCalled();
  });

  it("deletes a station with no history and logs the full row", async () => {
    await asAdmin();
    vi.mocked(prisma.fm_station.findUnique).mockResolvedValue({
      ...stationRow(),
      _count: { inspections: 0 },
    } as any);
    vi.mocked(prisma.fm_station.delete).mockResolvedValue(stationRow() as any);

    const res = await DELETE(req("DELETE"), ctx("10"));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.fm_station.delete).mock.calls[0][0].where).toEqual({ id: 10 });
    const log = vi.mocked(prisma.data_change.create).mock.calls[0][0].data;
    expect(log).toMatchObject({ action: "delete", row_id: 10, table_name: "fm_station" });
    expect(log.before).toMatchObject({ id_fm: "RFXL680004", name: "สถานีเดิม" });
    expect(log.before).not.toHaveProperty("_count");
  });

  it("rejects a non-numeric id", async () => {
    await asAdmin();
    expect((await DELETE(req("DELETE"), ctx("abc"))).status).toBe(400);
  });
});
