"use client";

import { useEffect, useRef } from "react";
import type { AdminStation } from "@/types/station";

/**
 * In-app confirm for deleting a station from the Data tab. Replaces
 * window.confirm so the warning about inspection history can be loud enough,
 * and so the safe choice (ยกเลิก) holds focus — Enter alone never deletes.
 */
export function DeleteStationDialog({
  station,
  busy,
  onCancel,
  onConfirm,
}: {
  station: AdminStation;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const history = station.inspectionCount;

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      onClick={busy ? undefined : onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0, 12, 18, 0.62)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-station-title"
        aria-describedby="delete-station-desc"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--fo-band)",
          color: "var(--fo-band-text)",
          border: "1px solid var(--fo-divider)",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            aria-hidden
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "color-mix(in srgb, var(--fo-crit) 16%, transparent)",
              color: "var(--fo-crit)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </div>
          <div>
            <div id="delete-station-title" className="fo-serif" style={{ fontSize: 20 }}>
              ลบสถานีนี้?
            </div>
            <div style={{ fontSize: 12, color: "var(--fo-band-mute)" }}>การลบย้อนกลับจากหน้านี้ไม่ได้</div>
          </div>
        </div>

        <div
          id="delete-station-desc"
          style={{
            background: "var(--fo-band-inset)",
            border: "1px solid var(--fo-divider)",
            borderRadius: 10,
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600 }}>{station.name}</div>
          <div className="fo-mono" style={{ fontSize: 12, color: "var(--fo-band-mute)" }}>
            {station.idFm ?? "—"} · {station.freq ?? "—"} MHz
          </div>
          <div style={{ fontSize: 12, color: "var(--fo-band-mute)" }}>
            {station.district}, {station.province}
          </div>
        </div>

        {history > 0 && (
          <div
            role="note"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              borderRadius: 10,
              padding: "10px 12px",
              border: "1px solid color-mix(in srgb, var(--fo-crit) 55%, transparent)",
              background: "color-mix(in srgb, var(--fo-crit) 10%, transparent)",
              color: "var(--fo-crit)",
              fontSize: 13,
            }}
          >
            <span aria-hidden style={{ fontSize: 15, lineHeight: "18px" }}>⚠</span>
            <span>
              ประวัติการตรวจ <strong>{history} ครั้ง</strong> จะถูกลบไปด้วย
              <span style={{ display: "block", fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                ระบบเก็บสำเนาไว้ในบันทึกการแก้ไข (data_change)
              </span>
            </span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "1px solid var(--fo-divider)",
              background: "transparent",
              color: "var(--fo-band-text)",
              cursor: "pointer",
            }}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "none",
              background: "var(--fo-crit)",
              color: "#fff",
              fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "กำลังลบ…" : "ลบสถานี"}
          </button>
        </div>
      </div>
    </div>
  );
}
