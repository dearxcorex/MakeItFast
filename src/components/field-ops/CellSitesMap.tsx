"use client";

import { useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { UserLocation } from "@/types/station";
import { CELL_OPERATORS, type CellOperator, type CellSite } from "@/utils/cellSites";
import { cellSiteKey, visibleOperators, type CellSiteFilters } from "@/utils/cellSiteFilters";
import { makeSegmentClusterIcon } from "@/utils/clusterIcon";
import {
  CELL_OPERATOR_COLORS,
  CELL_SHARED_COLOR,
  PIN_SELECTION,
  PIN_STROKE,
} from "@/utils/pinTokens";
import { createLocationIcon } from "@/utils/mapHelpers";
import { FlyTo, InitialLocationPan, InvalidateOnResize, RecenterButton } from "./FieldOpsMap";

// Korat city: the middle of the coverage area, where most sites are.
const COVERAGE_CENTER: [number, number] = [15.2, 102.0];

const OPERATOR_INITIAL: Record<CellOperator, string> = { AWN: "A", NT: "N", TUC: "T" };

/**
 * Cell site pin — the Field Ops teardrop, coloured by what the filter shows.
 *
 * One visible operator: that operator's colour with its initial. Several: a
 * dark neutral pin with the operator count, so a shared tower never pretends to
 * belong to one of them. The operator list rides in the className so the
 * cluster bubble can split its ring without looking the site up again.
 */
function cellIcon(operators: CellOperator[], selected: boolean): L.DivIcon {
  const shared = operators.length > 1;
  const fill = shared ? CELL_SHARED_COLOR : CELL_OPERATOR_COLORS[operators[0]];
  const label = shared ? String(operators.length) : OPERATOR_INITIAL[operators[0]];

  const baseSize = selected ? 30 : 24;
  const wrapW = baseSize + 14;
  const wrapH = Math.round(baseSize * 1.35) + 6;
  const pinPath = "M12 32 C 12 32 22 22 22 11 A 10 10 0 1 0 2 11 C 2 22 12 32 12 32 Z";

  const haloRing = selected
    ? `<circle cx="12" cy="11" r="13" fill="none" stroke="${PIN_SELECTION}" stroke-width="2" opacity="0.55"/>`
    : "";

  // Shared pins carry a thin tick per operator under the count, in its colour.
  const ticks = shared
    ? operators
        .map((op, i) => {
          const x = 12 - ((operators.length - 1) * 4) / 2 + i * 4;
          return `<rect x="${x - 1.5}" y="15.5" width="3" height="3" rx="1" fill="${CELL_OPERATOR_COLORS[op]}"/>`;
        })
        .join("")
    : "";

  const html = `<div style="position:relative;width:${wrapW}px;height:${wrapH}px;">
    <svg width="${wrapW}" height="${wrapH}" viewBox="-7 -3 ${24 + 14} ${32 + 6}" style="position:absolute;left:0;top:0;overflow:visible;">
      ${haloRing}
      <path d="${pinPath}" fill="${fill}" stroke="${PIN_STROKE}" stroke-width="1.8" stroke-linejoin="round" filter="drop-shadow(0 1px 2px rgba(0,30,43,0.4))"/>
      <text x="12" y="${shared ? 12 : 11}" text-anchor="middle" dominant-baseline="central" font-size="${shared ? 9 : 10}" font-family="ui-monospace,monospace" font-weight="700" fill="#ffffff">${label}</text>
      ${ticks}
    </svg>
  </div>`;

  return L.divIcon({
    className: `fo-marker fo-marker--cell fo-cell-ops--${operators.join("_")} ${selected ? "is-selected" : ""}`,
    html,
    iconSize: [wrapW, wrapH],
    iconAnchor: [wrapW / 2, wrapH - 3],
  });
}

export function CellSitesMap({
  sites,
  filters,
  selectedKey,
  onSelect,
  flyTarget,
  userLocation,
}: {
  /** Already filtered. */
  sites: CellSite[];
  filters: CellSiteFilters;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  flyTarget: [number, number] | null;
  userLocation?: UserLocation;
}) {
  // Icons depend only on the operator mix and selection, so a handful of
  // them cover all ~6,600 pins.
  const iconCache = useRef<Map<string, L.DivIcon>>(new Map());
  const iconFor = (operators: CellOperator[], selected: boolean) => {
    const key = `${operators.join("_")}-${selected}`;
    let icon = iconCache.current.get(key);
    if (!icon) {
      icon = cellIcon(operators, selected);
      iconCache.current.set(key, icon);
    }
    return icon;
  };

  // react-leaflet calls setLatLng whenever `position` is a new array, and the
  // cluster group answers every move by removing and re-adding the marker. A
  // fresh [lat, lng] per render would re-cluster all pins on each click, so
  // position and handlers are built once per site and reused.
  const stableProps = useRef(
    new WeakMap<CellSite, { key: string; position: [number, number]; eventHandlers: L.LeafletEventHandlerFnMap }>()
  );
  const propsFor = (site: CellSite) => {
    let p = stableProps.current.get(site);
    if (!p) {
      const key = cellSiteKey(site);
      p = { key, position: [site.lat, site.lng], eventHandlers: { click: () => onSelect(key) } };
      stableProps.current.set(site, p);
    }
    return p;
  };

  const markers = useMemo(
    () =>
      sites.map((site) => {
        const { key, position, eventHandlers } = propsFor(site);
        return (
          <Marker
            key={key}
            position={position}
            icon={iconFor(visibleOperators(site, filters), key === selectedKey)}
            eventHandlers={eventHandlers}
          />
        );
      }),
    // iconFor and propsFor only read refs; onSelect is a stable callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sites, filters, selectedKey]
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <MapContainer
        center={COVERAGE_CENTER}
        zoom={8}
        style={{ width: "100%", height: "100%" }}
        preferCanvas
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        {/* No chunkedLoading — see the note in FieldOpsMap. */}
        <MarkerClusterGroup
          maxClusterRadius={45}
          disableClusteringAtZoom={15}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          iconCreateFunction={(c: {
            getChildCount: () => number;
            getAllChildMarkers: () => Array<{ options: { icon?: { options?: { className?: string } } } }>;
          }) => {
            const counts: Record<CellOperator, number> = { AWN: 0, NT: 0, TUC: 0 };
            for (const m of c.getAllChildMarkers()) {
              const cn = m.options.icon?.options?.className ?? "";
              const ops = cn.match(/fo-cell-ops--(\S+)/)?.[1].split("_") ?? [];
              for (const op of ops) if (op in counts) counts[op as CellOperator]++;
            }
            return makeSegmentClusterIcon(
              c.getChildCount(),
              CELL_OPERATORS.map((op) => ({ color: CELL_OPERATOR_COLORS[op], count: counts[op] }))
            );
          }}
        >
          {markers}
        </MarkerClusterGroup>

        <InitialLocationPan location={userLocation} />
        {userLocation && (
          <Marker
            position={[userLocation.latitude, userLocation.longitude]}
            icon={createLocationIcon({ heading: null })}
          />
        )}

        <FlyTo target={flyTarget} />
        <InvalidateOnResize />
        {userLocation && <RecenterButton location={userLocation} />}
      </MapContainer>
    </div>
  );
}
