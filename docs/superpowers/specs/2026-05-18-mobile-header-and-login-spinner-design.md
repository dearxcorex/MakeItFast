# Mobile Header Visibility + Login Spinner — Design

**Date:** 2026-05-18
**Status:** Approved
**Surface:** field-ops (mobile layout) + login page

## Goal

Two small UX fixes bundled into one PR:

1. **Mobile header lost behind map** — on iOS Safari, the field-ops page overflows the visible viewport. The page header is pushed above the fold and unreachable because the Leaflet map captures vertical swipe gestures inside the map area. Make the header visible at all times on mobile.
2. **Login button shows literal `"..."` during submit** — no loading affordance. Replace with a real inline spinner.

## Issue 1 — Mobile header lost behind map

### Root cause

`src/components/field-ops/FieldOpsClient.tsx:462` sets the root container `minHeight: "100vh"`. On iOS Safari, the legacy `100vh` unit always returns the height as if the browser's top URL bar and bottom toolbar were collapsed. With those bars showing (the default on first paint), the actual visible viewport is ~160px shorter than `100vh`. The flex-column root pushes its first child (the header) up to the top of the 100vh box — which is above the visible area. The user then has to scroll up to find the header, but `<FieldOpsMap>` (Leaflet) captures all vertical pan gestures inside its bounds, so swipe-to-scroll-up doesn't work.

### Fix (two parts)

**Part A — Switch to dynamic viewport units.** In `src/components/field-ops/FieldOpsClient.tsx`, change the root container's `minHeight`:

```diff
       style={{
-        minHeight: "100vh",
+        minHeight: "100dvh",
         display: "flex",
         flexDirection: "column",
       }}
```

`100dvh` (dynamic viewport height) tracks the actual visible viewport height as Safari's bars expand and collapse. The page no longer overflows; the header sits at the actual top of the visible area on first paint. Supported in iOS Safari 15.4+, Chrome 108+, Firefox 101+ — all modern.

**Part B — Make the mobile header sticky.** In `src/components/field-ops/FieldOpsHeader.tsx`, the `MobileHeader` sub-component's outer `<header>` element. Add three style properties:

```diff
   return (
     <header
       style={{
         display: "flex",
         alignItems: "center",
         gap: 10,
         padding: "10px 12px",
         background: headerBg,
         color: textColor,
         borderBottom: `1px solid ${borderColor}`,
         flexShrink: 0,
+        position: "sticky",
+        top: 0,
+        zIndex: 50,
       }}
     >
```

Safety net: even if a future layout change re-introduces overflow, the sticky header always renders at the top of the visible viewport when scrolled. `z-index: 50` keeps the header above the map (Leaflet uses high z-indices internally but they're scoped to the map's stacking context, which is in the document flow below the header).

**Desktop header is NOT changed** — its branch in `FieldOpsHeader` keeps the existing layout. Desktop viewports are tall enough that the issue doesn't apply, and adding sticky would change the visual feel unnecessarily.

## Issue 2 — Login button spinner

### Root cause

`src/app/login/page.tsx:118` renders `{submitting ? "..." : "Sign in"}` — a literal `"..."` string. No animation, no spinner, no progress signal beyond the button text changing.

### Fix

Replace the button content with an inline spinner + a more descriptive label:

```tsx
<button
  type="submit"
  disabled={submitting}
  className="w-full rounded-md bg-[var(--fo-accent)] text-black font-medium py-2 disabled:opacity-60 flex items-center justify-center gap-2"
>
  {submitting && (
    <span
      aria-hidden
      className="inline-block w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin"
    />
  )}
  {submitting ? "Signing in…" : "Sign in"}
</button>
```

**Mechanics:**
- 16×16px circle with a 2px black border and a transparent top arc, spinning via Tailwind's built-in `animate-spin` keyframe (`@keyframes spin { to { transform: rotate(360deg); } }` runs over 1 second linear).
- `aria-hidden` on the spinner because the text label `"Signing in…"` is the accessible name.
- Button stays `disabled` while submitting (prevents double-submission; existing behavior preserved).
- Layout: button becomes a flex row centered, with `gap: 8px` between spinner and text.

**Color scaling:**
- Spinner inherits a hardcoded black border which matches the button's `text-black` foreground. Safe on the always-accent button background (no light/dark theme branch needed since the button color doesn't change).

### Why not an external spinner library

The project has no spinner library installed. Adding one (`react-spinners`, `lucide-react/Loader`, etc.) for a single 4-line component would expand the bundle for marginal value. Tailwind's `animate-spin` + a `<span>` is enough.

## Testing

| File | Cases |
|---|---|
| **NEW** `src/__tests__/login-spinner.test.tsx` | 2 cases — (1) initial render shows "Sign in" only, no spinner; (2) after `submitting=true`, button shows spinner element + "Signing in…" and is disabled. |
| Mobile header fix | No automated test. Pure CSS — would need a real iOS Safari to verify. Manual smoke via DevTools mobile emulation (set viewport to iPhone 14, refresh `/field-ops`, confirm header is visible at top and stays visible during map scroll). |

## Out of scope (YAGNI)

- Spinner on any other in-app pending state (analytics fetch, station toggle, default crew save, etc.). Only the login button this round.
- Reworking the mobile drawer or any other layout surface beyond the header.
- Light/dark theme adjustments to the spinner color (button is always accent-colored; spinner is always dark; works on both themes).
- Adding a spinner library.
- Adjusting the desktop header (the issue is mobile-only).
- Adding a global `<LoadingSpinner>` component for reuse. If we add a second spinner site later, we can extract it then.

## Risk callouts

- **`100dvh` browser support**: iOS Safari ≥ 15.4, Android Chrome ≥ 108, Firefox ≥ 101. Project targets modern mobile so this is safe. Older Safari (<15.4) would fall back to treating `100dvh` as invalid and the `minHeight` rule would not apply at all (effectively `auto`) — page would still render but might collapse to content height. Acceptable since the user base is current iOS.
- **Sticky header z-index conflicts**: Leaflet controls (zoom +/-, attribution, ME button) use z-index 1000+ but are inside the map container's stacking context. The sticky header (z-index 50) is a sibling of the map container, so the stacking contexts don't collide. The header always renders above the map in document order.

## Open questions

None.
