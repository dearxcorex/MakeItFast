"use client";

import { useMeasuredWidth } from "../useMeasuredWidth";

export interface DonutSegment {
  label: string;
  v: number;
  c: string;
}

interface FoDonutProps {
  segments: DonutSegment[];
  title: string;
  centerLabel: string;
  centerSub: string;
  height?: number;
}

export default function FoDonut({
  segments,
  title,
  centerLabel,
  centerSub,
  height = 260,
}: FoDonutProps) {
  const [ref, mw] = useMeasuredWidth(260);
  const W = mw;
  const cx = W / 2;
  const cy = (height - 30) / 2 + 10;
  const r = Math.max(0, Math.min(W, height - 30) / 2 - 14);
  const ir = Math.max(0, r - 22);
  const total = segments.reduce((s, x) => s + x.v, 0) || 1;
  let acc = 0;

  const arc = (start: number, end: number) => {
    const a0 = (start / total) * Math.PI * 2 - Math.PI / 2;
    const a1 = (end / total) * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + Math.cos(a0) * r;
    const y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r;
    const y1 = cy + Math.sin(a1) * r;
    const xi1 = cx + Math.cos(a1) * ir;
    const yi1 = cy + Math.sin(a1) * ir;
    const xi0 = cx + Math.cos(a0) * ir;
    const yi0 = cy + Math.sin(a0) * ir;
    const large = (end - start) / total > 0.5 ? 1 : 0;
    return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${xi1},${yi1} A${ir},${ir} 0 ${large} 0 ${xi0},${yi0} Z`;
  };

  return (
    <div ref={ref} className="fo-card" style={{ padding: 14, width: "100%" }}>
      <span
        className="fo-mono"
        style={{ color: "var(--fo-accent-2)", display: "block", marginBottom: 8 }}
      >
        {title}
      </span>
      <svg width={W} height={height - 28} style={{ display: "block" }}>
        {segments.map((s, i) => {
          const start = acc;
          acc += s.v;
          if (s.v <= 0) return null;
          return <path key={`${s.label}-${i}`} d={arc(start, acc)} fill={s.c} />;
        })}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontFamily="var(--fo-serif)"
          fontSize={28}
          fill="var(--fo-ink)"
        >
          {centerLabel}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontFamily="var(--fo-mono)"
          fontSize={9}
          letterSpacing="1.5"
          fill="var(--fo-mute)"
        >
          {centerSub}
        </text>
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {segments.map((s, i) => (
          <div
            key={`${s.label}-${i}`}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                background: s.c,
                borderRadius: 2,
                display: "inline-block",
              }}
            />
            <span className="fo-mono">
              {s.label} · {Math.round((s.v / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
