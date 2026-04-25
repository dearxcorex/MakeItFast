"use client";

const STATS = {
  inspected: 147,
  totalTasks: 218,
  status: [
    { key: "pending", label: "PENDING", count: 58, color: "#b8c4c2" },
    { key: "inProgress", label: "IN PROGRESS", count: 12, color: "#00ed64" },
    { key: "inspected", label: "INSPECTED", count: 147, color: "#00684a" },
    { key: "lawSent", label: "LAW SENT", count: 28, color: "#ffb800" },
  ],
  type: { fm: 112, interference: 106 },
  provinces: [
    { name: "Chonburi", count: 84 },
    { name: "Rayong", count: 71 },
    { name: "Chachoengsao", count: 42 },
  ],
  criticalOpen: 13,
};

export function StatsPanel() {
  const pct = Math.round((STATS.inspected / STATS.totalTasks) * 100);
  const statusMax = Math.max(...STATS.status.map((s) => s.count));
  const typeTotal = STATS.type.fm + STATS.type.interference;
  const fmPct = (STATS.type.fm / typeTotal) * 100;
  const provinceMax = STATS.provinces[0].count;

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: "#001216",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* a. Header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #3d4f58",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span className="fo-mono" style={{ color: "#b8c4c2" }}>
          OPERATIONS · TODAY
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span className="fo-mono" style={{ color: "#5c6c75" }}>25 APR</span>
          <span
            className="fo-mono"
            style={{
              color: "#00ed64",
              padding: "2px 8px",
              border: "1px solid #00684a",
              borderRadius: 999,
              fontSize: 9,
            }}
          >
            ● LIVE
          </span>
        </span>
      </div>

      {/* b. Progress ring */}
      <div
        style={{
          padding: "18px 20px 14px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          borderBottom: "1px solid #3d4f58",
        }}
      >
        <ProgressRing pct={pct} size={120} stroke={10} />
        <div className="fo-mono" style={{ color: "#b8c4c2", marginTop: 8 }}>
          INSPECTED
        </div>
        <div className="fo-mono" style={{ color: "#5c6c75", marginTop: 2 }}>
          {STATS.inspected} of {STATS.totalTasks} tasks
        </div>
      </div>

      {/* c. Status breakdown */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #3d4f58" }}>
        <div className="fo-mono" style={{ color: "#b8c4c2", marginBottom: 12 }}>
          STATUS BREAKDOWN
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {STATS.status.map((s) => (
            <StatusBar
              key={s.key}
              label={s.label}
              count={s.count}
              max={statusMax}
              color={s.color}
            />
          ))}
        </div>
      </div>

      {/* d. Type split */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #3d4f58" }}>
        <div className="fo-mono" style={{ color: "#b8c4c2", marginBottom: 10 }}>
          TYPE MIX
        </div>
        <div
          style={{
            height: 14,
            display: "flex",
            borderRadius: 999,
            overflow: "hidden",
            border: "1px solid #3d4f58",
          }}
        >
          <div style={{ width: `${fmPct}%`, background: "#00ed64" }} />
          <div style={{ width: `${100 - fmPct}%`, background: "#ff5b4a" }} />
        </div>
        <div
          className="fo-mono"
          style={{
            marginTop: 8,
            color: "#b8c4c2",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: "#00ed64" }}>{STATS.type.fm} FM</span>
          <span style={{ color: "#ff5b4a" }}>{STATS.type.interference} INT</span>
        </div>
      </div>

      {/* e. Province leaderboard */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #3d4f58" }}>
        <div className="fo-mono" style={{ color: "#b8c4c2", marginBottom: 12 }}>
          TOP PROVINCES
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {STATS.provinces.map((p, i) => (
            <ProvinceRow
              key={p.name}
              rank={i + 1}
              name={p.name}
              count={p.count}
              max={provinceMax}
            />
          ))}
        </div>
      </div>

      {/* f. Critical alert */}
      <div style={{ padding: "16px 20px 24px", position: "relative" }}>
        <div
          style={{
            position: "relative",
            padding: "14px 16px",
            background: "#2a0a0a",
            border: "1px solid #ff5b4a",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 22 }}>⚠</span>
          <div style={{ flex: 1 }}>
            <div className="fo-serif" style={{ fontSize: 22, color: "#ff5b4a", lineHeight: 1.05 }}>
              {STATS.criticalOpen} <span style={{ fontSize: 14 }}>CRITICAL OPEN</span>
            </div>
            <div className="fo-mono" style={{ color: "#ff8b7e", marginTop: 4 }}>
              REQUIRES TODAY
            </div>
          </div>
          <span
            className="fo-sketch"
            style={{
              position: "absolute",
              right: -10,
              top: -14,
              padding: "3px 8px",
              background: "#fff6c8",
              border: "1px dashed #001e2b",
              borderRadius: 4,
              fontSize: 11,
              color: "#001e2b",
              transform: "rotate(2deg)",
              whiteSpace: "nowrap",
            }}
          >
            tap to filter →
          </span>
        </div>
      </div>
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#3d4f58"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#00ed64"
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
        <span className="fo-serif" style={{ fontSize: 32, color: "#00ed64", lineHeight: 1 }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

function StatusBar({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
}) {
  const pct = Math.max(4, (count / max) * 100);
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span className="fo-mono" style={{ color: "#b8c4c2" }}>{label}</span>
        <span className="fo-mono" style={{ color }}>{count}</span>
      </div>
      <div
        style={{
          height: 6,
          background: "#1c2d38",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
            transition: "width 200ms ease",
          }}
        />
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
      <span
        className="fo-mono"
        style={{ color: "#5c6c75", width: 18, textAlign: "right" }}
      >
        {rank}
      </span>
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <span className="fo-serif" style={{ color: "#ffffff", fontSize: 14 }}>
            {name}
          </span>
          <span className="fo-mono" style={{ color: "#00ed64" }}>{count}</span>
        </div>
        <div
          style={{
            height: 4,
            background: "#1c2d38",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "linear-gradient(90deg, #00684a, #00ed64)",
              borderRadius: 999,
            }}
          />
        </div>
      </div>
    </div>
  );
}
