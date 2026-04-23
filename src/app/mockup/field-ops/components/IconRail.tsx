const ITEMS = [
  { id: "ops", label: "Ops", glyph: "◎", active: true },
  { id: "map", label: "Map", glyph: "◉" },
  { id: "queue", label: "Queue", glyph: "≡" },
  { id: "crew", label: "Crew", glyph: "◇" },
  { id: "stats", label: "Stats", glyph: "◧" },
  { id: "alerts", label: "Alerts", glyph: "△" },
];

export function IconRail() {
  return (
    <nav
      style={{
        width: 64,
        background: "#001e2b",
        borderRight: "1px solid #3d4f58",
        padding: "16px 0",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: "center",
      }}
    >
      <div
        className="fo-serif"
        style={{ color: "#00ed64", fontSize: 26, marginBottom: 20, letterSpacing: "-0.02em" }}
      >
        ✦
      </div>
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: item.active ? "#00684a" : "transparent",
            color: item.active ? "#00ed64" : "#b8c4c2",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {item.glyph}
        </button>
      ))}
    </nav>
  );
}
