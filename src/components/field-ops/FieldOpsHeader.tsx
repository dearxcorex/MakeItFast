"use client";

import Link from "next/link";
import type { FMStation, UserLocation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import type { TypeFilter } from "./FieldOpsFilters";
import type { GeolocationStatus } from "@/hooks/useGeolocation";
import { computeKpis } from "@/utils/fieldOpsKpi";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import CrewIndicator from "./CrewIndicator";

export function FieldOpsHeader({
  stations,
  interference,
  type,
  theme,
  onToggleTheme,
  isMobile = false,
  onOpenDrawer,
  locationStatus,
  userLocation,
  onRetryLocation,
  defaultCrew,
  inspectors,
  onOpenCrew,
}: {
  stations: FMStation[];
  interference: InterferenceSite[];
  type: TypeFilter;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  isMobile?: boolean;
  onOpenDrawer?: () => void;
  locationStatus?: GeolocationStatus;
  userLocation?: UserLocation;
  onRetryLocation?: () => void;
  defaultCrew?: number[] | null;
  inspectors?: { id: number; username: string; displayName: string }[];
  onOpenCrew?: () => void;
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
      locationStatus={locationStatus}
      userLocation={userLocation}
      onRetryLocation={onRetryLocation}
      labelColor={labelColor}
      defaultCrew={defaultCrew}
      inspectors={inspectors}
      onOpenCrew={onOpenCrew}
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

      <LocationBadge
        status={locationStatus}
        userLocation={userLocation}
        onRetry={onRetryLocation}
        accentText={accentText}
        labelColor={labelColor}
      />

      {onOpenCrew && (
        <CrewIndicator
          defaultCrew={defaultCrew ?? null}
          inspectors={inspectors ?? []}
          onOpen={onOpenCrew}
          compact={false}
        />
      )}

      <button
        type="button"
        onClick={onToggleTheme}
        className="fo-mono"
        title={`Switch to ${isLight ? "dark" : "light"} theme`}
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
        <span style={{ lineHeight: 1 }}>{isLight ? "LIGHT" : "DARK"}</span>
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
        <span style={{ lineHeight: 1 }}>LIVE</span>
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
  scopeLabel,
  headerBg,
  textColor,
  borderColor,
  accentText,
  onOpenDrawer,
  locationStatus,
  userLocation,
  onRetryLocation,
  labelColor,
  defaultCrew,
  inspectors,
  onOpenCrew,
}: {
  scopeLabel: string;
  headerBg: string;
  textColor: string;
  borderColor: string;
  accentText: string;
  onOpenDrawer?: () => void;
  locationStatus?: GeolocationStatus;
  userLocation?: UserLocation;
  onRetryLocation?: () => void;
  labelColor: string;
  defaultCrew?: number[] | null;
  inspectors?: { id: number; username: string; displayName: string }[];
  onOpenCrew?: () => void;
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
      <LocationBadge
        status={locationStatus}
        userLocation={userLocation}
        onRetry={onRetryLocation}
        accentText={accentText}
        labelColor={labelColor}
      />
      {onOpenCrew && (
        <CrewIndicator
          defaultCrew={defaultCrew ?? null}
          inspectors={inspectors ?? []}
          onOpen={onOpenCrew}
          compact={true}
        />
      )}
      <UserChip accentText={accentText} textColor={textColor} borderColor={borderColor} compact />
    </header>
  );
}

function LocationBadge({
  status,
  userLocation,
  onRetry,
  accentText,
  labelColor,
}: {
  status: GeolocationStatus | undefined;
  userLocation: UserLocation | undefined;
  onRetry: (() => void) | undefined;
  accentText: string;
  labelColor: string;
}) {
  if (!status || status === 'unsupported') return null;

  const pillStyle: React.CSSProperties = {
    padding: '6px 12px',
    border: `1px solid ${accentText}`,
    color: accentText,
    borderRadius: 999,
    fontSize: 10,
    letterSpacing: '0.16em',
    background: 'transparent',
    cursor:
      status === 'denied' || status === 'timeout' || status === 'unavailable'
        ? 'pointer'
        : 'default',
  };

  if (status === 'locating') {
    return <div className="fo-mono" style={pillStyle}>○ LOCATING…</div>;
  }
  if (status === 'granted') {
    const acc = userLocation?.accuracy;
    const label = acc != null ? `● ±${Math.round(acc)}m` : '● LOCATED';
    return <div className="fo-mono" style={pillStyle}>{label}</div>;
  }
  const buttonLabel = status === 'denied' ? '⚠ ENABLE LOCATION' : '↻ RETRY LOCATION';
  return (
    <button
      type="button"
      className="fo-mono"
      onClick={onRetry}
      style={{ ...pillStyle, color: labelColor, borderColor: labelColor }}
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
          MANAGE USERS
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
          ADMIN
        </span>
      )}
      <button
        type="button"
        onClick={() => void logout()}
        aria-label="Log out"
        title="Log out"
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
