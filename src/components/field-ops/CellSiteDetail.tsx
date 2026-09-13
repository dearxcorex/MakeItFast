"use client";

import type { UserLocation } from "@/types/station";
import { baseOperator, type CellSite } from "@/utils/cellSites";
import { operatorsAtSite, type CellSiteFilters } from "@/utils/cellSiteFilters";
import { haversineDistanceKm, initialBearingDeg } from "@/utils/distance";
import { CELL_OPERATOR_COLORS } from "@/utils/pinTokens";
import NavigationPill from "@/components/interference/NavigationPill";

function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/**
 * Everything licensed at one cell site: each operator's licences and station
 * codes, in matching order. Operators the filter hides stay listed but faded —
 * the tower still carries them, and hiding them would misdescribe the site.
 */
export function CellSiteDetail({
  site,
  filters,
  userLocation,
}: {
  site: CellSite;
  filters: CellSiteFilters;
  userLocation?: UserLocation;
}) {
  const bearing = userLocation
    ? initialBearingDeg(userLocation.latitude, userLocation.longitude, site.lat, site.lng)
    : NaN;
  const distance = userLocation
    ? haversineDistanceKm(userLocation.latitude, userLocation.longitude, site.lat, site.lng)
    : NaN;

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="fo-mono" style={{ color: "var(--fo-rail-mute)", fontSize: 10 }}>
          CELL SITE · {site.province ?? "—"}
        </span>
        <span className="fo-mono" style={{ color: "var(--fo-rail-text)", fontSize: 12 }}>
          {site.lat}, {site.lng}
        </span>
      </div>

      {Number.isFinite(bearing) && Number.isFinite(distance) && (
        <div>
          <NavigationPill bearing={bearing} distance={distance} />
        </div>
      )}

      {operatorsAtSite(site).map((op) => {
        const shown = filters.operators.includes(op);
        const variants = site.operators.filter((o) => baseOperator(o) === op).join(" / ");
        const licences = site.licences[op];
        return (
          <section
            key={op}
            aria-label={`${op} licences`}
            data-faded={shown ? undefined : "true"}
            style={{ opacity: shown ? 1 : 0.4, display: "flex", flexDirection: "column", gap: 6 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                aria-hidden
                style={{ width: 10, height: 10, borderRadius: 999, background: CELL_OPERATOR_COLORS[op] }}
              />
              <span className="fo-mono" style={{ color: "var(--fo-rail-text)", fontWeight: 700, fontSize: 12 }}>
                {variants}
              </span>
              <span className="fo-mono" style={{ color: "var(--fo-rail-mute)", fontSize: 10 }}>
                {licences.length} {licences.length === 1 ? "LICENCE" : "LICENCES"}
              </span>
            </div>
            {licences.length === 0 ? (
              <span className="fo-mono" style={{ color: "var(--fo-rail-mute)", fontSize: 11, paddingLeft: 18 }}>
                No licence listed
              </span>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 4 }}>
                {licences.map((l, i) => (
                  <li key={i} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span className="fo-mono" style={{ color: "var(--fo-rail-text)", fontSize: 12 }}>
                      {l.licenseNo ?? "— no licence no."}
                    </span>
                    <span style={{ color: "var(--fo-rail-mute)", fontSize: 12 }}>
                      {l.stationCode ?? "— no station code"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <a
        href={googleMapsUrl(site.lat, site.lng)}
        target="_blank"
        rel="noopener noreferrer"
        className="fo-mono"
        style={{
          display: "block",
          textAlign: "center",
          padding: "10px 12px",
          borderRadius: 999,
          background: "var(--fo-accent)",
          color: "#001e2b",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textDecoration: "none",
        }}
      >
        ▶ NAVIGATE
      </a>
    </div>
  );
}
