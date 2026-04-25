"use client";

export type FieldOpsTab = "field-ops" | "intermod" | "analytics";

const ITEMS: Array<{ id: FieldOpsTab; label: string; icon: string }> = [
  { id: "field-ops", label: "FIELD OPS", icon: "◉" },
  { id: "intermod", label: "INTERMOD", icon: "Σ" },
  { id: "analytics", label: "ANALYTICS", icon: "▦" },
];

export function FieldOpsNav({
  active,
  onChange,
}: {
  active: FieldOpsTab;
  onChange: (id: FieldOpsTab) => void;
}) {
  return (
    <nav
      style={{
        width: 72,
        background: "#001216",
        borderRight: "1px solid var(--fo-ink-3)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 0",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <div
        className="fo-mono"
        style={{
          color: "var(--fo-accent)",
          padding: "6px 0",
          marginBottom: 12,
          fontSize: 9,
          letterSpacing: "0.2em",
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
        }}
      >
        FIELD OPS
      </div>
      {ITEMS.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            style={{
              width: 56,
              height: 56,
              border: "none",
              borderRadius: 12,
              background: isActive ? "var(--fo-accent)" : "transparent",
              color: isActive ? "var(--fo-ink)" : "var(--fo-line)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              fontSize: 18,
              transition: "background 120ms ease",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = "var(--fo-ink-2)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <span aria-hidden style={{ fontSize: 18 }}>{item.icon}</span>
            <span
              className="fo-mono"
              style={{
                fontSize: 7,
                letterSpacing: "0.12em",
                color: isActive ? "var(--fo-ink)" : "var(--fo-mute)",
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
