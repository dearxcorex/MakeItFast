import { describe, it, expect } from "vitest";
import type { CameraSource } from "@/types/camera";
import type { CellSite } from "@/utils/cellSites";
import {
  cameraDate,
  cameraMatchesFilter,
  findCameraCellSite,
  parseCameraRows,
  planCameraImport,
} from "@/utils/cameraSources";
import { cameraPin } from "@/utils/cameraPin";
import { computeKpis } from "@/utils/fieldOpsKpi";
import { convertToCameraSource } from "@/services/cameraSourceService";

const row = (o: Record<string, unknown> = {}) => ({
  Latitude: 14.65,
  Longitude: 101.3,
  Code: "KGDGM_3",
  Date: 46168,
  "อำเภอ": "ปากช่อง",
  "จุดเด่น": null,
  "จังหวัด": "โคราช",
  ...o,
});

const camera = (o: Partial<CameraSource> = {}): CameraSource => ({
  id: 1,
  code: "KGDGM_3",
  lat: 14.65,
  lng: 101.3,
  foundOn: "2026-05-26",
  district: "ปากช่อง",
  province: "นครราชสีมา",
  landmark: "มทส",
  cellSite: { code: "878041_KGDGM", name: "กลางดง", lat: 14.654, lng: 101.31, operators: ["AWN", "NT"] },
  status: "ยังไม่ตรวจ",
  inspectedAt: null,
  inspectedByName: null,
  ...o,
});

const FILTERS = { type: "ALL", province: "All", status: "ALL", search: "" };

describe("parseCameraRows", () => {
  it("stores โคราช as นครราชสีมา and reads the Excel date", () => {
    const { cameras, skipped } = parseCameraRows([row()]);
    expect(skipped).toEqual([]);
    expect(cameras[0]).toMatchObject({ province: "นครราชสีมา", foundOn: "2026-05-26", landmark: null });
  });

  it("skips and reports a row outside coverage", () => {
    const { cameras, skipped } = parseCameraRows([row({ Code: "SUNNM_3", "จังหวัด": "สระบุรี" })]);
    expect(cameras).toEqual([]);
    expect(skipped[0].code).toBe("SUNNM_3");
    expect(skipped[0].reason).toContain("outside coverage");
  });

  it("rejects bad coordinates, bad dates and duplicate codes", () => {
    const { cameras, skipped } = parseCameraRows([
      row({ Code: "A_1", Latitude: "x" }),
      row({ Code: "B_1", Date: "soon" }),
      row({ Code: "C_1" }),
      row({ Code: "C_1" }),
    ]);
    expect(cameras.map((c) => c.code)).toEqual(["C_1"]);
    expect(skipped.map((s) => s.reason)).toEqual(["invalid coordinates", "invalid date", "duplicate code"]);
  });

  it("does not shift a Date across midnight", () => {
    expect(cameraDate(new Date("2026-10-22T00:00:00.000Z"))).toBe("2026-10-22");
  });
});

describe("findCameraCellSite", () => {
  const site: CellSite = {
    province: "นครราชสีมา",
    lat: 14.654,
    lng: 101.311,
    operators: ["AWN", "NT"],
    licences: {
      AWN: [{ licenseNo: "1", stationCode: "878041 กลางดง" }],
      NT: [{ licenseNo: "2", stationCode: "878041_KGDGM" }],
      TUC: [],
    },
  };

  it("links on the code before the sector and uses the readable name", () => {
    expect(findCameraCellSite("KGDGM_3", [site])).toMatchObject({
      code: "878041_KGDGM",
      name: "กลางดง",
      operators: ["AWN", "NT"],
    });
  });

  it("returns null for an unknown code, and never matches part of a code", () => {
    expect(findCameraCellSite("YNSDW_1", [site])).toBeNull();
    expect(findCameraCellSite("KGDG_1", [site])).toBeNull();
  });
});

describe("planCameraImport", () => {
  it("adds, updates, and reports missing rows without deleting them", () => {
    const { cameras } = parseCameraRows([row({ Code: "A_1" }), row({ Code: "B_1" })]);
    const plan = planCameraImport(cameras, ["B_1", "GONE_1"]);
    expect(plan.toAdd.map((c) => c.code)).toEqual(["A_1"]);
    expect(plan.toUpdate.map((c) => c.code)).toEqual(["B_1"]);
    expect(plan.missingFromFile).toEqual(["GONE_1"]);
  });
});

describe("cameraMatchesFilter", () => {
  it("shows under ทั้งหมด and กล้อง, not under FM or รบกวน", () => {
    expect(cameraMatchesFilter(camera(), FILTERS)).toBe(true);
    expect(cameraMatchesFilter(camera(), { ...FILTERS, type: "CAMERA" })).toBe(true);
    expect(cameraMatchesFilter(camera(), { ...FILTERS, type: "FM" })).toBe(false);
    expect(cameraMatchesFilter(camera(), { ...FILTERS, type: "INT" })).toBe(false);
  });

  it("applies status, province and search", () => {
    const done = camera({ status: "ตรวจแล้ว" });
    expect(cameraMatchesFilter(done, { ...FILTERS, status: "PENDING" })).toBe(false);
    expect(cameraMatchesFilter(done, { ...FILTERS, status: "INSPECTED" })).toBe(true);
    expect(cameraMatchesFilter(camera(), { ...FILTERS, province: "ชัยภูมิ" })).toBe(false);
    for (const search of ["kgdgm", "ปากช่อง", "มทส", "กลางดง"]) {
      expect(cameraMatchesFilter(camera(), { ...FILTERS, search })).toBe(true);
    }
    expect(cameraMatchesFilter(camera(), { ...FILTERS, search: "ไม่มี" })).toBe(false);
  });
});

describe("cameraPin", () => {
  it("is red with a bell until inspected, then green without one", () => {
    const open = cameraPin(false, false);
    expect(open.html).toContain("#ff5b4a");
    expect(open.html).toContain("fo-camera-bell");
    const done = cameraPin(true, false);
    expect(done.html).toContain("#00684a");
    expect(done.html).not.toContain("fo-camera-bell");
  });

  it("carries no bucket class, so it can never count in a cluster ring", () => {
    expect(cameraPin(false, false).className).not.toContain("fo-bucket--");
  });
});

describe("computeKpis with cameras", () => {
  const cams = [camera(), camera({ id: 2, status: "ตรวจแล้ว" })];

  it("tallies cameras under the กล้อง chip", () => {
    expect(computeKpis([], [], "CAMERA", cams)).toMatchObject({ total: 2, inspected: 1, pending: 1, pct: 50, critical: null });
  });

  it("keeps cameras out of the FM + interference progress", () => {
    expect(computeKpis([], [], "ALL", cams).total).toBe(0);
  });
});

describe("convertToCameraSource", () => {
  const base = {
    id: 1, code: "YNSDW_1", lat: 15.1, long: 102.3, found_on: new Date("2026-06-23T00:00:00.000Z"),
    district: "โนนสูง", province: "นครราชสีมา", landmark: null, cell_site_code: null, cell_site_name: null,
    cell_site_lat: null, cell_site_long: null, cell_site_operators: null, status: "ยังไม่ตรวจ", inspected_at: null,
  };

  it("maps a row with no linked cell site", () => {
    expect(convertToCameraSource(base)).toMatchObject({ lng: 102.3, foundOn: "2026-06-23", cellSite: null });
  });

  it("maps the linked cell site and inspector", () => {
    const out = convertToCameraSource({
      ...base, cell_site_code: "878_X", cell_site_name: "X", cell_site_lat: 15, cell_site_long: 102,
      cell_site_operators: "AWN|NT", status: "ตรวจแล้ว", inspected_at: new Date("2026-11-23T01:00:00.000Z"),
      inspector: { display_name: "ผู้ตรวจ" },
    });
    expect(out.cellSite?.operators).toEqual(["AWN", "NT"]);
    expect(out.inspectedByName).toBe("ผู้ตรวจ");
  });
});
