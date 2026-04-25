"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import { FieldOpsNav, type FieldOpsTab } from "./FieldOpsNav";
import { FieldOpsHeader } from "./FieldOpsHeader";
import { FieldOpsStats } from "./FieldOpsStats";
import { FieldOpsFilters, DEFAULT_FILTERS, type FieldFilters } from "./FieldOpsFilters";
import { FieldOpsCurrentFM, FieldOpsCurrentINT } from "./FieldOpsCurrent";
import { FieldOpsBottomSheet } from "./FieldOpsBottomSheet";
import type { FieldSelection } from "./FieldOpsMap";

const FieldOpsMap = dynamic(
  () => import("./FieldOpsMap").then((m) => m.FieldOpsMap),
  { ssr: false, loading: () => <MapLoading /> }
);

const IntermodCalculator = dynamic(() => import("@/components/IntermodCalculator"), {
  ssr: false,
  loading: () => <SimpleLoading label="Loading Intermod Calculator…" />,
});

const AnalyticsDashboard = dynamic(() => import("@/components/analytics/AnalyticsDashboard"), {
  ssr: false,
  loading: () => <SimpleLoading label="Loading Analytics…" />,
});

interface Props {
  initialStations: FMStation[];
  initialInterference: InterferenceSite[];
  initialCities: string[];
  initialProvinces: string[];
}

export default function FieldOpsClient({
  initialStations,
  initialInterference,
  initialProvinces,
}: Props) {
  const [tab, setTab] = useState<FieldOpsTab>("field-ops");
  const [stations, setStations] = useState<FMStation[]>(initialStations);
  const [interference, setInterference] = useState<InterferenceSite[]>(initialInterference);
  const [filters, setFilters] = useState<FieldFilters>(DEFAULT_FILTERS);
  const [selection, setSelection] = useState<FieldSelection>(null);
  const [pending, setPending] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("fo-theme");
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("fo-theme", theme);
  }, [theme]);

  const filteredStations = useMemo(() => {
    if (filters.type === "INT") return [];
    return stations.filter((s) => {
      if (filters.province !== "All" && s.state !== filters.province) return false;
      if (filters.status === "PENDING" && s.inspection69 === "ตรวจแล้ว") return false;
      if (filters.status === "INSPECTED" && s.inspection69 !== "ตรวจแล้ว") return false;
      if (filters.status === "LAW_SENT") return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${s.name} ${s.frequency} ${s.city} ${s.state} ${s.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [stations, filters]);

  const filteredInterference = useMemo(() => {
    if (filters.type === "FM") return [];
    return interference.filter((s) => {
      if (filters.province !== "All" && s.changwat !== filters.province) return false;
      if (filters.status === "PENDING" && s.status === "ตรวจแล้ว") return false;
      if (filters.status === "INSPECTED" && s.status !== "ตรวจแล้ว") return false;
      if (filters.status === "LAW_SENT" && !s.lawPaperSent) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${s.siteName ?? ""} ${s.siteCode ?? ""} ${s.cellName ?? ""} ${s.changwat ?? ""} ${s.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [interference, filters]);

  const visibleCount = filteredStations.length + filteredInterference.length;

  const selectedStation =
    selection?.kind === "fm" ? stations.find((s) => s.id === selection.id) ?? null : null;
  const selectedSite =
    selection?.kind === "int" ? interference.find((s) => s.id === selection.id) ?? null : null;

  const handleSelect = (sel: FieldSelection) => {
    setSelection(sel);
    if (!sel) {
      setFlyTarget(null);
      return;
    }
    if (sel.kind === "fm") {
      const s = stations.find((x) => x.id === sel.id);
      if (s) setFlyTarget([s.latitude, s.longitude]);
    } else {
      const s = interference.find((x) => x.id === sel.id);
      if (s && s.lat !== null && s.long !== null) setFlyTarget([s.lat, s.long]);
    }
  };

  const handleToggleInspection = async () => {
    if (!selection) return;
    setPending(true);
    try {
      if (selection.kind === "fm" && selectedStation) {
        const next = selectedStation.inspection69 === "ตรวจแล้ว" ? "ยังไม่ตรวจ" : "ตรวจแล้ว";
        setStations((all) =>
          all.map((s) =>
            s.id === selectedStation.id
              ? { ...s, inspection69: next, dateInspected: next === "ตรวจแล้ว" ? new Date().toISOString().split("T")[0] : undefined }
              : s
          )
        );
        const res = await fetch(`/api/stations/${selectedStation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inspection69: next }),
        });
        if (!res.ok) throw new Error("FM update failed");
      } else if (selection.kind === "int" && selectedSite) {
        const next = selectedSite.status === "ตรวจแล้ว" ? "ยังไม่ตรวจ" : "ตรวจแล้ว";
        setInterference((all) =>
          all.map((s) => (s.id === selectedSite.id ? { ...s, status: next } : s))
        );
        const res = await fetch(`/api/interference/${selectedSite.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) throw new Error("Interference update failed");
      }
    } catch (err) {
      console.error(err);
      window.location.reload();
    } finally {
      setPending(false);
    }
  };

  const handleToggleLawPaper = async () => {
    if (!selection || selection.kind !== "int" || !selectedSite) return;
    setPending(true);
    try {
      const next = !selectedSite.lawPaperSent;
      setInterference((all) =>
        all.map((s) => (s.id === selectedSite.id ? { ...s, lawPaperSent: next } : s))
      );
      const res = await fetch(`/api/interference/${selectedSite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawPaperSent: next }),
      });
      if (!res.ok) throw new Error("Law paper toggle failed");
    } catch (err) {
      console.error(err);
      window.location.reload();
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="field-ops-root"
      data-theme={theme}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <FieldOpsHeader
        stations={stations}
        interference={interference}
        type={filters.type}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {!isMobile && <FieldOpsNav active={tab} onChange={setTab} />}

        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          {tab === "field-ops" && (
            <>
              {!isMobile && (
                <FieldOpsFilters
                  filters={filters}
                  onChange={setFilters}
                  provinces={initialProvinces}
                  visibleCount={visibleCount}
                />
              )}

              <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
                <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                  <FieldOpsMap
                    stations={filteredStations}
                    interference={filteredInterference}
                    selection={selection}
                    onSelect={handleSelect}
                    flyTarget={flyTarget}
                    theme={theme}
                  />
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
                        {selection ? "CURRENT" : "SELECT A SITE"}
                      </span>
                      <span className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>
                        {visibleCount} VISIBLE
                      </span>
                    </div>

                    {selection?.kind === "fm" && selectedStation && (
                      <FieldOpsCurrentFM
                        station={selectedStation}
                        onToggleInspection={handleToggleInspection}
                        pending={pending}
                      />
                    )}
                    {selection?.kind === "int" && selectedSite && (
                      <FieldOpsCurrentINT
                        site={selectedSite}
                        onToggleInspection={handleToggleInspection}
                        onToggleLawPaper={handleToggleLawPaper}
                        pending={pending}
                      />
                    )}
                    {!selection && (
                      <div style={{ padding: 20 }}>
                        <div className="fo-serif" style={{ fontSize: 18, color: "var(--fo-rail-text)", marginBottom: 6 }}>
                          Tap a marker
                        </div>
                        <div className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>
                          Map shows {filteredStations.length} FM · {filteredInterference.length} INT
                        </div>
                      </div>
                    )}

                    <FieldOpsStats stations={filteredStations} interference={filteredInterference} />
                  </aside>
                )}
              </div>

              {isMobile && (
                <FieldOpsBottomSheet
                  selection={selection}
                  station={selectedStation}
                  site={selectedSite}
                  onToggleInspection={handleToggleInspection}
                  onToggleLawPaper={handleToggleLawPaper}
                  pending={pending}
                />
              )}
            </>
          )}

          {tab === "intermod" && (
            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: 20,
                background: "var(--fo-canvas)",
              }}
            >
              <IntermodCalculator stations={stations} />
            </div>
          )}

          {tab === "analytics" && (
            <div style={{ flex: 1, overflow: "auto", background: "var(--fo-canvas)" }}>
              <AnalyticsDashboard />
            </div>
          )}
        </main>
      </div>

      {isMobile && (
        <div
          style={{
            display: "flex",
            background: "var(--fo-rail-bg)",
            borderTop: "1px solid var(--fo-rail-border)",
          }}
        >
          {(["field-ops", "intermod", "analytics"] as FieldOpsTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="fo-mono"
              style={{
                flex: 1,
                padding: "12px 8px",
                background: tab === t ? "var(--fo-accent)" : "transparent",
                color: tab === t ? "#001e2b" : "var(--fo-rail-mute)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {t === "field-ops" ? "FIELD OPS" : t.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MapLoading() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#001216",
        color: "var(--fo-accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span className="fo-mono">LOADING MAP…</span>
    </div>
  );
}

function SimpleLoading({ label }: { label: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--fo-paper)",
        color: "var(--fo-mute)",
      }}
    >
      <span className="fo-mono">{label}</span>
    </div>
  );
}
