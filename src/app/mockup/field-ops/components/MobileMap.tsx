"use client";

import type { FieldTask } from "../types";

const PIN_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 35, y: 28 },
  { x: 62, y: 22 },
  { x: 48, y: 45 },
  { x: 72, y: 52 },
  { x: 28, y: 58 },
  { x: 58, y: 70 },
  { x: 40, y: 78 },
  { x: 78, y: 38 },
];

export function MobileMap({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: FieldTask[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        background: "#e6e2da",
      }}
    >
      {/* Background grid map */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <pattern id="mmgrid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#c9c2b6" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="mmglow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00ed64" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#00ed64" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="#eae5dc" />
        <rect width="100%" height="100%" fill="url(#mmgrid)" />
        <circle cx="50%" cy="50%" r="160" fill="url(#mmglow)" />
        {/* Coast/highway hint */}
        <path
          d="M 20 260 Q 120 230 180 280 T 360 320"
          fill="none"
          stroke="#001e2b"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          opacity="0.35"
        />
      </svg>

      {/* Pins */}
      {tasks.slice(0, PIN_POSITIONS.length).map((t, i) => {
        const { x, y } = PIN_POSITIONS[i];
        const isFM = t.type === "fm";
        const active = t.id === selectedId;
        return (
          <button
            key={t.id}
            type="button"
            aria-label={`Select ${t.id}`}
            onClick={() => onSelect(t.id)}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -100%)",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              zIndex: active ? 10 : 1,
            }}
          >
            {active && (
              <span
                className="fo-mono"
                style={{
                  background: "#001e2b",
                  color: "#00ed64",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 9,
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                }}
              >
                {t.id}
              </span>
            )}
            {/* Interference pins show a direction wedge */}
            {!isFM && t.direction !== undefined && (
              <svg
                width="36"
                height="36"
                style={{
                  position: "absolute",
                  bottom: -2,
                  left: "50%",
                  transform: `translate(-50%, 50%) rotate(${t.direction}deg)`,
                  pointerEvents: "none",
                }}
              >
                <path
                  d="M 18 18 L 10 2 L 26 2 Z"
                  fill={active ? "#ff5b4a" : "#ff5b4a"}
                  opacity={active ? 0.55 : 0.3}
                />
              </svg>
            )}
            <div
              style={{
                width: active ? 20 : 14,
                height: active ? 20 : 14,
                borderRadius: "50% 50% 50% 0",
                background: isFM ? "#00ed64" : "#ff5b4a",
                border: `${active ? 3 : 2}px solid #001e2b`,
                transform: "rotate(-45deg)",
                transition: "all 120ms ease",
              }}
            />
          </button>
        );
      })}

      {/* Map controls */}
      <div
        style={{
          position: "absolute",
          right: 12,
          top: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {["＋", "－", "⟲"].map((g) => (
          <button
            key={g}
            type="button"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "1px solid #b8c4c2",
              background: "#ffffff",
              fontSize: 18,
              color: "#001e2b",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,30,43,0.1)",
            }}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          left: 12,
          top: 12,
          background: "rgba(255,255,255,0.92)",
          border: "1px solid #b8c4c2",
          borderRadius: 8,
          padding: "6px 10px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          fontSize: 11,
          backdropFilter: "blur(4px)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#00ed64" }} />
          FM
        </span>
        <span style={{ width: 1, height: 12, background: "#b8c4c2" }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#ff5b4a" }} />
          Int
        </span>
      </div>

      <div
        className="fo-sketch"
        style={{
          position: "absolute",
          bottom: 72,
          left: "50%",
          transform: "translateX(-50%) rotate(-0.5deg)",
          padding: "4px 10px",
          background: "#fff6c8",
          border: "1px dashed #001e2b",
          borderRadius: 4,
          fontSize: 11,
          whiteSpace: "nowrap",
        }}
      >
        real build = MapLibre
      </div>
    </div>
  );
}
