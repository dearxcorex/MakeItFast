"use client";

import { useEffect, useState } from "react";
import type { AnalyticsSummary } from "@/types/analytics";
import InspectorsSection from "./InspectorsSection";

const RANGES = ["7D", "30D", "90D", "YTD"] as const;
type Range = (typeof RANGES)[number];

export default function AnalyticsDashboard({
  currentUser,
}: {
  currentUser?: { id: number; displayName: string };
} = {}) {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [range, setRange] = useState<Range>("30D");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/summary");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AnalyticsSummary;
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExport = () => {
    if (!data) return;
    const win = window.open("", "_blank");
    if (!win) {
      alert("Please allow popups to export the report.");
      return;
    }
    const inspectionRate = data.heroStats.totalStations
      ? Math.round(
          (data.heroStats.inspectedStations / data.heroStats.totalStations) * 100
        )
      : 0;
    const html = `<!DOCTYPE html>
<html><head><title>FM Station Analytics · NBTC Thailand</title>
<style>
  body { font-family: 'Inter', sans-serif; padding: 32px; max-width: 920px; margin: 0 auto; color: #001e2b; }
  h1 { font-family: 'Playfair Display', Georgia, serif; color: #001e2b; border-bottom: 3px solid #00ed64; padding-bottom: 10px; font-weight: 400; }
  h2 { font-family: 'Source Code Pro', monospace; color: #00684a; text-transform: uppercase; letter-spacing: 0.16em; font-size: 12px; margin-top: 32px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 18px 0; }
  .kpi { padding: 14px; border: 1px solid #e2dfd8; border-radius: 12px; }
  .kpi .l { font-family: 'Source Code Pro', monospace; font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: #5c6c75; }
  .kpi .v { font-family: 'Playfair Display', serif; font-size: 32px; margin-top: 6px; }
  .kpi .s { font-size: 12px; color: #5c6c75; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2dfd8; font-size: 13px; }
  th { font-family: 'Source Code Pro', monospace; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #5c6c75; }
  .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2dfd8; color: #5c6c75; font-size: 11px; }
  @media print { body { padding: 0; } }
</style></head><body>
  <h1>How the field is performing.</h1>
  <p style="color:#5c6c75;font-size:12px;">Generated ${new Date().toLocaleString()} · Range ${range}</p>

  <h2>Headline KPIs</h2>
  <div class="grid">
    <div class="kpi"><div class="l">FM Stations</div><div class="v">${data.heroStats.totalStations}</div><div class="s">${data.heroStats.inspectedStations} inspected</div></div>
    <div class="kpi"><div class="l">Inspection Rate</div><div class="v">${inspectionRate}%</div><div class="s">target 100%</div></div>
    <div class="kpi"><div class="l">Interference Sites</div><div class="v">${data.heroStats.totalInterferenceSites}</div><div class="s">${data.heroStats.pendingInterference} pending</div></div>
    <div class="kpi"><div class="l">Critical Alerts</div><div class="v" style="color:#e34b4b;">${data.heroStats.criticalInterference}</div><div class="s">requires action</div></div>
  </div>

  <h2>FM Stations · Top Provinces</h2>
  <table>
    <tr><th>Province</th><th>Total</th><th>Inspected (Y69)</th></tr>
    ${data.fmStationsByProvince
      .slice(0, 12)
      .map(
        (p) =>
          `<tr><td>${p.name}</td><td>${p.total}</td><td>${p.inspected69}</td></tr>`
      )
      .join("")}
  </table>

  <h2>Interference · Severity Distribution</h2>
  <table>
    <tr><th>Ranking</th><th>Count</th></tr>
    ${data.rankingDistribution
      .map((r) => `<tr><td>${r.ranking}</td><td>${r.count}</td></tr>`)
      .join("")}
  </table>

  <div class="footer">FM Station &amp; Interference Analytics · NBTC Thailand · field-ops dashboard</div>
</body></html>`;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  if (loading && !data) {
    return (
      <div
        className="fo-light"
        style={{
          flex: 1,
          minHeight: 480,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              width: 36,
              height: 36,
              border: "3px solid var(--fo-accent-2)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <div className="fo-mono" style={{ marginTop: 14 }}>
            LOADING ANALYTICS…
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="fo-light"
        style={{
          flex: 1,
          minHeight: 480,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div className="fo-card" style={{ padding: 24, maxWidth: 420, textAlign: "center" }}>
          <div className="fo-serif" style={{ fontSize: 22, marginBottom: 6 }}>
            Unable to load analytics
          </div>
          <div className="fo-mono" style={{ marginBottom: 12 }}>
            {error ?? "NO DATA"}
          </div>
          <button onClick={fetchData} className="fo-btn fo-btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fo-light" style={{ minHeight: "100%", display: "flex" }}>
      {/* Sidebar — desktop only */}
      <aside
        className="hidden md:flex"
        style={{
          width: 200,
          flexShrink: 0,
          borderRight: "1px solid var(--fo-line)",
          padding: "20px 16px",
          flexDirection: "column",
          gap: 6,
          background: "var(--fo-surface)",
        }}
      >
        <div className="fo-mono" style={{ marginBottom: 4 }}>
          ANALYZE
        </div>
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            background: "rgba(0,104,74,0.08)",
            border: "1px solid var(--fo-accent-2)",
            color: "var(--fo-accent-2)",
          }}
        >
          Overview
        </div>

        <div style={{ flex: 1 }} />
        {lastUpdated && (
          <div className="fo-mono" style={{ fontSize: 9 }}>
            UPDATED {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </aside>

      {/* Main */}
      <div
        style={{
          flex: 1,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minWidth: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <div className="fo-mono" style={{ color: "var(--fo-accent-2)" }}>
              ANALYTICS · OVERVIEW · NBTC THAILAND
            </div>
            <div
              className="fo-serif"
              style={{ fontSize: 42, marginTop: 6, lineHeight: 1.1 }}
            >
              How the field is{" "}
              <span className="fo-underline-accent">performing</span>.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`fo-pill ${range === r ? "is-active" : ""}`}
              >
                {r}
              </button>
            ))}
            <button
              type="button"
              onClick={handleExport}
              className="fo-pill is-solid"
            >
              EXPORT
            </button>
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="fo-pill"
              aria-label="refresh"
            >
              {loading ? "…" : "↻"}
            </button>
          </div>
        </div>

        <InspectorsSection currentUserId={currentUser?.id ?? null} />
      </div>
    </div>
  );
}

