"use client";

import { useEffect, useState } from "react";
import type { CameraSource } from "@/types/camera";
import { haversineDistanceKm } from "@/utils/distance";
import { isCameraInspected } from "@/utils/cameraSources";

function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/** Camera details, used by both the desktop panel and the mobile sheet. */
export function FieldOpsCameraDetail({
  camera,
  pending,
  onToggleInspection,
  onClose,
  mobile = false,
}: {
  camera: CameraSource;
  pending: boolean;
  onToggleInspection: () => void;
  onClose?: () => void;
  mobile?: boolean;
}) {
  const [confirmUndo, setConfirmUndo] = useState(false);
  useEffect(() => setConfirmUndo(false), [camera.id]);

  const inspected = isCameraInspected(camera);
  const cell = camera.cellSite;
  const distanceKm = cell ? haversineDistanceKm(camera.lat, camera.lng, cell.lat, cell.lng) : null;
  const text = mobile ? "var(--fo-sheet-text)" : "var(--fo-rail-text)";

  return (
    <div
      style={{
        padding: mobile ? "14px 16px calc(16px + env(safe-area-inset-bottom, 0px))" : 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflowY: "auto",
        pointerEvents: "auto",
        ...(mobile
          ? {
              maxHeight: "70%",
              background: "var(--fo-sheet-bg)",
              borderTop: "1px solid var(--fo-rail-border)",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              boxShadow: "0 -8px 24px rgba(0,30,43,0.35)",
            }
          : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: "var(--fo-crit)", color: "#ffffff" }}>
          กล้อง
        </span>
        <span style={{ fontSize: 12, color: inspected ? "var(--fo-accent)" : "var(--fo-warn)" }}>
          {inspected ? "ตรวจแล้ว" : "ยังไม่ตรวจ"}
        </span>
        <div style={{ flex: 1 }} />
        {onClose && (
          <button
            type="button"
            aria-label="ปิด"
            onClick={onClose}
            style={{ width: 44, height: 44, border: "none", background: "transparent", color: "var(--fo-rail-mute)", fontSize: 20, cursor: "pointer" }}
          >
            ✕
          </button>
        )}
      </div>

      <div>
        <div style={{ fontSize: 21, fontWeight: 600, color: text, lineHeight: 1.25 }}>{camera.code}</div>
        <div style={{ fontSize: 13, color: "var(--fo-rail-mute)", marginTop: 2 }}>
          แหล่งรบกวน cell site · {camera.province} · {camera.district}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="วันที่พบ" value={camera.foundOn} color={text} />
        <Field label="จุดเด่น" value={camera.landmark ?? "—"} color={text} />
        <Field label="Cell site" value={cell?.name ?? "ไม่พบ cell site"} color={text} />
        {cell && <Field label="ผู้ให้บริการ" value={cell.operators.join(", ") || "—"} color={text} />}
        {distanceKm !== null && <Field label="ระยะจาก cell site" value={`${distanceKm.toFixed(2)} km`} color={text} />}
        {inspected && camera.inspectedByName && <Field label="ตรวจโดย" value={camera.inspectedByName} color={text} />}
      </div>

      {confirmUndo ? (
        <div>
          <div style={{ fontSize: 14, color: text, marginBottom: 8 }}>ยกเลิกการตรวจกล้องนี้?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setConfirmUndo(false)} style={{ ...action, background: "transparent", color: text, border: "1px solid var(--fo-rail-border)" }}>
              ไม่ยกเลิก
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setConfirmUndo(false);
                onToggleInspection();
              }}
              style={{ ...action, background: "var(--fo-crit)", color: "#ffffff", border: "1px solid var(--fo-crit)" }}
            >
              ยกเลิกการตรวจ
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href={googleMapsUrl(camera.lat, camera.lng)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...action, background: "var(--fo-accent)", color: "var(--fo-ink)", border: "1px solid transparent", textDecoration: "none" }}
          >
            ▶ นำทาง
          </a>
          <button
            type="button"
            disabled={pending}
            aria-pressed={inspected}
            onClick={inspected ? () => setConfirmUndo(true) : onToggleInspection}
            style={{
              ...action,
              background: inspected ? "transparent" : "var(--fo-white)",
              color: inspected ? "var(--fo-accent)" : "var(--fo-ink)",
              border: `1px solid ${inspected ? "var(--fo-accent)" : "var(--fo-white)"}`,
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.6 : 1,
            }}
          >
            {inspected ? "✓ ตรวจแล้ว" : "ตรวจ"}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: "var(--fo-rail-mute)" }}>{label}</div>
      <div style={{ fontSize: 14, color, lineHeight: 1.4, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

const action: React.CSSProperties = {
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
