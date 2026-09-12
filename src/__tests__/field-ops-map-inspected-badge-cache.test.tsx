import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { FieldOpsMap } from "@/components/field-ops/FieldOpsMap";
import { BADGE_INSPECTED } from "@/utils/pinTokens";
import type { InspectedBadgeGates } from "@/utils/pinBucket";
import type { FMStation } from "@/types/station";

const captured: string[] = [];

vi.mock("react-leaflet", () => {
  return {
    MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TileLayer: () => null,
    Marker: ({ icon }: { icon?: { options?: { html?: string } } }) => {
      if (icon?.options?.html) captured.push(icon.options.html);
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
    inspection69: "ตรวจแล้ว",
    onAir: true,
    revoked: true,
    ...o,
  } as FMStation;
}

/**
 * `fmIconCache` keys every pin it has already built. The badge is the one
 * input to `fmIcon` that comes from outside the station row, so if it is
 * missing from the key a pin drawn before the chip was pressed is handed
 * straight back afterwards — the fix silently does nothing until the marker
 * happens to be rebuilt for some other reason.
 */
describe("FieldOpsMap — inspected badge survives the icon cache", () => {
  it("re-renders the pin when the REVOKED chip flips, nothing else changing", () => {
    const stations = [makeFM()];
    const off: InspectedBadgeGates = { revoked: false, offAir: false };
    const on: InspectedBadgeGates = { revoked: true, offAir: false };

    captured.length = 0;
    const { rerender } = render(
      <FieldOpsMap
        stations={stations}
        interference={[]}
        selection={null}
        onSelect={() => {}}
        flyTarget={null}
        inspectedBadges={off}
      />
    );
    expect(captured.at(-1)).not.toContain(BADGE_INSPECTED);

    rerender(
      <FieldOpsMap
        stations={stations}
        interference={[]}
        selection={null}
        onSelect={() => {}}
        flyTarget={null}
        inspectedBadges={on}
      />
    );
    expect(captured.at(-1)).toContain(BADGE_INSPECTED);

    rerender(
      <FieldOpsMap
        stations={stations}
        interference={[]}
        selection={null}
        onSelect={() => {}}
        flyTarget={null}
        inspectedBadges={off}
      />
    );
    expect(captured.at(-1)).not.toContain(BADGE_INSPECTED);
  });
});
