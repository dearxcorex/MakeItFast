import { describe, it, expect } from "vitest";
import {
  bucketForStation,
  bucketForSite,
  showsInspectedBadge,
  NO_INSPECTED_BADGES,
} from "@/utils/pinBucket";
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

  it("off-air FM → offair, and stays offair once inspected", () => {
    expect(bucketForStation(makeFM({ onAir: false }))).toBe("offair");
    expect(
      bucketForStation(makeFM({ onAir: false, inspection69: "ตรวจแล้ว" }))
    ).toBe("offair");
  });

  it("revoked outranks off-air", () => {
    expect(
      bucketForStation(makeFM({ onAir: false, revoked: true }))
    ).toBe("critical");
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

describe("showsInspectedBadge", () => {
  const ALL_ON = { revoked: true, offAir: true };
  const inspectedRevoked = makeFM({ revoked: true, inspection69: "ตรวจแล้ว" });
  const inspectedOffAir = makeFM({ onAir: false, inspection69: "ตรวจแล้ว" });

  it("badges an inspected revoked pin only while the REVOKED chip is on", () => {
    expect(showsInspectedBadge([inspectedRevoked], { revoked: true, offAir: false })).toBe(true);
    expect(showsInspectedBadge([inspectedRevoked], { revoked: false, offAir: true })).toBe(false);
    expect(showsInspectedBadge([inspectedRevoked], NO_INSPECTED_BADGES)).toBe(false);
  });

  it("badges an inspected off-air pin only while the OFF AIR chip is on", () => {
    expect(showsInspectedBadge([inspectedOffAir], { revoked: false, offAir: true })).toBe(true);
    expect(showsInspectedBadge([inspectedOffAir], { revoked: true, offAir: false })).toBe(false);
  });

  it("never badges a pin that has not been inspected", () => {
    expect(showsInspectedBadge([makeFM({ revoked: true })], ALL_ON)).toBe(false);
    expect(showsInspectedBadge([makeFM({ onAir: false })], ALL_ON)).toBe(false);
  });

  it("never badges pending or inspected buckets — their glyph already says it", () => {
    expect(showsInspectedBadge([makeFM({ inspection69: "ตรวจแล้ว" })], ALL_ON)).toBe(false);
    expect(showsInspectedBadge([makeFM()], ALL_ON)).toBe(false);
  });

  it("badges a stack only when every station in it is inspected", () => {
    const partly = [inspectedRevoked, makeFM({ id: 2, revoked: true })];
    const all = [inspectedRevoked, makeFM({ id: 2, revoked: true, inspection69: "ตรวจแล้ว" })];
    expect(showsInspectedBadge(partly, ALL_ON)).toBe(false);
    expect(showsInspectedBadge(all, ALL_ON)).toBe(true);
  });

  it("handles an empty group", () => {
    expect(showsInspectedBadge([], ALL_ON)).toBe(false);
  });
});
