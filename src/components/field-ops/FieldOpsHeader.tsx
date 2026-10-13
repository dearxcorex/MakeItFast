"use client";

import Link from "next/link";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import type { TypeFilter } from "./FieldOpsFilters";
import type { GeolocationStatus } from "@/hooks/useGeolocation";
import { computeKpis } from "@/utils/fieldOpsKpi";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { BrandMark, BrandWordmark } from "./BrandMark";

export function FieldOpsHeader({
  stations,
  interference,
  type,
  theme,
  onToggleTheme,
  isMobile = false,
  onOpenDrawer,
  locationStatus,
  onRetryLocation,
}: {
  stations: FMStation[];
  interference: InterferenceSite[];
  type: TypeFilter;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  isMobile?: boolean;
  onOpenDrawer?: () => void;
  locationStatus?: GeolocationStatus;
  onRetryLocation?: () => void;
}) {
  const kpis = computeKpis(stations, interference, type);

  const isLight = theme === "light";
  const headerBg = isLight ? "#ffffff" : "var(--fo-ink)";
  const textColor = isLight ? "#001e2b" : "var(--fo-white)";
  const borderColor = isLight ? "#e2dfd8" : "var(--fo-ink-3)";
  const labelColor = isLight ? "#5c6c75" : "var(--fo-line)";
  const accentText = isLight ? "#00684a" : "var(--fo-accent)";

  const scopeLabel =
    type === "FM" ? "เฉพาะ FM" : type === "INT" ? "เฉพาะการรบกวน" : "ทั้งหมด";

  if (isMobile) {
    return <MobileHeader
      headerBg={headerBg}
      textColor={textColor}
      borderColor={borderColor}
      onOpenDrawer={onOpenDrawer}
      locationStatus={locationStatus}
      onRetryLocation={onRetryLocation}
      labelColor={labelColor}
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
          กสทช. · ภาคสนาม · {scopeLabel}
        </div>
        <h1 style={{ margin: "3px 0 0", lineHeight: 1, color: textColor }}>
          <BrandWordmark fontSize={20} />
        </h1>
      </div>

      <div style={{ flex: 1 }} />

      <Stat
        label="ตรวจแล้ว"
        value={kpis.inspected}
        sub={`/ ${kpis.target} · ${kpis.pct}%`}
        accent
        textColor={textColor}
        labelColor={labelColor}
        accentText={accentText}
      />
      <Stat label="ยังไม่ตรวจ" value={kpis.pending} textColor={textColor} labelColor={labelColor} />
      <Stat
        label="วิกฤต"
        value={kpis.critical}
        warn
        textColor={textColor}
        labelColor={labelColor}
      />

      <LocationBadge
        status={locationStatus}
        onRetry={onRetryLocation}
        labelColor={labelColor}
      />

      <button
        type="button"
        onClick={onToggleTheme}
        className="fo-mono"
        title={`เปลี่ยนเป็นธีม${isLight ? "มืด" : "สว่าง"}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "6px 12px",
          border: `1px solid ${accentText}`,
          color: accentText,
          background: "transparent",
          borderRadius: 999,
          fontSize: 10,
          lineHeight: 1,
          cursor: "pointer",
          letterSpacing: "0.16em",
        }}
      >
        <span aria-hidden style={{ fontSize: 12, lineHeight: 1 }}>
          {isLight ? "☀" : "☾"}
        </span>
        <span style={{ lineHeight: 1 }}>{isLight ? "สว่าง" : "มืด"}</span>
      </button>

      <div
        className="fo-mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "6px 12px",
          border: `1px solid ${accentText}`,
          color: accentText,
          borderRadius: 999,
          fontSize: 10,
          lineHeight: 1,
          letterSpacing: "0.16em",
        }}
      >
        <span aria-hidden style={{ fontSize: 10, lineHeight: 1 }}>
          ●
        </span>
        <span style={{ lineHeight: 1 }}>ออนไลน์</span>
      </div>

      <UserChip accentText={accentText} textColor={textColor} borderColor={borderColor} />
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
  headerBg,
  textColor,
  onOpenDrawer,
  locationStatus,
  onRetryLocation,
  labelColor,
  borderColor,
}: {
  headerBg: string;
  textColor: string;
  borderColor: string;
  onOpenDrawer?: () => void;
  locationStatus?: GeolocationStatus;
  onRetryLocation?: () => void;
  labelColor: string;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        minHeight: 48,
        padding: "0 12px 0 2px",
        background: headerBg,
        color: textColor,
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <button
        type="button"
        aria-label="เปิดเมนู"
        onClick={onOpenDrawer}
        style={{
          border: "none",
          background: "transparent",
          color: textColor,
          width: 44,
          height: 44,
          flexShrink: 0,
          fontSize: 20,
          cursor: "pointer",
          lineHeight: 1,
          padding: 0,
        }}
      >
        ☰
      </button>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          color: textColor,
          overflow: "hidden",
        }}
      >
        <BrandMark logoSize={28} fontSize={16} gap={8} />
      </div>
      <LocationBadge
        status={locationStatus}
        onRetry={onRetryLocation}
        labelColor={labelColor}
      />
    </header>
  );
}

function LocationBadge({
  status,
  onRetry,
  labelColor,
}: {
  status: GeolocationStatus | undefined;
  onRetry: (() => void) | undefined;
  labelColor: string;
}) {
  // Suppress the chip in healthy states — the ±Xm accuracy number is visual
  // noise for non-engineers. Only surface the badge when the user needs to
  // act (denied/timeout/unavailable) so they can retry GPS from the header.
  if (!status || status === 'unsupported' || status === 'locating' || status === 'granted') {
    return null;
  }
  const buttonLabel = status === 'denied' ? '⚠ เปิดใช้ตำแหน่ง' : '↻ หาตำแหน่งอีกครั้ง';
  return (
    <button
      type="button"
      className="fo-mono"
      onClick={onRetry}
      style={{
        padding: '6px 12px',
        border: `1px solid ${labelColor}`,
        color: labelColor,
        borderRadius: 999,
        fontSize: 10,
        letterSpacing: '0.16em',
        background: 'transparent',
        cursor: 'pointer',
      }}
    >
      {buttonLabel}
    </button>
  );
}

function UserChip({
  accentText,
  textColor,
  borderColor,
  compact = false,
}: {
  accentText: string;
  textColor: string;
  borderColor: string;
  compact?: boolean;
}) {
  const { user, loading, logout } = useCurrentUser();
  if (loading || !user) return null;

  const fontSize = compact ? 11 : 12;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {user.role === "admin" && !compact && (
        <Link
          href="/admin/users"
          className="fo-mono"
          style={{
            padding: "6px 12px",
            border: `1px solid ${borderColor}`,
            color: textColor,
            borderRadius: 999,
            fontSize: 10,
            lineHeight: 1,
            letterSpacing: "0.16em",
            textDecoration: "none",
          }}
        >
          จัดการผู้ใช้
        </Link>
      )}
      <span style={{ fontSize, color: textColor, lineHeight: 1 }}>
        {user.displayName}
      </span>
      {user.role === "admin" && (
        <span
          className="fo-mono"
          style={{
            fontSize: 9,
            padding: "2px 6px",
            border: `1px solid ${accentText}`,
            color: accentText,
            borderRadius: 999,
            letterSpacing: "0.16em",
            lineHeight: 1,
          }}
        >
          ผู้ดูแล
        </span>
      )}
      <button
        type="button"
        onClick={() => void logout()}
        aria-label="ออกจากระบบ"
        title="ออกจากระบบ"
        style={{
          border: `1px solid ${borderColor}`,
          background: "transparent",
          color: textColor,
          width: 26,
          height: 26,
          borderRadius: 999,
          cursor: "pointer",
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        ⏻
      </button>
    </div>
  );
}
