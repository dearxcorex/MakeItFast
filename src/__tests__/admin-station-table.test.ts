import { describe, it, expect } from "vitest";
import { filterAdminStations, sortAdminStations } from "@/utils/adminStationTable";
import type { AdminStation } from "@/types/station";

const row = (over: Partial<AdminStation>): AdminStation => ({
  id: 1,
  idFm: null,
  registerStationId: null,
  name: "",
  freq: 100,
  lat: 15,
  long: 102,
  district: "",
  province: "นครราชสีมา",
  type: "บริการธุรกิจ",
  permit: null,
  submitRequest: false,
  revoked: false,
  revokedNote: null,
  onAir: false,
  inspected: false,
  inspectionCount: 0,
  ...over,
});

const rows = [
  row({ id: 1, name: "เสียงโคราช", idFm: "RFXL1", freq: 99.5, district: "โนนสูง" }),
  row({ id: 2, name: "ชัยภูมิเรดิโอ", idFm: null, freq: 101.25, province: "ชัยภูมิ", district: "เมืองชัยภูมิ" }),
  row({ id: 3, name: "Korat FM", idFm: "5520001", freq: 88.0, district: "ปากช่อง" }),
];

describe("filterAdminStations", () => {
  it("returns everything with no search and All provinces", () => {
    expect(filterAdminStations(rows, { search: "", province: "All" })).toHaveLength(3);
  });

  it("matches name, id_fm, freq and district case-insensitively", () => {
    const ids = (q: string) => filterAdminStations(rows, { search: q, province: "All" }).map((r) => r.id);
    expect(ids("korat")).toEqual([3]);
    expect(ids("rfxl")).toEqual([1]);
    expect(ids("101.25")).toEqual([2]);
    expect(ids("ปากช่อง")).toEqual([3]);
  });

  it("filters by province", () => {
    expect(filterAdminStations(rows, { search: "", province: "ชัยภูมิ" }).map((r) => r.id)).toEqual([2]);
  });
});

describe("sortAdminStations", () => {
  it("sorts numbers numerically in both directions", () => {
    expect(sortAdminStations(rows, "freq", "asc").map((r) => r.id)).toEqual([3, 1, 2]);
    expect(sortAdminStations(rows, "freq", "desc").map((r) => r.id)).toEqual([2, 1, 3]);
  });

  it("puts missing values last regardless of direction", () => {
    expect(sortAdminStations(rows, "idFm", "asc").at(-1)?.id).toBe(2);
    expect(sortAdminStations(rows, "idFm", "desc").at(-1)?.id).toBe(2);
  });

  it("does not mutate its input", () => {
    const copy = [...rows];
    sortAdminStations(rows, "name", "desc");
    expect(rows).toEqual(copy);
  });
});
