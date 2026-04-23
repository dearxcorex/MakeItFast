import type { FieldTaskType } from "../types";

export function TypeBadge({ type, size = "sm" }: { type: FieldTaskType; size?: "sm" | "md" }) {
  const isFM = type === "fm";
  const label = isFM ? "FM" : "INT";
  const pad = size === "md" ? "4px 10px" : "2px 8px";
  const fontSize = size === "md" ? 11 : 10;

  return (
    <span
      className="fo-mono"
      style={{
        padding: pad,
        fontSize,
        letterSpacing: "0.18em",
        background: isFM ? "#001e2b" : "#00684a",
        color: isFM ? "#00ed64" : "#ffffff",
        borderRadius: 999,
        border: "1px solid #001e2b",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}
