"use client";

import { useEffect, useState } from "react";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import type { FieldSelection } from "./FieldOpsMap";
import { parseLatLngInput } from "@/utils/parseLatLng";
import type { StationInspection } from "@/types/inspection";
import InspectionPanel from "@/components/inspection/InspectionPanel";

function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function FieldOpsBottomSheet({
  selection,
  station,
  site,
  onToggleInspection,
  onToggleLawPaper,
  onClose,
  pending,
  marking = false,
  onStartMarkSource,
  onCancelMarkSource,
  onClearSource,
  onSubmitSourceCoords,
  inspectionHistory,
  inspectors,
  currentUser,
  onLoadInspections,
  onCreateInspection,
}: {
  selection: FieldSelection;
  station: FMStation | null;
  site: InterferenceSite | null;
  onToggleInspection: () => void;
  onToggleLawPaper: () => void;
  onClose?: () => void;
  pending: boolean;
  marking?: boolean;
  onStartMarkSource?: () => void;
  onCancelMarkSource?: () => void;
  onClearSource?: () => void;
  onSubmitSourceCoords?: (lat: number, lng: number) => void;
  inspectionHistory?: StationInspection[];
  inspectors?: { id: number; username: string; displayName: string }[];
  currentUser?: { id: number; displayName: string };
  onLoadInspections?: () => void;
  onCreateInspection?: (input: {
    stationId: number;
    inspectedOn: string;
    helperUserIds: number[];
    notes?: string;
  }) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [coordsOpen, setCoordsOpen] = useState(false);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [coordError, setCoordError] = useState<string | null>(null);

  const intSiteId = selection?.kind === "int" ? site?.id ?? null : null;
  useEffect(() => {
    setLatInput("");
    setLngInput("");
    setCoordError(null);
    setCoordsOpen(false);
  }, [intSiteId]);

  // Refresh inspection history whenever a different FM station opens.
  const fmStationId = selection?.kind === "fm" ? station?.id ?? null : null;
  useEffect(() => {
    if (fmStationId != null) {
      onLoadInspections?.();
    }
  }, [fmStationId, onLoadInspections]);

  // Marking banner takes over the sheet so the map stays fully visible.
  if (marking && selection?.kind === "int") {
    return (
      <div
        style={{
          background: "var(--fo-sheet-bg)",
          borderTop: "1px solid var(--fo-accent)",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          boxShadow: "0 -8px 24px rgba(0,30,43,0.25)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "2px solid var(--fo-accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--fo-accent)",
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          ◎
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="fo-mono"
            style={{ color: "var(--fo-accent)", fontSize: 10, letterSpacing: "0.16em" }}
          >
            MARK SOURCE
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--fo-sheet-text)",
              marginTop: 2,
              lineHeight: 1.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Tap the map to drop the source pin
          </div>
        </div>
        <button
          type="button"
          onClick={onCancelMarkSource}
          disabled={pending}
          className="fo-mono"
          style={{
            padding: "10px 14px",
            background: "transparent",
            color: "var(--fo-warn)",
            border: "1px solid var(--fo-warn)",
            borderRadius: 999,
            fontSize: 10,
            letterSpacing: "0.16em",
            cursor: pending ? "wait" : "pointer",
            flexShrink: 0,
          }}
        >
          ✕ CANCEL
        </button>
      </div>
    );
  }

  if (!selection || (!station && !site)) {
    return null;
  }

  const isFM = selection.kind === "fm" && station;
  const isINT = selection.kind === "int" && site;
  const id = isFM ? `FM-${station!.id}` : `INT-${site!.id}`;
  const title = isFM ? station!.name : (site!.siteName || site!.siteCode || `Site #${site!.id}`);
  const province = isFM ? station!.state : site!.changwat || "";
  const district = isFM ? station!.city : (site!.cellName || "—");
  const inspected = isFM ? station!.inspection69 === "ตรวจแล้ว" : site!.status === "ตรวจแล้ว";
  const lawSent = !isFM && !!site!.lawPaperSent;
  const revoked = !!isFM && station!.revoked === true;
  const lat = isFM ? station!.latitude : (site!.lat ?? 0);
  const lng = isFM ? station!.longitude : (site!.long ?? 0);
  const canNavigate = isFM ? true : site!.lat !== null && site!.long !== null;
  const hasSource = !!isINT && site!.sourceLat !== null && site!.sourceLong !== null;
  const showSourceControls = !!isINT && !!onStartMarkSource;

  const handleSubmitCoords = () => {
    const r = parseLatLngInput(latInput, lngInput);
    if (!r.ok) {
      setCoordError(r.error);
      return;
    }
    setCoordError(null);
    onSubmitSourceCoords?.(r.lat, r.lng);
    setLatInput("");
    setLngInput("");
    setCoordsOpen(false);
  };

  return (
    <div
      style={{
        background: "var(--fo-sheet-bg)",
        borderTop: "1px solid var(--fo-rail-border)",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        boxShadow: "0 -8px 24px rgba(0,30,43,0.1)",
        maxHeight: expanded ? "70vh" : 320,
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
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              marginLeft: 4,
              border: "1px solid var(--fo-rail-border)",
              background: "transparent",
              color: "var(--fo-rail-mute)",
              width: 28,
              height: 28,
              borderRadius: 6,
              fontSize: 14,
              cursor: "pointer",
              lineHeight: 1,
              padding: 0,
            }}
          >
            ✕
          </button>
        )}
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
            {hasSource && site!.estimateDistance !== null && site!.estimateDistance !== undefined && (
              <Inline label="DIST" value={`${site!.estimateDistance.toFixed(1)} km`} />
            )}
          </>
        )}
      </div>

      <div style={{ padding: "12px 16px 0", display: "flex", gap: 8 }}>
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
            background: revoked
              ? "var(--fo-crit)"
              : inspected
                ? "var(--fo-ink)"
                : "var(--fo-white)",
            color: revoked
              ? "#ffffff"
              : inspected
                ? "var(--fo-accent)"
                : "var(--fo-ink)",
            border: `1px solid ${
              revoked
                ? "var(--fo-crit)"
                : inspected
                  ? "var(--fo-ink)"
                  : "var(--fo-line)"
            }`,
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

      {showSourceControls && (
        <div style={{ padding: "10px 16px 0" }}>
          {hasSource ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onClearSource}
                disabled={pending}
                className="fo-mono"
                style={{
                  flex: 1,
                  padding: "11px",
                  background: "transparent",
                  color: "var(--fo-rail-mute)",
                  border: "1px solid var(--fo-rail-border)",
                  borderRadius: 999,
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  fontWeight: 700,
                  cursor: pending ? "wait" : "pointer",
                }}
              >
                ✕ CLEAR
              </button>
              <button
                type="button"
                onClick={onStartMarkSource}
                disabled={pending}
                className="fo-mono"
                style={{
                  flex: 2,
                  padding: "11px",
                  background: "transparent",
                  color: "var(--fo-accent)",
                  border: "1px solid var(--fo-accent)",
                  borderRadius: 999,
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  fontWeight: 700,
                  cursor: pending ? "wait" : "pointer",
                }}
              >
                ⊕ RE-MARK SOURCE
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onStartMarkSource}
              disabled={pending}
              className="fo-mono"
              style={{
                width: "100%",
                padding: "12px",
                background: "transparent",
                color: "var(--fo-accent)",
                border: "1px dashed var(--fo-accent)",
                borderRadius: 999,
                fontSize: 11,
                letterSpacing: "0.2em",
                fontWeight: 700,
                cursor: pending ? "wait" : "pointer",
              }}
            >
              ⊕ MARK SOURCE
            </button>
          )}
        </div>
      )}

      {isFM && onCreateInspection && currentUser && inspectors && (
        <div style={{ padding: "10px 16px 0" }}>
          <InspectionPanel
            stationId={Number(station!.id)}
            history={inspectionHistory ?? []}
            currentUser={currentUser}
            inspectors={inspectors}
            onCreate={onCreateInspection}
          />
        </div>
      )}

      <div style={{ height: 12 }} />

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

          {showSourceControls && onSubmitSourceCoords && (
            <div
              style={{
                padding: 12,
                border: "1px solid var(--fo-rail-border)",
                borderRadius: 10,
                marginBottom: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setCoordsOpen((v) => !v)}
                className="fo-mono"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  color: "var(--fo-rail-mute)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  cursor: "pointer",
                }}
              >
                <span>ENTER COORDS MANUALLY</span>
                <span>{coordsOpen ? "▴" : "▾"}</span>
              </button>
              {coordsOpen && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="LAT 13.756"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSubmitCoords();
                      }}
                      disabled={pending}
                      className="fo-mono"
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="LONG 100.501"
                      value={lngInput}
                      onChange={(e) => setLngInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSubmitCoords();
                      }}
                      disabled={pending}
                      className="fo-mono"
                      style={inputStyle}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmitCoords}
                    disabled={pending || (!latInput.trim() && !lngInput.trim())}
                    className="fo-mono"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "var(--fo-accent-2)",
                      color: "#fff",
                      border: "1px solid var(--fo-accent-2)",
                      borderRadius: 8,
                      cursor: pending ? "wait" : "pointer",
                      fontSize: 11,
                      letterSpacing: "0.14em",
                    }}
                  >
                    SAVE COORDS
                  </button>
                  {coordError && (
                    <div className="fo-mono" style={{ color: "var(--fo-crit)", fontSize: 10 }}>
                      ✕ {coordError}
                    </div>
                  )}
                  <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", fontSize: 10 }}>
                    Tip: paste &quot;13.756, 100.501&quot; into LAT
                  </div>
                </div>
              )}
            </div>
          )}

          {(() => {
            const cells: React.ReactNode[] = [];
            if (isFM) {
              if (station!.transmitterPower !== undefined) {
                cells.push(<Cell key="power" label="POWER" value={`${station!.transmitterPower} W`} />);
              }
              // INSPECTED cell removed — InspectionPanel below now shows the
              // latest inspection (date + lead + helpers) in a richer form.
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

const inputStyle: React.CSSProperties = {
  minWidth: 0,
  width: "100%",
  padding: "10px 10px",
  background: "var(--fo-canvas)",
  color: "var(--fo-rail-text)",
  border: "1px solid var(--fo-rail-border)",
  borderRadius: 8,
  fontSize: 13,
  boxSizing: "border-box",
};

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
