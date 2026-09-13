"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { UserLocation } from "@/types/station";
import { CELL_OPERATORS, type CellOperator, type CellSite } from "@/utils/cellSites";
import {
  DEFAULT_CELL_FILTERS,
  cellSiteKey,
  cellSiteMatchesFilter,
  cellSiteProvinces,
  countOperators,
  type CellSiteFilters,
} from "@/utils/cellSiteFilters";
import { CELL_OPERATOR_COLORS } from "@/utils/pinTokens";
import { CellSiteDetail } from "./CellSiteDetail";

const CellSitesMap = dynamic(
  () => import("./CellSitesMap").then((m) => m.CellSitesMap),
  { ssr: false, loading: () => <Placeholder label="LOADING MAP…" /> }
);

// ~6,600 sites is too much to ship with every page load, so the tab fetches
// them the first time it opens. Kept at module level so switching tabs away
// and back does not fetch again.
let sitesRequest: Promise<CellSite[]> | null = null;

function fetchCellSites(): Promise<CellSite[]> {
  sitesRequest ??= fetch("/api/cell-sites")
    .then((r) => {
      if (!r.ok) throw new Error(`cell sites: HTTP ${r.status}`);
      return r.json() as Promise<{ sites: CellSite[] }>;
    })
    .then((j) => j.sites)
    .catch((err) => {
      sitesRequest = null; // let the next open retry
      throw err;
    });
  return sitesRequest;
}

export function CellSitesTab({
  isMobile,
  userLocation,
}: {
  isMobile: boolean;
  userLocation?: UserLocation;
}) {
  const [sites, setSites] = useState<CellSite[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState<CellSiteFilters>(DEFAULT_CELL_FILTERS);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetchCellSites()
      .then((s) => !cancelled && setSites(s))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const provinces = useMemo(() => cellSiteProvinces(sites ?? []), [sites]);
  const filtered = useMemo(
    () => (sites ?? []).filter((s) => cellSiteMatchesFilter(s, filters)),
    [sites, filters]
  );
  const operatorCounts = useMemo(
    () => countOperators(sites ?? [], { ...DEFAULT_CELL_FILTERS, province: filters.province }),
    [sites, filters.province]
  );

  const selectedSite = useMemo(
    () => (selectedKey ? filtered.find((s) => cellSiteKey(s) === selectedKey) ?? null : null),
    [filtered, selectedKey]
  );

  // A filter change that hides the open site closes it, as in Field Ops.
  useEffect(() => {
    if (selectedKey && sites && !selectedSite) {
      setSelectedKey(null);
      setFlyTarget(null);
    }
  }, [selectedKey, selectedSite, sites]);

  const handleSelect = useCallback((key: string) => {
    setSelectedKey(key);
    const [lat, lng] = key.split(",").map(Number);
    setFlyTarget([lat, lng]);
  }, []);

  const clearSelection = () => {
    setSelectedKey(null);
    setFlyTarget(null);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <CellSiteFilterBar
        filters={filters}
        onChange={setFilters}
        provinces={provinces}
        operatorCounts={operatorCounts}
        visibleCount={filtered.length}
        compact={isMobile}
      />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          {error ? (
            <Placeholder label="COULD NOT LOAD CELL SITES">
              <button
                type="button"
                className="fo-mono"
                onClick={() => setAttempt((n) => n + 1)}
                style={{
                  marginTop: 12,
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid var(--fo-accent)",
                  background: "transparent",
                  color: "var(--fo-accent)",
                  cursor: "pointer",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                }}
              >
                RETRY
              </button>
            </Placeholder>
          ) : sites === null ? (
            <Placeholder label="LOADING CELL SITES…" />
          ) : (
            <CellSitesMap
              sites={filtered}
              filters={filters}
              selectedKey={selectedKey}
              onSelect={handleSelect}
              flyTarget={flyTarget}
              userLocation={userLocation}
            />
          )}
        </div>

        {!isMobile && (
          <aside
            style={{
              width: 360,
              background: "var(--fo-rail-bg)",
              color: "var(--fo-rail-text)",
              borderLeft: "1px solid var(--fo-rail-border)",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--fo-rail-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span className="fo-mono" style={{ color: "var(--fo-accent)" }}>
                {selectedSite ? "CURRENT" : "SELECT A SITE"}
              </span>
            </div>
            {selectedSite ? (
              <CellSiteDetail site={selectedSite} filters={filters} userLocation={userLocation} />
            ) : (
              <div style={{ padding: 20, flex: 1 }}>
                <div className="fo-serif" style={{ fontSize: 18, color: "var(--fo-rail-text)", marginBottom: 6 }}>
                  Tap a marker
                </div>
                <div className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>
                  Map shows {filtered.length} cell sites
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {isMobile && selectedSite && (
        <div
          role="dialog"
          aria-label="Cell site details"
          style={{
            background: "var(--fo-sheet-bg)",
            borderTop: "1px solid var(--fo-rail-border)",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            boxShadow: "0 -8px 24px rgba(0,30,43,0.1)",
            maxHeight: "50dvh",
            display: "flex",
            flexDirection: "column",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 12px 0" }}>
            <button
              type="button"
              aria-label="Close"
              onClick={clearSelection}
              className="fo-mono"
              style={{
                border: "none",
                background: "transparent",
                color: "var(--fo-rail-mute)",
                fontSize: 18,
                cursor: "pointer",
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>
          <CellSiteDetail site={selectedSite} filters={filters} userLocation={userLocation} />
        </div>
      )}
    </div>
  );
}

export function CellSiteFilterBar({
  filters,
  onChange,
  provinces,
  operatorCounts,
  visibleCount,
  compact,
}: {
  filters: CellSiteFilters;
  onChange: (next: CellSiteFilters) => void;
  provinces: string[];
  /** Sites per operator in the chosen province, before the operator filter. */
  operatorCounts: Record<CellOperator, number>;
  visibleCount: number;
  compact: boolean;
}) {
  const toggleOperator = (op: CellOperator) => {
    const on = filters.operators.includes(op);
    const operators = on
      ? filters.operators.filter((o) => o !== op)
      : CELL_OPERATORS.filter((o) => o === op || filters.operators.includes(o));
    onChange({ ...filters, operators });
  };

  return (
    <div
      style={{
        background: "var(--fo-band)",
        borderBottom: "1px solid var(--fo-divider)",
        padding: compact ? "10px 12px" : "12px 20px",
        display: "flex",
        flexWrap: "wrap",
        gap: compact ? 8 : 12,
        alignItems: "center",
      }}
    >
      <span className="fo-mono" style={{ color: "var(--fo-band-mute)" }}>OPERATOR</span>
      {CELL_OPERATORS.map((op) => {
        const active = filters.operators.includes(op);
        const color = CELL_OPERATOR_COLORS[op];
        return (
          <button
            key={op}
            type="button"
            className="fo-mono"
            aria-pressed={active}
            onClick={() => toggleOperator(op)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 999,
              border: `1px solid ${active ? color : "var(--fo-divider)"}`,
              background: active ? color : "transparent",
              color: active ? "#ffffff" : "var(--fo-band-text)",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.16em",
            }}
          >
            {!active && (
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
            )}
            {op}
            <span style={{ fontWeight: 400, opacity: 0.85 }}>{operatorCounts[op]}</span>
          </button>
        );
      })}

      <select
        aria-label="Province filter"
        className="fo-mono"
        value={filters.province}
        onChange={(e) => onChange({ ...filters, province: e.target.value })}
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          border: "1px solid var(--fo-divider)",
          background: "var(--fo-band-inset)",
          color: "var(--fo-band-text)",
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        {["All", ...provinces].map((p) => (
          <option key={p} value={p}>
            {p === "All" ? "ALL PROVINCES" : p}
          </option>
        ))}
      </select>

      {!compact && <div style={{ flex: 1 }} />}

      <input
        type="search"
        aria-label="Search licence or station code"
        placeholder="Search licence no., station code…"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        style={{
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px solid var(--fo-divider)",
          background: "var(--fo-band-inset)",
          color: "var(--fo-band-text)",
          fontSize: 12,
          minWidth: compact ? 0 : 240,
          flex: compact ? "1 1 160px" : undefined,
        }}
      />
      <span className="fo-mono" style={{ color: "var(--fo-band-mute)" }}>
        {visibleCount} VISIBLE
      </span>
    </div>
  );
}

function Placeholder({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--fo-canvas)",
        color: "var(--fo-accent)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span className="fo-mono">{label}</span>
      {children}
    </div>
  );
}
