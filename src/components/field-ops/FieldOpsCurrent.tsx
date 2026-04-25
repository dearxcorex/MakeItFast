"use client";

import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

interface CommonAction {
  label: string;
  pending: string;
  inverse?: boolean;
  onClick: () => void;
  variant?: "primary" | "ghost" | "warn";
  disabled?: boolean;
}

function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function FieldOpsCurrentFM({
  station,
  onToggleInspection,
  pending,
}: {
  station: FMStation;
  onToggleInspection: () => void;
  pending: boolean;
}) {
  const inspected = station.inspection69 === "ตรวจแล้ว";

  return (
    <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Badge tone="fm">FM</Badge>
        <span
          className="fo-mono"
          style={{
            padding: "2px 8px",
            border: `1px solid ${inspected ? "var(--fo-accent)" : "var(--fo-warn)"}`,
            color: inspected ? "var(--fo-accent)" : "var(--fo-warn)",
            borderRadius: 999,
            fontSize: 9,
          }}
        >
          {inspected ? "INSPECTED" : "PENDING"}
        </span>
        {!station.onAir && <Badge tone="off">OFF AIR</Badge>}
      </div>

      <div className="fo-serif" style={{ fontSize: 24, color: "var(--fo-rail-text)", lineHeight: 1.15 }}>
        {station.name}
      </div>
      <div className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>
        {(station.state || "").toUpperCase()} · {station.city}
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", paddingTop: 4 }}>
        <Meter label="FREQ" value={`${station.frequency.toFixed(2)} MHz`} />
        <Meter label="PERMIT" value={station.permit || "—"} />
        {station.transmitterPower !== undefined && (
          <Meter label="POWER" value={`${station.transmitterPower} W`} />
        )}
      </div>

      <ButtonRow
        actions={[
          { label: "▶ NAVIGATE", pending: "...", onClick: () => window.open(googleMapsUrl(station.latitude, station.longitude), "_blank"), variant: "primary" },
          {
            label: inspected ? "✓ INSPECTED" : "✓ INSPECT",
            pending: "...",
            onClick: onToggleInspection,
            variant: inspected ? "ghost" : "primary",
            disabled: pending,
            inverse: inspected,
          },
        ]}
        loading={pending}
      />
    </div>
  );
}

export function FieldOpsCurrentINT({
  site,
  onToggleInspection,
  onToggleLawPaper,
  pending,
}: {
  site: InterferenceSite;
  onToggleInspection: () => void;
  onToggleLawPaper: () => void;
  pending: boolean;
}) {
  const inspected = site.status === "ตรวจแล้ว";
  const lawSent = !!site.lawPaperSent;

  return (
    <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Badge tone="int">INT</Badge>
        {site.ranking && (
          <span
            className="fo-mono"
            style={{
              padding: "2px 8px",
              border: `1px solid ${rankingColor(site.ranking)}`,
              color: rankingColor(site.ranking),
              borderRadius: 999,
              fontSize: 9,
            }}
          >
            {site.ranking.toUpperCase()}
          </span>
        )}
        <span
          className="fo-mono"
          style={{
            padding: "2px 8px",
            border: `1px solid ${inspected ? "var(--fo-accent)" : "var(--fo-warn)"}`,
            color: inspected ? "var(--fo-accent)" : "var(--fo-warn)",
            borderRadius: 999,
            fontSize: 9,
          }}
        >
          {inspected ? "INSPECTED" : "PENDING"}
        </span>
      </div>

      <div className="fo-serif" style={{ fontSize: 22, color: "var(--fo-rail-text)", lineHeight: 1.15 }}>
        {site.siteName || site.siteCode || `Site #${site.id}`}
      </div>
      <div className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>
        {(site.changwat || "").toUpperCase()}
        {site.cellName ? ` · ${site.cellName}` : ""}
        {site.sectorName ? ` · ${site.sectorName}` : ""}
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", paddingTop: 4 }}>
        {site.direction !== null && site.direction !== undefined && (
          <Meter label="BEARING" value={`${site.direction.toFixed(0)}°`} />
        )}
        {site.avgNiCarrier !== null && site.avgNiCarrier !== undefined && (
          <Meter label="N/I" value={`${site.avgNiCarrier.toFixed(1)} dBm`} />
        )}
        {site.estimateDistance !== null && site.estimateDistance !== undefined && (
          <Meter label="DIST" value={`${site.estimateDistance.toFixed(1)} km`} />
        )}
      </div>

      <ButtonRow
        actions={[
          {
            label: "▶ NAVIGATE",
            pending: "...",
            onClick: () =>
              site.lat !== null &&
              site.long !== null &&
              window.open(googleMapsUrl(site.lat, site.long), "_blank"),
            variant: "primary",
            disabled: site.lat === null || site.long === null,
          },
          {
            label: inspected ? "✓ INSPECTED" : "✓ INSPECT",
            pending: "...",
            onClick: onToggleInspection,
            variant: inspected ? "ghost" : "primary",
            disabled: pending,
            inverse: inspected,
          },
        ]}
        loading={pending}
      />

      <button
        type="button"
        onClick={onToggleLawPaper}
        disabled={pending}
        style={{
          padding: "12px 14px",
          background: lawSent ? "var(--fo-warn)" : "transparent",
          color: lawSent ? "var(--fo-ink)" : "var(--fo-warn)",
          border: `1px solid ${lawSent ? "var(--fo-warn)" : "var(--fo-warn)"}`,
          borderRadius: 12,
          cursor: pending ? "wait" : "pointer",
          fontFamily: "inherit",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity: pending ? 0.6 : 1,
        }}
      >
        <span style={{ fontSize: 18 }}>✉</span>
        <span style={{ flex: 1 }}>
          <span className="fo-mono" style={{ color: "inherit" }}>LAW PAPER</span>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>
            {lawSent ? "ส่งแล้ว · Sent" : "ยังไม่ส่ง · Not sent"}
          </div>
        </span>
        <span className="fo-mono" style={{ color: "inherit", opacity: 0.7 }}>TAP TO TOGGLE</span>
      </button>
    </div>
  );
}

function rankingColor(ranking: string) {
  const lc = ranking.toLowerCase();
  if (lc === "critical") return "var(--fo-crit)";
  if (lc === "major") return "var(--fo-warn)";
  return "var(--fo-line)";
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="fo-mono" style={{ color: "var(--fo-mute)" }}>{label}</div>
      <div className="fo-serif" style={{ fontSize: 18, color: "var(--fo-accent)" }}>{value}</div>
    </div>
  );
}

function Badge({ tone, children }: { tone: "fm" | "int" | "off"; children: React.ReactNode }) {
  const styles =
    tone === "fm"
      ? { background: "var(--fo-ink)", color: "var(--fo-accent)", border: "1px solid var(--fo-accent)" }
      : tone === "int"
        ? { background: "var(--fo-accent-2)", color: "var(--fo-rail-text)", border: "1px solid var(--fo-accent-2)" }
        : { background: "transparent", color: "var(--fo-mute)", border: "1px solid var(--fo-mute)" };
  return (
    <span
      className="fo-mono"
      style={{
        padding: "3px 8px",
        borderRadius: 4,
        fontSize: 9,
        ...styles,
      }}
    >
      {children}
    </span>
  );
}

function ButtonRow({ actions, loading }: { actions: CommonAction[]; loading: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
      {actions.map((a, i) => {
        const baseStyle: React.CSSProperties = {
          flex: 1,
          padding: "12px 14px",
          borderRadius: 999,
          border: "1px solid",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          cursor: a.disabled ? "wait" : "pointer",
          fontFamily: "inherit",
          opacity: a.disabled ? 0.6 : 1,
        };
        const style: React.CSSProperties =
          a.variant === "primary"
            ? {
                ...baseStyle,
                background: "var(--fo-accent)",
                color: "var(--fo-ink)",
                borderColor: "var(--fo-accent)",
              }
            : a.inverse
              ? {
                  ...baseStyle,
                  background: "var(--fo-ink)",
                  color: "var(--fo-accent)",
                  borderColor: "var(--fo-accent)",
                }
              : {
                  ...baseStyle,
                  background: "transparent",
                  color: "var(--fo-rail-mute)",
                  borderColor: "var(--fo-ink-3)",
                };
        return (
          <button
            key={i}
            type="button"
            onClick={a.onClick}
            disabled={a.disabled}
            className="fo-mono"
            style={style}
          >
            {loading && a.disabled ? a.pending : a.label}
          </button>
        );
      })}
    </div>
  );
}
