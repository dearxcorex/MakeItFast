"use client";

import { useMemo, useState } from "react";
import { FilterChips } from "./components/FilterChips";
import { MobileMap } from "./components/MobileMap";
import { BottomSheet } from "./components/BottomSheet";
import { SAMPLE_TASKS, PROVINCES } from "./sample-tasks";
import type { FieldTask, FieldTaskStatus } from "./types";

type TypeFilter = "ALL" | "FM" | "INT";

export function MobileD3() {
  const [province, setProvince] = useState<(typeof PROVINCES)[number]>("All");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [tasks, setTasks] = useState<FieldTask[]>(SAMPLE_TASKS);
  const [selectedId, setSelectedId] = useState<string>(SAMPLE_TASKS[0].id);
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (province !== "All" && t.province !== province) return false;
        if (typeFilter === "FM" && t.type !== "fm") return false;
        if (typeFilter === "INT" && t.type !== "interference") return false;
        return true;
      }),
    [tasks, province, typeFilter]
  );

  const selected =
    filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? tasks[0];

  const toggleInspected = (id: string) => {
    setTasks((all) =>
      all.map((t) => {
        if (t.id !== id) return t;
        const next: FieldTaskStatus = t.status === "inspected" ? "pending" : "inspected";
        return { ...t, status: next };
      })
    );
  };

  const toggleLawPaper = (id: string) => {
    setTasks((all) =>
      all.map((t) => {
        if (t.id !== id) return t;
        const next: FieldTaskStatus = t.status === "law_sent" ? "pending" : "law_sent";
        return { ...t, status: next };
      })
    );
  };

  return (
    <div
      style={{
        width: 390,
        height: 780,
        background: "#ffffff",
        border: "1px solid #b8c4c2",
        borderRadius: 32,
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 20px 60px rgba(0,30,43,0.18)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Status bar */}
      <div
        style={{
          padding: "10px 20px 6px",
          background: "#001e2b",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span className="fo-mono" style={{ color: "#00ed64" }}>● ONLINE</span>
        <span className="fo-mono">{filtered.length} tasks</span>
        <span className="fo-mono">14:08</span>
      </div>

      {/* Filter chips */}
      <div
        style={{
          padding: "10px 12px",
          background: "#f5f3ef",
          borderBottom: "1px solid #b8c4c2",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <FilterChips options={PROVINCES} value={province} onChange={setProvince} />
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <FilterChips
            options={["ALL", "FM", "INT"] as const}
            value={typeFilter}
            onChange={setTypeFilter}
          />
          <div style={{ flex: 1 }} />
          <button
            type="button"
            aria-label="Search"
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: "1px solid #b8c4c2",
              background: "#ffffff",
              cursor: "pointer",
              fontSize: 15,
            }}
          >
            🔍
          </button>
        </div>
      </div>

      {/* Map fills remaining space */}
      <MobileMap
        tasks={filtered}
        selectedId={selected?.id ?? ""}
        onSelect={(id) => {
          setSelectedId(id);
          setExpanded(false);
        }}
      />

      {/* Bottom sheet */}
      {selected ? (
        <BottomSheet
          task={selected}
          onToggleInspected={toggleInspected}
          onToggleLawPaper={toggleLawPaper}
          expanded={expanded}
          onExpandChange={setExpanded}
        />
      ) : (
        <div
          style={{
            padding: "20px 16px",
            borderTop: "1px solid #b8c4c2",
            background: "#ffffff",
            textAlign: "center",
          }}
        >
          <span className="fo-mono" style={{ color: "#5c6c75" }}>NO TASKS IN VIEW</span>
        </div>
      )}
    </div>
  );
}
