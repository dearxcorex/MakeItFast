import { describe, it, expect } from "vitest";
import { bucketForStation, bucketForSite } from "@/utils/pinBucket";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

function makeFM(o: Partial<FMStation> = {}): FMStation {
  return {
    id: 1,
    name: "T",
    frequency: 100,
    latitude: 13.7,
    longitude: 100.5,
    city: "C",
    state: "S",
    genre: "",
    inspection69: "ยังไม่ตรวจ",
    onAir: true,
    revoked: false,
    ...o,
  } as FMStation;
}

function makeINT(o: Partial<InterferenceSite> = {}): InterferenceSite {
  return {
    id: 1,
    siteName: null,
    siteCode: null,
    cellName: null,
    sectorName: null,
    changwat: null,
    lat: 13.7,
    long: 100.5,
    sourceLat: null,
    sourceLong: null,
    estimateDistance: null,
    ranking: null,
    status: "ยังไม่ตรวจ",
    direction: null,
    lawPaperSent: false,
    updatedAt: null,
    ...o,
  } as unknown as InterferenceSite;
}

describe("bucketForStation", () => {
  it("revoked FM → critical, even if inspected", () => {
    expect(bucketForStation(makeFM({ revoked: true }))).toBe("critical");
    expect(
      bucketForStation(makeFM({ revoked: true, inspection69: "ตรวจแล้ว" }))
    ).toBe("critical");
  });

  it("inspected non-revoked FM → inspected", () => {
    expect(
      bucketForStation(makeFM({ inspection69: "ตรวจแล้ว", revoked: false }))
    ).toBe("inspected");
  });

  it("non-revoked, not-yet-inspected FM → pending", () => {
    expect(
      bucketForStation(makeFM({ inspection69: "ยังไม่ตรวจ", revoked: false }))
    ).toBe("pending");
  });
});

describe("bucketForSite", () => {
  it("inspected INT → inspected, regardless of ranking", () => {
    expect(
      bucketForSite(makeINT({ status: "ตรวจแล้ว", ranking: "Critical" }))
    ).toBe("inspected");
    expect(
      bucketForSite(makeINT({ status: "ตรวจแล้ว", ranking: "Minor" }))
    ).toBe("inspected");
  });

  it("pending Critical INT → critical (case-insensitive on ranking)", () => {
    expect(
      bucketForSite(makeINT({ status: "ยังไม่ตรวจ", ranking: "Critical" }))
    ).toBe("critical");
    expect(
      bucketForSite(makeINT({ status: "ยังไม่ตรวจ", ranking: "critical" }))
    ).toBe("critical");
  });

  it("pending non-Critical INT → pending", () => {
    expect(
      bucketForSite(makeINT({ status: "ยังไม่ตรวจ", ranking: "Major" }))
    ).toBe("pending");
    expect(
      bucketForSite(makeINT({ status: "ยังไม่ตรวจ", ranking: null }))
    ).toBe("pending");
  });
});
