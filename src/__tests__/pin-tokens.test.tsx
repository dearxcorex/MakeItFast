import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { FieldOpsMap } from "@/components/field-ops/FieldOpsMap";
import {
  PIN_COLORS,
  BADGE_MAIN,
  BADGE_LAW,
  BADGE_INSPECTED,
  BADGE_PARTLY_GLYPH,
  BADGE_PARTLY_TITLE,
  PIN_SELECTION,
} from "@/utils/pinTokens";
import type { InspectedBadgeGates, PinBucket } from "@/utils/pinBucket";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

type Captured = { className: string; html: string };
const captured: Captured[] = [];

vi.mock("react-leaflet", () => {
  return {
    MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TileLayer: () => null,
    Marker: ({ icon }: { icon?: { options?: { className?: string; html?: string } } }) => {
      if (icon?.options?.className) {
        captured.push({
          className: icon.options.className,
          html: icon.options.html ?? "",
        });
      }
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

function draw(
  stations: FMStation[],
  sites: InterferenceSite[] = [],
  inspectedBadges?: InspectedBadgeGates
) {
  captured.length = 0;
  render(
    <FieldOpsMap
      stations={stations}
      interference={sites}
      selection={null}
      onSelect={() => {}}
      flyTarget={null}
      inspectedBadges={inspectedBadges}
    />
  );
  return captured;
}

/** The pin body is the only <path> carrying the teardrop `M12 32` outline. */
function bodyFill(html: string): string | null {
  const m = html.match(/<path d="M12 32[^"]*"\s+fill="([^"]+)"/);
  return m ? m[1] : null;
}

function bucketOf(className: string): PinBucket | null {
  const m = className.match(/fo-bucket--(\w+)/);
  return m ? (m[1] as PinBucket) : null;
}

describe("pin tokens — body fill always matches the marker's bucket", () => {
  it("FM: every state paints the token colour for the bucket it reports", () => {
    const cases: Array<[FMStation, PinBucket]> = [
      [makeFM({ id: 1, revoked: true }), "critical"],
      [makeFM({ id: 5, revoked: true, inspection69: "ตรวจแล้ว" }), "revokedInspected"],
      [makeFM({ id: 6, revoked: true, permit: "x" }), "relicensed"],
      [
        makeFM({ id: 7, revoked: true, permit: "x", inspection69: "ตรวจแล้ว" }),
        "relicensedInspected",
      ],
      [makeFM({ id: 2, onAir: false }), "offair"],
      [makeFM({ id: 3, inspection69: "ตรวจแล้ว" }), "inspected"],
      [makeFM({ id: 4 }), "pending"],
    ];
    for (const [station, expected] of cases) {
      const [pin] = draw([station]);
      expect(bucketOf(pin.className)).toBe(expected);
      expect(bodyFill(pin.html)).toBe(PIN_COLORS[expected]);
    }
  });

  it("INT: every state paints the token colour for the bucket it reports", () => {
    const cases: Array<[InterferenceSite, PinBucket]> = [
      [makeINT({ id: 1, ranking: "Critical" }), "critical"],
      [makeINT({ id: 2, ranking: "Major" }), "pending"],
      [makeINT({ id: 3, ranking: "Minor" }), "pending"],
      [makeINT({ id: 4, ranking: "Critical", status: "ตรวจแล้ว" }), "inspected"],
    ];
    for (const [site, expected] of cases) {
      const [pin] = draw([], [site]);
      expect(bucketOf(pin.className)).toBe(expected);
      expect(bodyFill(pin.html)).toBe(PIN_COLORS[expected]);
    }
  });

  it("an inspected revoked FM darkens but never borrows the inspected green", () => {
    const [pin] = draw([makeFM({ revoked: true, inspection69: "ตรวจแล้ว" })]);
    expect(bodyFill(pin.html)).toBe(PIN_COLORS.revokedInspected);
    expect(pin.html).not.toContain(PIN_COLORS.inspected);
  });

  it("an off-air FM stays grey even once inspected, so it survives clustering", () => {
    const [pin] = draw([makeFM({ onAir: false, inspection69: "ตรวจแล้ว" })]);
    expect(bucketOf(pin.className)).toBe("offair");
    expect(bodyFill(pin.html)).toBe(PIN_COLORS.offair);
  });
});

describe("pin tokens — badges stay orthogonal to state", () => {
  it("the gold star means main station and appears only on FM", () => {
    const [main] = draw([makeFM({ type: "สถานีหลัก" } as Partial<FMStation>)]);
    expect(main.html).toContain(BADGE_MAIN);

    const [plain] = draw([makeFM()]);
    expect(plain.html).not.toContain(BADGE_MAIN);
  });

  it("law-paper-sent uses the document badge, never the main-station gold", () => {
    const [sent] = draw([], [makeINT({ lawPaperSent: true })]);
    expect(sent.html).toContain(BADGE_LAW);
    expect(sent.html).not.toContain(BADGE_MAIN);

    const [unsent] = draw([], [makeINT({ lawPaperSent: false })]);
    expect(unsent.html).not.toContain(BADGE_LAW);
  });
});

describe("pin tokens — the inspected badge is gated by the OFF AIR chip", () => {
  const OFFAIR_ON: InspectedBadgeGates = { offAir: true };

  it("an inspected off-air pin keeps the grey body and gains a green check", () => {
    const station = makeFM({ onAir: false, inspection69: "ตรวจแล้ว" });
    const [pin] = draw([station], [], OFFAIR_ON);
    expect(bodyFill(pin.html)).toBe(PIN_COLORS.offair);
    expect(pin.html).toContain(BADGE_INSPECTED);
    expect(pin.className).toContain("is-inspected-badge");
  });

  it("the same pin wears no badge while the chip is off", () => {
    const [pin] = draw([makeFM({ onAir: false, inspection69: "ตรวจแล้ว" })]);
    expect(pin.html).not.toContain(BADGE_INSPECTED);
  });

  it("an uninspected off-air pin never badges", () => {
    const [pin] = draw([makeFM({ onAir: false })], [], OFFAIR_ON);
    expect(pin.html).not.toContain(BADGE_INSPECTED);
  });

  it("a revoked pin never badges — its colour already carries the visit", () => {
    const [pin] = draw([makeFM({ revoked: true, inspection69: "ตรวจแล้ว" })], [], OFFAIR_ON);
    expect(pin.html).not.toContain(BADGE_INSPECTED);
  });

  it("the badge coexists with the main-station star", () => {
    const station = makeFM({
      onAir: false,
      inspection69: "ตรวจแล้ว",
      type: "สถานีหลัก",
    } as Partial<FMStation>);
    const [pin] = draw([station], [], OFFAIR_ON);
    expect(pin.html).toContain(BADGE_MAIN);
    expect(pin.html).toContain(BADGE_INSPECTED);
  });
});

describe("pin tokens — a partly inspected stack is flagged", () => {
  const done = makeFM({ id: 1, inspection69: "ตรวจแล้ว" });
  const open = makeFM({ id: 2 });

  it("a green head with an uninspected station beneath it gains the split disc", () => {
    const [pin] = draw([done, open]);
    expect(bodyFill(pin.html)).toBe(PIN_COLORS.inspected);
    expect(pin.className).toContain("is-partly-inspected-badge");
    expect(pin.html).toContain(BADGE_PARTLY_GLYPH);
    expect(pin.html).toContain(BADGE_PARTLY_TITLE);
  });

  it("a stack that agrees wears no alert", () => {
    const [allDone] = draw([done, makeFM({ id: 2, inspection69: "ตรวจแล้ว" })]);
    expect(allDone.className).not.toContain("is-partly-inspected-badge");
    expect(allDone.html).not.toContain(BADGE_PARTLY_GLYPH);

    const [allOpen] = draw([makeFM({ id: 1 }), open]);
    expect(allOpen.className).not.toContain("is-partly-inspected-badge");
  });

  it("replaces the inspected badge rather than sharing its corner", () => {
    const [pin] = draw(
      [
        makeFM({ id: 1, onAir: false, inspection69: "ตรวจแล้ว" }),
        makeFM({ id: 2, onAir: false }),
      ],
      [],
      { offAir: true }
    );
    expect(pin.className).toContain("is-partly-inspected-badge");
    expect(pin.className).not.toContain("is-inspected-badge");
  });

  it("still shows when a filter has hidden the uninspected sibling", () => {
    captured.length = 0;
    render(
      <FieldOpsMap
        stations={[done]}
        allStations={[done, open]}
        interference={[]}
        selection={null}
        onSelect={() => {}}
        flyTarget={null}
      />
    );
    expect(captured[0].className).toContain("is-partly-inspected-badge");
  });

  it("halos the pin when the selected station is a sibling the filter hid", () => {
    captured.length = 0;
    render(
      <FieldOpsMap
        stations={[done]}
        allStations={[done, open]}
        interference={[]}
        selection={{ kind: "fm", id: 2 }}
        onSelect={() => {}}
        flyTarget={null}
      />
    );
    expect(captured[0].className).toContain("is-selected");
  });
});

describe("pin tokens — sector wedges follow their own sibling's state", () => {
  it("an inspected sector draws a green wedge next to a pending amber one", () => {
    const [pin] = draw(
      [],
      [
        makeINT({ id: 1, direction: 0, ranking: "Critical" }),
        makeINT({ id: 2, direction: 120, ranking: "Critical", status: "ตรวจแล้ว" }),
      ]
    );
    const wedges = pin.html.match(/M 0 0 L -10 -28 L 10 -28 Z" fill="([^"]+)"/g) ?? [];
    expect(wedges.length).toBe(2);
    expect(wedges.some((w) => w.includes(PIN_COLORS.critical))).toBe(true);
    expect(wedges.some((w) => w.includes(PIN_COLORS.inspected))).toBe(true);
  });
});

describe("pin tokens — selection is a UI state, not a data state", () => {
  it("FM and INT halo in the same colour, which is not a bucket colour", () => {
    const [fm] = draw([makeFM({ id: 7 })]);
    expect(fm.html).not.toContain(PIN_SELECTION);

    const fmSel = (() => {
      captured.length = 0;
      render(
        <FieldOpsMap
          stations={[makeFM({ id: 7 })]}
          interference={[]}
          selection={{ kind: "fm", id: 7 }}
          onSelect={() => {}}
          flyTarget={null}
        />
      );
      return captured[0];
    })();
    expect(fmSel.html).toContain(`stroke="${PIN_SELECTION}"`);

    const intSel = (() => {
      captured.length = 0;
      render(
        <FieldOpsMap
          stations={[]}
          interference={[makeINT({ id: 9, ranking: "Critical" })]}
          selection={{ kind: "int", id: 9 }}
          onSelect={() => {}}
          flyTarget={null}
        />
      );
      return captured[0];
    })();
    expect(intSel.html).toContain(`stroke="${PIN_SELECTION}"`);
  });
});
