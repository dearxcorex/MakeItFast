"use client";

import { useEffect, useState } from "react";
import {
  type FieldFilters,
  type TypeFilter,
  type StatusFilter,
} from "./FieldOpsFilters";

const SS_KEY = "fo:mobileFiltersOpen";
const TYPES: TypeFilter[] = ["ALL", "FM", "INT"];
const STATUSES_FM: Array<StatusFilter | "OFF AIR"> = ["ALL", "PENDING", "INSPECTED", "OFF AIR"];
const STATUSES_INT: StatusFilter[] = ["ALL", "PENDING", "INSPECTED"];

export function MobileFilterBar({
  filters,
  onChange,
  provinces,
}: {
  filters: FieldFilters;
  onChange: (next: FieldFilters) => void;
  provinces: string[];
}) {
  const [expanded, setExpanded] = useState<boolean>(true);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(SS_KEY);
      if (stored === "false") setExpanded(false);
      if (stored === "true") setExpanded(true);
    } catch {
      // Safari private mode — keep default
    }
  }, []);

  const persist = (v: boolean) => {
    setExpanded(v);
    try {
      window.sessionStorage.setItem(SS_KEY, String(v));
    } catch {
      // ignore
    }
  };

  const activeCount =
    (filters.type !== "ALL" ? 1 : 0) +
    (filters.status !== "ALL" ? 1 : 0) +
    (filters.province !== "All" ? 1 : 0) +
    (filters.offAir ? 1 : 0) +
    (filters.lawSent ? 1 : 0) +
    (filters.search.trim().length > 0 ? 1 : 0);

  const handleType = (v: TypeFilter) => {
    const next: FieldFilters = { ...filters, type: v };
    if (v === "FM") {
      next.severity = "ALL";
      next.lawSent = false;
    }
    if (v === "INT") {
      next.offAir = false;
      // Mobile INT view shows only critical-ranked sites — clutter-free.
      next.severity = "Critical";
    }
    if (v === "ALL") {
      next.severity = "ALL";
    }
    onChange(next);
  };

  const handleStatus = (v: StatusFilter | "OFF AIR") => {
    if (v === "OFF AIR") {
      onChange({ ...filters, status: "ALL", offAir: !filters.offAir });
    } else {
      onChange({ ...filters, status: v as StatusFilter, offAir: false });
    }
  };

  const isStatusActive = (v: StatusFilter | "OFF AIR"): boolean => {
    if (v === "OFF AIR") return filters.offAir;
    return filters.status === v && !filters.offAir;
  };

  const provinceOptions = ["All", ...provinces];
  const showLawSent = filters.type !== "FM";
  const showOffAirInStatus = filters.type !== "INT";

  if (!expanded) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "var(--fo-rail-bg)",
          borderBottom: "1px solid var(--fo-rail-border)",
        }}
      >
        <button
          type="button"
          aria-label="Expand filters"
          className="fo-mono"
          onClick={() => persist(true)}
          style={{
            border: "1px solid var(--fo-accent)",
            color: "var(--fo-accent)",
            background: "transparent",
            padding: "5px 12px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: "0.16em",
            cursor: "pointer",
          }}
        >
          ≡ FILTERS · {activeCount}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--fo-rail-bg)",
        borderBottom: "1px solid var(--fo-rail-border)",
        padding: "8px 12px",
      }}
    >
      <SegmentRow
        label="TYPE"
        options={TYPES}
        isActive={(v) => filters.type === v}
        onPick={handleType}
        rightAdornment={
          <button
            type="button"
            aria-label="Collapse filters"
            onClick={() => persist(false)}
            className="fo-mono"
            style={{
              border: "1px solid var(--fo-rail-border)",
              color: "var(--fo-rail-mute)",
              background: "transparent",
              padding: 0,
              width: 28,
              height: 28,
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ▴
          </button>
        }
      />
      <div style={{ height: 6 }} />
      <SegmentRow
        label="PROVINCE"
        options={provinceOptions}
        isActive={(v) => (v === "All" ? filters.province === "All" : filters.province === v)}
        onPick={(v) => onChange({ ...filters, province: v })}
        renderLabel={(v) => (v === "All" ? "ALL" : v)}
      />
      <div style={{ height: 6 }} />
      <SegmentRow
        label="STATUS"
        options={showOffAirInStatus ? STATUSES_FM : STATUSES_INT}
        isActive={isStatusActive}
        onPick={handleStatus}
      />
      {showLawSent && (
        <>
          <div style={{ height: 6 }} />
          <SegmentRow
            label="LAW"
            options={["ALL", "SENT"] as const}
            isActive={(v) => (v === "ALL" ? !filters.lawSent : filters.lawSent)}
            onPick={(v) => onChange({ ...filters, lawSent: v === "SENT" })}
          />
        </>
      )}
    </div>
  );
}

function SegmentRow<T extends string>({
  label,
  options,
  isActive,
  onPick,
  rightAdornment,
  renderLabel,
}: {
  label: string;
  options: readonly T[];
  isActive: (v: T) => boolean;
  onPick: (v: T) => void;
  rightAdornment?: React.ReactNode;
  renderLabel?: (v: T) => string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        className="fo-mono"
        style={{
          color: "var(--fo-rail-mute)",
          fontSize: 9,
          flexShrink: 0,
          width: 56,
          letterSpacing: "0.18em",
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          display: "flex",
          overflowX: "auto",
          scrollbarWidth: "none",
          background: "transparent",
          border: "1px solid var(--fo-rail-border)",
          borderRadius: 8,
          padding: 2,
          gap: 0,
          minWidth: 0,
        }}
      >
        {options.map((opt, i) => {
          const active = isActive(opt);
          return (
            <button
              key={opt}
              type="button"
              className="fo-mono"
              onClick={() => onPick(opt)}
              style={{
                position: "relative",
                padding: "6px 12px",
                border: "none",
                background: active ? "var(--fo-accent)" : "transparent",
                color: active ? "#001e2b" : "var(--fo-rail-text)",
                fontSize: 10,
                fontWeight: active ? 700 : 400,
                flexShrink: 0,
                cursor: "pointer",
                letterSpacing: "0.12em",
                borderRadius: 6,
                marginLeft: i === 0 ? 0 : 1,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}
            >
              {renderLabel ? renderLabel(opt) : opt}
            </button>
          );
        })}
      </div>
      {rightAdornment}
    </div>
  );
}
