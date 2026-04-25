"use client";

import type { ReactNode } from "react";

interface FoKPIProps {
  label: string;
  value: ReactNode;
  delta?: string;
  trend?: "up" | "down";
  sub?: string;
  accent?: boolean;
  tone?: "default" | "danger";
}

export default function FoKPI({
  label,
  value,
  delta,
  trend = "up",
  sub,
  accent = false,
  tone = "default",
}: FoKPIProps) {
  const valueColor = tone === "danger" ? "var(--fo-crit)" : "var(--fo-ink)";
  const deltaColor = trend === "up" ? "var(--fo-accent-2)" : "var(--fo-crit)";
  return (
    <div
      className={accent ? "fo-card-accent" : "fo-card"}
      style={{ padding: 16, position: "relative" }}
    >
      <div className="fo-mono">{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
        <span
          className="fo-serif"
          style={{ fontSize: 36, lineHeight: 1.05, color: valueColor }}
        >
          {value}
        </span>
        {delta && (
          <span
            style={{
              fontFamily: "var(--fo-mono)",
              fontSize: 11,
              letterSpacing: "0.08em",
              color: deltaColor,
              fontWeight: 600,
            }}
          >
            {trend === "up" ? "▲" : "▼"} {delta}
          </span>
        )}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "var(--fo-mute)",
            fontWeight: 400,
          }}
        >
          {sub}
        </div>
      )}
      {accent && (
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 10,
            height: 2,
            background: "var(--fo-accent)",
            opacity: 0.9,
          }}
        />
      )}
    </div>
  );
}
