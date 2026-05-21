import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => {
  const fm_station = {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  };
  const interference_site = { findMany: vi.fn() };
  return { default: { fm_station, interference_site } };
});

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => ({ userId: 1, displayName: "Tester" })),
}));

vi.mock("@/services/stationService", () => ({
  convertToFMStation: (r: unknown) => r,
}));
vi.mock("@/services/interferenceService", () => ({
  convertToInterferenceSite: (r: unknown) => r,
}));

import prisma from "@/lib/prisma";
import FieldOpsFetcher from "@/components/field-ops/FieldOpsFetcher";

const mockedFm = prisma.fm_station as unknown as {
  findMany: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
};
const mockedInt = prisma.interference_site as unknown as {
  findMany: ReturnType<typeof vi.fn>;
};

describe("FieldOpsFetcher", () => {
  beforeEach(() => {
    mockedFm.findMany.mockReset();
    mockedFm.groupBy.mockReset();
    mockedInt.findMany.mockReset();
  });

  it("issues exactly three Prisma calls and merges province sources", async () => {
    mockedFm.findMany.mockResolvedValueOnce([]); // stations
    mockedInt.findMany.mockResolvedValueOnce([
      { changwat: "Bangkok" },
      { changwat: "Chiang Mai" },
    ]);
    mockedFm.groupBy.mockResolvedValueOnce([
      { district: "Khlong Toei", province: "Bangkok" },
      { district: "Mueang", province: "Chiang Mai" },
      { district: null, province: "Phuket" },
    ]);

    const result = await FieldOpsFetcher();
    // The returned JSX is a React element of FieldOpsClient — its `props` carry
    // the initial* arrays we want to assert against.
    // @ts-expect-error — vitest jsx escape hatch
    const props = result.props;

    expect(mockedFm.findMany).toHaveBeenCalledTimes(1);
    expect(mockedFm.groupBy).toHaveBeenCalledTimes(1);
    expect(mockedInt.findMany).toHaveBeenCalledTimes(1);

    expect(props.initialCities).toEqual(["Khlong Toei", "Mueang"]);
    expect(props.initialProvinces).toEqual(
      ["Bangkok", "Chiang Mai", "Phuket"].sort()
    );
  });
});
