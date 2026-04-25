"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

export type FieldSelection =
  | { kind: "fm"; id: string | number }
  | { kind: "int"; id: number }
  | null;

const THAILAND_CENTER: [number, number] = [13.7563, 100.5018];

function isMainStation(s: FMStation): boolean {
  return s.type === "สถานีหลัก" || s.genre === "สถานีหลัก";
}

/**
 * FM marker — clean teardrop pin, ~24px tall, with distinct glyphs per state.
 *  - PENDING (not inspected): solid neon green + white ring + tiny inner dot
 *  - INSPECTED: solid dark green + white ring + white ✓ glyph
 *  - OFF-AIR: solid grey + white ring + ⊘ glyph
 *  - MAIN STATION (สถานีหลัก): gold ★ badge upper-right
 *  - STACKED (multiple stations at same coords): "+N" badge upper-left
 */
function fmIcon(
  station: FMStation,
  selected: boolean,
  stackCount: number
) {
  const inspected = station.inspection69 === "ตรวจแล้ว";
  const offAir = !station.onAir;
  const main = isMainStation(station);

  // Solid fills — three maximally distinct hues so PENDING vs INSPECTED is
  // unmistakable at a glance (amber = needs attention, green = done, grey = off air).
  const bodyFill = offAir ? "#5c6c75" : inspected ? "#00684a" : "#f5a623";

  // Glyph centered at the pin head (cx=12, cy=12 in 24-unit viewBox)
  const innerGlyph = offAir
    ? `<path d="M9 9 l6 6 M15 9 l-6 6" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>`
    : inspected
      ? `<path d="M8.5 12.5 l2.5 2.5 l5 -5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
      : `<g><line x1="12" y1="8" x2="12" y2="13" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16" r="1.3" fill="#ffffff"/></g>`;

  const baseSize = selected ? 30 : 24;
  const wrapW = baseSize + 14;
  const wrapH = Math.round(baseSize * 1.35) + 6;

  // Standard teardrop pin (head + tail), drawn as a single path inside a 24x32 viewBox.
  // Centered on x=12; tip at y=32; head circle radius ~10 around (12, 11).
  const pinPath =
    "M12 32 C 12 32 22 22 22 11 A 10 10 0 1 0 2 11 C 2 22 12 32 12 32 Z";

  const haloRing = selected
    ? `<circle cx="12" cy="11" r="13" fill="none" stroke="#00ed64" stroke-width="2" opacity="0.55"/>`
    : "";

  const starBadge = main
    ? `<g transform="translate(16, -3)">
         <circle cx="6" cy="6" r="6" fill="#ffd24a" stroke="#001e2b" stroke-width="1"/>
         <path d="M6 1.8 L7.2 4.6 L10.2 5 L8 7.1 L8.6 10 L6 8.5 L3.4 10 L4 7.1 L1.8 5 L4.8 4.6 Z" fill="#001e2b"/>
       </g>`
    : "";

  const stackBadge =
    stackCount > 1
      ? `<g transform="translate(-3, -3)">
           <circle cx="6" cy="6" r="6" fill="#001e2b" stroke="#ffffff" stroke-width="1.2"/>
           <text x="6" y="9" text-anchor="middle" font-size="9" font-family="ui-monospace,monospace" font-weight="700" fill="#ffffff">+${stackCount - 1}</text>
         </g>`
      : "";

  const html = `<div style="position:relative;width:${wrapW}px;height:${wrapH}px;transition:all 120ms ease;">
    <svg width="${wrapW}" height="${wrapH}" viewBox="-7 -3 ${24 + 14} ${32 + 6}" style="position:absolute;left:0;top:0;overflow:visible;">
      ${haloRing}
      <path d="${pinPath}" fill="${bodyFill}" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round" filter="drop-shadow(0 1px 2px rgba(0,30,43,0.4))"/>
      ${innerGlyph}
      ${starBadge}
      ${stackBadge}
    </svg>
  </div>`;

  return L.divIcon({
    className: `fo-marker fo-marker--fm ${main ? "is-main" : ""} ${selected ? "is-selected" : ""}`,
    html,
    iconSize: [wrapW, wrapH],
    iconAnchor: [wrapW / 2, wrapH - 3],
    popupAnchor: [0, -wrapH + 10],
  });
}

/**
 * INT marker — same clean teardrop language as FM, with state on top:
 *  - PIN COLOR = ranking severity (Critical=red, Major=amber, Minor=light orange)
 *  - GLYPH = inspection status (✓ inspected, ! pending)
 *  - GOLD ★ in upper-right when LAW PAPER SENT
 *  - SECTOR WEDGE behind the pin when direction is known
 */
function intIcon(
  site: InterferenceSite,
  selected: boolean,
  stackCount: number,
  siblings: InterferenceSite[]
) {
  const ranking = (site.ranking || "").toLowerCase();
  const inspected = site.status === "ตรวจแล้ว";
  // Inspected sites = green (matches FM's "done" semantics).
  // Pending sites = ranking severity color so the user can see what's open.
  const rankingColor =
    ranking === "critical" ? "#ff5b4a" : ranking === "major" ? "#ffb800" : "#ff8b7e";
  const bodyFill = inspected ? "#00684a" : rankingColor;
  const wedgeColor = rankingColor;
  const lawSent = site.lawPaperSent === true;
  const direction = site.direction ?? null;

  const innerGlyph = inspected
    ? `<path d="M8.5 12.5 l2.5 2.5 l5 -5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    : `<g><line x1="12" y1="8" x2="12" y2="13" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16" r="1.3" fill="#ffffff"/></g>`;

  const baseSize = selected ? 30 : 24;
  const wrapW = baseSize + 14;
  const wrapH = Math.round(baseSize * 1.35) + 6;

  const pinPath =
    "M12 32 C 12 32 22 22 22 11 A 10 10 0 1 0 2 11 C 2 22 12 32 12 32 Z";

  const haloRing = selected
    ? `<circle cx="12" cy="11" r="13" fill="none" stroke="#ff5b4a" stroke-width="2" opacity="0.55"/>`
    : "";

  // Direction wedges — render ALL co-located sectors as separate wedges
  // around the pin head, so a 3-sector cellsite shows three triangles
  // pointing in three directions instead of three overlapping pins.
  const sectorWedges = siblings
    .map((s) => {
      if (s.direction === null || s.direction === undefined) return "";
      const sRanking = (s.ranking || "").toLowerCase();
      const c =
        sRanking === "critical"
          ? "#ff5b4a"
          : sRanking === "major"
            ? "#ffb800"
            : "#ff8b7e";
      const isHead = s.id === site.id;
      const opacity = isHead ? (selected ? 0.9 : 0.7) : 0.55;
      return `<g transform="translate(12, 11)">
                <g transform="rotate(${s.direction})">
                  <path d="M 0 0 L -10 -28 L 10 -28 Z" fill="${c}" opacity="${opacity}" stroke="${c}" stroke-width="0.5" stroke-opacity="0.9"/>
                </g>
              </g>`;
    })
    .join("");

  // Single-sector fallback (when siblings is empty)
  const singleWedge =
    siblings.length === 0 && direction !== null
      ? `<g transform="translate(12, 11)" style="transform-origin:0 0;">
           <g transform="rotate(${direction})">
             <path d="M 0 0 L -10 -28 L 10 -28 Z" fill="${wedgeColor}" opacity="${selected ? 0.85 : 0.65}" stroke="${wedgeColor}" stroke-width="0.5" stroke-opacity="0.9"/>
           </g>
         </g>`
      : "";

  const lawBadge = lawSent
    ? `<g transform="translate(16, -3)">
         <circle cx="6" cy="6" r="6" fill="#ffd24a" stroke="#001e2b" stroke-width="1"/>
         <path d="M6 1.8 L7.2 4.6 L10.2 5 L8 7.1 L8.6 10 L6 8.5 L3.4 10 L4 7.1 L1.8 5 L4.8 4.6 Z" fill="#001e2b"/>
       </g>`
    : "";

  const stackBadge =
    stackCount > 1
      ? `<g transform="translate(-3, -3)">
           <circle cx="6" cy="6" r="6" fill="#001e2b" stroke="#ffffff" stroke-width="1.2"/>
           <text x="6" y="9" text-anchor="middle" font-size="9" font-family="ui-monospace,monospace" font-weight="700" fill="#ffffff">+${stackCount - 1}</text>
         </g>`
      : "";

  const html = `<div style="position:relative;width:${wrapW}px;height:${wrapH}px;transition:all 120ms ease;">
    <svg width="${wrapW}" height="${wrapH}" viewBox="-7 -3 ${24 + 14} ${32 + 6}" style="position:absolute;left:0;top:0;overflow:visible;">
      ${sectorWedges || singleWedge}
      ${haloRing}
      <path d="${pinPath}" fill="${bodyFill}" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round" filter="drop-shadow(0 1px 2px rgba(0,30,43,0.4))"/>
      ${innerGlyph}
      ${stackBadge}
      ${lawBadge}
    </svg>
  </div>`;

  return L.divIcon({
    className: `fo-marker fo-marker--int ${selected ? "is-selected" : ""}`,
    html,
    iconSize: [wrapW, wrapH],
    iconAnchor: [wrapW / 2, wrapH - 3],
    popupAnchor: [0, -wrapH + 10],
  });
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, Math.max(map.getZoom(), 12), { duration: 0.6 });
    }
  }, [target, map]);
  return null;
}

export function FieldOpsMap({
  stations,
  interference,
  selection,
  onSelect,
  flyTarget,
  theme = "dark",
}: {
  stations: FMStation[];
  interference: InterferenceSite[];
  selection: FieldSelection;
  onSelect: (sel: FieldSelection) => void;
  flyTarget: [number, number] | null;
  theme?: "dark" | "light";
}) {
  const fmMarkers = useMemo(
    () => stations.filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude)),
    [stations]
  );
  const intMarkers = useMemo(
    () =>
      interference.filter(
        (s) => s.lat !== null && s.long !== null && Number.isFinite(s.lat) && Number.isFinite(s.long)
      ),
    [interference]
  );

  // Group FM stations by identical coordinates so we can show a "+N" badge
  // and prefer the main station as the visible representative.
  const fmGroups = useMemo(() => {
    const groups = new Map<string, FMStation[]>();
    for (const s of fmMarkers) {
      const key = `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`;
      const arr = groups.get(key);
      if (arr) arr.push(s);
      else groups.set(key, [s]);
    }
    // Sort each group: main station first, then inspected, then by id
    for (const arr of groups.values()) {
      arr.sort((a, b) => {
        const am = isMainStation(a) ? 0 : 1;
        const bm = isMainStation(b) ? 0 : 1;
        if (am !== bm) return am - bm;
        const ai = a.inspection69 === "ตรวจแล้ว" ? 0 : 1;
        const bi = b.inspection69 === "ตรวจแล้ว" ? 0 : 1;
        if (ai !== bi) return ai - bi;
        return String(a.id).localeCompare(String(b.id));
      });
    }
    return groups;
  }, [fmMarkers]);

  // Group INT rows by identical coordinates — multi-sector cellsites have
  // separate rows per sector at the same lat/long, which would otherwise stack
  // as overlapping pins.
  const intGroups = useMemo(() => {
    const groups = new Map<string, InterferenceSite[]>();
    for (const s of intMarkers) {
      const lat = (s.lat as number).toFixed(5);
      const lng = (s.long as number).toFixed(5);
      const key = `${lat},${lng}`;
      const arr = groups.get(key);
      if (arr) arr.push(s);
      else groups.set(key, [s]);
    }
    for (const arr of groups.values()) {
      // Worst-ranking first (Critical > Major > Minor > unknown), then pending
      // first (so the head pin reflects "what still needs attention").
      const rankWeight = (r: string | null) => {
        const lc = (r || "").toLowerCase();
        if (lc === "critical") return 0;
        if (lc === "major") return 1;
        if (lc === "minor") return 2;
        return 3;
      };
      arr.sort((a, b) => {
        const ra = rankWeight(a.ranking);
        const rb = rankWeight(b.ranking);
        if (ra !== rb) return ra - rb;
        const ai = a.status === "ตรวจแล้ว" ? 1 : 0;
        const bi = b.status === "ตรวจแล้ว" ? 1 : 0;
        if (ai !== bi) return ai - bi;
        return a.id - b.id;
      });
    }
    return groups;
  }, [intMarkers]);

  const fmIconCache = useRef<Map<string, L.DivIcon>>(new Map());
  const intIconCache = useRef<Map<string, L.DivIcon>>(new Map());

  const tileUrl =
    theme === "light"
      ? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const tileAttribution =
    theme === "light"
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

  return (
    <MapContainer
      center={THAILAND_CENTER}
      zoom={7}
      style={{ width: "100%", height: "100%" }}
      preferCanvas
    >
      <TileLayer key={theme} url={tileUrl} attribution={tileAttribution} maxZoom={19} />

      {Array.from(fmGroups.entries()).map(([coordKey, group]) => {
        const head = group[0];
        const stackCount = group.length;
        const isSelected = selection?.kind === "fm" && group.some((s) => s.id === selection.id);
        const cacheKey = `${head.id}-${isSelected}-${head.inspection69}-${head.onAir}-${isMainStation(head) ? "M" : "x"}-${stackCount}`;
        if (!fmIconCache.current.has(cacheKey)) {
          fmIconCache.current.set(cacheKey, fmIcon(head, isSelected, stackCount));
        }
        return (
          <Marker
            key={`fm-grp-${coordKey}`}
            position={[head.latitude, head.longitude]}
            icon={fmIconCache.current.get(cacheKey)!}
            eventHandlers={{
              click: () => onSelect({ kind: "fm", id: head.id }),
            }}
          />
        );
      })}

      {Array.from(intGroups.entries()).map(([coordKey, group]) => {
        const stackCount = group.length;
        const headFromGroup = group[0];
        // If the user selected one of the siblings, treat that one as the
        // head so the map highlights the right sector.
        const selectedInGroup =
          selection?.kind === "int"
            ? group.find((s) => s.id === selection.id) ?? null
            : null;
        const site = selectedInGroup ?? headFromGroup;
        const isSelected = selectedInGroup !== null;
        const dirsKey = group.map((s) => `${s.id}:${s.direction}:${s.ranking}:${s.status}`).join("|");
        const cacheKey = `${site.id}-${isSelected}-${stackCount}-${dirsKey}-${site.lawPaperSent ? "L" : "x"}`;
        if (!intIconCache.current.has(cacheKey)) {
          intIconCache.current.set(cacheKey, intIcon(site, isSelected, stackCount, group));
        }
        return (
          <Marker
            key={`int-grp-${coordKey}`}
            position={[site.lat as number, site.long as number]}
            icon={intIconCache.current.get(cacheKey)!}
            eventHandlers={{
              click: () => onSelect({ kind: "int", id: site.id }),
            }}
          />
        );
      })}

      <FlyTo target={flyTarget} />
    </MapContainer>
  );
}
