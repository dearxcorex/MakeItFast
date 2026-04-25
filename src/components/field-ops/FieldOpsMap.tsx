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

function fmIcon(station: FMStation, selected: boolean) {
  const inspected = station.inspection69 === "ตรวจแล้ว";
  const offAir = !station.onAir;
  const fill = offAir ? "#5c6c75" : inspected ? "#00684a" : "#00ed64";
  const ringColor = selected ? "#00ed64" : "#001e2b";
  const ringWidth = selected ? 3 : 2;
  const size = selected ? 22 : 16;
  return L.divIcon({
    className: "fo-marker fo-marker--fm",
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50% 50% 50% 0;
      background:${fill};
      border:${ringWidth}px solid ${ringColor};
      transform:rotate(-45deg);
      box-shadow:0 2px 6px rgba(0,30,43,0.3);
      transition: all 120ms ease;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
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

      {fmMarkers.map((station) => {
        const isSelected = selection?.kind === "fm" && selection.id === station.id;
        const cacheKey = `${station.id}-${isSelected}-${station.inspection69}-${station.onAir}`;
        if (!fmIconCache.current.has(cacheKey)) {
          fmIconCache.current.set(cacheKey, fmIcon(station, isSelected));
        }
        return (
          <Marker
            key={`fm-${station.id}`}
            position={[station.latitude, station.longitude]}
            icon={fmIconCache.current.get(cacheKey)!}
            eventHandlers={{
              click: () => onSelect({ kind: "fm", id: station.id }),
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
