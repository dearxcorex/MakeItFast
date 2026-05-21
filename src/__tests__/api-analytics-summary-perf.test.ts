import { describe, it, expect, vi, beforeEach } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: queryRaw,
    fm_station: {
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
      findMany: vi.fn(async () => []),
    },
    interference_site: {
      count: vi.fn(async () => 0),
      groupBy: vi.fn(async () => []),
      findMany: vi.fn(async () => []),
    },
  },
}));

import { GET } from "@/app/api/analytics/summary/route";

describe("/api/analytics/summary perf", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("uses $queryRaw for the FM frequency band aggregation", async () => {
    queryRaw.mockResolvedValueOnce([
      { band: "88-90", count: 12n },
      { band: "100-102", count: 7n },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    // The route must call $queryRaw exactly once for the band aggregation.
    expect(queryRaw).toHaveBeenCalledTimes(1);
    // The shape must still be 10 bands in ascending order, filled with 0s.
    expect(body.fmFrequencyDistribution).toEqual([
      { band: "88-90", count: 12 },
      { band: "90-92", count: 0 },
      { band: "92-94", count: 0 },
      { band: "94-96", count: 0 },
      { band: "96-98", count: 0 },
      { band: "98-100", count: 0 },
      { band: "100-102", count: 7 },
      { band: "102-104", count: 0 },
      { band: "104-106", count: 0 },
      { band: "106-108", count: 0 },
    ]);
  });
});
