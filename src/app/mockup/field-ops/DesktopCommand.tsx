"use client";

import { useState } from "react";
import { IconRail } from "./components/IconRail";
import { SummaryStrip } from "./components/SummaryStrip";
import { FilterChips } from "./components/FilterChips";
import { TypeBadge } from "./components/TypeBadge";
import { StatusPill } from "./components/StatusPill";
import { StatsPanel } from "./components/StatsPanel";
import { SAMPLE_TASKS, PROVINCES } from "./sample-tasks";
import type { FieldTask } from "./types";
import { googleMapsUrl } from "./types";

type TypeFilter = "ALL" | "FM" | "INT";

export function DesktopCommand() {
  const [province, setProvince] = useState<(typeof PROVINCES)[number]>("All");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  const filtered = SAMPLE_TASKS.filter((t) => {
    if (province !== "All" && t.province !== province) return false;
    if (typeFilter === "FM" && t.type !== "fm") return false;
    if (typeFilter === "INT" && t.type !== "interference") return false;
    return true;
  });

  const current = filtered[0];

  return (
    <div
      style={{
        width: 1280,
        height: 800,
        background: "#edeae3",
        display: "flex",
        flexDirection: "column",
        border: "1px solid #b8c4c2",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,30,43,0.12)",
      }}
    >
      <SummaryStrip />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <IconRail />

        {/* Map area */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", background: "#e6e2da" }}>
          <div
            style={{
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: "#ffffff",
              borderBottom: "1px solid #b8c4c2",
            }}
          >
            <FilterChips
              label="PROVINCE"
              options={PROVINCES}
              value={province}
              onChange={setProvince}
            />
            <div style={{ width: 1, height: 20, background: "#b8c4c2" }} />
            <FilterChips
              label="TYPE"
              options={["ALL", "FM", "INT"] as const}
              value={typeFilter}
              onChange={setTypeFilter}
            />
            <div style={{ flex: 1 }} />
            <span className="fo-mono">{filtered.length} tasks</span>
          </div>

          <MapPlaceholder tasks={filtered} />
        </main>

        {/* Right rail */}
        <aside
          style={{
            width: 360,
            background: "#001e2b",
            color: "#ffffff",
            borderLeft: "1px solid #3d4f58",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #3d4f58",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div className="fo-mono" style={{ color: "#00ed64" }}>CURRENT · {current?.id}</div>
            <span className="fo-mono" style={{ color: "#b8c4c2" }}>
              {filtered.length - 1 > 0 ? `+${filtered.length - 1} queued` : "queue clear"}
            </span>
          </div>

          {current && <CurrentBlock task={current} />}

          <StatsPanel />
        </aside>
      </div>
    </div>
  );
}

function MapPlaceholder({ tasks }: { tasks: FieldTask[] }) {
  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      {/* Simulated map grid */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#c9c2b6" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="glow" cx="50%" cy="50%" r="40%">
            <stop offset="0%" stopColor="#00ed64" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00ed64" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="#eae5dc" />
        <rect width="100%" height="100%" fill="url(#grid)" />
        <circle cx="52%" cy="48%" r="220" fill="url(#glow)" />
        {/* Hand-drawn route squiggle */}
        <path
          d="M 180 620 Q 300 500 380 480 T 540 400 Q 640 360 720 300 T 860 220"
          fill="none"
          stroke="#001e2b"
          strokeWidth="2"
          strokeDasharray="6 6"
          opacity="0.35"
        />
      </svg>

      {/* Task pins */}
      {tasks.slice(0, 8).map((t, i) => {
        const x = 20 + ((i * 97) % 80);
        const y = 15 + ((i * 37) % 70);
        const isFM = t.type === "fm";
        return (
          <div
            key={t.id}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -100%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <div
              className="fo-mono"
              style={{
                background: isFM ? "#001e2b" : "#00684a",
                color: isFM ? "#00ed64" : "#ffffff",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 9,
                boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
              }}
            >
              {t.id}
            </div>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50% 50% 50% 0",
                background: isFM ? "#00ed64" : "#ff5b4a",
                border: "2px solid #001e2b",
                transform: "rotate(-45deg)",
                marginTop: -2,
              }}
            />
          </div>
        );
      })}

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          background: "#ffffff",
          border: "1px solid #b8c4c2",
          borderRadius: 10,
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          boxShadow: "0 4px 12px rgba(0,30,43,0.08)",
        }}
      >
        <div className="fo-mono">LEGEND</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#00ed64" }} />
          FM station
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#ff5b4a" }} />
          Interference site
        </div>
      </div>

      <div
        className="fo-sketch"
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          padding: "8px 12px",
          background: "#fff6c8",
          border: "1px dashed #001e2b",
          borderRadius: 4,
          fontSize: 13,
          transform: "rotate(-1deg)",
        }}
      >
        wire MapLibre here in real build
      </div>
    </div>
  );
}

function CurrentBlock({ task }: { task: FieldTask }) {
  return (
    <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <TypeBadge type={task.type} size="md" />
        <StatusPill status={task.status} />
      </div>
      <div className="fo-serif" style={{ fontSize: 26, color: "#ffffff", lineHeight: 1.15 }}>
        {task.title}
      </div>
      <div className="fo-mono" style={{ color: "#b8c4c2" }}>
        {task.province.toUpperCase()} · {task.district}
      </div>

      <div style={{ display: "flex", gap: 20, paddingTop: 6 }}>
        <Meter label="DIST" value={`${task.distanceKm.toFixed(1)} km`} />
        <Meter label="ETA" value={`${task.etaMinutes} min`} />
        {task.freq && <Meter label="FREQ" value={`${task.freq.toFixed(2)}`} />}
        {task.direction !== undefined && <Meter label="BEARING" value={`${task.direction}°`} />}
      </div>

      <a
        href={googleMapsUrl(task.lat, task.long)}
        target="_blank"
        rel="noopener noreferrer"
        className="fo-mono"
        style={{
          marginTop: 6,
          padding: "14px 20px",
          background: "#00ed64",
          color: "#001e2b",
          border: "none",
          borderRadius: 999,
          fontSize: 11,
          letterSpacing: "0.22em",
          fontWeight: 700,
          textDecoration: "none",
          textAlign: "center",
          cursor: "pointer",
        }}
      >
        ▶ NAVIGATE IN GOOGLE MAPS
      </a>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="fo-mono" style={{ color: "#5c6c75" }}>{label}</div>
      <div className="fo-serif" style={{ fontSize: 20, color: "#00ed64" }}>{value}</div>
    </div>
  );
}

