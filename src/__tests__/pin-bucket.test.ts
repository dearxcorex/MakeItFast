import { describe, it, expect } from "vitest";
import {
  bucketForStation,
  bucketForSite,
  isRelicensed,
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
  it("revoked FM with no new holder → critical, revokedInspected once visited", () => {
    expect(bucketForStation(makeFM({ revoked: true }))).toBe("critical");
    expect(
      bucketForStation(makeFM({ revoked: true, inspection69: "ตรวจแล้ว" }))
    ).toBe("revokedInspected");
  });

  it("revoked FM with a permit → relicensed, relicensedInspected once visited", () => {
    const permit = "หจก. ก เป็นผู้รับใบอนุญาตให้ใช้คลื่นความถี่รายใหม่";
    expect(bucketForStation(makeFM({ revoked: true, permit }))).toBe("relicensed");
    expect(
      bucketForStation(makeFM({ revoked: true, permit, inspection69: "ตรวจแล้ว" }))
    ).toBe("relicensedInspected");
  });

  it("a blank permit is not a new holder, and a permit means nothing unless revoked", () => {
    expect(bucketForStation(makeFM({ revoked: true, permit: "  " }))).toBe("critical");
    expect(bucketForStation(makeFM({ permit: "x" }))).toBe("pending");
    expect(isRelicensed(makeFM({ permit: "x" }))).toBe(false);
    expect(isRelicensed(makeFM({ revoked: true, permit: "x" }))).toBe(true);
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
  const ON = { offAir: true };
  const inspectedOffAir = makeFM({ onAir: false, inspection69: "ตรวจแล้ว" });

  it("badges an inspected off-air pin only while the OFF AIR chip is on", () => {
    expect(showsInspectedBadge([inspectedOffAir], ON)).toBe(true);
    expect(showsInspectedBadge([inspectedOffAir], NO_INSPECTED_BADGES)).toBe(false);
  });

  it("never badges a pin that has not been inspected", () => {
    expect(showsInspectedBadge([makeFM({ onAir: false })], ON)).toBe(false);
  });

  it("never badges revoked, pending or inspected buckets — their colour already says it", () => {
    expect(showsInspectedBadge([makeFM({ revoked: true, inspection69: "ตรวจแล้ว" })], ON)).toBe(false);
    expect(showsInspectedBadge([makeFM({ revoked: true, permit: "x", inspection69: "ตรวจแล้ว" })], ON)).toBe(false);
    expect(showsInspectedBadge([makeFM({ inspection69: "ตรวจแล้ว" })], ON)).toBe(false);
    expect(showsInspectedBadge([makeFM()], ON)).toBe(false);
  });

  it("badges a stack only when every station in it is inspected", () => {
    const partly = [inspectedOffAir, makeFM({ id: 2, onAir: false })];
    const all = [inspectedOffAir, makeFM({ id: 2, onAir: false, inspection69: "ตรวจแล้ว" })];
    expect(showsInspectedBadge(partly, ON)).toBe(false);
    expect(showsInspectedBadge(all, ON)).toBe(true);
  });

  it("handles an empty group", () => {
    expect(showsInspectedBadge([], ON)).toBe(false);
  });
});
