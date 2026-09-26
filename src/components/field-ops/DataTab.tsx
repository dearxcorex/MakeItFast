"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminStation } from "@/types/station";
import { TARGET_PROVINCES } from "@/utils/offairAudit";
import {
  filterAdminStations,
  sortAdminStations,
  type AdminSortKey,
  type SortDir,
} from "@/utils/adminStationTable";
import { StationForm } from "./StationForm";

const COLUMNS: Array<{ key: AdminSortKey; label: string; align?: "right" }> = [
  { key: "idFm", label: "ID" },
  { key: "name", label: "ชื่อสถานี" },
  { key: "freq", label: "MHz", align: "right" },
  { key: "district", label: "อำเภอ" },
  { key: "province", label: "จังหวัด" },
  { key: "type", label: "ประเภท" },
  { key: "inspectionCount", label: "ตรวจ", align: "right" },
];

/** "new" opens an empty form; a number edits that station; null closes the panel. */
type Panel = "new" | number | null;

/**
 * Admin-only table over fm_station with add / edit / delete. Reads through
 * /api/admin/stations rather than the map's props because it needs columns the
 * map never loads (submit_a_request, register_station_id, inspection counts).
 * After a write it refetches its own list and calls `onChanged` so the map
 * picks the change up too.
 */
export function DataTab({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<AdminStation[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [province, setProvince] = useState("All");
  const [sortKey, setSortKey] = useState<AdminSortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [panel, setPanel] = useState<Panel>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch("/api/admin/stations");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { stations: AdminStation[] };
      setRows(json.stations);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => sortAdminStations(filterAdminStations(rows ?? [], { search, province }), sortKey, sortDir),
    [rows, search, province, sortKey, sortDir]
  );

  const editing = typeof panel === "number" ? rows?.find((r) => r.id === panel) ?? null : null;

  const onSort = (key: AdminSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const onSaved = () => {
    setPanel(null);
    void load();
    onChanged();
  };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--fo-canvas)", color: "var(--fo-text)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          style={{
            background: "var(--fo-band)",
            borderBottom: "1px solid var(--fo-divider)",
            padding: "12px 20px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            color: "var(--fo-band-text)",
          }}
        >
          <span className="fo-mono" style={{ letterSpacing: "0.12em" }}>FM STATIONS</span>
          <select
            aria-label="Province filter"
            className="fo-mono"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            style={pill}
          >
            <option value="All">ALL PROVINCES</option>
            {TARGET_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div style={{ flex: 1 }} />
          <input
            type="search"
            placeholder="ค้นหา ID, ชื่อ, ความถี่, อำเภอ…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...pill, minWidth: 240 }}
          />
          <span className="fo-mono" style={{ color: "var(--fo-band-mute)" }}>
            {visible.length} / {rows?.length ?? 0}
          </span>
          <button
            type="button"
            onClick={() => setPanel("new")}
            style={{
              ...pill,
              background: "var(--fo-accent)",
              color: "#001e2b",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + เพิ่มสถานี
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {error && (
            <div style={{ padding: 20 }}>
              โหลดข้อมูลไม่สำเร็จ{" "}
              <button type="button" onClick={() => void load()} style={{ ...pill, cursor: "pointer" }}>
                ลองใหม่
              </button>
            </div>
          )}
          {!error && rows === null && (
            <div className="fo-mono" style={{ padding: 20, color: "var(--fo-mute)" }}>LOADING…</div>
          )}
          {rows !== null && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      onClick={() => onSort(c.key)}
                      aria-sort={sortKey === c.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                      style={{
                        ...cell,
                        textAlign: c.align ?? "left",
                        position: "sticky",
                        top: 0,
                        background: "var(--fo-band)",
                        cursor: "pointer",
                        userSelect: "none",
                        fontWeight: 600,
                      }}
                    >
                      {c.label}
                      {sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                  <th style={{ ...cell, position: "sticky", top: 0, background: "var(--fo-band)" }}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const selected = panel === r.id;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setPanel(r.id)}
                      style={{
                        cursor: "pointer",
                        background: selected ? "var(--fo-band)" : undefined,
                        opacity: r.revoked ? 0.6 : 1,
                      }}
                    >
                      <td className="fo-mono" style={{ ...cell, fontSize: 11 }}>{r.idFm ?? "—"}</td>
                      <td style={cell}>{r.name}</td>
                      <td className="fo-mono" style={{ ...cell, textAlign: "right" }}>{r.freq ?? "—"}</td>
                      <td style={cell}>{r.district}</td>
                      <td style={cell}>{r.province}</td>
                      <td style={cell}>{r.type}</td>
                      <td className="fo-mono" style={{ ...cell, textAlign: "right" }}>{r.inspectionCount}</td>
                      <td style={cell}>
                        {r.revoked ? (
                          <span style={{ color: "var(--fo-crit)" }}>เพิกถอน</span>
                        ) : r.onAir ? (
                          "on air"
                        ) : (
                          <span style={{ color: "var(--fo-mute)" }}>off air</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {panel !== null && (panel === "new" || editing) && (
        <aside
          style={{
            width: 400,
            flexShrink: 0,
            overflow: "auto",
            background: "var(--fo-band)",
            color: "var(--fo-band-text)",
            borderLeft: "1px solid var(--fo-divider)",
          }}
        >
          <StationForm
            key={panel}
            station={panel === "new" ? null : editing}
            onSaved={onSaved}
            onClose={() => setPanel(null)}
          />
        </aside>
      )}
    </div>
  );
}

const pill: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid var(--fo-divider)",
  background: "var(--fo-band-inset)",
  color: "var(--fo-band-text)",
  fontSize: 12,
};

const cell: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--fo-divider)",
  whiteSpace: "nowrap",
};
