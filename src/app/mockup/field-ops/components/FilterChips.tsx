"use client";

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {label && <span className="fo-mono" style={{ marginRight: 4 }}>{label}</span>}
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="fo-mono"
            style={{
              padding: "6px 12px",
              fontSize: 11,
              letterSpacing: "0.16em",
              background: active ? "#001e2b" : "transparent",
              color: active ? "#00ed64" : "#5c6c75",
              border: `1px solid ${active ? "#001e2b" : "#b8c4c2"}`,
              borderRadius: 999,
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
