"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_FILTERS,
  type FieldFilters,
  type StatusFilter,
  type TypeFilter,
} from "./FieldOpsFilters";
import { MobileFilterSheet } from "./MobileFilterSheet";

const SS_KEY = "fo:filterSheetOpen";
const TYPES: TypeFilter[] = ["ALL", "FM", "INT"];
const STATUSES: StatusFilter[] = ["ALL", "PENDING", "INSPECTED"];

const TYPE_LABEL: Record<TypeFilter, string> = {
  ALL: "All",
  FM: "FM",
  INT: "INT",
};

const STATUS_LABEL: Record<StatusFilter, string> = {
  ALL: "All",
  PENDING: "Pending",
  INSPECTED: "Inspected",
};

export function MobileFilterBar({
  filters,
  onChange,
  provinces,
  resultCount,
}: {
  filters: FieldFilters;
  onChange: (next: FieldFilters) => void;
  provinces: string[];
  resultCount: number;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(SS_KEY);
      if (stored === "true") setSheetOpen(true);
    } catch {
      // Safari private mode — keep default
    }
  }, []);

  const persist = (open: boolean) => {
    setSheetOpen(open);
    try {
      window.sessionStorage.setItem(SS_KEY, String(open));
    } catch {
      // ignore
    }
  };

  const advancedCount =
    (filters.search.trim().length > 0 ? 1 : 0) +
    (filters.province !== "All" ? 1 : 0) +
    (filters.offAir ? 1 : 0) +
    (filters.revoked ? 1 : 0) +
    (filters.lawSent ? 1 : 0);

  const anyFilterActive =
    filters.type !== "ALL" || filters.status !== "ALL" || advancedCount > 0;

  const handleType = (v: TypeFilter) => {
    const next: FieldFilters = { ...filters, type: v };
    if (v === "FM") next.lawSent = false;
    if (v === "INT") {
      next.offAir = false;
      next.revoked = false;
    }
    onChange(next);
  };

  const handleStatus = (v: StatusFilter) => {
    onChange({ ...filters, status: v });
  };

  const handleReset = () => {
    onChange(DEFAULT_FILTERS);
  };

  return (
    <>
      <div
        style={{
          background: "var(--fo-rail-bg)",
          borderBottom: "1px solid var(--fo-rail-border)",
          padding: "8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <ChipGroup
            options={TYPES}
            label={(v) => TYPE_LABEL[v]}
            isActive={(v) => filters.type === v}
            onPick={handleType}
          />
          <ChipGroup
            options={STATUSES}
            label={(v) => STATUS_LABEL[v]}
            isActive={(v) => filters.status === v}
            onPick={handleStatus}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={() => persist(true)}
            className="fo-mono"
            aria-label={
              advancedCount > 0
                ? `More filters (${advancedCount} active)`
                : "More filters"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
              padding: "0 14px",
              border: "1px solid var(--fo-accent)",
              borderRadius: 999,
              background: "transparent",
              color: "var(--fo-accent)",
              fontSize: 11,
              cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            <span aria-hidden>⇅</span>
            <span>More{advancedCount > 0 ? ` · ${advancedCount}` : ""}</span>
          </button>
          {anyFilterActive && (
            <button
              type="button"
              onClick={handleReset}
              className="fo-mono"
              style={{
                minHeight: 44,
                padding: "0 14px",
                border: "1px solid var(--fo-rail-border)",
                borderRadius: 999,
                background: "transparent",
                color: "var(--fo-rail-mute)",
                fontSize: 11,
                cursor: "pointer",
                letterSpacing: "0.04em",
              }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <MobileFilterSheet
        open={sheetOpen}
        onClose={() => persist(false)}
        filters={filters}
        onChange={onChange}
        provinces={provinces}
        resultCount={resultCount}
      />
    </>
  );
}

function ChipGroup<T extends string>({
  options,
  label,
  isActive,
  onPick,
}: {
  options: readonly T[];
  label: (v: T) => string;
  isActive: (v: T) => boolean;
  onPick: (v: T) => void;
}) {
  return (
    <div
      role="group"
      style={{
        flex: 1,
        display: "flex",
        gap: 2,
        minWidth: 0,
      }}
    >
      {options.map((opt) => {
        const active = isActive(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onPick(opt)}
            aria-pressed={active}
            className="fo-mono"
            style={{
              flex: 1,
              minHeight: 44,
              padding: "0 8px",
              border: "none",
              background: active ? "var(--fo-accent)" : "transparent",
              color: active ? "#001e2b" : "var(--fo-rail-text)",
              fontSize: 12,
              fontWeight: active ? 700 : 400,
              cursor: "pointer",
              letterSpacing: "0.04em",
              borderRadius: 8,
              transition:
                "background-color 120ms ease, color 120ms ease",
              whiteSpace: "nowrap",
            }}
          >
            {label(opt)}
          </button>
        );
      })}
    </div>
  );
}
