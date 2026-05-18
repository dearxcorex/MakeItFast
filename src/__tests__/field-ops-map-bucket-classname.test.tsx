import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { FieldOpsMap } from "@/components/field-ops/FieldOpsMap";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

const capturedClassNames: string[] = [];

vi.mock("react-leaflet", () => {
  return {
    MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TileLayer: () => null,
    Marker: ({ icon }: { icon?: { options?: { className?: string } } }) => {
      if (icon?.options?.className) capturedClassNames.push(icon.options.className);
      return null;
    },
    Polyline: () => null,
    useMap: () => ({
      flyTo: vi.fn(),
      setView: vi.fn(),
      getZoom: () => 13,
      getContainer: () => ({ style: { cursor: "" } }),
    }),
    useMapEvents: () => null,
  };
});

vi.mock("react-leaflet-cluster", () => {
  return { default: ({ children }: { children: ReactNode }) => <>{children}</> };
});

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

describe("FieldOpsMap — marker fo-bucket--* invariant", () => {
  it("every rendered FM marker carries its fo-bucket--* class", () => {
    capturedClassNames.length = 0;
    const stations: FMStation[] = [
      makeFM({ id: 1, latitude: 13.7, longitude: 100.5, revoked: true }),
      makeFM({ id: 2, latitude: 14.0, longitude: 100.7, inspection69: "ตรวจแล้ว" }),
      makeFM({ id: 3, latitude: 14.3, longitude: 100.9 }),
    ];
    render(
      <FieldOpsMap
        stations={stations}
        interference={[]}
        selection={null}
        onSelect={vi.fn()}
        flyTarget={null}
      />
    );
    const fmClassNames = capturedClassNames.filter((c) => c.includes("fo-marker--fm"));
    expect(fmClassNames).toHaveLength(3);
    expect(fmClassNames.some((c) => c.includes("fo-bucket--critical"))).toBe(true);
    expect(fmClassNames.some((c) => c.includes("fo-bucket--inspected"))).toBe(true);
    expect(fmClassNames.some((c) => c.includes("fo-bucket--pending"))).toBe(true);
  });

  it("every rendered INT marker carries its fo-bucket--* class", () => {
    capturedClassNames.length = 0;
    const sites: InterferenceSite[] = [
      makeINT({ id: 1, lat: 13.7, long: 100.5, status: "ยังไม่ตรวจ", ranking: "Critical" }),
      makeINT({ id: 2, lat: 14.0, long: 100.7, status: "ยังไม่ตรวจ", ranking: "Minor" }),
      makeINT({ id: 3, lat: 14.3, long: 100.9, status: "ตรวจแล้ว", ranking: "Critical" }),
    ];
    render(
      <FieldOpsMap
        stations={[]}
        interference={sites}
        selection={null}
        onSelect={vi.fn()}
        flyTarget={null}
      />
    );
    const intClassNames = capturedClassNames.filter((c) => c.includes("fo-marker--int"));
    expect(intClassNames).toHaveLength(3);
    expect(intClassNames.some((c) => c.includes("fo-bucket--critical"))).toBe(true);
    expect(intClassNames.some((c) => c.includes("fo-bucket--pending"))).toBe(true);
    expect(intClassNames.some((c) => c.includes("fo-bucket--inspected"))).toBe(true);
  });
});
