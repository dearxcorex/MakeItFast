"use client";

import { useState } from "react";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import type { FieldSelection } from "./FieldOpsMap";

function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function FieldOpsBottomSheet({
  selection,
  station,
  site,
  onToggleInspection,
  onToggleLawPaper,
  pending,
}: {
  selection: FieldSelection;
  station: FMStation | null;
  site: InterferenceSite | null;
  onToggleInspection: () => void;
  onToggleLawPaper: () => void;
  pending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!selection || (!station && !site)) {
    return (
      <div
        style={{
          background: "var(--fo-sheet-bg)",
          borderTop: "1px solid var(--fo-rail-border)",
          padding: "20px 16px",
          textAlign: "center",
        }}
      >
        <span className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>NO ITEM SELECTED</span>
      </div>
    );
  }

  const isFM = selection.kind === "fm" && station;
  const id = isFM ? `FM-${station!.id}` : `INT-${site!.id}`;
  const title = isFM ? station!.name : (site!.siteName || site!.siteCode || `Site #${site!.id}`);
  const province = isFM ? station!.state : site!.changwat || "";
  const district = isFM ? station!.city : (site!.cellName || "—");
  const inspected = isFM ? station!.inspection69 === "ตรวจแล้ว" : site!.status === "ตรวจแล้ว";
  const lawSent = !isFM && !!site!.lawPaperSent;
  const lat = isFM ? station!.latitude : (site!.lat ?? 0);
  const lng = isFM ? station!.longitude : (site!.long ?? 0);
  const canNavigate = isFM ? true : site!.lat !== null && site!.long !== null;

  return (
    <div
      style={{
        background: "var(--fo-sheet-bg)",
        borderTop: "1px solid var(--fo-rail-border)",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        boxShadow: "0 -8px 24px rgba(0,30,43,0.1)",
        maxHeight: expanded ? "70vh" : 280,
        transition: "max-height 200ms ease",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Collapse" : "Expand"}
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "8px 0 4px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <span style={{ width: 48, height: 4, borderRadius: 999, background: "var(--fo-line)" }} />
      </button>

      <div style={{ padding: "0 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <span
          className="fo-mono"
          style={{
            padding: "3px 8px",
            borderRadius: 4,
            fontSize: 9,
            background: isFM ? "var(--fo-ink)" : "var(--fo-accent-2)",
            color: isFM ? "var(--fo-accent)" : "var(--fo-white)",
          }}
        >
          {isFM ? "FM" : "INT"}
        </span>
        <span className="fo-mono" style={{ color: "var(--fo-sheet-text)" }}>{id}</span>
        <div style={{ flex: 1 }} />
        <span
          className="fo-mono"
          style={{
            padding: "3px 8px",
            borderRadius: 999,
            border: `1px solid ${inspected ? "var(--fo-accent-2)" : "var(--fo-warn)"}`,
            color: inspected ? "var(--fo-accent-2)" : "var(--fo-warn)",
            fontSize: 9,
          }}
        >
          {inspected ? "INSPECTED" : "PENDING"}
        </span>
      </div>

      <div style={{ padding: "8px 16px 4px" }}>
        <div className="fo-serif" style={{ fontSize: 18, color: "var(--fo-sheet-text)", lineHeight: 1.15 }}>
          {title}
        </div>
        <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", marginTop: 4 }}>
          {province.toUpperCase()} · {district}
        </div>
      </div>

      <div style={{ padding: "8px 16px 0", display: "flex", gap: 16, fontSize: 12 }}>
        {isFM ? (
          <>
            <Inline label="FREQ" value={`${station!.frequency.toFixed(2)} MHz`} />
            {station!.permit && <Inline label="PERMIT" value={station!.permit} />}
          </>
        ) : (
          <>
            {site!.direction !== null && site!.direction !== undefined && (
              <Inline label="BEARING" value={`${site!.direction.toFixed(0)}°`} />
            )}
            {site!.avgNiCarrier !== null && site!.avgNiCarrier !== undefined && (
              <Inline label="N/I" value={`${site!.avgNiCarrier.toFixed(1)}`} />
            )}
            {site!.ranking && <Inline label="RANK" value={site!.ranking} />}
          </>
        )}
      </div>

      <div style={{ padding: "12px 16px", display: "flex", gap: 8 }}>
        <a
          href={canNavigate ? googleMapsUrl(lat, lng) : "#"}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!canNavigate}
          className="fo-mono"
          onClick={(e) => {
            if (!canNavigate) e.preventDefault();
          }}
          style={{
            flex: 1,
            padding: "12px",
            background: canNavigate ? "var(--fo-accent)" : "var(--fo-line)",
            color: "var(--fo-ink)",
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: "0.2em",
            fontWeight: 700,
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          ▶ NAVIGATE
        </a>
        <button
          type="button"
          onClick={onToggleInspection}
          disabled={pending}
          className="fo-mono"
          style={{
            flex: 1,
            padding: "12px",
            background: inspected ? "var(--fo-ink)" : "var(--fo-white)",
            color: inspected ? "var(--fo-accent)" : "var(--fo-ink)",
            border: `1px solid ${inspected ? "var(--fo-ink)" : "var(--fo-line)"}`,
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: "0.2em",
            fontWeight: 700,
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {inspected ? "✓ INSPECTED" : "✓ INSPECT"}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 24px", overflowY: "auto" }}>
          {!isFM && (
            <button
              type="button"
              onClick={onToggleLawPaper}
              disabled={pending}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: lawSent ? "var(--fo-warn)" : "var(--fo-white)",
                color: "var(--fo-ink)",
                border: `1px solid ${lawSent ? "var(--fo-warn)" : "var(--fo-line)"}`,
                borderRadius: 12,
                cursor: pending ? "wait" : "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
                opacity: pending ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 18 }}>✉</span>
              <span style={{ flex: 1 }}>
                <span className="fo-mono">LAW PAPER</span>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {lawSent ? "ส่งแล้ว · Sent" : "ยังไม่ส่ง · Not sent"}
                </div>
              </span>
              <span className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>TAP TO TOGGLE</span>
            </button>
          )}

          {(() => {
            const cells: React.ReactNode[] = [];
            if (isFM) {
              if (station!.transmitterPower !== undefined) {
                cells.push(<Cell key="power" label="POWER" value={`${station!.transmitterPower} W`} />);
              }
              if (station!.dateInspected) {
                cells.push(<Cell key="inspected" label="INSPECTED" value={station!.dateInspected} />);
              }
            } else {
              if (site!.estimateDistance !== null && site!.estimateDistance !== undefined) {
                cells.push(<Cell key="dist" label="DIST" value={`${site!.estimateDistance.toFixed(1)} km`} />);
              }
              if (site!.nbtcArea) {
                cells.push(<Cell key="nbtc" label="NBTC AREA" value={site!.nbtcArea} />);
              }
            }
            if (cells.length === 0) return null;
            return (
              <div
                style={{
                  padding: 12,
                  background: "var(--fo-paper-2)",
                  border: "1px solid var(--fo-line)",
                  borderRadius: 10,
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                {cells}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function Inline({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>{label}</span>
      <span
        className="fo-serif"
        style={{
          fontSize: 14,
          color: "var(--fo-sheet-text)",
          lineHeight: 1.4,
          whiteSpace: "normal",
          wordBreak: "break-word",
        }}
      >{value}</span>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--fo-sheet-text)" }}>{value}</div>
    </div>
  );
}
