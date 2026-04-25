"use client";

import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

export function FieldOpsHeader({
  stations,
  interference,
}: {
  stations: FMStation[];
  interference: InterferenceSite[];
}) {
  const totalTasks = stations.length + interference.length;

  const inspectedFM = stations.filter((s) => s.inspection69 === "ตรวจแล้ว").length;
  const inspectedINT = interference.filter((s) => s.status === "ตรวจแล้ว").length;
  const inspected = inspectedFM + inspectedINT;

  const pending = totalTasks - inspected;
  const critical = interference.filter((s) => s.ranking === "Critical").length;

  const pct = totalTasks > 0 ? Math.round((inspected / totalTasks) * 100) : 0;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "14px 24px",
        background: "var(--fo-ink)",
        color: "var(--fo-white)",
        borderBottom: "1px solid var(--fo-ink-3)",
        flexShrink: 0,
      }}
    >
      <div>
        <div className="fo-mono" style={{ color: "var(--fo-accent)" }}>
          NBTC · FIELD OPS
        </div>
        <div
          className="fo-serif"
          style={{ fontSize: 20, lineHeight: 1.1, marginTop: 2 }}
        >
          Field Operations
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <Stat label="TOTAL" value={totalTasks} />
      <Stat label="INSPECTED" value={inspected} sub={`${pct}%`} accent />
      <Stat label="PENDING" value={pending} />
      <Stat label="CRITICAL" value={critical} warn />

      <div
        className="fo-mono"
        style={{
          padding: "6px 12px",
          border: "1px solid var(--fo-accent)",
          color: "var(--fo-accent)",
          borderRadius: 999,
          fontSize: 10,
        }}
      >
        ● LIVE
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = false,
  warn = false,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const color = accent ? "var(--fo-accent)" : warn ? "var(--fo-crit)" : "var(--fo-white)";
  return (
    <div>
      <div className="fo-mono" style={{ color: "var(--fo-line)" }}>{label}</div>
      <div
        className="fo-serif"
        style={{ fontSize: 24, lineHeight: 1.1, color }}
      >
        {value}
        {sub && (
          <span className="fo-mono" style={{ fontSize: 11, marginLeft: 6, color }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
