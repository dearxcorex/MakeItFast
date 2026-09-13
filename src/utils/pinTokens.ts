import type { PinBucket } from "./pinBucket";

/**
 * Single source of truth for map pin, cluster-ring and legend colours.
 *
 * Before this existed the same state had different hexes depending on where it
 * was drawn — an FM "pending" pin was #f5a623 while the cluster arc summarising
 * that same pin was #ffb800, and revoked was #e34b4b on the pin but #ff5b4a in
 * the ring. The values kept here are the brighter set, which is what the dark
 * theme's --fo-crit / --fo-warn already used and what the cluster ring already
 * drew; the FM pin was the odd one out.
 *
 * Deliberately theme-independent. Pins live in .leaflet-marker-pane, which is
 * NOT touched by the dark-mode filter on .leaflet-tile-pane (see field-ops.css),
 * so one pin renders identically over the light OSM basemap and the inverted
 * dark one. Keeping a single set also means fmIcon/intIcon need no `theme`
 * prop — the prop was removed when the basemap moved to a CSS filter.
 */
export const PIN_COLORS: Record<PinBucket, string> = {
  critical: "#ff5b4a",
  pending: "#ffb800",
  offair: "#5c6c75",
  inspected: "#00684a",
};

/**
 * Severity order: most urgent first. Cluster ring arcs are emitted in this
 * order so red sits at 12 o'clock, and the legend lists swatches the same way.
 */
export const PIN_BUCKET_ORDER: PinBucket[] = [
  "critical",
  "pending",
  "offair",
  "inspected",
];

/**
 * Inner glyph per bucket, so colour is never the only channel carrying state
 * (red and amber are the classic red-green-blind confusion pair).
 *
 * Drawn in the pin's 24x32 viewBox with the head centred on (12, 11); the
 * legend reuses these strings inside the same viewBox so a swatch is pixel-wise
 * the pin it stands for.
 */
export const PIN_GLYPHS: Record<PinBucket, string> = {
  critical: `<path d="M12 7 L12 14 M12 16.5 L12 17.5" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>`,
  pending: `<circle cx="12" cy="11.5" r="4" fill="none" stroke="#ffffff" stroke-width="2"/>`,
  offair: `<path d="M9 9 l6 6 M15 9 l-6 6" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>`,
  inspected: `<path d="M8.5 12.5 l2.5 2.5 l5 -5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
};

/** Dark ink used for pin outlines-on-badges, cluster discs and badge glyphs. */
export const PIN_INK = "#001e2b";

/** White keyline that lifts a pin off the basemap in both themes. */
export const PIN_STROKE = "#ffffff";

/**
 * Selection halo. One colour for FM and INT: selection is a UI state, not a
 * data state, so it must not borrow a bucket colour (INT used to halo in
 * critical red, which read as "this site is critical").
 */
export const PIN_SELECTION = "#00ed64";

/** Badge: FM main station (สถานีหลัก). Gold star. */
export const BADGE_MAIN = "#ffd24a";

/**
 * Badge: INT law paper sent. Deliberately NOT the gold star — the star already
 * means "main station" on FM pins, and one glyph carrying two unrelated
 * meanings on the same map is unreadable. This is a pale document instead.
 */
export const BADGE_LAW = "#e6ecf0";

/**
 * Badge: already inspected, worn by pins whose bucket outranks `inspected`
 * (revoked, off air). Deliberately the *same* green as the inspected bucket —
 * reusing it keeps "green = inspected" true everywhere on the map, where a new
 * hue would invent a fourth state nobody has a legend for.
 */
export const BADGE_INSPECTED = PIN_COLORS.inspected;

/**
 * Cell Sites map: pin, cluster-ring and chip colour per operator. A separate
 * tab from Field Ops, so these never share a map with the bucket colours
 * above — green here is AWN, not "inspected".
 */
export const CELL_OPERATOR_COLORS = {
  AWN: "#1faa4b",
  NT: "#ff8a00",
  TUC: "#e5202e",
} as const;

/** Cell Sites map: a location shared by several visible operators. */
export const CELL_SHARED_COLOR = PIN_INK;
