export default function Loading() {
  return (
    <div
      className="field-ops-root"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--fo-canvas)",
        color: "var(--fo-accent)",
      }}
    >
      <div
        role="status"
        aria-label="กำลังโหลด"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontFamily: "var(--fo-mono, ui-monospace)",
          letterSpacing: "0.18em",
          fontSize: 12,
        }}
      >
        <span aria-hidden className="fo-spinner" />
        กำลังโหลด…
      </div>
    </div>
  );
}
