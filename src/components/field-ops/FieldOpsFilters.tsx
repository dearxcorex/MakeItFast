"use client";

export type TypeFilter = "ALL" | "FM" | "INT";
export type StatusFilter = "ALL" | "PENDING" | "INSPECTED";
export type SeverityFilter = "ALL" | "Critical" | "Major" | "Minor";

export interface FieldFilters {
  type: TypeFilter;
  province: string;
  status: StatusFilter;
  /** Interference ranking — INT-only. Ignored when type=FM. */
  severity: SeverityFilter;
  /** FM "off air" toggle — FM-only. Ignored when type=INT. */
  offAir: boolean;
  /** INT "law paper sent" toggle — INT-only. Ignored when type=FM. */
  lawSent: boolean;
  search: string;
}

export const DEFAULT_FILTERS: FieldFilters = {
  type: "ALL",
  province: "All",
  status: "ALL",
  severity: "ALL",
  offAir: false,
  lawSent: false,
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
  const statuses: StatusFilter[] = ["ALL", "PENDING", "INSPECTED"];

  const showOffAir = filters.type !== "INT";
  const showLawSent = filters.type !== "FM";

  const handleTypeChange = (v: TypeFilter) => {
    const next: FieldFilters = { ...filters, type: v };
    // Cascade: drop filters that don't apply to the new type
    if (v === "FM") {
      next.severity = "ALL";
      next.lawSent = false;
    }
    if (v === "INT") {
      next.offAir = false;
    }
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
        style={selectStyle}
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
        options={statuses}
        value={filters.status}
        onChange={(v) => onChange({ ...filters, status: v })}
      />

      <Divider />

      {showOffAir && (
        <Toggle
          label="OFF AIR"
          active={filters.offAir}
          onChange={(v) => onChange({ ...filters, offAir: v })}
        />
      )}
      {showLawSent && (
        <Toggle
          label="LAW SENT"
          active={filters.lawSent}
          onChange={(v) => onChange({ ...filters, lawSent: v })}
        />
      )}

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

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid var(--fo-divider)",
  background: "var(--fo-band-inset)",
  color: "var(--fo-band-text)",
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  cursor: "pointer",
};

function Divider() {
  return <div style={{ width: 1, height: 22, background: "var(--fo-divider)" }} />;
}

function Toggle({
  label,
  active,
  onChange,
}: {
  label: string;
  active: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="fo-mono"
      onClick={() => onChange(!active)}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? "var(--fo-accent)" : "var(--fo-divider)"}`,
        background: active ? "var(--fo-accent)" : "transparent",
        color: active ? "#001e2b" : "var(--fo-band-text)",
        fontSize: 10,
        cursor: "pointer",
        letterSpacing: "0.16em",
      }}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
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
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
