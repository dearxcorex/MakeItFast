"use client";

export type TypeFilter = "ALL" | "FM" | "INT";
export type StatusFilter =
  | "ALL"
  | "PENDING"
  | "INSPECTED"
  | "LAW_SENT"
  | "OFF_AIR";

export interface FieldFilters {
  type: TypeFilter;
  province: string;
  status: StatusFilter;
  search: string;
}

export const DEFAULT_FILTERS: FieldFilters = {
  type: "ALL",
  province: "All",
  status: "ALL",
  search: "",
};

export function FieldOpsFilters({
  filters,
  onChange,
  provinces,
  visibleCount,
}: {
  filters: FieldFilters;
  onChange: (next: FieldFilters) => void;
  provinces: string[];
  visibleCount: number;
}) {
  const provinceOptions = ["All", ...provinces];
  const types: TypeFilter[] = ["ALL", "FM", "INT"];
  // FM has no "law paper sent"; INT has no "on air" — chip set depends on type
  const statuses: Array<{ id: StatusFilter; label: string }> = (() => {
    const base: Array<{ id: StatusFilter; label: string }> = [
      { id: "ALL", label: "ALL" },
      { id: "PENDING", label: "PENDING" },
      { id: "INSPECTED", label: "INSPECTED" },
    ];
    if (filters.type !== "INT") base.push({ id: "OFF_AIR", label: "OFF AIR" });
    if (filters.type !== "FM") base.push({ id: "LAW_SENT", label: "LAW SENT" });
    return base;
  })();

  const handleTypeChange = (v: TypeFilter) => {
    const next: FieldFilters = { ...filters, type: v };
    // Cascade: drop the status if it's not valid for the new type
    if (v === "FM" && next.status === "LAW_SENT") next.status = "ALL";
    if (v === "INT" && next.status === "OFF_AIR") next.status = "ALL";
    onChange(next);
  };

  return (
    <div
      style={{
        background: "var(--fo-band)",
        borderBottom: "1px solid var(--fo-divider)",
        padding: "12px 20px",
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
      }}
    >
      <ChipGroup
        label="TYPE"
        options={types}
        value={filters.type}
        onChange={handleTypeChange}
      />

      <Divider />

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
        {provinceOptions.map((p) => (
          <option key={p} value={p}>
            {p === "All" ? "ALL PROVINCES" : p}
          </option>
        ))}
      </select>

      <Divider />

      <ChipGroup
        label="STATUS"
        options={statuses.map((s) => s.id)}
        labels={statuses.reduce<Record<string, string>>((acc, s) => {
          acc[s.id] = s.label;
          return acc;
        }, {})}
        value={filters.status}
        onChange={(v) => onChange({ ...filters, status: v as StatusFilter })}
      />

      <div style={{ flex: 1 }} />

      <input
        type="search"
        placeholder="Search id, name, frequency…"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        style={{
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px solid var(--fo-divider)",
          background: "var(--fo-band-inset)",
          color: "var(--fo-band-text)",
          fontSize: 12,
          minWidth: 220,
        }}
      />
      <span className="fo-mono" style={{ color: "var(--fo-band-mute)" }}>
        {visibleCount} VISIBLE
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 22, background: "var(--fo-divider)" }} />;
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  labels,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="fo-mono" style={{ color: "var(--fo-band-mute)" }}>{label}</span>
      <div
        style={{
          display: "inline-flex",
          padding: 3,
          background: "var(--fo-band-inset)",
          borderRadius: 999,
          border: "1px solid var(--fo-divider)",
          gap: 2,
        }}
      >
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              className="fo-mono"
              onClick={() => onChange(opt)}
              style={{
                padding: "4px 12px",
                background: active ? "var(--fo-accent)" : "transparent",
                color: active ? "#001e2b" : "var(--fo-band-text)",
                border: "none",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 10,
              }}
            >
              {labels?.[opt] ?? opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
