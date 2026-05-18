"use client";

import { useEffect, useRef } from "react";
import type { FieldFilters } from "./FieldOpsFilters";

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
  const searchRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

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
      label: `Search "${filters.search}"`,
      clear: () => onChange({ ...filters, search: "" }),
    });
  }
  if (filters.province !== "All") {
    activeChips.push({
      key: "province",
      label: `Province: ${filters.province}`,
      clear: () => onChange({ ...filters, province: "All" }),
    });
  }
  if (filters.offAir) {
    activeChips.push({
      key: "offAir",
      label: "Off air",
      clear: () => onChange({ ...filters, offAir: false }),
    });
  }
  if (filters.revoked) {
    activeChips.push({
      key: "revoked",
      label: "Revoked",
      clear: () => onChange({ ...filters, revoked: false }),
    });
  }
  if (filters.lawSent) {
    activeChips.push({
      key: "lawSent",
      label: "Law-paper sent",
      clear: () => onChange({ ...filters, lawSent: false }),
    });
  }

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
        aria-label="More filters"
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
          <span className="fo-serif" style={{ fontSize: 18, lineHeight: 1.1 }}>
            More filters
          </span>
          <button
            type="button"
            aria-label="Close"
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
              <span
                className="fo-mono"
                style={{
                  fontSize: 10,
                  color: "var(--fo-rail-mute)",
                  letterSpacing: "0.16em",
                }}
              >
                Active:
              </span>
              {activeChips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.clear}
                  className="fo-mono"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 10px",
                    minHeight: 32,
                    border: "1px solid var(--fo-accent)",
                    borderRadius: 999,
                    background: "rgba(0, 237, 100, 0.08)",
                    color: "var(--fo-accent)",
                    fontSize: 11,
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                >
                  {c.label} <span aria-hidden>✕</span>
                </button>
              ))}
            </div>
          )}

          <FilterSection label="Search">
            <input
              ref={searchRef}
              type="search"
              placeholder="Search stations…"
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

          <FilterSection label="Province">
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
              <option value="All">All provinces</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FilterSection>

          {showFMFilters && (
            <FilterSection label="FM filters">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TogglePill
                  label="Off air"
                  active={filters.offAir}
                  onClick={() => onChange({ ...filters, offAir: !filters.offAir })}
                />
                <TogglePill
                  label="Revoked"
                  active={filters.revoked}
                  onClick={() => onChange({ ...filters, revoked: !filters.revoked })}
                />
              </div>
            </FilterSection>
          )}

          {showINTFilters && (
            <FilterSection label="INT filters">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TogglePill
                  label="Law-paper sent"
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
            className="fo-mono"
            style={{
              width: "100%",
              minHeight: 56,
              border: "none",
              background: "var(--fo-accent)",
              color: "#001e2b",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.04em",
              touchAction: "manipulation",
            }}
          >
            Show {resultCount} {resultCount === 1 ? "result" : "results"}
          </button>
        </div>
      </aside>
    </>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        className="fo-mono"
        style={{
          fontSize: 10,
          color: "var(--fo-rail-mute)",
          letterSpacing: "0.16em",
          marginBottom: 8,
        }}
      >
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
      className="fo-mono"
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
        fontSize: 12,
        cursor: "pointer",
        letterSpacing: "0.04em",
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
