"use client";

import { useEffect, useState } from "react";
import {
  type FieldFilters,
  type TypeFilter,
  type StatusFilter,
} from "./FieldOpsFilters";

const SS_KEY = "fo:mobileFiltersOpen";
const TYPES: TypeFilter[] = ["ALL", "FM", "INT"];
const STATUSES: Array<StatusFilter | "OFF AIR"> = ["ALL", "PENDING", "INSPECTED", "OFF AIR"];

export function MobileFilterBar({
  filters,
  onChange,
}: {
  filters: FieldFilters;
  onChange: (next: FieldFilters) => void;
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
      <ChipRow
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
              marginLeft: "auto",
              border: "1px solid var(--fo-rail-border)",
              color: "var(--fo-rail-mute)",
              background: "transparent",
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            ▴
          </button>
        }
      />
      <div style={{ height: 4 }} />
      <ChipRow
        label="STATUS"
        options={STATUSES}
        isActive={isStatusActive}
        onPick={handleStatus}
      />
    </div>
  );
}

function ChipRow<T extends string>({
  label,
  options,
  isActive,
  onPick,
  rightAdornment,
}: {
  label: string;
  options: readonly T[];
  isActive: (v: T) => boolean;
  onPick: (v: T) => void;
  rightAdornment?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      <span
        className="fo-mono"
        style={{ color: "var(--fo-rail-mute)", fontSize: 9, flexShrink: 0 }}
      >
        {label}
      </span>
      {options.map((opt) => {
        const active = isActive(opt);
        return (
          <button
            key={opt}
            type="button"
            className="fo-mono"
            onClick={() => onPick(opt)}
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              border: active ? "none" : "1px solid var(--fo-rail-border)",
              background: active ? "var(--fo-accent)" : "transparent",
              color: active ? "#001e2b" : "var(--fo-rail-text)",
              fontSize: 10,
              fontWeight: active ? 700 : 400,
              flexShrink: 0,
              cursor: "pointer",
              letterSpacing: "0.1em",
            }}
          >
            {opt}
          </button>
        );
      })}
      {rightAdornment}
    </div>
  );
}
