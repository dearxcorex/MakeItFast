"use client";

import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import type { TypeFilter } from "./FieldOpsFilters";
import { computeKpis } from "@/utils/fieldOpsKpi";

export function FieldOpsHeader({
  stations,
  interference,
  type,
  theme,
  onToggleTheme,
  isMobile = false,
  onOpenDrawer,
}: {
  stations: FMStation[];
  interference: InterferenceSite[];
  type: TypeFilter;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  isMobile?: boolean;
  onOpenDrawer?: () => void;
}) {
  const kpis = computeKpis(stations, interference, type);

  const isLight = theme === "light";
  const headerBg = isLight ? "#ffffff" : "var(--fo-ink)";
  const textColor = isLight ? "#001e2b" : "var(--fo-white)";
  const borderColor = isLight ? "#e2dfd8" : "var(--fo-ink-3)";
  const labelColor = isLight ? "#5c6c75" : "var(--fo-line)";
  const accentText = isLight ? "#00684a" : "var(--fo-accent)";

  const scopeLabel =
    type === "FM" ? "FM ONLY" : type === "INT" ? "INTERFERENCE ONLY" : "ALL";

  if (isMobile) {
    return <MobileHeader
      scopeLabel={scopeLabel}
      headerBg={headerBg}
      textColor={textColor}
      borderColor={borderColor}
      accentText={accentText}
      onOpenDrawer={onOpenDrawer}
    />;
  }

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "14px 24px",
        background: headerBg,
        color: textColor,
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
      }}
    >
      <div>
        <div className="fo-mono" style={{ color: accentText }}>
          NBTC · FIELD OPS · {scopeLabel}
        </div>
        <div
          className="fo-serif"
          style={{ fontSize: 20, lineHeight: 1.1, marginTop: 2, color: textColor }}
        >
          Field Operations
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <Stat
        label="INSPECTED"
        value={kpis.inspected}
        sub={`/ ${kpis.target} · ${kpis.pct}%`}
        accent
        textColor={textColor}
        labelColor={labelColor}
        accentText={accentText}
      />
      <Stat label="PENDING" value={kpis.pending} textColor={textColor} labelColor={labelColor} />
      <Stat
        label="CRITICAL"
        value={kpis.critical}
        warn
        textColor={textColor}
        labelColor={labelColor}
      />

      <button
        type="button"
        onClick={onToggleTheme}
        className="fo-mono"
        title={`Switch to ${isLight ? "dark" : "light"} theme`}
        style={{
          padding: "6px 12px",
          border: `1px solid ${accentText}`,
          color: accentText,
          background: "transparent",
          borderRadius: 999,
          fontSize: 10,
          cursor: "pointer",
          letterSpacing: "0.16em",
        }}
      >
        {isLight ? "☀ LIGHT" : "☾ DARK"}
      </button>

      <div
        className="fo-mono"
        style={{
          padding: "6px 12px",
          border: `1px solid ${accentText}`,
          color: accentText,
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
  textColor,
  labelColor,
  accentText,
}: {
  label: string;
  value: number | null;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
  textColor: string;
  labelColor: string;
  accentText?: string;
}) {
  const isMissing = value === null;
  const color = isMissing
    ? labelColor
    : accent
      ? accentText ?? "var(--fo-accent)"
      : warn
        ? "var(--fo-crit)"
        : textColor;
  const display = isMissing ? "—" : value;
  return (
    <div>
      <div className="fo-mono" style={{ color: labelColor }}>
        {label}
      </div>
      <div className="fo-serif" style={{ fontSize: 24, lineHeight: 1.1, color }}>
        {display}
        {!isMissing && sub && (
          <span className="fo-mono" style={{ fontSize: 11, marginLeft: 6, color }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function MobileHeader({
  scopeLabel,
  headerBg,
  textColor,
  borderColor,
  accentText,
  onOpenDrawer,
}: {
  scopeLabel: string;
  headerBg: string;
  textColor: string;
  borderColor: string;
  accentText: string;
  onOpenDrawer?: () => void;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: headerBg,
        color: textColor,
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        aria-label="Open menu"
        onClick={onOpenDrawer}
        style={{
          border: `1px solid ${borderColor}`,
          background: "transparent",
          color: textColor,
          padding: "6px 10px",
          borderRadius: 6,
          fontSize: 16,
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ☰
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fo-mono" style={{ color: accentText, fontSize: 9, letterSpacing: "0.18em" }}>
          NBTC · FIELD OPS · {scopeLabel}
        </div>
        <div className="fo-serif" style={{ fontSize: 14, lineHeight: 1.1, color: textColor }}>
          Field Operations
        </div>
      </div>
    </header>
  );
}
