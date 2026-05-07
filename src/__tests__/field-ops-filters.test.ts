import { describe, it, expect } from "vitest";
import { fmStationMatchesFilter } from "@/components/field-ops/FieldOpsClient";
import { DEFAULT_FILTERS } from "@/components/field-ops/FieldOpsFilters";
import type { FMStation } from "@/types/station";

function makeStation(overrides: Partial<FMStation> = {}): FMStation {
  return {
    id: 1,
    name: "Test",
    frequency: 100.0,
    latitude: 13.7,
    longitude: 100.5,
    city: "City",
    state: "State",
    genre: "Music",
    inspection69: "ยังไม่ตรวจ",
    onAir: true,
    revoked: false,
    ...overrides,
  } as FMStation;
}

describe("fmStationMatchesFilter", () => {
  it("returns true under default filters for a normal on-air station", () => {
    expect(fmStationMatchesFilter(makeStation(), DEFAULT_FILTERS)).toBe(true);
  });

  it("OFF AIR filter excludes on-air rows", () => {
    const filters = { ...DEFAULT_FILTERS, offAir: true };
    expect(fmStationMatchesFilter(makeStation({ onAir: true }), filters)).toBe(false);
  });

  it("OFF AIR filter excludes revoked rows (disjoint from REVOKED)", () => {
    const filters = { ...DEFAULT_FILTERS, offAir: true };
    const s = makeStation({ onAir: false, revoked: true });
    expect(fmStationMatchesFilter(s, filters)).toBe(false);
  });

  it("OFF AIR filter includes naturally off-air rows (revoked=false)", () => {
    const filters = { ...DEFAULT_FILTERS, offAir: true };
    const s = makeStation({ onAir: false, revoked: false });
    expect(fmStationMatchesFilter(s, filters)).toBe(true);
  });

  it("REVOKED filter excludes non-revoked rows", () => {
    const filters = { ...DEFAULT_FILTERS, revoked: true };
    expect(fmStationMatchesFilter(makeStation({ revoked: false }), filters)).toBe(false);
  });

  it("REVOKED filter includes revoked rows regardless of onAir", () => {
    const filters = { ...DEFAULT_FILTERS, revoked: true };
    expect(fmStationMatchesFilter(makeStation({ revoked: true, onAir: true }), filters)).toBe(true);
    expect(fmStationMatchesFilter(makeStation({ revoked: true, onAir: false }), filters)).toBe(true);
  });

  it("OFF AIR + REVOKED both on: only revoked-and-off-air rows match", () => {
    // Both filters are AND-ed. Since OFF AIR now excludes revoked, this
    // combination is intentionally empty — useful to assert disjointness.
    const filters = { ...DEFAULT_FILTERS, offAir: true, revoked: true };
    expect(fmStationMatchesFilter(makeStation({ revoked: true, onAir: false }), filters)).toBe(false);
    expect(fmStationMatchesFilter(makeStation({ revoked: false, onAir: false }), filters)).toBe(false);
  });
});
