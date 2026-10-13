"use client";

import { useEffect, useRef } from "react";
import {
  DEFAULT_FILTERS,
  TYPE_LABEL,
  type FieldFilters,
  type TypeFilter,
} from "./FieldOpsFilters";

const TYPES: TypeFilter[] = ["ALL", "FM", "INT"];

interface Props {
  open: boolean;
  onClose: () => void;
  filters: FieldFilters;
  onChange: (next: FieldFilters) => void;
  provinces: string[];
  resultCount: number;
}

export function MobileFilterSheet({
  open,
  onClose,
  filters,
  onChange,
  provinces,
  resultCount,
}: Props) {
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleSwipeStart = (e: React.TouchEvent) => {
    // Inputs/selects own their touch interaction; never treat swipes that
    // start on them as a dismiss gesture.
    if ((e.target as HTMLElement).closest("input, textarea, select")) {
      touchStartY.current = null;
      return;
    }
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };

  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
    const dy = endY - touchStartY.current;
    touchStartY.current = null;
    if (dy > 60) onClose();
  };

  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (filters.search.trim().length > 0) {
    activeChips.push({
      key: "search",
      label: `ค้นหา "${filters.search}"`,
      clear: () => onChange({ ...filters, search: "" }),
    });
  }
  if (filters.province !== "All") {
    activeChips.push({
      key: "province",
      label: `จังหวัด: ${filters.province}`,
      clear: () => onChange({ ...filters, province: "All" }),
    });
  }
  if (filters.offAir) {
    activeChips.push({
      key: "offAir",
      label: "ไม่ออกอากาศ",
      clear: () => onChange({ ...filters, offAir: false }),
    });
  }
  if (filters.revoked) {
    activeChips.push({
      key: "revoked",
      label: "เพิกถอน",
      clear: () => onChange({ ...filters, revoked: false }),
    });
  }
  if (filters.lawSent) {
    activeChips.push({
      key: "lawSent",
      label: "ส่งหนังสือแล้ว",
      clear: () => onChange({ ...filters, lawSent: false }),
    });
  }

  const handleType = (v: TypeFilter) => {
    const next: FieldFilters = { ...filters, type: v };
    if (v === "FM") next.lawSent = false;
    if (v === "INT") {
      next.offAir = false;
      next.revoked = false;
    }
    onChange(next);
  };

  const anyFilterActive =
    filters.type !== "ALL" || filters.status !== "ALL" || activeChips.length > 0;

  const showFMFilters = filters.type !== "INT";
  const showINTFilters = filters.type !== "FM";

  return (
    <>
      <div
        data-testid="fo-filter-sheet-backdrop"
        onClick={onClose}
        aria-hidden={!open}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.55)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 180ms ease",
          zIndex: 1000,
        }}
      />
      <aside
        role="dialog"
        aria-label="ตัวกรอง"
        aria-hidden={!open}
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "75dvh",
          background: "var(--fo-band)",
          color: "var(--fo-text)",
          borderRadius: "16px 16px 0 0",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "8px 0 4px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: "var(--fo-rail-mute)",
              opacity: 0.5,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px 12px",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.1 }}>
            ตัวกรอง
          </span>
          <div style={{ flex: 1 }} />
          {anyFilterActive && (
            <button
              type="button"
              onClick={() => onChange(DEFAULT_FILTERS)}
              style={{
                minHeight: 44,
                padding: "0 12px",
                marginRight: 4,
                border: "none",
                background: "transparent",
                color: "var(--fo-accent)",
                fontFamily: "inherit",
                fontSize: 14,
                cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              ล้าง
            </button>
          )}
          <button
            type="button"
            aria-label="ปิด"
            onClick={onClose}
            style={{
              width: 44,
              height: 44,
              border: "1px solid var(--fo-rail-border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--fo-rail-mute)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              touchAction: "manipulation",
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0 16px",
            WebkitOverflowScrolling: "touch",
            minHeight: 0,
          }}
        >
          {activeChips.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
                padding: "8px 0 16px",
                borderBottom: "1px solid var(--fo-divider)",
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--fo-rail-mute)" }}>
                ที่ใช้อยู่:
              </span>
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.clear}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    minHeight: 36,
                    border: "1px solid var(--fo-accent)",
                    borderRadius: 999,
                    background: "rgba(0, 237, 100, 0.08)",
                    color: "var(--fo-accent)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {c.label} <span aria-hidden>✕</span>
                </button>
              ))}
            </div>
          )}

          <FilterSection label="ประเภท">
            <div role="group" style={{ display: "flex", gap: 8 }}>
              {TYPES.map((t) => {
                const active = filters.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleType(t)}
                    aria-pressed={active}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 44,
                      border: `1px solid ${active ? "var(--fo-accent)" : "var(--fo-divider)"}`,
                      background: active ? "var(--fo-accent)" : "transparent",
                      color: active ? "#001e2b" : "var(--fo-text)",
                      borderRadius: 10,
                      fontFamily: "inherit",
                      fontSize: 14,
                      fontWeight: active ? 700 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </FilterSection>

          <FilterSection label="ค้นหา">
            <input
              type="search"
              placeholder="ค้นหาสถานี…"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid var(--fo-divider)",
                background: "transparent",
                color: "var(--fo-text)",
                borderRadius: 10,
                fontSize: 14,
                minHeight: 44,
              }}
            />
          </FilterSection>

          <FilterSection label="จังหวัด">
            <select
              value={filters.province}
              onChange={(e) => onChange({ ...filters, province: e.target.value })}
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "1px solid var(--fo-divider)",
                background: "transparent",
                color: "var(--fo-text)",
                borderRadius: 10,
                fontSize: 14,
                minHeight: 44,
                cursor: "pointer",
              }}
            >
              <option value="All">ทุกจังหวัด</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FilterSection>

          {showFMFilters && (
            <FilterSection label="ตัวกรอง FM">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TogglePill
                  label="ไม่ออกอากาศ"
                  active={filters.offAir}
                  onClick={() => onChange({ ...filters, offAir: !filters.offAir })}
                />
                <TogglePill
                  label="เพิกถอน"
                  active={filters.revoked}
                  onClick={() => onChange({ ...filters, revoked: !filters.revoked })}
                />
              </div>
            </FilterSection>
          )}

          {showINTFilters && (
            <FilterSection label="ตัวกรองการรบกวน">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TogglePill
                  label="ส่งหนังสือแล้ว"
                  active={filters.lawSent}
                  onClick={() => onChange({ ...filters, lawSent: !filters.lawSent })}
                />
              </div>
            </FilterSection>
          )}
        </div>

        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--fo-divider)",
            background: "var(--fo-band)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              minHeight: 52,
              border: "none",
              background: "var(--fo-accent)",
              color: "#001e2b",
              borderRadius: 12,
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            แสดง {resultCount} รายการ
          </button>
        </div>
      </aside>
    </>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "var(--fo-rail-mute)", marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        minHeight: 44,
        border: `1px solid ${active ? "var(--fo-accent)" : "var(--fo-divider)"}`,
        background: active ? "var(--fo-accent)" : "transparent",
        color: active ? "#001e2b" : "var(--fo-text)",
        borderRadius: 999,
        fontFamily: "inherit",
        fontSize: 14,
        cursor: "pointer",
        transition: "background-color 120ms ease, border-color 120ms ease",
      }}
    >
      <span>{label}</span>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: active ? "#001e2b" : "var(--fo-rail-mute)",
          opacity: active ? 1 : 0.3,
        }}
      />
    </button>
  );
}
