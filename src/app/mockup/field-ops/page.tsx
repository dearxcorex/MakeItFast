"use client";

import { useState } from "react";
import { DesktopCommand } from "./DesktopCommand";
import { MobileD3 } from "./MobileD3";

type Viewport = "both" | "desktop" | "mobile";

export default function FieldOpsMockup() {
  const [viewport, setViewport] = useState<Viewport>("both");

  return (
    <div style={{ minHeight: "100vh", padding: "40px 32px 80px" }}>
      <Brief />
      <Toolbar viewport={viewport} onChange={setViewport} />

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center", marginTop: 32 }}>
        {(viewport === "desktop" || viewport === "both") && (
          <Frame label="DESKTOP · D · Command Center · 1280 × 800">
            <DesktopCommand />
          </Frame>
        )}
        {(viewport === "mobile" || viewport === "both") && (
          <Frame label="MOBILE · D3 · Stack + Flow · 390 × 780">
            <MobileD3 />
          </Frame>
        )}
      </div>

      <Footer />
    </div>
  );
}

function Brief() {
  return (
    <header style={{ maxWidth: 900, margin: "0 auto 28px" }}>
      <div className="fo-mono">MOCKUP · APR 2026</div>
      <h1
        className="fo-serif"
        style={{ fontSize: 44, lineHeight: 1.05, marginTop: 8, marginBottom: 14, fontWeight: 500 }}
      >
        A unified field ops surface for{" "}
        <span className="fo-underline-accent">FM stations & interference sites</span>.
      </h1>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "#001e2b", maxWidth: 720 }}>
        This mockup merges the current <b>Stations</b> and <b>Interference</b> tabs into one
        task-oriented Field Ops surface. Inspectors see a single queue of tasks (FM + INT),
        filter by province, tap to navigate in Google Maps, and check off on-site steps.
        Intermod calculator and Analytics stay separate. Desktop layout is Command Center (D);
        mobile is the D3 Stack with a 5-step flow: Queue → Detail → Navigating → On-Site → Done.
      </p>
      <div
        className="fo-sketch"
        style={{
          marginTop: 16,
          padding: "10px 14px",
          background: "#fff6c8",
          border: "1px dashed #001e2b",
          borderRadius: 6,
          fontSize: 13,
          maxWidth: 720,
          transform: "rotate(-0.2deg)",
          lineHeight: 1.35,
        }}
      >
        mockup only — no backend integration, placeholder map, hardcoded tasks.
        real build wires MapLibre, Prisma queries, and the inspection API.
      </div>
    </header>
  );
}

function Toolbar({ viewport, onChange }: { viewport: Viewport; onChange: (v: Viewport) => void }) {
  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: "14px 18px",
        background: "#ffffff",
        border: "1px solid #b8c4c2",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span className="fo-mono">VIEWPORT</span>
      {(["both", "desktop", "mobile"] as Viewport[]).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className="fo-mono"
          style={{
            padding: "8px 14px",
            fontSize: 11,
            background: viewport === v ? "#001e2b" : "transparent",
            color: viewport === v ? "#00ed64" : "#5c6c75",
            border: `1px solid ${viewport === v ? "#001e2b" : "#b8c4c2"}`,
            borderRadius: 999,
            cursor: "pointer",
          }}
        >
          {v.toUpperCase()}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <span className="fo-mono" style={{ color: "#00684a" }}>● MOCKUP · NOT WIRED</span>
    </div>
  );
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div className="fo-mono" style={{ marginBottom: 10 }}>{label}</div>
      {children}
    </section>
  );
}

function Footer() {
  return (
    <footer
      style={{
        maxWidth: 900,
        margin: "48px auto 0",
        padding: "20px 24px",
        background: "#001e2b",
        color: "#b8c4c2",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div className="fo-mono" style={{ color: "#00ed64" }}>REVIEW CHECKLIST</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
        <li>Does merging FM + Interference into one &quot;Field Ops&quot; surface feel right?</li>
        <li>Is the 5-step on-site flow (tap ✓ on each step) the right level of detail?</li>
        <li>Should the navigate CTA open Google Maps only, or also support in-app route preview?</li>
        <li>Forest-black + neon green: keep, soften, or pivot to an NBTC-aligned palette?</li>
        <li>Desktop Command Center density — too much, just right, or too sparse?</li>
      </ul>
    </footer>
  );
}
