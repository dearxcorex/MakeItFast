import { SUMMARY_STATS } from "../sample-tasks";

export function SummaryStrip() {
  const { totalTasks, inspected, pending, critical } = SUMMARY_STATS;
  const pct = Math.round((inspected / totalTasks) * 100);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 32,
        padding: "18px 28px",
        background: "#001e2b",
        color: "#ffffff",
        borderBottom: "1px solid #3d4f58",
      }}
    >
      <div>
        <div className="fo-mono" style={{ color: "#00ed64" }}>FIELD OPS</div>
        <div className="fo-serif" style={{ fontSize: 22 }}>
          Field Operations
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <StatBlock label="TOTAL TASKS" value={totalTasks} />
      <StatBlock label="INSPECTED" value={`${inspected}`} sub={`${pct}%`} accent />
      <StatBlock label="PENDING" value={pending} />
      <StatBlock label="CRITICAL" value={critical} warn />
      <div
        className="fo-mono"
        style={{ padding: "6px 12px", border: "1px solid #00ed64", color: "#00ed64", borderRadius: 999 }}
      >
        ● LIVE
      </div>
    </header>
  );
}

function StatBlock({
  label,
  value,
  sub,
  accent = false,
  warn = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const color = accent ? "#00ed64" : warn ? "#ff5b4a" : "#ffffff";
  return (
    <div style={{ textAlign: "left" }}>
      <div className="fo-mono" style={{ color: "#b8c4c2" }}>{label}</div>
      <div className="fo-serif" style={{ fontSize: 28, color, lineHeight: 1.1 }}>
        {value}
        {sub && (
          <span className="fo-mono" style={{ fontSize: 12, marginLeft: 8, color }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
