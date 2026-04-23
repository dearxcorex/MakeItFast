import type { FieldTaskStatus, FieldTaskRanking } from "../types";

const STATUS_STYLES: Record<FieldTaskStatus, { label: string; bg: string; color: string }> = {
  pending: { label: "PENDING", bg: "transparent", color: "#5c6c75" },
  in_progress: { label: "IN PROGRESS", bg: "#00ed64", color: "#001e2b" },
  inspected: { label: "ตรวจแล้ว", bg: "#00684a", color: "#ffffff" },
  law_sent: { label: "ส่งหนังสือ", bg: "#ffb800", color: "#001e2b" },
};

const RANKING_STYLES: Record<NonNullable<FieldTaskRanking>, { label: string; color: string }> = {
  critical: { label: "CRITICAL", color: "#ff5b4a" },
  major: { label: "MAJOR", color: "#ffb800" },
  minor: { label: "MINOR", color: "#5c6c75" },
};

export function StatusPill({ status }: { status: FieldTaskStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="fo-mono"
      style={{
        padding: "3px 8px",
        fontSize: 10,
        background: s.bg,
        color: s.color,
        borderRadius: 999,
        border: s.bg === "transparent" ? "1px solid #b8c4c2" : "none",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1,
      }}
    >
      {s.label}
    </span>
  );
}

export function RankingDot({ ranking }: { ranking: FieldTaskRanking }) {
  if (!ranking) return null;
  const r = RANKING_STYLES[ranking];
  return (
    <span
      className="fo-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10,
        color: r.color,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: r.color }} />
      {r.label}
    </span>
  );
}
