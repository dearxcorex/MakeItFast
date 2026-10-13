"use client";

import { useEffect, useState } from "react";
import {
  STATUS_LABEL,
  type FieldFilters,
  type StatusFilter,
} from "./FieldOpsFilters";
import { MobileFilterSheet } from "./MobileFilterSheet";

const SS_KEY = "fo:filterSheetOpen";
const STATUSES: StatusFilter[] = ["ALL", "PENDING", "INSPECTED"];

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

  // Everything the sheet holds, type included — the badge has to account for
  // any filter that is narrowing the map but is not visible in this row.
  const sheetCount =
    (filters.type !== "ALL" ? 1 : 0) +
    (filters.search.trim().length > 0 ? 1 : 0) +
    (filters.province !== "All" ? 1 : 0) +
    (filters.offAir ? 1 : 0) +
    (filters.revoked ? 1 : 0) +
    (filters.lawSent ? 1 : 0);

  const handleStatus = (v: StatusFilter) => {
    onChange({ ...filters, status: v });
  };

  return (
    <>
      <div
        style={{
          background: "var(--fo-rail-bg)",
          borderBottom: "1px solid var(--fo-rail-border)",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <ChipGroup
          options={STATUSES}
          label={(v) => STATUS_LABEL[v]}
          isActive={(v) => filters.status === v}
          onPick={handleStatus}
        />
        <button
          type="button"
          onClick={() => persist(true)}
          aria-label={sheetCount > 0 ? `ตัวกรอง (ใช้อยู่ ${sheetCount})` : "ตัวกรอง"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minHeight: 44,
            padding: "0 14px",
            border: "1px solid var(--fo-accent)",
            borderRadius: 999,
            background: sheetCount > 0 ? "var(--fo-accent)" : "transparent",
            color: sheetCount > 0 ? "#001e2b" : "var(--fo-accent)",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          <span aria-hidden>⇅</span>
          <span>ตัวกรอง{sheetCount > 0 ? ` · ${sheetCount}` : ""}</span>
        </button>
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
            style={{
              // flex-basis 0 + minWidth 0 keeps "Inspected" from pushing the
              // row past the viewport — an overflowing chip lets the whole
              // page scroll sideways on a phone.
              flexGrow: 1,
              flexShrink: 1,
              flexBasis: 0,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              minHeight: 44,
              padding: "0 6px",
              border: "none",
              background: active ? "var(--fo-accent)" : "transparent",
              color: active ? "#001e2b" : "var(--fo-rail-text)",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: active ? 700 : 400,
              cursor: "pointer",
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
