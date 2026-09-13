"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { FMStation, UserLocation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import { makeClusterIcon } from "@/utils/clusterIcon";
import type { InspectedBadgeGates, PinBucket } from "@/utils/pinBucket";
import {
  bucketForStation,
  bucketForSite,
  showsInspectedBadge,
  NO_INSPECTED_BADGES,
} from "@/utils/pinBucket";
import {
  BADGE_INSPECTED,
  BADGE_LAW,
  BADGE_MAIN,
  PIN_COLORS,
  PIN_GLYPHS,
  PIN_INK,
  PIN_SELECTION,
  PIN_STROKE,
} from "@/utils/pinTokens";
import { createLocationIcon } from "@/utils/mapHelpers";
import NavigationPill from "@/components/interference/NavigationPill";

export type FieldSelection =
  | { kind: "fm"; id: string | number }
  | { kind: "int"; id: number }
  | null;

const THAILAND_CENTER: [number, number] = [13.7563, 100.5018];

function isMainStation(s: FMStation): boolean {
  return s.type === "สถานีหลัก" || s.genre === "สถานีหลัก";
}

/**
 * FM marker — clean teardrop pin, ~24px tall.
 *
 * Body colour and inner glyph both come from `bucketForStation`, so a pin can
 * never contradict the cluster arc that summarises it: red ! = revoked,
 * grey x = off air, green check = inspected, amber ring = not yet inspected.
 *
 * Badges are a separate, orthogonal channel — they describe what the station
 * *is*, not what state it is in:
 *  - MAIN STATION (สถานีหลัก): gold star, upper-right
 *  - STACKED (multiple stations at the same coords): "+N", upper-left
 *  - ALREADY INSPECTED: green check, lower-right. Only ever appears on pins
 *    whose bucket outranks `inspected` (revoked, off air) and only while the
 *    matching filter chip is on — see `showsInspectedBadge`. All three badges
 *    can appear at once; they are three independent facts, and suppressing one
 *    to save room would make the pin lie.
 */
function fmIcon(
  station: FMStation,
  selected: boolean,
  stackCount: number,
  inspectedBadge: boolean
) {
  const bucket = bucketForStation(station);
  const main = isMainStation(station);

  const bodyFill = PIN_COLORS[bucket];
  const innerGlyph = PIN_GLYPHS[bucket];

  const baseSize = selected ? 30 : 24;
  const wrapW = baseSize + 14;
  const wrapH = Math.round(baseSize * 1.35) + 6;

  // Standard teardrop pin (head + tail), drawn as a single path inside a 24x32 viewBox.
  // Centered on x=12; tip at y=32; head circle radius ~10 around (12, 11).
  const pinPath =
    "M12 32 C 12 32 22 22 22 11 A 10 10 0 1 0 2 11 C 2 22 12 32 12 32 Z";

  const haloRing = selected
    ? `<circle cx="12" cy="11" r="13" fill="none" stroke="${PIN_SELECTION}" stroke-width="2" opacity="0.55"/>`
    : "";

  const starBadge = main
    ? `<g transform="translate(16, -3)">
         <circle cx="6" cy="6" r="6" fill="${BADGE_MAIN}" stroke="${PIN_INK}" stroke-width="1"/>
         <path d="M6 1.8 L7.2 4.6 L10.2 5 L8 7.1 L8.6 10 L6 8.5 L3.4 10 L4 7.1 L1.8 5 L4.8 4.6 Z" fill="${PIN_INK}"/>
       </g>`
    : "";

  const stackBadge =
    stackCount > 1
      ? `<g transform="translate(-3, -3)">
           <circle cx="6" cy="6" r="6" fill="${PIN_INK}" stroke="${PIN_STROKE}" stroke-width="1.2"/>
           <text x="6" y="9" text-anchor="middle" font-size="9" font-family="ui-monospace,monospace" font-weight="700" fill="${PIN_STROKE}">+${stackCount - 1}</text>
         </g>`
      : "";

  // Lower-right: the only free corner (star owns upper-right, "+N" upper-left).
  // White keyline so the dark green disc survives the red revoked body.
  const inspectedBadgeMark = inspectedBadge
    ? `<g transform="translate(16, 13)">
         <circle cx="6" cy="6" r="6" fill="${BADGE_INSPECTED}" stroke="${PIN_STROKE}" stroke-width="1.2"/>
         <path d="M3.2 6.2 l2 2 l3.6 -3.8" stroke="${PIN_STROKE}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
       </g>`
    : "";

  const html = `<div style="position:relative;width:${wrapW}px;height:${wrapH}px;transition:all 120ms ease;">
    <svg width="${wrapW}" height="${wrapH}" viewBox="-7 -3 ${24 + 14} ${32 + 6}" style="position:absolute;left:0;top:0;overflow:visible;">
      ${haloRing}
      <path d="${pinPath}" fill="${bodyFill}" stroke="${PIN_STROKE}" stroke-width="1.8" stroke-linejoin="round" filter="drop-shadow(0 1px 2px rgba(0,30,43,0.4))"/>
      ${innerGlyph}
      ${starBadge}
      ${stackBadge}
      ${inspectedBadgeMark}
    </svg>
  </div>`;

  return L.divIcon({
    className: `fo-marker fo-marker--fm fo-bucket--${bucket} ${main ? "is-main" : ""} ${selected ? "is-selected" : ""} ${inspectedBadge ? "is-inspected-badge" : ""}`,
    html,
    iconSize: [wrapW, wrapH],
    iconAnchor: [wrapW / 2, wrapH - 3],
    popupAnchor: [0, -wrapH + 10],
  });
}

/**
 * INT marker — same teardrop language as FM, same two channels.
 *
 * Body colour and glyph come from `bucketForSite`: pending + ranking Critical
 * is red, every other pending ranking is amber, inspected is green. Ranking
 * used to paint Minor sites a salmon that no legend could tell apart from
 * critical red; the exact ranking lives in the detail sheet instead.
 *
 * Badges (orthogonal):
 *  - LAW PAPER SENT: pale document, upper-right. Not the gold star — that
 *    already means "main station" on FM pins.
 *  - STACKED: "+N", upper-left.
 *
 * SECTOR WEDGES take each sibling's own bucket colour, so an inspected sector
 * shows a green wedge behind a green pin rather than a wedge still shouting
 * its old severity.
 */
function intIcon(
  site: InterferenceSite,
  selected: boolean,
  stackCount: number,
  siblings: InterferenceSite[]
) {
  const bucket = bucketForSite(site);
  const bodyFill = PIN_COLORS[bucket];
  const innerGlyph = PIN_GLYPHS[bucket];
  const lawSent = site.lawPaperSent === true;
  const direction = site.direction ?? null;

  const baseSize = selected ? 30 : 24;
  const wrapW = baseSize + 14;
  const wrapH = Math.round(baseSize * 1.35) + 6;

  const pinPath =
    "M12 32 C 12 32 22 22 22 11 A 10 10 0 1 0 2 11 C 2 22 12 32 12 32 Z";

  const haloRing = selected
    ? `<circle cx="12" cy="11" r="13" fill="none" stroke="${PIN_SELECTION}" stroke-width="2" opacity="0.55"/>`
    : "";

  // Direction wedges — render ALL co-located sectors as separate wedges
  // around the pin head, so a 3-sector cellsite shows three triangles
  // pointing in three directions instead of three overlapping pins.
  const sectorWedges = siblings
    .map((s) => {
      if (s.direction === null || s.direction === undefined) return "";
      const c = PIN_COLORS[bucketForSite(s)];
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
             <path d="M 0 0 L -10 -28 L 10 -28 Z" fill="${bodyFill}" opacity="${selected ? 0.85 : 0.65}" stroke="${bodyFill}" stroke-width="0.5" stroke-opacity="0.9"/>
           </g>
         </g>`
      : "";

  const lawBadge = lawSent
    ? `<g transform="translate(16, -3)">
         <circle cx="6" cy="6" r="6" fill="${BADGE_LAW}" stroke="${PIN_INK}" stroke-width="1"/>
         <path d="M3.6 2.4 h4.8 v7.2 h-4.8 Z" fill="${PIN_INK}"/>
         <path d="M4.8 4.3 h2.4 M4.8 6 h2.4 M4.8 7.7 h1.5" stroke="${BADGE_LAW}" stroke-width="0.7" stroke-linecap="round"/>
       </g>`
    : "";

  const stackBadge =
    stackCount > 1
      ? `<g transform="translate(-3, -3)">
           <circle cx="6" cy="6" r="6" fill="${PIN_INK}" stroke="${PIN_STROKE}" stroke-width="1.2"/>
           <text x="6" y="9" text-anchor="middle" font-size="9" font-family="ui-monospace,monospace" font-weight="700" fill="${PIN_STROKE}">+${stackCount - 1}</text>
         </g>`
      : "";

  const html = `<div style="position:relative;width:${wrapW}px;height:${wrapH}px;transition:all 120ms ease;">
    <svg width="${wrapW}" height="${wrapH}" viewBox="-7 -3 ${24 + 14} ${32 + 6}" style="position:absolute;left:0;top:0;overflow:visible;">
      ${sectorWedges || singleWedge}
      ${haloRing}
      <path d="${pinPath}" fill="${bodyFill}" stroke="${PIN_STROKE}" stroke-width="1.8" stroke-linejoin="round" filter="drop-shadow(0 1px 2px rgba(0,30,43,0.4))"/>
      ${innerGlyph}
      ${stackBadge}
      ${lawBadge}
    </svg>
  </div>`;

  return L.divIcon({
    className: `fo-marker fo-marker--int fo-bucket--${bucket} ${selected ? "is-selected" : ""}`,
    html,
    iconSize: [wrapW, wrapH],
    iconAnchor: [wrapW / 2, wrapH - 3],
    popupAnchor: [0, -wrapH + 10],
  });
}

export function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, Math.max(map.getZoom(), 12), { duration: 0.6 });
    }
  }, [target, map]);
  return null;
}

// Leaflet caches the container's pixel size at mount; when the bottom sheet
// opens and closes the parent flex item resizes, but the map still renders
// tiles for the stale (smaller) size — leaving a blank band where new map
// real-estate appeared. ResizeObserver → invalidateSize() keeps Leaflet in
// sync with whatever size the parent layout gives us. Optional-chains guard
// against incomplete useMap mocks in unit tests.
export function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer?.();
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => map.invalidateSize?.());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function makeSourceIcon(): L.DivIcon {
  const html = `
    <div style="
      width:18px;height:18px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      background:${PIN_COLORS.critical};border:2px solid ${PIN_STROKE};
      box-shadow:0 0 0 2px rgba(0,30,43,0.45), 0 1px 4px rgba(0,30,43,0.5);
      color:#ffffff;font-family:'Source Code Pro',ui-monospace,monospace;
      font-weight:800;font-size:11px;line-height:1;
    ">⊕</div>
  `;
  return L.divIcon({
    className: "fo-source-pin",
    html,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const SOURCE_ICON = makeSourceIcon();

function ClickToMark({
  active,
  onPick,
  onCancel,
}: {
  active: boolean;
  onPick: (lat: number, lng: number) => void;
  onCancel: () => void;
}) {
  const map = useMap();
  useMapEvents({
    click(e) {
      if (!active) return;
      const target = e.originalEvent?.target as HTMLElement | null;
      if (target && target.closest && target.closest(".leaflet-marker-icon")) {
        return;
      }
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  useEffect(() => {
    if (!active) return;
    const container = map.getContainer();
    const prevCursor = container.style.cursor;
    container.style.cursor = "crosshair";
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      container.style.cursor = prevCursor;
      window.removeEventListener("keydown", onKey);
    };
  }, [active, map, onCancel]);
  return null;
}

export function InitialLocationPan({ location }: { location: UserLocation | undefined }) {
  const map = useMap();
  const didPanRef = useRef(false);
  useEffect(() => {
    if (didPanRef.current) return;
    if (!location) return;
    map.setView([location.latitude, location.longitude], 13);
    didPanRef.current = true;
  }, [location, map]);
  return null;
}

export function RecenterButton({ location }: { location: UserLocation }) {
  const map = useMap();
  return (
    <button
      type="button"
      aria-label="Recenter map on my location"
      onClick={() => {
        map.setView([location.latitude, location.longitude], 14);
      }}
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        zIndex: 500,
        padding: '8px 12px',
        borderRadius: 999,
        border: '1px solid rgba(0, 30, 43, 0.2)',
        background: 'rgba(255, 255, 255, 0.92)',
        color: '#001e2b',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.18)',
        cursor: 'pointer',
        fontSize: 12,
        letterSpacing: '0.12em',
      }}
      className="fo-mono"
    >
      ◎ ME
    </button>
  );
}

export function FieldOpsMap({
  stations,
  interference,
  selection,
  onSelect,
  flyTarget,
  markingSourceForId = null,
  onMarkSource,
  onCancelMarkSource,
  userLocation,
  inspectedBadges = NO_INSPECTED_BADGES,
}: {
  stations: FMStation[];
  interference: InterferenceSite[];
  selection: FieldSelection;
  onSelect: (sel: FieldSelection) => void;
  flyTarget: [number, number] | null;
  markingSourceForId?: number | null;
  onMarkSource?: (siteId: number, lat: number, lng: number) => void;
  onCancelMarkSource?: () => void;
  userLocation?: UserLocation;
  /**
   * Which FM buckets currently show the "already inspected" badge. Derived
   * from the filter chips by `FieldOpsClient` — the map stays ignorant of the
   * filter model and only receives the two booleans it draws with.
   */
  inspectedBadges?: InspectedBadgeGates;
}) {
  const isMarking = markingSourceForId !== null;
  const sourcedSites = useMemo(
    () =>
      interference.filter(
        (s) =>
          s.lat !== null &&
          s.long !== null &&
          s.sourceLat !== null &&
          s.sourceLong !== null &&
          Number.isFinite(s.lat) &&
          Number.isFinite(s.long) &&
          Number.isFinite(s.sourceLat) &&
          Number.isFinite(s.sourceLong)
      ),
    [interference]
  );
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

  // One keyless tile source for both themes. CARTO's raster basemaps now
  // require an API key: unauthenticated tiles still return 200 with a valid
  // PNG, but with "API KEY REQUIRED" painted into the image, so the dark map
  // silently rotted. Dark mode is now a CSS filter over these same OSM tiles
  // — see .leaflet-tile-pane in field-ops.css.
  const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tileAttribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  const selectedSite =
    selection?.kind === "int"
      ? interference.find((s) => s.id === selection.id) ?? null
      : null;
  const showPill =
    selectedSite !== null &&
    (selectedSite.direction != null ||
      (selectedSite.sourceLat !== null && selectedSite.sourceLong !== null));

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {showPill && selectedSite && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 1000,
            pointerEvents: "none",
          }}
        >
          <NavigationPill
            bearing={selectedSite.direction ?? null}
            distance={
              selectedSite.sourceLat !== null && selectedSite.sourceLong !== null
                ? selectedSite.estimateDistance ?? null
                : null
            }
          />
        </div>
      )}
      <MapContainer
      center={THAILAND_CENTER}
      zoom={7}
      style={{ width: "100%", height: "100%" }}
      preferCanvas
    >
      <TileLayer url={tileUrl} attribution={tileAttribution} maxZoom={19} />

      {/*
        NOTE: do NOT re-enable `chunkedLoading`. It races with React updates
        when the user toggles filters quickly — pins can disappear entirely.
        Synchronous addLayers handles the current dataset comfortably.
      */}
      <MarkerClusterGroup
        maxClusterRadius={45}
        disableClusteringAtZoom={13}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        iconCreateFunction={(c: {
          getChildCount: () => number;
          getAllChildMarkers: () => Array<{ options: { icon?: { options?: { className?: string } } } }>;
        }) => {
          const buckets: Record<PinBucket, number> = {
            critical: 0,
            pending: 0,
            offair: 0,
            inspected: 0,
          };
          for (const m of c.getAllChildMarkers()) {
            const cn = m.options.icon?.options?.className ?? "";
            const match = cn.match(/fo-bucket--(critical|pending|offair|inspected)/);
            if (match) buckets[match[1] as PinBucket]++;
          }
          return makeClusterIcon(c.getChildCount(), buckets);
        }}
      >
      {Array.from(fmGroups.entries()).map(([coordKey, group]) => {
        const head = group[0];
        const stackCount = group.length;
        const isSelected = selection?.kind === "fm" && group.some((s) => s.id === selection.id);
        // `inspectedBadge` belongs in the key: it depends on the filter chips
        // and on siblings, neither of which appears anywhere else in it, so
        // without it a cached pin survives a REVOKED toggle and renders stale.
        const inspectedBadge = showsInspectedBadge(group, inspectedBadges);
        const cacheKey = `${head.id}-${isSelected}-${head.inspection69}-${head.onAir}-${head.revoked ? "R" : "x"}-${isMainStation(head) ? "M" : "x"}-${stackCount}-${inspectedBadge ? "I" : "x"}`;
        if (!fmIconCache.current.has(cacheKey)) {
          fmIconCache.current.set(
            cacheKey,
            fmIcon(head, isSelected, stackCount, inspectedBadge)
          );
        }
        return (
          <Marker
            key={`fm-grp-${coordKey}`}
            position={[head.latitude, head.longitude]}
            icon={fmIconCache.current.get(cacheKey)!}
            eventHandlers={{
              click: () => {
                if (isMarking) return;
                onSelect({ kind: "fm", id: head.id });
              },
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
              click: () => {
                if (isMarking) return;
                onSelect({ kind: "int", id: site.id });
              },
            }}
          />
        );
      })}
      </MarkerClusterGroup>

      {sourcedSites.map((s) => {
        const lat = s.lat as number;
        const lng = s.long as number;
        const sLat = s.sourceLat as number;
        const sLng = s.sourceLong as number;
        return (
          <Polyline
            key={`src-line-${s.id}`}
            positions={[[lat, lng], [sLat, sLng]]}
            pathOptions={{
              color: "var(--fo-accent)",
              weight: 3,
              opacity: 0.85,
            }}
          />
        );
      })}

      {sourcedSites.map((s) => (
        <Marker
          key={`src-pin-${s.id}`}
          position={[s.sourceLat as number, s.sourceLong as number]}
          icon={SOURCE_ICON}
          eventHandlers={{
            click: () => {
              if (isMarking) return;
              onSelect({ kind: "int", id: s.id });
            },
          }}
        />
      ))}

      {onMarkSource && (
        <ClickToMark
          active={isMarking}
          onPick={(lat, lng) => {
            if (markingSourceForId !== null) onMarkSource(markingSourceForId, lat, lng);
          }}
          onCancel={() => onCancelMarkSource?.()}
        />
      )}

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
