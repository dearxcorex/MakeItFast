import { describe, it, expect } from "vitest";
import { parseStationInput, STATION_TYPES } from "@/utils/stationInput";

const valid = {
  name: "  สถานีทดสอบ  ",
  freq: 99.5,
  lat: 14.97,
  long: 102.1,
  district: "เมืองนครราชสีมา",
  province: "นครราชสีมา",
  type: "บริการธุรกิจ",
};

describe("parseStationInput", () => {
  it("accepts the required fields and fills optional defaults", () => {
    const r = parseStationInput(valid);
    expect(r).toEqual({
      ok: true,
      data: {
        name: "สถานีทดสอบ",
        freq: 99.5,
        lat: 14.97,
        long: 102.1,
        district: "เมืองนครราชสีมา",
        province: "นครราชสีมา",
        type: "บริการธุรกิจ",
        id_fm: null,
        permit: null,
        submit_a_request: false,
        revoked: false,
        revoked_note: null,
      },
    });
  });

  it("maps the optional fields, trimming and nulling blanks", () => {
    const r = parseStationInput({
      ...valid,
      idFm: " RFXL680004 ",
      permit: "   ",
      submitRequest: true,
      revoked: true,
      revokedNote: "เพิกถอน 2569",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.id_fm).toBe("RFXL680004");
    expect(r.data.permit).toBeNull();
    expect(r.data.submit_a_request).toBe(true);
    expect(r.data.revoked).toBe(true);
    expect(r.data.revoked_note).toBe("เพิกถอน 2569");
  });

  it("drops the revoked note when the station is not revoked", () => {
    const r = parseStationInput({ ...valid, revoked: false, revokedNote: "old" });
    expect(r.ok && r.data.revoked_note).toBeNull();
  });

  it("reports every missing required field at once", () => {
    const r = parseStationInput({});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(
      ["district", "freq", "lat", "long", "name", "province", "type"].sort()
    );
  });

  it("rejects a frequency outside the FM band", () => {
    for (const freq of [87.4, 108.1, NaN]) {
      const r = parseStationInput({ ...valid, freq });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.freq).toBeDefined();
    }
    expect(parseStationInput({ ...valid, freq: 87.5 }).ok).toBe(true);
    expect(parseStationInput({ ...valid, freq: 108 }).ok).toBe(true);
  });

  it("rejects coordinates outside the two provinces, e.g. swapped lat/long", () => {
    const r = parseStationInput({ ...valid, lat: 102.1, long: 14.97 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.lat).toBeDefined();
    const bkk = parseStationInput({ ...valid, lat: 13.75, long: 100.5 });
    expect(bkk.ok).toBe(false);
  });

  it("accepts only the two tracked provinces", () => {
    const r = parseStationInput({ ...valid, province: "บุรีรัมย์" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.province).toBeDefined();
    expect(parseStationInput({ ...valid, province: "ชัยภูมิ", lat: 15.8, long: 102.0 }).ok).toBe(true);
  });

  it("accepts only the known station types", () => {
    expect(STATION_TYPES).toHaveLength(4);
    const r = parseStationInput({ ...valid, type: "สถานีสาขา" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.type).toBeDefined();
  });

  it("rejects a non-object body", () => {
    expect(parseStationInput(null).ok).toBe(false);
    expect(parseStationInput("x").ok).toBe(false);
  });
});
