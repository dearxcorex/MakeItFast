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
  /** FM "off air" toggle — FM-only. Excludes revoked rows so REVOKED stays disjoint. */
  offAir: boolean;
  /** FM "revoked" toggle — FM-only. License revoked by NBTC; illegal if on-air. */
  revoked: boolean;
  /** INT "law paper sent" toggle — INT-only. Ignored when type=FM. */
  lawSent: boolean;
  search: string;
}

export const TYPE_LABEL: Record<TypeFilter, string> = {
  ALL: "ทั้งหมด",
  FM: "FM",
  INT: "รบกวน",
};

export const STATUS_LABEL: Record<StatusFilter, string> = {
  ALL: "ทั้งหมด",
  PENDING: "ยังไม่ตรวจ",
  INSPECTED: "ตรวจแล้ว",
};

export const DEFAULT_FILTERS: FieldFilters = {
  type: "ALL",
  province: "All",
  status: "ALL",
  severity: "ALL",
  offAir: false,
  revoked: false,
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
    if (v === "FM") {
      next.severity = "ALL";
      next.lawSent = false;
    }
    if (v === "INT") {
      next.offAir = false;
      next.revoked = false;
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
        label="ประเภท"
        labels={TYPE_LABEL}
        options={types}
        value={filters.type}
        onChange={handleTypeChange}
      />

      <Divider />

      <select
        aria-label="กรองจังหวัด"
        className="fo-mono"
        value={filters.province}
        onChange={(e) => onChange({ ...filters, province: e.target.value })}
        style={selectStyle}
      >
        {provinceOptions.map((p) => (
          <option key={p} value={p}>
            {p === "All" ? "ทุกจังหวัด" : p}
          </option>
        ))}
      </select>

      <Divider />

      <ChipGroup
        label="สถานะ"
        labels={STATUS_LABEL}
        options={statuses}
        value={filters.status}
        onChange={(v) => onChange({ ...filters, status: v })}
      />

      <Divider />

      {showOffAir && (
        <Toggle
          label="ไม่ออกอากาศ"
          active={filters.offAir}
          onChange={(v) => onChange({ ...filters, offAir: v })}
        />
      )}
      {showOffAir && (
        <Toggle
          label="เพิกถอน"
          active={filters.revoked}
          onChange={(v) => onChange({ ...filters, revoked: v })}
          activeColor="var(--fo-crit)"
        />
      )}
      {showLawSent && (
        <Toggle
          label="ส่งหนังสือแล้ว"
          active={filters.lawSent}
          onChange={(v) => onChange({ ...filters, lawSent: v })}
        />
      )}

      <div style={{ flex: 1 }} />

      <input
        type="search"
        placeholder="ค้นหา ID, ชื่อ, ความถี่…"
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
        แสดง {visibleCount} รายการ
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
  activeColor = "var(--fo-accent)",
}: {
  label: string;
  active: boolean;
  onChange: (v: boolean) => void;
  activeColor?: string;
}) {
  return (
    <button
      type="button"
      className="fo-mono"
      onClick={() => onChange(!active)}
      style={{
        padding: "5px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? activeColor : "var(--fo-divider)"}`,
        background: active ? activeColor : "transparent",
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
  labels,
  options,
  value,
  onChange,
}: {
  label: string;
  labels: Record<T, string>;
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
              {labels[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
