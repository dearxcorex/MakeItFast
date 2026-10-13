import type { CSSProperties } from "react";

export const APP_NAME = "nbtc!NMATEAM";

// The tile stays ink-on-green in both themes so it reads as one badge on the
// dark rail, the white light-theme header and the login card alike.
export function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: Math.round(size * 0.3),
        background: "linear-gradient(145deg, #1c2d38 0%, #001e2b 70%)",
        border: "1.5px solid #00ed64",
        boxShadow: "0 0 0 3px rgba(0, 237, 100, 0.14)",
        fontSize: Math.round(size * 0.56),
        lineHeight: 1,
      }}
    >
      📡
    </span>
  );
}

// Set in the mono face without `.fo-mono`, which would uppercase "nbtc".
export function BrandWordmark({
  fontSize = 18,
  style,
}: {
  fontSize?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: "var(--fo-mono)",
        fontSize,
        lineHeight: 1.1,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span style={{ fontWeight: 500, opacity: 0.72 }}>nbtc</span>
      <span style={{ fontWeight: 600, color: "var(--fo-accent-text)", margin: "0 0.06em" }}>!</span>
      <span style={{ fontWeight: 600, letterSpacing: "0.03em" }}>NMATEAM</span>
    </span>
  );
}

export function BrandMark({
  logoSize = 32,
  fontSize = 18,
  gap = 10,
  style,
}: {
  logoSize?: number;
  fontSize?: number;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap, minWidth: 0, ...style }}>
      <BrandLogo size={logoSize} />
      <BrandWordmark fontSize={fontSize} />
    </span>
  );
}
