"use client";

import { useEffect, useRef, useState } from "react";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import type { FieldSelection } from "./FieldOpsMap";
import { parseLatLngInput } from "@/utils/parseLatLng";
import TeammatePicker, { type InspectorOption } from "./TeammatePicker";
import InspectionTeamChips from './InspectionTeamChips';
import type { InspectionMember } from '@/types/inspection';
import { stationLabel } from "@/utils/stationLabel";
import { isRelicensed } from "@/utils/pinBucket";
import { rankingLabel } from "@/utils/rankingLabel";

function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function FieldOpsBottomSheet({
  selection,
  station,
  site,
  coLocatedStations,
  coLocatedSites,
  onSelectStation,
  onSelectSite,
  onToggleInspection,
  onToggleLawPaper,
  onToggleOnAir,
  onClose,
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
  lastInspection,
}: {
  selection: FieldSelection;
  station: FMStation | null;
  site: InterferenceSite | null;
  coLocatedStations?: FMStation[];
  coLocatedSites?: InterferenceSite[];
  onSelectStation?: (id: string | number) => void;
  onSelectSite?: (id: number) => void;
  onToggleInspection: () => void;
  onToggleLawPaper: () => void;
  onToggleOnAir?: () => void;
  onClose?: () => void;
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
  lastInspection?: {
    lead: InspectionMember;
    helpers: InspectionMember[];
    inspectedOn: string;
  } | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [coordsOpen, setCoordsOpen] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const handleSwipeStart = (e: React.TouchEvent) => {
    // Inputs swallow touch handling entirely (keyboard, selection, etc).
    // For buttons/links we still TRACK the swipe so users can drag-to-expand
    // from anywhere in the sheet — the 30px threshold below keeps taps
    // from accidentally triggering expand/collapse.
    if ((e.target as HTMLElement).closest('input, textarea')) {
      touchStartY.current = null;
      return;
    }
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };
  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
    const dy = touchStartY.current - endY;
    touchStartY.current = null;
    if (dy > 30) setExpanded(true);
    else if (dy < -30) setExpanded(false);
  };
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

  const selectionKey = selection ? `${selection.kind}:${selection.id}` : null;
  useEffect(() => {
    setConfirmUndo(false);
  }, [selectionKey]);

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
          pointerEvents: "auto",
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
          <div style={{ color: "var(--fo-accent)", fontSize: 12 }}>
            ปักหมุดแหล่งรบกวน
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
            แตะแผนที่เพื่อปักหมุดแหล่งรบกวน
          </div>
        </div>
        <button
          type="button"
          onClick={onCancelMarkSource}
          disabled={pending}
          style={{
            minHeight: 44,
            padding: "0 14px",
            background: "transparent",
            color: "var(--fo-warn)",
            border: "1px solid var(--fo-warn)",
            borderRadius: 999,
            fontSize: 13,
            cursor: pending ? "wait" : "pointer",
            flexShrink: 0,
          }}
        >
          ✕ ยกเลิก
        </button>
      </div>
    );
  }

  if (!selection || (!station && !site)) {
    return null;
  }

  const isFM = selection.kind === "fm" && station;
  const isINT = selection.kind === "int" && site;
  const id = isFM ? stationLabel(station!) : `INT-${site!.id}`;
  const title = isFM ? station!.name : (site!.siteName || site!.siteCode || `จุด #${site!.id}`);
  const province = isFM ? station!.state : site!.changwat || "";
  const district = isFM ? station!.city : (site!.cellName || "—");
  const inspected = isFM ? station!.inspection69 === "ตรวจแล้ว" : site!.status === "ตรวจแล้ว";
  const lawSent = !isFM && !!site!.lawPaperSent;
  const revoked = !!isFM && station!.revoked === true;
  const onAir = !!isFM && station!.onAir !== false;
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
      onTouchStart={handleSwipeStart}
      onTouchEnd={handleSwipeEnd}
      style={{
        background: "var(--fo-sheet-bg)",
        borderTop: "1px solid var(--fo-rail-border)",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        boxShadow: "0 -8px 24px rgba(0,30,43,0.35)",
        // Shares of the map area the sheet floats over (see FieldOpsClient).
        maxHeight: expanded ? "100%" : "70%",
        pointerEvents: "auto",
        transition: "max-height 220ms ease",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "ย่อ" : "ขยาย"}
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "10px 0 4px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          touchAction: "none",
          flexShrink: 0,
        }}
      >
        <span style={{ width: 56, height: 5, borderRadius: 999, background: "var(--fo-line)" }} />
      </button>

      <div style={{ padding: "0 8px 0 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span
          style={{
            padding: "3px 8px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
            background: isFM ? "var(--fo-ink)" : "var(--fo-accent-2)",
            color: isFM ? "var(--fo-accent)" : "var(--fo-white)",
          }}
        >
          {isFM ? "FM" : "รบกวน"}
        </span>
        <span
          style={{
            ...ellipsis,
            fontFamily: "var(--fo-mono)",
            fontSize: 13,
            color: "var(--fo-rail-mute)",
            minWidth: 0,
          }}
        >
          {id}
        </span>
        {/* Only the exception gets a tag: on air is the normal state, and the
            inspect button below already says whether the station is done. */}
        {isFM && !onAir && (
          <span
            style={{
              padding: "3px 8px",
              borderRadius: 999,
              border: "1px solid var(--fo-warn)",
              color: "var(--fo-warn)",
              fontSize: 11,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            ไม่ออกอากาศ
          </span>
        )}
        <div style={{ flex: 1 }} />
        {onClose && (
          <button
            type="button"
            aria-label="ปิด"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--fo-rail-mute)",
              width: 44,
              height: 44,
              flexShrink: 0,
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
              padding: 0,
              touchAction: "manipulation",
            }}
          >
            ✕
          </button>
        )}
      </div>

      <div style={{ padding: "0 16px", flexShrink: 0 }}>
        <div
          style={{
            fontSize: 19,
            fontWeight: 600,
            color: "var(--fo-sheet-text)",
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, color: "var(--fo-rail-mute)", marginTop: 2, lineHeight: 1.4 }}>
          {isFM && (
            <span style={{ color: "var(--fo-sheet-text)", fontWeight: 600 }}>
              {station!.frequency.toFixed(2)} MHz ·{" "}
            </span>
          )}
          {province} · {district}
        </div>
      </div>

      <CoLocatedStrip
        isFM={!!isFM}
        currentId={isFM ? station!.id : site!.id}
        stations={coLocatedStations}
        sites={coLocatedSites}
        onSelectStation={onSelectStation}
        onSelectSite={onSelectSite}
      />

      {confirmUndo ? (
        <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
          <div style={{ fontSize: 14, color: "var(--fo-sheet-text)", marginBottom: 8 }}>
            ยกเลิกการตรวจสถานีนี้?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setConfirmUndo(false)}
              style={{
                ...actionStyle,
                background: "transparent",
                color: "var(--fo-sheet-text)",
                border: "1px solid var(--fo-rail-border)",
              }}
            >
              ไม่ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmUndo(false);
                onToggleInspection();
              }}
              disabled={pending}
              style={{
                ...actionStyle,
                background: "var(--fo-crit)",
                color: "#ffffff",
                border: "1px solid var(--fo-crit)",
              }}
            >
              ยกเลิกการตรวจ
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: "12px 16px 0", display: "flex", gap: 8, flexShrink: 0 }}>
          <a
            href={canNavigate ? googleMapsUrl(lat, lng) : "#"}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!canNavigate}
            onClick={(e) => {
              if (!canNavigate) e.preventDefault();
            }}
            style={{
              ...actionStyle,
              background: canNavigate ? "var(--fo-accent)" : "var(--fo-line)",
              color: "var(--fo-ink)",
              border: "1px solid transparent",
              textDecoration: "none",
            }}
          >
            ▶ นำทาง
          </a>
          <button
            type="button"
            // Marking is one tap; undoing deletes the Discord notice, so it asks first.
            onClick={inspected ? () => setConfirmUndo(true) : onToggleInspection}
            disabled={pending}
            aria-pressed={inspected}
            style={{
              ...actionStyle,
              background: inspected
                ? "transparent"
                : revoked
                  ? "var(--fo-crit)"
                  : "var(--fo-white)",
              color: inspected
                ? "var(--fo-accent)"
                : revoked
                  ? "#ffffff"
                  : "var(--fo-ink)",
              border: `1px solid ${
                inspected ? "var(--fo-accent)" : revoked ? "var(--fo-crit)" : "var(--fo-white)"
              }`,
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.6 : 1,
            }}
          >
            {inspected ? "✓ ตรวจแล้ว" : "ตรวจ"}
          </button>
        </div>
      )}

      {((isFM && station!.inspection69 !== 'ตรวจแล้ว')
        || (isINT && site!.status !== 'ตรวจแล้ว'))
        && onHelperUserIdsChange
        && inspectors
        && currentUser && (
        <div style={{ padding: '4px 16px 0', flexShrink: 0 }}>
          <TeammatePicker
            inspectors={inspectors}
            currentUserId={currentUser.id}
            value={helperUserIds ?? []}
            onChange={onHelperUserIdsChange}
            disabled={pending}
          />
        </div>
      )}

      {showSourceControls && (
        <div style={{ padding: "8px 16px 0", flexShrink: 0 }}>
          {hasSource ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onClearSource}
                disabled={pending}
                style={{
                  ...secondaryStyle,
                  flex: 1,
                  color: "var(--fo-rail-mute)",
                  border: "1px solid var(--fo-rail-border)",
                  cursor: pending ? "wait" : "pointer",
                }}
              >
                ✕ ล้างหมุด
              </button>
              <button
                type="button"
                onClick={onStartMarkSource}
                disabled={pending}
                style={{
                  ...secondaryStyle,
                  flex: 2,
                  color: "var(--fo-accent)",
                  border: "1px solid var(--fo-accent)",
                  cursor: pending ? "wait" : "pointer",
                }}
              >
                ⊕ ปักหมุดใหม่
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onStartMarkSource}
              disabled={pending}
              style={{
                ...secondaryStyle,
                width: "100%",
                color: "var(--fo-accent)",
                border: "1px dashed var(--fo-accent)",
                cursor: pending ? "wait" : "pointer",
              }}
            >
              ⊕ ปักหมุดแหล่งรบกวน
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          minHeight: 40,
          padding: "0 16px",
          background: "transparent",
          border: "none",
          color: "var(--fo-rail-mute)",
          fontSize: 13,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {expanded ? "ซ่อนรายละเอียด ▾" : "รายละเอียด ▴"}
      </button>

      {expanded && (
        <div
          style={{
            padding: "0 16px 24px",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            flex: 1,
            minHeight: 0,
          }}
        >
          {isFM && onToggleOnAir && (
            <div
              style={{
                padding: "10px 12px",
                border: "1px solid var(--fo-rail-border)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={labelStyle}>สถานะออกอากาศ</div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: onAir ? "var(--fo-sheet-text)" : "var(--fo-warn)",
                  }}
                >
                  {onAir ? "ออกอากาศ" : "ไม่ออกอากาศ"}
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleOnAir}
                disabled={pending}
                style={{
                  ...secondaryStyle,
                  padding: "0 14px",
                  color: "var(--fo-sheet-text)",
                  border: "1px solid var(--fo-rail-border)",
                  cursor: pending ? "wait" : "pointer",
                  opacity: pending ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                {onAir ? "เปลี่ยนเป็นไม่ออกอากาศ" : "เปลี่ยนเป็นออกอากาศ"}
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {isFM ? (
              station!.permit && (
                <Inline
                  label={isRelicensed(station!) ? "ผู้รับใบอนุญาตรายใหม่" : "ผู้รับใบอนุญาต"}
                  value={station!.permit}
                />
              )
            ) : (
              <div style={{ display: "flex", gap: 16 }}>
                {site!.avgNiCarrier !== null && site!.avgNiCarrier !== undefined && (
                  <Inline label="N/I" value={`${site!.avgNiCarrier.toFixed(1)}`} />
                )}
                {site!.ranking && <Inline label="ระดับ" value={rankingLabel(site!.ranking)} />}
              </div>
            )}
          </div>

          {inspected && lastInspection && (
            <div style={{ marginBottom: 10 }}>
              <InspectionTeamChips
                lead={lastInspection.lead}
                helpers={lastInspection.helpers}
                inspectedOn={lastInspection.inspectedOn}
              />
            </div>
          )}

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
                <span style={{ fontSize: 12 }}>หนังสือแจ้ง</span>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {lawSent ? "ส่งแล้ว" : "ยังไม่ส่ง"}
                </div>
              </span>
              <span style={{ fontSize: 12, color: "#5c6c75" }}>แตะเพื่อสลับ</span>
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
                style={{
                  width: "100%",
                  minHeight: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  color: "var(--fo-rail-mute)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <span>กรอกพิกัดเอง</span>
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
                    style={{
                      width: "100%",
                      minHeight: 44,
                      padding: "10px 12px",
                      background: "var(--fo-accent-2)",
                      color: "#fff",
                      border: "1px solid var(--fo-accent-2)",
                      borderRadius: 8,
                      cursor: pending ? "wait" : "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    บันทึกพิกัด
                  </button>
                  {coordError && (
                    <div style={{ color: "var(--fo-crit)", fontSize: 12 }}>
                      ✕ {coordError}
                    </div>
                  )}
                  <div style={{ color: "var(--fo-rail-mute)", fontSize: 12 }}>
                    เคล็ดลับ: วาง &quot;13.756, 100.501&quot; ในช่อง LAT
                  </div>
                </div>
              )}
            </div>
          )}

          {(() => {
            const cells: React.ReactNode[] = [];
            if (isFM) {
              if (station!.transmitterPower !== undefined) {
                cells.push(<Cell key="power" label="กำลังส่ง" value={`${station!.transmitterPower} W`} />);
              }
              if (station!.dateInspected) {
                cells.push(<Cell key="inspected" label="วันที่ตรวจ" value={station!.dateInspected} />);
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

const ellipsis: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

// Thai labels: no tracking and no uppercase — the `.fo-mono` look pulls Thai
// words apart at phone sizes.
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--fo-rail-mute)",
};

const actionStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 48,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 12px",
  borderRadius: 12,
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  touchAction: "manipulation",
};

const secondaryStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "0 12px",
  background: "transparent",
  borderRadius: 12,
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  touchAction: "manipulation",
};

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
      <span style={labelStyle}>{label}</span>
      <span
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

function CoLocatedStrip({
  isFM,
  currentId,
  stations,
  sites,
  onSelectStation,
  onSelectSite,
}: {
  isFM: boolean;
  currentId: string | number;
  stations?: FMStation[];
  sites?: InterferenceSite[];
  onSelectStation?: (id: string | number) => void;
  onSelectSite?: (id: number) => void;
}) {
  const others = isFM
    ? (stations ?? []).filter((s) => s.id !== currentId)
    : (sites ?? []).filter((s) => s.id !== currentId);
  if (others.length === 0) return null;
  return (
    <div style={{ padding: "8px 16px 0", flexShrink: 0 }}>
      <div style={{ ...labelStyle, marginBottom: 6 }}>
        ที่เดียวกัน · {others.length}
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          scrollbarWidth: "none",
          paddingBottom: 2,
        }}
      >
        {others.map((s) => {
          const isStation = "frequency" in s;
          const label = isStation
            ? `${s.name} · ${s.frequency.toFixed(2)}`
            : (s.siteName || s.siteCode || `จุด #${s.id}`);
          const handleClick = () => {
            if (isStation) onSelectStation?.(s.id);
            else onSelectSite?.(s.id);
          };
          const inspected = isStation
            ? s.inspection69 === "ตรวจแล้ว"
            : s.status === "ตรวจแล้ว";
          return (
            <button
              key={String(s.id)}
              type="button"
              onClick={handleClick}
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                minHeight: 44,
                border: "1px solid var(--fo-rail-border)",
                borderRadius: 999,
                background: "transparent",
                color: "var(--fo-sheet-text)",
                fontSize: 13,
                cursor: "pointer",
                maxWidth: 240,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: inspected ? "var(--fo-accent-2)" : "var(--fo-warn)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
              {!inspected && (
                <span style={{ color: "var(--fo-warn)", flexShrink: 0 }}>ยังไม่ตรวจ</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  // Cell sits inside a `--fo-paper-2` (cream) container, so text must be DARK
  // regardless of the sheet's surrounding dark surface. Using the sheet-text /
  // rail-mute tokens here would render light-on-light and be invisible.
  return (
    <div>
      <div style={{ fontSize: 12, color: "#5c6c75", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: "#001e2b" }}>{value}</div>
    </div>
  );
}
