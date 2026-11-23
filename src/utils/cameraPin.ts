import { PIN_COLORS, PIN_INK, PIN_SELECTION, PIN_STROKE } from "./pinTokens";

const PIN_PATH = "M12 32 C 12 32 22 22 22 11 A 10 10 0 1 0 2 11 C 2 22 12 32 12 32 Z";

const cameraGlyph = (body: string) =>
  `<path d="M7 7.8h2l1-1.6h4l1 1.6h2a1.2 1.2 0 0 1 1.2 1.2v5.8a1.2 1.2 0 0 1-1.2 1.2H7a1.2 1.2 0 0 1-1.2-1.2V9A1.2 1.2 0 0 1 7 7.8Z" fill="${PIN_STROKE}"/>` +
  `<circle cx="12" cy="11.8" r="2.5" fill="${body}"/>`;

/** The bell means exactly one thing: this camera still needs action. */
const BELL_BADGE = `<g class="fo-camera-bell" transform="translate(15, -4)">
  <circle cx="6.5" cy="6.5" r="6.5" fill="${PIN_INK}" stroke="${PIN_STROKE}" stroke-width="1.2"/>
  <path d="M6.5 2.6a2.8 2.8 0 0 0-2.8 2.8v2L2.7 8.9h7.6l-1-1.5v-2a2.8 2.8 0 0 0-2.8-2.8Z" fill="${PIN_STROKE}"/>
  <circle cx="6.5" cy="10.1" r="1" fill="${PIN_STROKE}"/>
</g>`;

/**
 * Camera pin: red with a bell while it needs action, inspected green without
 * one. It carries no `fo-bucket--` class because cameras never join a cluster.
 */
export function cameraPin(inspected: boolean, selected: boolean) {
  const body = inspected ? PIN_COLORS.inspected : PIN_COLORS.critical;
  const baseSize = selected ? 30 : 24;
  const width = baseSize + 14;
  const height = Math.round(baseSize * 1.35) + 6;
  const halo = selected
    ? `<circle cx="12" cy="11" r="13" fill="none" stroke="${PIN_SELECTION}" stroke-width="2" opacity="0.55"/>`
    : "";
  const html = `<div style="position:relative;width:${width}px;height:${height}px;">
    <svg width="${width}" height="${height}" viewBox="-7 -4 38 39" style="position:absolute;left:0;top:0;overflow:visible;">
      ${halo}
      <path d="${PIN_PATH}" fill="${body}" stroke="${PIN_STROKE}" stroke-width="1.8" stroke-linejoin="round" filter="drop-shadow(0 1px 2px rgba(0,30,43,0.4))"/>
      ${cameraGlyph(body)}
      ${inspected ? "" : BELL_BADGE}
    </svg>
  </div>`;
  return {
    html,
    className: `fo-marker fo-marker--camera ${inspected ? "is-inspected" : "is-alert"} ${selected ? "is-selected" : ""}`,
    width,
    height,
  };
}
