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

  // Solid fills — readable on dark and light basemaps
  const bodyFill = offAir ? "#5c6c75" : inspected ? "#00684a" : "#00ed64";

  // Glyph centered at the pin head (cx=12, cy=12 in 24-unit viewBox)
  const innerGlyph = offAir
    ? `<path d="M9 9 l6 6 M15 9 l-6 6" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>`
    : inspected
      ? `<path d="M8.5 12.5 l2.5 2.5 l5 -5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
      : `<circle cx="12" cy="12" r="2.6" fill="#001e2b"/>`;

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

function intIcon(site: InterferenceSite, selected: boolean) {
  const ranking = (site.ranking || "").toLowerCase();
  const fill = ranking === "critical" ? "#ff5b4a" : ranking === "major" ? "#ffb800" : "#ff8b7e";
  const ringColor = selected ? "#ff5b4a" : "#001e2b";
  const ringWidth = selected ? 3 : 2;
  const size = selected ? 22 : 16;
  const direction = site.direction ?? null;
  const wedgeSvg =
    direction !== null
      ? `<svg width="48" height="48" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(${direction}deg);pointer-events:none;">
           <path d="M 24 24 L 12 0 L 36 0 Z" fill="#ff5b4a" opacity="${selected ? 0.55 : 0.3}" />
         </svg>`
      : "";
  return L.divIcon({
    className: "fo-marker fo-marker--int",
    html: `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
      ${wedgeSvg}
      <div style="
        width:${size}px;height:${size}px;
        border-radius:50% 50% 50% 0;
        background:${fill};
        border:${ringWidth}px solid ${ringColor};
        transform:rotate(-45deg);
        position:relative;
        z-index:2;
        box-shadow:0 2px 6px rgba(0,30,43,0.3);
      "></div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
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

      {intMarkers.map((site) => {
        const isSelected = selection?.kind === "int" && selection.id === site.id;
        const cacheKey = `${site.id}-${isSelected}-${site.ranking}-${site.direction}`;
        if (!intIconCache.current.has(cacheKey)) {
          intIconCache.current.set(cacheKey, intIcon(site, isSelected));
        }
        return (
          <Marker
            key={`int-${site.id}`}
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
