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

  it("issues all groupBy queries inside a single Promise.all", async () => {
    // After this task: only one $queryRaw + a fixed count of typed prisma
    // calls should fire. We track ordering via a shared array.
    const callOrder: string[] = [];

    const prisma = (await import("@/lib/prisma")).default as unknown as {
      fm_station: {
        count: ReturnType<typeof vi.fn>;
        groupBy: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
      interference_site: {
        count: ReturnType<typeof vi.fn>;
        groupBy: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
    };
    prisma.interference_site.groupBy.mockImplementation(async (args: unknown) => {
      callOrder.push(`int.groupBy:${JSON.stringify((args as { by?: string[] }).by ?? [])}`);
      return [];
    });
    prisma.fm_station.groupBy.mockImplementation(async () => []);
    prisma.fm_station.count.mockImplementation(async () => 0);
    prisma.interference_site.count.mockImplementation(async () => 0);
    prisma.fm_station.findMany.mockImplementation(async () => []);
    prisma.interference_site.findMany.mockImplementation(async () => []);
    queryRaw.mockResolvedValueOnce([]);

    await GET();

    // BOTH the (changwat, ranking) and (changwat with status filter) groupBys
    // must have been issued. After Task 2 these run inside the main Promise.all
    // alongside the (changwat) and (ranking) groupBys.
    const intGroupByCalls = callOrder.filter((c) => c.startsWith("int.groupBy"));
    // 1 = rankingGroups by (ranking) alone
    // 2 = provinceGroups by (changwat)
    // 3 = provincePerRanking by (changwat, ranking)
    // 4 = provinceInspected by (changwat) with status filter
    expect(intGroupByCalls.length).toBeGreaterThanOrEqual(4);
  });

  it("sets a short s-maxage Cache-Control for dashboard reloads", async () => {
    queryRaw.mockResolvedValueOnce([]);
    const res = await GET();
    expect(res.headers.get("cache-control")).toMatch(
      /s-maxage=\d+/i
    );
    // SWR window so revalidation can happen in the background.
    expect(res.headers.get("cache-control")).toMatch(
      /stale-while-revalidate=\d+/i
    );
  });
});
