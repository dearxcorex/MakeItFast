"use client";

import { useState } from "react";
import type { FieldTask } from "../types";
import { googleMapsUrl } from "../types";
import { TypeBadge } from "./TypeBadge";
import { StatusPill, RankingDot } from "./StatusPill";

export function BottomSheet({
  task,
  onToggleInspected,
  onToggleLawPaper,
  expanded,
  onExpandChange,
}: {
  task: FieldTask;
  onToggleInspected: (id: string) => void;
  onToggleLawPaper: (id: string) => void;
  expanded: boolean;
  onExpandChange: (next: boolean) => void;
}) {
  const [note, setNote] = useState(task.note ?? "");
  const isFM = task.type === "fm";
  const inspected = task.status === "inspected";
  const lawSent = task.status === "law_sent";

  return (
    <div
      style={{
        background: "#ffffff",
        borderTop: "1px solid #b8c4c2",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        boxShadow: "0 -8px 24px rgba(0,30,43,0.1)",
        maxHeight: expanded ? 460 : 220,
        transition: "max-height 200ms ease",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Drag handle */}
      <button
        type="button"
        onClick={() => onExpandChange(!expanded)}
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
        <span style={{ width: 48, height: 4, borderRadius: 999, background: "#b8c4c2" }} />
      </button>

      {/* Peek row */}
      <div style={{ padding: "4px 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <TypeBadge type={task.type} />
        <span className="fo-mono">{task.id}</span>
        <div style={{ flex: 1 }} />
        <StatusPill status={task.status} />
      </div>

      <div style={{ padding: "6px 16px 2px" }}>
        <div
          className="fo-serif"
          style={{ fontSize: 20, lineHeight: 1.15, color: "#001e2b" }}
        >
          {task.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 4,
          }}
        >
          <span className="fo-mono">{task.province.toUpperCase()} · {task.district}</span>
          {task.ranking && <RankingDot ranking={task.ranking} />}
        </div>
      </div>

      {/* Inline stats */}
      <div
        style={{
          padding: "8px 16px 2px",
          display: "flex",
          gap: 16,
          fontSize: 12,
          color: "#001e2b",
        }}
      >
        {isFM && task.freq && (
          <InlineStat label="FREQ" value={`${task.freq.toFixed(2)} MHz`} />
        )}
        {!isFM && task.direction !== undefined && (
          <InlineStat label="BEARING" value={`${task.direction}°`} />
        )}
        {task.distanceKm > 0 && (
          <InlineStat label="DIST" value={`${task.distanceKm.toFixed(1)} km`} />
        )}
        {task.etaMinutes > 0 && (
          <InlineStat label="ETA" value={`${task.etaMinutes} min`} />
        )}
      </div>

      {/* Action row — always visible */}
      <div
        style={{
          padding: "10px 16px",
          display: "flex",
          gap: 8,
        }}
      >
        <a
          href={googleMapsUrl(task.lat, task.long)}
          target="_blank"
          rel="noopener noreferrer"
          className="fo-mono"
          style={{
            flex: 1,
            padding: "13px 12px",
            background: "#00ed64",
            color: "#001e2b",
            border: "none",
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
          onClick={() => onToggleInspected(task.id)}
          className="fo-mono"
          style={{
            flex: 1,
            padding: "13px 12px",
            background: inspected ? "#001e2b" : "#ffffff",
            color: inspected ? "#00ed64" : "#001e2b",
            border: `1px solid ${inspected ? "#001e2b" : "#b8c4c2"}`,
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: "0.2em",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {inspected ? "✓ INSPECTED" : "✓ INSPECT"}
        </button>
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "More"}
          onClick={() => onExpandChange(!expanded)}
          style={{
            width: 44,
            padding: 0,
            background: "#ffffff",
            color: "#001e2b",
            border: "1px solid #b8c4c2",
            borderRadius: 999,
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          ⋯
        </button>
      </div>

      {/* Expanded — details + notes */}
      {expanded && (
        <div style={{ padding: "6px 16px 16px", overflowY: "auto" }}>
          <div
            style={{
              padding: 12,
              background: "#f5f3ef",
              border: "1px solid #b8c4c2",
              borderRadius: 10,
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <Cell label="LAT" value={task.lat.toFixed(4)} />
            <Cell label="LONG" value={task.long.toFixed(4)} />
            {task.freq && <Cell label="FREQUENCY" value={`${task.freq.toFixed(2)} MHz`} />}
            {task.direction !== undefined && (
              <Cell label="BEARING" value={`${task.direction}°`} />
            )}
            <Cell label="PROVINCE" value={task.province} />
            <Cell label="DISTRICT" value={task.district} />
          </div>

          {!isFM && (
            <button
              type="button"
              onClick={() => onToggleLawPaper(task.id)}
              style={{
                width: "100%",
                padding: "12px 14px",
                background: lawSent ? "#ffb800" : "#ffffff",
                color: "#001e2b",
                border: `1px solid ${lawSent ? "#ffb800" : "#b8c4c2"}`,
                borderRadius: 10,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 18 }}>{lawSent ? "✉" : "✉"}</span>
              <span style={{ flex: 1 }}>
                <span className="fo-mono">LAW PAPER</span>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {lawSent ? "ส่งแล้ว · Sent" : "ยังไม่ส่ง · Not sent"}
                </div>
              </span>
              <span className="fo-mono" style={{ color: "#5c6c75" }}>TAP TO TOGGLE</span>
            </button>
          )}

          <label style={{ display: "block" }}>
            <span className="fo-mono" style={{ display: "block", marginBottom: 4 }}>NOTE</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add inspection notes…"
              style={{
                width: "100%",
                padding: 10,
                border: "1px solid #b8c4c2",
                borderRadius: 8,
                fontFamily: "inherit",
                fontSize: 13,
                resize: "vertical",
              }}
            />
          </label>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              style={{
                flex: 1,
                padding: 10,
                background: "#ffffff",
                border: "1px dashed #b8c4c2",
                borderRadius: 10,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              📷 Add photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span className="fo-mono" style={{ color: "#5c6c75" }}>{label}</span>
      <span className="fo-serif" style={{ fontSize: 15, color: "#001e2b" }}>{value}</span>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="fo-mono" style={{ color: "#5c6c75", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#001e2b" }}>{value}</div>
    </div>
  );
}
