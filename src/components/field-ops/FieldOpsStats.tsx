"use client";

import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";

export function FieldOpsStats({
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
  const lawSent = interference.filter((s) => s.lawPaperSent).length;

  const pct = totalTasks > 0 ? Math.round((inspected / totalTasks) * 100) : 0;

  const fmCount = stations.length;
  const intCount = interference.length;
  const typeTotal = fmCount + intCount || 1;
  const fmPct = (fmCount / typeTotal) * 100;

  const provinceCounts = new Map<string, number>();
  for (const s of stations) {
    if (s.state) provinceCounts.set(s.state, (provinceCounts.get(s.state) ?? 0) + 1);
  }
  for (const s of interference) {
    if (s.changwat) provinceCounts.set(s.changwat, (provinceCounts.get(s.changwat) ?? 0) + 1);
  }
  const topProvinces = [...provinceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topMax = topProvinces[0]?.[1] ?? 1;

  const criticalOpen = interference.filter(
    (s) => s.ranking === "Critical" && s.status !== "ตรวจแล้ว"
  ).length;

  const statusRows = [
    { key: "pending", label: "PENDING", count: pending, color: "var(--fo-rail-mute)" },
    { key: "inspected", label: "INSPECTED", count: inspected, color: "var(--fo-accent-2)" },
    { key: "law_sent", label: "LAW SENT", count: lawSent, color: "var(--fo-warn)" },
  ];
  const statusMax = Math.max(1, ...statusRows.map((r) => r.count));

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: "var(--fo-rail-bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--fo-rail-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>OPERATIONS · TODAY</span>
        <span
          className="fo-mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            color: "var(--fo-accent)",
            padding: "2px 8px",
            border: "1px solid var(--fo-accent-2)",
            borderRadius: 999,
            fontSize: 9,
            lineHeight: 1,
          }}
        >
          <span aria-hidden style={{ fontSize: 9, lineHeight: 1 }}>●</span>
          <span style={{ lineHeight: 1 }}>LIVE</span>
        </span>
      </div>

      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          borderBottom: "1px solid var(--fo-rail-border)",
        }}
      >
        <ProgressRing pct={pct} size={120} stroke={10} />
        <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", marginTop: 8 }}>INSPECTED</div>
        <div className="fo-mono" style={{ color: "var(--fo-mute)", marginTop: 2 }}>
          {inspected} of {totalTasks} tasks
        </div>
      </div>

      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--fo-rail-border)" }}>
        <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", marginBottom: 12 }}>
          STATUS BREAKDOWN
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {statusRows.map((s) => (
            <Bar key={s.key} label={s.label} count={s.count} max={statusMax} color={s.color} />
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--fo-rail-border)" }}>
        <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", marginBottom: 10 }}>TYPE MIX</div>
        <div
          style={{
            height: 14,
            display: "flex",
            borderRadius: 999,
            overflow: "hidden",
            border: "1px solid var(--fo-rail-border)",
          }}
        >
          <div style={{ width: `${fmPct}%`, background: "var(--fo-accent)" }} />
          <div style={{ width: `${100 - fmPct}%`, background: "var(--fo-crit)" }} />
        </div>
        <div
          className="fo-mono"
          style={{
            marginTop: 8,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "var(--fo-accent)" }}>{fmCount} FM</span>
          <span style={{ color: "var(--fo-crit)" }}>{intCount} INT</span>
        </div>
      </div>

      {topProvinces.length > 0 && (
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--fo-rail-border)" }}>
          <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", marginBottom: 12 }}>
            TOP PROVINCES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topProvinces.map(([name, count], i) => (
              <ProvinceRow key={name} rank={i + 1} name={name} count={count} max={topMax} />
            ))}
          </div>
        </div>
      )}

      {criticalOpen > 0 && (
        <div style={{ padding: "16px 20px 24px" }}>
          <div
            style={{
              padding: "14px 16px",
              background: "#2a0a0a",
              border: "1px solid var(--fo-crit)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 22 }}>⚠</span>
            <div style={{ flex: 1 }}>
              <div
                className="fo-serif"
                style={{ fontSize: 22, color: "var(--fo-crit)", lineHeight: 1.05 }}
              >
                {criticalOpen} <span style={{ fontSize: 14 }}>CRITICAL OPEN</span>
              </div>
              <div className="fo-mono" style={{ color: "#ff8b7e", marginTop: 4 }}>
                REQUIRES TODAY
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressRing({ pct, size, stroke }: { pct: number; size: number; stroke: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fo-rail-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--fo-accent)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="fo-serif" style={{ fontSize: 32, color: "var(--fo-accent)", lineHeight: 1 }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

function Bar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = Math.max(2, (count / max) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>{label}</span>
        <span className="fo-mono" style={{ color }}>{count}</span>
      </div>
      <div
        style={{
          height: 6,
          background: "var(--fo-ink-2)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function ProvinceRow({
  rank,
  name,
  count,
  max,
}: {
  rank: number;
  name: string;
  count: number;
  max: number;
}) {
  const pct = Math.max(8, (count / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span className="fo-mono" style={{ color: "var(--fo-mute)", width: 18, textAlign: "right" }}>
        {rank}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span className="fo-serif" style={{ color: "var(--fo-rail-text)", fontSize: 14 }}>{name}</span>
          <span className="fo-mono" style={{ color: "var(--fo-accent)" }}>{count}</span>
        </div>
        <div style={{ height: 4, background: "var(--fo-ink-2)", borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "linear-gradient(90deg, var(--fo-accent-2), var(--fo-accent))",
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    </div>
  );
}
