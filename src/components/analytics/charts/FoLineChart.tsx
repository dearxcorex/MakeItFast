"use client";

import { useMeasuredWidth } from "../useMeasuredWidth";

export interface LineSeries {
  name: string;
  color: string;
  points: number[];
}

interface FoLineChartProps {
  series: LineSeries[];
  title: string;
  height?: number;
  xLabels?: string[];
}

export default function FoLineChart({
  series,
  title,
  height = 260,
  xLabels,
}: FoLineChartProps) {
  const [ref, mw] = useMeasuredWidth(520);
  const W = mw;
  const pad = { l: 32, r: 14, t: 16, b: 26 };
  const iw = Math.max(0, W - pad.l - pad.r);
  const ih = Math.max(0, height - pad.t - pad.b - 28);
  const allPts = series.flatMap((s) => s.points);
  const max = allPts.length ? Math.max(...allPts) : 1;
  const min = allPts.length ? Math.min(...allPts) : 0;
  const N = series[0]?.points.length ?? 0;
  const x = (i: number) => pad.l + (N > 1 ? (i / (N - 1)) * iw : iw / 2);
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min || 1)) * ih;
  const labels = xLabels && xLabels.length === N ? xLabels : Array.from({ length: N }, (_, i) => `${i + 1}`);

  return (
    <div ref={ref} className="fo-card" style={{ padding: 14, width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span className="fo-mono" style={{ color: "var(--fo-accent-2)" }}>
          {title}
        </span>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {series.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: s.color,
                  borderRadius: 2,
                  display: "inline-block",
                }}
              />
              <span className="fo-mono">{s.name}</span>
            </div>
          ))}
        </div>
      </div>
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
        {series.map((s, si) => {
          const path = s.points
            .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p)}`)
            .join(" ");
          const areaPath =
            N > 0
              ? `${path} L${x(N - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`
              : "";
          return (
            <g key={s.name}>
              {si === 0 && areaPath && <path d={areaPath} fill={s.color} opacity="0.12" />}
              <path d={path} stroke={s.color} strokeWidth={2} fill="none" />
              {s.points.map((p, i) => (
                <circle key={i} cx={x(i)} cy={y(p)} r={2.5} fill={s.color} />
              ))}
            </g>
          );
        })}
        {labels.map((d, i) => (
          <text
            key={`${d}-${i}`}
            x={x(i)}
            y={height - 32}
            fontSize={9}
            textAnchor="middle"
            fill="var(--fo-mute)"
            fontFamily="var(--fo-mono)"
            letterSpacing="1.5"
          >
            {d}
          </text>
        ))}
      </svg>
    </div>
  );
}
