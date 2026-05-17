"use client";

import { useEffect, useState } from "react";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import { parseLatLngInput } from "@/utils/parseLatLng";
import TeammatePicker, { type InspectorOption } from "./TeammatePicker";

interface CommonAction {
  label: string;
  pending: string;
  inverse?: boolean;
  onClick: () => void;
  variant?: "primary" | "ghost" | "warn" | "danger";
  disabled?: boolean;
}

function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

function isMain(s: FMStation): boolean {
  return s.type === "สถานีหลัก" || s.genre === "สถานีหลัก";
}

export function FieldOpsCurrentFM({
  station,
  coLocated,
  onSelectStation,
  onToggleInspection,
  onToggleOnAir,
  pending,
  inspectors,
  currentUser,
  helperUserIds,
  onHelperUserIdsChange,
}: {
  station: FMStation;
  coLocated?: FMStation[];
  onSelectStation?: (id: string | number) => void;
  onToggleInspection: () => void;
  onToggleOnAir?: () => void;
  pending: boolean;
  inspectors?: InspectorOption[];
  currentUser?: { id: number; displayName: string };
  helperUserIds?: number[];
  onHelperUserIdsChange?: (helperUserIds: number[]) => void;
}) {
  const inspected = station.inspection69 === "ตรวจแล้ว";
  const main = isMain(station);
  const others = (coLocated ?? []).filter((s) => s.id !== station.id);

  return (
    <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Badge tone="fm">FM</Badge>
        {station.revoked && (
          <span
            className="fo-mono"
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--fo-crit)",
              color: "#ffffff",
              fontSize: 9,
              letterSpacing: 0.5,
              fontWeight: 700,
            }}
            title={station.revokedNote || "ใบอนุญาตถูกเพิกถอน"}
          >
            ⚠ REVOKED
          </span>
        )}
        {main && (
          <span
            className="fo-mono"
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: "#ffd24a",
              color: "#001e2b",
              fontSize: 9,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontWeight: 700,
            }}
            title="สถานีหลัก · main station"
          >
            ★ MAIN
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
            variant: station.revoked ? "danger" : (inspected ? "ghost" : "primary"),
            disabled: pending,
            inverse: inspected,
          },
        ]}
        loading={pending}
      />

      {station.inspection69 !== 'ตรวจแล้ว'
        && onHelperUserIdsChange
        && inspectors
        && currentUser && (
        <TeammatePicker
          inspectors={inspectors}
          currentUserId={currentUser.id}
          value={helperUserIds ?? []}
          onChange={onHelperUserIdsChange}
          disabled={pending}
        />
      )}

      {onToggleOnAir && (
        <ButtonRow
          actions={[
            {
              label: station.onAir ? "📡 ON AIR · STOP" : "📡 OFF AIR · GO LIVE",
              pending: "...",
              onClick: onToggleOnAir,
              variant: station.onAir ? "warn" : "primary",
              disabled: pending,
              inverse: station.onAir,
            },
          ]}
          loading={pending}
        />
      )}

      {others.length > 0 && (
        <div
          style={{
            marginTop: 4,
            paddingTop: 12,
            borderTop: "1px solid var(--fo-rail-border)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>
            ALSO AT THIS LOCATION · {others.length}
          </div>
          {others.map((s) => {
            const sInsp = s.inspection69 === "ตรวจแล้ว";
            const sMain = isMain(s);
            return (
              <button
                key={String(s.id)}
                type="button"
                onClick={() => onSelectStation?.(s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid var(--fo-rail-border)",
                  cursor: onSelectStation ? "pointer" : "default",
                  color: "var(--fo-rail-text)",
                  fontFamily: "var(--fo-body)",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: sInsp ? "var(--fo-accent-2)" : "var(--fo-accent)",
                    flexShrink: 0,
                  }}
                />
                {sMain && <span style={{ color: "#ffd24a", fontSize: 12 }}>★</span>}
                <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                </span>
                <span className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>
                  {s.frequency.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FieldOpsCurrentINT({
  site,
  coLocated,
  onSelectSite,
  onToggleInspection,
  onToggleLawPaper,
  pending,
  marking = false,
  onStartMarkSource,
  onCancelMarkSource,
  onClearSource,
  onSubmitSourceCoords,
  inspectors,
  currentUser,
  helperUserIds,
  onHelperUserIdsChange,
}: {
  site: InterferenceSite;
  coLocated?: InterferenceSite[];
  onSelectSite?: (id: number) => void;
  onToggleInspection: () => void;
  onToggleLawPaper: () => void;
  pending: boolean;
  marking?: boolean;
  onStartMarkSource?: () => void;
  onCancelMarkSource?: () => void;
  onClearSource?: () => void;
  onSubmitSourceCoords?: (lat: number, lng: number) => void;
  inspectors?: InspectorOption[];
  currentUser?: { id: number; displayName: string };
  helperUserIds?: number[];
  onHelperUserIdsChange?: (helperUserIds: number[]) => void;
}) {
  const inspected = site.status === "ตรวจแล้ว";
  const lawSent = !!site.lawPaperSent;
  const others = (coLocated ?? []).filter((s) => s.id !== site.id);
  const hasSource = site.sourceLat !== null && site.sourceLong !== null;
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [coordError, setCoordError] = useState<string | null>(null);

  useEffect(() => {
    setLatInput("");
    setLngInput("");
    setCoordError(null);
  }, [site.id]);

  const handleSubmitCoords = () => {
    if (!onSubmitSourceCoords) return;
    const r = parseLatLngInput(latInput, lngInput);
    if (!r.ok) {
      setCoordError(r.error);
      return;
    }
    setCoordError(null);
    onSubmitSourceCoords(r.lat, r.lng);
    setLatInput("");
    setLngInput("");
  };

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
          <Meter label="DIST" value={`${site.estimateDistance.toFixed(2)} km`} />
        )}
      </div>

      {hasSource && (
        <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", fontSize: 11 }}>
          SOURCE · {site.sourceLat!.toFixed(5)}, {site.sourceLong!.toFixed(5)}
        </div>
      )}

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

      {(onStartMarkSource || onClearSource || onSubmitSourceCoords) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {marking ? (
            <>
              <div
                className="fo-mono"
                style={{
                  color: "var(--fo-accent)",
                  fontSize: 11,
                  padding: "8px 12px",
                  border: "1px dashed var(--fo-accent)",
                  borderRadius: 8,
                }}
              >
                ◎ Click on the map to drop the source pin · ESC to cancel
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
                  borderRadius: 12,
                  cursor: pending ? "wait" : "pointer",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                }}
              >
                ✕ CANCEL
              </button>
            </>
          ) : hasSource ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onClearSource}
                disabled={pending}
                className="fo-mono"
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  background: "transparent",
                  color: "var(--fo-rail-mute)",
                  border: "1px solid var(--fo-divider)",
                  borderRadius: 12,
                  cursor: pending ? "wait" : "pointer",
                  fontSize: 11,
                  letterSpacing: "0.12em",
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
                  padding: "10px 14px",
                  background: "transparent",
                  color: "var(--fo-accent)",
                  border: "1px solid var(--fo-accent)",
                  borderRadius: 12,
                  cursor: pending ? "wait" : "pointer",
                  fontSize: 11,
                  letterSpacing: "0.12em",
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
                padding: "12px 14px",
                background: "var(--fo-accent)",
                color: "var(--fo-ink)",
                border: "1px solid var(--fo-accent)",
                borderRadius: 12,
                cursor: pending ? "wait" : "pointer",
                fontSize: 11,
                letterSpacing: "0.12em",
              }}
            >
              ⊕ MARK SOURCE
            </button>
          )}

          {!marking && onSubmitSourceCoords && (
            <div
              style={{
                marginTop: 4,
                paddingTop: 8,
                borderTop: "1px dashed var(--fo-divider)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", fontSize: 10 }}>
                OR ENTER COORDS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, minWidth: 0 }}>
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
                  style={{
                    minWidth: 0,
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--fo-canvas)",
                    color: "var(--fo-rail-text)",
                    border: "1px solid var(--fo-divider)",
                    borderRadius: 8,
                    fontSize: 12,
                    boxSizing: "border-box",
                  }}
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
                  style={{
                    minWidth: 0,
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--fo-canvas)",
                    color: "var(--fo-rail-text)",
                    border: "1px solid var(--fo-divider)",
                    borderRadius: 8,
                    fontSize: 12,
                    boxSizing: "border-box",
                  }}
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
                  letterSpacing: "0.12em",
                  boxSizing: "border-box",
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

      {others.length > 0 && (
        <div
          style={{
            marginTop: 4,
            paddingTop: 12,
            borderTop: "1px solid var(--fo-rail-border)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>
            ALSO AT THIS LOCATION · {others.length}
          </div>
          {others.map((s) => {
            const sInsp = s.status === "ตรวจแล้ว";
            const sColor = sInsp
              ? "var(--fo-accent-2)"
              : (s.ranking || "").toLowerCase() === "critical"
                ? "var(--fo-crit)"
                : (s.ranking || "").toLowerCase() === "major"
                  ? "var(--fo-warn)"
                  : "var(--fo-line)";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSite?.(s.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid var(--fo-rail-border)",
                  cursor: onSelectSite ? "pointer" : "default",
                  color: "var(--fo-rail-text)",
                  fontFamily: "var(--fo-body)",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: sColor,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.cellName ?? s.sectorName ?? `#${s.id}`}
                </span>
                <span className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>
                  {s.direction !== null && s.direction !== undefined ? `${s.direction}°` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}
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
          a.variant === "danger"
            ? {
                ...baseStyle,
                background: "var(--fo-crit)",
                color: "#ffffff",
                borderColor: "var(--fo-crit)",
              }
            : a.variant === "warn"
              ? {
                  ...baseStyle,
                  background: "var(--fo-warn)",
                  color: "var(--fo-ink)",
                  borderColor: "var(--fo-warn)",
                }
              : a.variant === "primary"
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
