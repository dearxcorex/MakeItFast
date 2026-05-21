"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { FMStation } from "@/types/station";
import type { InterferenceSite } from "@/types/interference";
import { FieldOpsNav, type FieldOpsTab } from "./FieldOpsNav";
import { FieldOpsHeader } from "./FieldOpsHeader";
import { FieldOpsFilters, DEFAULT_FILTERS, type FieldFilters } from "./FieldOpsFilters";
import { dedupeInterferenceSites } from "@/utils/dedupeInterference";
import { useGeolocation } from "@/hooks/useGeolocation";
import { haversineDistanceKm } from "@/utils/distance";
import { FieldOpsCurrentFM, FieldOpsCurrentINT } from "./FieldOpsCurrent";
import { FieldOpsBottomSheet } from "./FieldOpsBottomSheet";
import { FieldOpsDrawer } from "./FieldOpsDrawer";
import { MobileFilterBar } from "./MobileFilterBar";
import CrewModal from "./CrewModal";
import { computeKpis } from "@/utils/fieldOpsKpi";
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
  currentUser?: { id: number; displayName: string };
}

/**
 * Pure FM filter predicate. Exported for unit tests.
 * Returns true if `s` should be visible under `filters`.
 */
export function fmStationMatchesFilter(s: FMStation, filters: FieldFilters): boolean {
  if (filters.province !== "All" && s.state !== filters.province) return false;
  if (filters.status === "PENDING" && s.inspection69 === "ตรวจแล้ว") return false;
  if (filters.status === "INSPECTED" && s.inspection69 !== "ตรวจแล้ว") return false;
  // OFF AIR: license still valid but currently silent. Excludes revoked
  // so the OFF AIR / REVOKED filters are truly disjoint.
  if (filters.offAir && (s.onAir !== false || s.revoked === true)) return false;
  // REVOKED: license cancelled by NBTC. Illegal if on-air.
  if (filters.revoked && s.revoked !== true) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const hay = `${s.name} ${s.frequency} ${s.city} ${s.state} ${s.id}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export default function FieldOpsClient({
  initialStations,
  initialInterference,
  initialProvinces,
  currentUser,
}: Props) {
  const [tab, setTab] = useState<FieldOpsTab>("field-ops");
  const [stations, setStations] = useState<FMStation[]>(initialStations);
  const [interference, setInterference] = useState<InterferenceSite[]>(initialInterference);
  const [filters, setFilters] = useState<FieldFilters>(DEFAULT_FILTERS);
  const [selection, setSelection] = useState<FieldSelection>(null);
  const [pending, setPending] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [markingSourceForId, setMarkingSourceForId] = useState<number | null>(null);
  const [inspectors, setInspectors] = useState<{ id: number; username: string; displayName: string }[]>([]);
  const [helperUserIds, setHelperUserIds] = useState<number[]>([]);
  const [defaultCrew, setDefaultCrew] = useState<number[] | null>(null);
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [crewSaveError, setCrewSaveError] = useState<string | undefined>(undefined);
  const [crewSaving, setCrewSaving] = useState(false);
  const { userLocation, status: locationStatus, retry: retryLocation } = useGeolocation();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/users/me/crew')
      .then((r) => (r.ok ? r.json() : { defaultHelperUserIds: null }))
      .then((j: { defaultHelperUserIds: number[] | null }) => {
        if (cancelled) return;
        setDefaultCrew(j.defaultHelperUserIds);
        if (j.defaultHelperUserIds === null) setCrewModalOpen(true);
      })
      .catch(() => {
        if (cancelled) return;
        setDefaultCrew(null);
        setCrewModalOpen(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetch("/api/users/inspectors")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((j) => setInspectors(j.users ?? []))
      .catch(() => setInspectors([]));
  }, []);

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

  useEffect(() => {
    if (markingSourceForId === null) return;
    if (tab !== "field-ops") {
      setMarkingSourceForId(null);
      return;
    }
    if (selection?.kind !== "int" || selection.id !== markingSourceForId) {
      setMarkingSourceForId(null);
    }
  }, [tab, selection, markingSourceForId]);

  const filteredStations = useMemo(() => {
    if (filters.type === "INT") return [];
    return stations.filter((s) => fmStationMatchesFilter(s, filters));
  }, [stations, filters]);

  // De-duplicate interference rows that share (siteCode, cellName,
  // sectorName, direction). The DB has older "High interference" rows
  // alongside newer "ตรวจแล้ว" rows for the same physical sector — without
  // this collapse, the map would render conflicting INSPECTED/PENDING pins.
  const dedupedInterference = useMemo(
    () => dedupeInterferenceSites(interference),
    [interference]
  );

  const filteredInterference = useMemo(() => {
    if (filters.type === "FM") return [];
    return dedupedInterference.filter((s) => {
      if (filters.province !== "All" && s.changwat !== filters.province) return false;
      if (filters.status === "PENDING" && s.status === "ตรวจแล้ว") return false;
      if (filters.status === "INSPECTED" && s.status !== "ตรวจแล้ว") return false;
      if (filters.severity !== "ALL" && s.ranking !== filters.severity) return false;
      if (filters.lawSent && !s.lawPaperSent) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${s.siteName ?? ""} ${s.siteCode ?? ""} ${s.cellName ?? ""} ${s.changwat ?? ""} ${s.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dedupedInterference, filters]);

  const visibleCount = filteredStations.length + filteredInterference.length;

  const selectedStation =
    selection?.kind === "fm" ? stations.find((s) => s.id === selection.id) ?? null : null;
  const selectedSite =
    selection?.kind === "int" ? interference.find((s) => s.id === selection.id) ?? null : null;

  const selectedTargetKey = selection ? `${selection.kind}-${selection.id}` : null;
  useEffect(() => {
    setHelperUserIds(defaultCrew ?? []);
  }, [selectedTargetKey, defaultCrew]);

  // Auto-dismiss the selection (and its details panel / bottom sheet) when
  // the current filter no longer includes the selected item — e.g. switching
  // TYPE from ALL to FM while an INT site is open.
  useEffect(() => {
    if (!selection) return;
    if (selection.kind === "fm") {
      if (!filteredStations.some((s) => s.id === selection.id)) {
        setSelection(null);
        setFlyTarget(null);
        if (markingSourceForId !== null) setMarkingSourceForId(null);
      }
    } else {
      if (!filteredInterference.some((s) => s.id === selection.id)) {
        setSelection(null);
        setFlyTarget(null);
        if (markingSourceForId !== null) setMarkingSourceForId(null);
      }
    }
  }, [selection, filteredStations, filteredInterference, markingSourceForId]);

  const coLocatedStations = useMemo(() => {
    if (!selectedStation) return [] as FMStation[];
    const { latitude: lat, longitude: lng } = selectedStation;
    const round = (n: number) => n.toFixed(5);
    const key = `${round(lat)},${round(lng)}`;
    return filteredStations.filter(
      (s) => `${round(s.latitude)},${round(s.longitude)}` === key
    );
  }, [filteredStations, selectedStation]);

  const coLocatedSites = useMemo(() => {
    if (!selectedSite || selectedSite.lat === null || selectedSite.long === null) {
      return [] as InterferenceSite[];
    }
    const round = (n: number) => n.toFixed(5);
    const key = `${round(selectedSite.lat)},${round(selectedSite.long)}`;
    return filteredInterference.filter(
      (s) =>
        s.lat !== null &&
        s.long !== null &&
        `${round(s.lat)},${round(s.long)}` === key
    );
  }, [filteredInterference, selectedSite]);

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

  async function persistCrew(ids: number[]) {
    setCrewSaving(true);
    setCrewSaveError(undefined);
    try {
      const res = await fetch('/api/users/me/crew', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultHelperUserIds: ids }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'crew_save_failed');
      }
      const j = (await res.json()) as { defaultHelperUserIds: number[] };
      setDefaultCrew(j.defaultHelperUserIds);
      setCrewModalOpen(false);
    } catch (err) {
      const code = err instanceof Error ? err.message : 'crew_save_failed';
      const friendly =
        code === 'invalid_helper'   ? 'That teammate is no longer active.' :
        code === 'self_in_list'     ? "You can't add yourself." :
        code === 'too_many'         ? 'You can pick up to 5 teammates.' :
        code === 'invalid_body'     ? "Something's wrong with the form." :
                                      "Couldn't save — try again.";
      setCrewSaveError(friendly);
    } finally {
      setCrewSaving(false);
    }
  }

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
          body: JSON.stringify({
            inspection69: next,
            ...(next === "ตรวจแล้ว" ? { helperUserIds } : {}),
          }),
        });
        if (!res.ok) throw new Error("FM update failed");
        if (next === "ตรวจแล้ว") setHelperUserIds([]);
      } else if (selection.kind === "int" && selectedSite) {
        const next = selectedSite.status === "ตรวจแล้ว" ? "ยังไม่ตรวจ" : "ตรวจแล้ว";
        setInterference((all) =>
          all.map((s) => (s.id === selectedSite.id ? { ...s, status: next } : s))
        );
        const res = await fetch(`/api/interference/${selectedSite.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: next,
            ...(next === "ตรวจแล้ว" ? { helperUserIds } : {}),
          }),
        });
        if (!res.ok) throw new Error("Interference update failed");
        if (next === "ตรวจแล้ว") setHelperUserIds(defaultCrew ?? []);
      }
    } catch (err) {
      console.error(err);
      window.location.reload();
    } finally {
      setPending(false);
    }
  };

  const handleToggleOnAir = async () => {
    if (!selection || selection.kind !== "fm" || !selectedStation) return;
    setPending(true);
    const prev = selectedStation.onAir;
    const next = !prev;
    try {
      setStations((all) =>
        all.map((s) => (s.id === selectedStation.id ? { ...s, onAir: next } : s))
      );
      const res = await fetch(`/api/stations/${selectedStation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onAir: next }),
      });
      if (!res.ok) {
        // Roll back optimistic update + surface server-side reason
        const json = await res.json().catch(() => ({}));
        setStations((all) =>
          all.map((s) => (s.id === selectedStation.id ? { ...s, onAir: prev } : s))
        );
        alert(json?.error ?? "On-air update failed");
        return;
      }
    } catch (err) {
      console.error(err);
      window.location.reload();
    } finally {
      setPending(false);
    }
  };

  const handleMarkSource = async (siteId: number, lat: number, lng: number) => {
    const target = interference.find((s) => s.id === siteId);
    if (!target) return;
    const prev = {
      sourceLat: target.sourceLat,
      sourceLong: target.sourceLong,
      estimateDistance: target.estimateDistance,
    };
    let distance: number | null = null;
    if (target.lat !== null && target.long !== null) {
      const km = haversineDistanceKm(target.lat, target.long, lat, lng);
      distance = Number.isFinite(km) ? km : null;
    }
    setInterference((all) =>
      all.map((s) =>
        s.id === siteId
          ? { ...s, sourceLat: lat, sourceLong: lng, estimateDistance: distance }
          : s
      )
    );
    setMarkingSourceForId(null);
    setPending(true);
    try {
      const res = await fetch(`/api/interference/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceLat: lat, sourceLong: lng, estimateDistance: distance }),
      });
      if (!res.ok) {
        setInterference((all) =>
          all.map((s) => (s.id === siteId ? { ...s, ...prev } : s))
        );
        const json = await res.json().catch(() => ({}));
        console.error("Mark source failed:", json?.error ?? res.statusText);
      }
    } catch (err) {
      console.error(err);
      setInterference((all) =>
        all.map((s) => (s.id === siteId ? { ...s, ...prev } : s))
      );
    } finally {
      setPending(false);
    }
  };

  const handleClearSource = async (siteId: number) => {
    const target = interference.find((s) => s.id === siteId);
    if (!target) return;
    const prev = {
      sourceLat: target.sourceLat,
      sourceLong: target.sourceLong,
      estimateDistance: target.estimateDistance,
    };
    setInterference((all) =>
      all.map((s) =>
        s.id === siteId
          ? { ...s, sourceLat: null, sourceLong: null, estimateDistance: null }
          : s
      )
    );
    setPending(true);
    try {
      const res = await fetch(`/api/interference/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceLat: null, sourceLong: null, estimateDistance: null }),
      });
      if (!res.ok) {
        setInterference((all) =>
          all.map((s) => (s.id === siteId ? { ...s, ...prev } : s))
        );
        const json = await res.json().catch(() => ({}));
        console.error("Clear source failed:", json?.error ?? res.statusText);
      }
    } catch (err) {
      console.error(err);
      setInterference((all) =>
        all.map((s) => (s.id === siteId ? { ...s, ...prev } : s))
      );
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
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <FieldOpsHeader
        stations={filteredStations}
        interference={filteredInterference}
        type={filters.type}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        isMobile={isMobile}
        onOpenDrawer={() => setDrawerOpen(true)}
        locationStatus={locationStatus}
        onRetryLocation={retryLocation}
        defaultCrew={defaultCrew}
        inspectors={inspectors}
        onOpenCrew={() => setCrewModalOpen(true)}
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

              {isMobile && (
                <MobileFilterBar
                  filters={filters}
                  onChange={setFilters}
                  provinces={initialProvinces}
                  resultCount={visibleCount}
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
                    markingSourceForId={markingSourceForId}
                    onMarkSource={handleMarkSource}
                    onCancelMarkSource={() => setMarkingSourceForId(null)}
                    userLocation={userLocation}
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
                    </div>

                    {selection?.kind === "fm" && selectedStation && (
                      <FieldOpsCurrentFM
                        station={selectedStation}
                        coLocated={coLocatedStations}
                        onSelectStation={(id) => handleSelect({ kind: "fm", id })}
                        onToggleInspection={handleToggleInspection}
                        onToggleOnAir={handleToggleOnAir}
                        pending={pending}
                        inspectors={inspectors}
                        currentUser={currentUser}
                        helperUserIds={helperUserIds}
                        onHelperUserIdsChange={setHelperUserIds}
                      />
                    )}
                    {selection?.kind === "int" && selectedSite && (
                      <FieldOpsCurrentINT
                        site={selectedSite}
                        coLocated={coLocatedSites}
                        onSelectSite={(id) => handleSelect({ kind: "int", id })}
                        onToggleInspection={handleToggleInspection}
                        onToggleLawPaper={handleToggleLawPaper}
                        pending={pending}
                        marking={markingSourceForId === selectedSite.id}
                        onStartMarkSource={() => setMarkingSourceForId(selectedSite.id)}
                        onCancelMarkSource={() => setMarkingSourceForId(null)}
                        onClearSource={() => handleClearSource(selectedSite.id)}
                        onSubmitSourceCoords={(lat, lng) => handleMarkSource(selectedSite.id, lat, lng)}
                        inspectors={inspectors}
                        currentUser={currentUser}
                        helperUserIds={helperUserIds}
                        onHelperUserIdsChange={setHelperUserIds}
                      />
                    )}
                    {!selection && (
                      <div style={{ padding: 20, flex: 1 }}>
                        <div className="fo-serif" style={{ fontSize: 18, color: "var(--fo-rail-text)", marginBottom: 6 }}>
                          Tap a marker
                        </div>
                        <div className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>
                          Map shows {filteredStations.length} FM · {filteredInterference.length} INT
                        </div>
                      </div>
                    )}
                  </aside>
                )}
              </div>

              {isMobile && (
                <FieldOpsBottomSheet
                  selection={selection}
                  station={selectedStation}
                  site={selectedSite}
                  coLocatedStations={coLocatedStations}
                  coLocatedSites={coLocatedSites}
                  onSelectStation={(id) => handleSelect({ kind: "fm", id })}
                  onSelectSite={(id) => handleSelect({ kind: "int", id })}
                  onToggleInspection={handleToggleInspection}
                  onToggleLawPaper={handleToggleLawPaper}
                  onToggleOnAir={handleToggleOnAir}
                  onClose={() => setSelection(null)}
                  pending={pending}
                  marking={selectedSite ? markingSourceForId === selectedSite.id : false}
                  onStartMarkSource={
                    selectedSite ? () => setMarkingSourceForId(selectedSite.id) : undefined
                  }
                  onCancelMarkSource={() => setMarkingSourceForId(null)}
                  onClearSource={
                    selectedSite ? () => handleClearSource(selectedSite.id) : undefined
                  }
                  onSubmitSourceCoords={
                    selectedSite
                      ? (lat, lng) => handleMarkSource(selectedSite.id, lat, lng)
                      : undefined
                  }
                  inspectors={inspectors}
                  currentUser={currentUser}
                  helperUserIds={helperUserIds}
                  onHelperUserIdsChange={setHelperUserIds}
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
        <FieldOpsDrawer
          open={drawerOpen}
          activeTab={tab}
          theme={theme}
          kpis={computeKpis(filteredStations, filteredInterference, filters.type)}
          onChangeTab={setTab}
          onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          onClose={() => setDrawerOpen(false)}
          defaultCrew={defaultCrew}
          inspectors={inspectors}
          onOpenCrew={() => {
            setDrawerOpen(false);
            setCrewModalOpen(true);
          }}
        />
      )}
      <CrewModal
        open={crewModalOpen}
        inspectors={inspectors}
        currentUserId={currentUser?.id ?? -1}
        initialSelected={defaultCrew ?? []}
        onSave={(ids) => persistCrew(ids)}
        onSolo={() => persistCrew([])}
        onClose={() => setCrewModalOpen(false)}
        error={crewSaveError}
        pending={crewSaving}
      />
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
