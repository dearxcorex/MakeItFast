"use client";

import { useMeasuredWidth } from "../useMeasuredWidth";

export interface BarDatum {
  label: string;
  v: number;
  color?: string;
  dim?: boolean;
}

interface FoBarChartProps {
  data: BarDatum[];
  title: string;
  height?: number;
}

export default function FoBarChart({ data, title, height = 240 }: FoBarChartProps) {
  const [ref, mw] = useMeasuredWidth(520);
  const W = mw;
  const pad = { l: 28, r: 12, t: 16, b: 36 };
  const iw = Math.max(0, W - pad.l - pad.r);
  const ih = Math.max(0, height - pad.t - pad.b - 28);
  const max = data.length ? Math.max(...data.map((d) => d.v), 1) : 1;
  const slot = data.length ? iw / data.length : iw;
  const bw = slot * 0.7;
  const gap = slot * 0.3;

  return (
    <div ref={ref} className="fo-card" style={{ padding: 14, width: "100%" }}>
      <span
        className="fo-mono"
        style={{ color: "var(--fo-accent-2)", display: "block", marginBottom: 8 }}
      >
        {title}
      </span>
      <svg width={W} height={height - 28} style={{ display: "block" }}>
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1={pad.l}
            x2={pad.l + iw}
            y1={pad.t + (ih * i) / 3}
            y2={pad.t + (ih * i) / 3}
            stroke="var(--fo-grid)"
            strokeDasharray="2 4"
          />
        ))}
        {data.map((d, i) => {
          const bh = (d.v / max) * ih;
          const xi = pad.l + i * (bw + gap) + gap / 2;
          const yi = pad.t + ih - bh;
          const fill = d.color || "var(--fo-accent-2)";
          return (
            <g key={`${d.label}-${i}`}>
              <rect
                x={xi}
                y={yi}
                width={bw}
                height={bh}
                fill={fill}
                opacity={d.dim ? 0.4 : 1}
                rx={2}
              />
              <text
                x={xi + bw / 2}
                y={pad.t + ih + 16}
                fontSize={9}
                textAnchor="middle"
                fill="var(--fo-mute)"
                fontFamily="var(--fo-mono)"
                letterSpacing="1.5"
              >
                {d.label}
              </text>
              <text
                x={xi + bw / 2}
                y={Math.max(yi - 4, pad.t + 8)}
                fontSize={9}
                textAnchor="middle"
                fill="var(--fo-ink)"
                fontFamily="var(--fo-mono)"
              >
                {d.v}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
