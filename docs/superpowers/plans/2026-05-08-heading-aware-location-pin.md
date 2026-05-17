# Heading-Aware Location Pin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static "you are here" dot with a heading-aware pin (cyan dot + 60° beam cone) that rotates with the user's direction of travel and gracefully falls back to a last-known/grayed cone when GPS heading is unavailable. Applied to both the stations map and the interference map.

**Architecture:** A pure utility (`headingTracking.ts`) smooths GPS heading and tracks staleness. An updated `createLocationIcon({heading, stale})` factory renders an SVG `divIcon` whose cone is rotated via inline `transform`. Both maps run their own `headingStateRef`, fed by the existing `watchPosition` callbacks. Map stays north-up; only the pin rotates.

**Tech Stack:** Next.js 15, TypeScript, react-leaflet (Leaflet `divIcon`), Vitest + jsdom + @testing-library/react. No new runtime dependencies.

**Project policy on commits:** Per `CLAUDE.md`, this repo does NOT auto-commit or push. Each task ends with a `git commit` step — when executing, run `git add` and show the diff first, **pause for explicit user approval**, then commit. Do not push.

**Spec:** `docs/superpowers/specs/2026-05-08-heading-aware-location-pin-design.md`

---

## Task 1: Add `stale` field to `UserLocation` type

**Files:**
- Modify: `src/types/station.ts:27-33`

- [ ] **Step 1: Add the optional field**

Edit `src/types/station.ts`. Replace the `UserLocation` interface block:

```ts
export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  stale?: boolean;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. The field is optional, so all existing callers compile unchanged.

- [ ] **Step 3: Stage and commit (pause for approval per repo policy)**

```bash
git add src/types/station.ts
git diff --cached
# wait for user approval, then:
git commit -m "feat(types): add optional stale flag to UserLocation"
```

---

## Task 2: Create `headingTracking.ts` utility (TDD)

**Files:**
- Create: `src/utils/headingTracking.ts`
- Test: `src/__tests__/headingTracking.test.ts`

This is a pure utility — no React, no DOM. Reuses the existing `haversineDistanceKm` helper from `src/utils/distance.ts`.

- [ ] **Step 1: Write the failing tests first**

Create `src/__tests__/headingTracking.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  initialHeadingState,
  updateHeading,
} from '@/utils/headingTracking';

describe('headingTracking', () => {
  describe('initialHeadingState', () => {
    it('returns a fresh state with null heading and stale=false', () => {
      const s = initialHeadingState();
      expect(s.heading).toBeNull();
      expect(s.stale).toBe(false);
      expect(s.lastPosition).toBeNull();
    });
  });

  describe('updateHeading', () => {
    it('accepts non-null GPS heading when speed is at or above threshold', () => {
      const next = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: 90, speed: 5 },
        1000
      );
      expect(next.heading).toBe(90);
      expect(next.stale).toBe(false);
      expect(next.lastPosition).toEqual({ lat: 13.7, lng: 100.5 });
    });

    it('marks stale when heading is null and speed is below threshold', () => {
      const seeded = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: 45, speed: 5 },
        1000
      );
      const next = updateHeading(
        seeded,
        { lat: 13.7, lng: 100.5, heading: null, speed: 0 },
        2000
      );
      expect(next.heading).toBe(45);
      expect(next.stale).toBe(true);
    });

    it('falls back to position-bearing when distance is large and heading is null', () => {
      const start = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: 0, speed: 5 },
        1000
      );
      // ~10 m east of starting point at lat 13.7
      const lngStep = 10 / (111000 * Math.cos((13.7 * Math.PI) / 180));
      const east = {
        lat: 13.7,
        lng: 100.5 + lngStep,
        heading: null,
        speed: null,
      };
      const next = updateHeading(start, east, 2000);
      expect(next.stale).toBe(false);
      expect(next.heading).not.toBeNull();
      // EMA(0, ~90, 0.3) ≈ 27, but bearing alone is ~90; we just bound it
      expect(next.heading!).toBeGreaterThan(0);
      expect(next.heading!).toBeLessThan(180);
    });

    it('keeps stale when null heading and movement is below the bearing threshold', () => {
      const seeded = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: 180, speed: 5 },
        1000
      );
      const next = updateHeading(
        seeded,
        // ~0.01 m north — well below 5 m
        { lat: 13.70000009, lng: 100.5, heading: null, speed: 0 },
        2000
      );
      expect(next.heading).toBe(180);
      expect(next.stale).toBe(true);
    });

    it('smooths through 0/360 wraparound (358 -> 2)', () => {
      const seeded = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: 358, speed: 5 },
        1000
      );
      const next = updateHeading(
        seeded,
        { lat: 13.7001, lng: 100.5, heading: 2, speed: 5 },
        2000
      );
      // EMA(358, 2, 0.3) with shortest delta of +4 -> 359.2
      expect(next.heading).toBeCloseTo(359.2, 1);
    });

    it('normalizes heading into [0, 360)', () => {
      const seeded = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: 5, speed: 5 },
        1000
      );
      const next = updateHeading(
        seeded,
        { lat: 13.7001, lng: 100.5, heading: 355, speed: 5 },
        2000
      );
      expect(next.heading!).toBeGreaterThanOrEqual(0);
      expect(next.heading!).toBeLessThan(360);
    });

    it('seeds lastPosition even when first sample has no heading', () => {
      const next = updateHeading(
        initialHeadingState(),
        { lat: 1, lng: 2, heading: null, speed: null },
        0
      );
      expect(next.lastPosition).toEqual({ lat: 1, lng: 2 });
      expect(next.heading).toBeNull();
      expect(next.stale).toBe(false); // never had a heading -> not "stale"
    });

    it('simulates a typical drive sequence: cold start → moving → stopped → moving', () => {
      // 1. Cold start: first GPS fix, no heading yet (parked)
      let state = updateHeading(
        initialHeadingState(),
        { lat: 13.7, lng: 100.5, heading: null, speed: 0 },
        0
      );
      expect(state.heading).toBeNull();
      expect(state.stale).toBe(false);

      // 2. Driving north at 10 m/s — heading ~0°
      state = updateHeading(
        state,
        { lat: 13.701, lng: 100.5, heading: 0, speed: 10 },
        1000
      );
      expect(state.heading).toBe(0);
      expect(state.stale).toBe(false);

      // 3. Still driving, heading nudges to 5°
      state = updateHeading(
        state,
        { lat: 13.702, lng: 100.5, heading: 5, speed: 10 },
        2000
      );
      expect(state.heading).toBeCloseTo(1.5, 1); // EMA(0, 5, 0.3)
      expect(state.stale).toBe(false);

      // 4. Stopped at a light: heading null, speed 0 — should freeze + go stale
      state = updateHeading(
        state,
        { lat: 13.702, lng: 100.5, heading: null, speed: 0 },
        3000
      );
      expect(state.heading).toBeCloseTo(1.5, 1); // preserved
      expect(state.stale).toBe(true);

      // 5. Moving again: heading 90°, speed 8 m/s — fresh again
      state = updateHeading(
        state,
        { lat: 13.702, lng: 100.501, heading: 90, speed: 8 },
        4000
      );
      expect(state.stale).toBe(false);
      expect(state.heading).toBeGreaterThan(1.5); // smoothing toward 90
      expect(state.heading).toBeLessThan(90);
    });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail (red)**

Run: `npx vitest run src/__tests__/headingTracking.test.ts`
Expected: FAIL — "Cannot find module '@/utils/headingTracking'".

- [ ] **Step 3: Implement the utility**

Create `src/utils/headingTracking.ts`:

```ts
import { haversineDistanceKm } from './distance';

export interface HeadingState {
  heading: number | null;
  stale: boolean;
  lastSampleAt: number;
  lastPosition: { lat: number; lng: number } | null;
}

export interface HeadingSample {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
}

const MIN_SPEED_MS = 0.5;
const MIN_BEARING_DISTANCE_M = 5;
const EMA_ALPHA = 0.3;

export function initialHeadingState(): HeadingState {
  return {
    heading: null,
    stale: false,
    lastSampleAt: 0,
    lastPosition: null,
  };
}

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// Wraparound-aware EMA: smooths along the shortest angular delta
function emaAngle(prev: number, next: number, alpha: number): number {
  let delta = next - prev;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return normalizeAngle(prev + alpha * delta);
}

function bearingDeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const phi1 = toRad(a.lat);
  const phi2 = toRad(b.lat);
  const dLambda = toRad(b.lng - a.lng);
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return normalizeAngle(toDeg(Math.atan2(y, x)));
}

export function updateHeading(
  prev: HeadingState,
  sample: HeadingSample,
  now: number = Date.now()
): HeadingState {
  const newPosition = { lat: sample.lat, lng: sample.lng };

  // Path 1: trust GPS heading when speed is sufficient
  if (sample.heading != null && (sample.speed ?? 0) >= MIN_SPEED_MS) {
    const smoothed =
      prev.heading == null
        ? normalizeAngle(sample.heading)
        : emaAngle(prev.heading, sample.heading, EMA_ALPHA);
    return {
      heading: smoothed,
      stale: false,
      lastSampleAt: now,
      lastPosition: newPosition,
    };
  }

  // Path 2: bearing fallback when GPS heading is null but movement is large
  if (sample.heading == null && prev.lastPosition) {
    const distM =
      haversineDistanceKm(
        prev.lastPosition.lat,
        prev.lastPosition.lng,
        newPosition.lat,
        newPosition.lng
      ) * 1000;
    if (distM >= MIN_BEARING_DISTANCE_M) {
      const bearing = bearingDeg(prev.lastPosition, newPosition);
      const smoothed =
        prev.heading == null
          ? bearing
          : emaAngle(prev.heading, bearing, EMA_ALPHA);
      return {
        heading: smoothed,
        stale: false,
        lastSampleAt: now,
        lastPosition: newPosition,
      };
    }
  }

  // Path 3: keep last heading; mark stale only if we ever had one
  return {
    heading: prev.heading,
    stale: prev.heading != null,
    lastSampleAt: prev.lastSampleAt,
    lastPosition: newPosition,
  };
}
```

- [ ] **Step 4: Run the tests to confirm green**

Run: `npx vitest run src/__tests__/headingTracking.test.ts`
Expected: all 7 tests pass.

- [ ] **Step 5: Run full test suite (no regressions)**

Run: `npm test -- --run`
Expected: all existing tests still pass.

- [ ] **Step 6: Stage and commit (pause for approval per repo policy)**

```bash
git add src/utils/headingTracking.ts src/__tests__/headingTracking.test.ts
git diff --cached
# wait for user approval, then:
git commit -m "feat(utils): add headingTracking smoothing + stale detection"
```

---

## Task 3: Update `createLocationIcon` to render heading cone (TDD)

**Files:**
- Modify: `src/utils/mapHelpers.ts:104-116`
- Modify: `src/__tests__/mapHelpers.test.ts:151-169`

The new signature is backward-compatible: `createLocationIcon()` with no arg returns the cold-start (plain dot) icon.

- [ ] **Step 1: Update the existing tests, then add new ones (write red first)**

Edit `src/__tests__/mapHelpers.test.ts`. Replace the `describe('createLocationIcon', ...)` block (lines 151-169) with:

```ts
// --- createLocationIcon ---
describe('createLocationIcon', () => {
  it('returns a DivIcon', () => {
    const icon = createLocationIcon();
    expect(icon).toBeDefined();
    expect(icon.options.className).toBe('custom-location-icon');
  });

  it('uses the new larger dimensions to fit the cone', () => {
    const icon = createLocationIcon();
    expect(icon.options.iconSize).toEqual([80, 80]);
    expect(icon.options.iconAnchor).toEqual([40, 40]);
  });

  it('always contains the dot and pulse halo', () => {
    const html = createLocationIcon().options.html as string;
    expect(html).toContain('location-pulse');
    expect(html).toContain('location-dot');
  });

  it('cold start (no heading) hides the cone', () => {
    const html = createLocationIcon().options.html as string;
    expect(html).not.toContain('heading-cone');
  });

  it('renders a rotated cone when heading is provided', () => {
    const html = createLocationIcon({ heading: 90, stale: false })
      .options.html as string;
    expect(html).toContain('heading-cone');
    expect(html).toContain('rotate(90deg)');
    expect(html).not.toContain('heading-cone--stale');
  });

  it('applies the stale modifier and pauses the pulse when stale', () => {
    const html = createLocationIcon({ heading: 270, stale: true })
      .options.html as string;
    expect(html).toContain('heading-cone--stale');
    expect(html).toContain('rotate(270deg)');
    expect(html).toContain('location-pulse--paused');
  });

  it('rounds non-integer headings to one decimal in the transform', () => {
    const html = createLocationIcon({ heading: 359.249, stale: false })
      .options.html as string;
    expect(html).toContain('rotate(359.2deg)');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail (red)**

Run: `npx vitest run src/__tests__/mapHelpers.test.ts -t createLocationIcon`
Expected: most assertions fail (`iconSize` mismatch, missing `heading-cone`, etc.).

- [ ] **Step 3: Implement the new icon factory**

In `src/utils/mapHelpers.ts`, replace the existing `createLocationIcon` (lines 104-116) with:

```ts
export interface LocationIconOptions {
  heading?: number | null;
  stale?: boolean;
}

export function createLocationIcon(opts: LocationIconOptions = {}): L.DivIcon {
  const { heading = null, stale = false } = opts;
  const hasHeading = typeof heading === 'number' && Number.isFinite(heading);

  const cone = hasHeading
    ? `<svg
         class="heading-cone${stale ? ' heading-cone--stale' : ''}"
         viewBox="-40 -40 80 80"
         width="80"
         height="80"
         style="position:absolute;top:0;left:0;transform:rotate(${(heading as number).toFixed(1)}deg);transform-origin:50% 50%;"
         aria-hidden="true"
       >
         <defs>
           <radialGradient id="heading-cone-grad" cx="50%" cy="100%" r="100%">
             <stop offset="0%" stop-color="rgba(34,211,238,0.55)" />
             <stop offset="100%" stop-color="rgba(34,211,238,0)" />
           </radialGradient>
         </defs>
         <path d="M 0 0 L -18 -36 A 40 40 0 0 1 18 -36 Z" fill="url(#heading-cone-grad)" />
       </svg>`
    : '';

  const pulseClass = stale ? 'location-pulse location-pulse--paused' : 'location-pulse';

  return L.divIcon({
    className: 'custom-location-icon',
    html: `
      <div class="location-marker-host">
        ${cone}
        <div class="location-dot">
          <div class="${pulseClass}"></div>
        </div>
      </div>
    `,
    iconSize: [80, 80],
    iconAnchor: [40, 40],
    popupAnchor: [0, -40],
  });
}
```

- [ ] **Step 4: Run the tests to confirm green**

Run: `npx vitest run src/__tests__/mapHelpers.test.ts -t createLocationIcon`
Expected: all 7 assertions pass.

- [ ] **Step 5: Run full test suite (no regressions)**

Run: `npm test -- --run`
Expected: all tests pass. The existing callers (`Map.tsx`, `InterferenceMap.tsx`, `components-batch4.test.tsx`) still work because the no-arg call is preserved.

- [ ] **Step 6: Stage and commit (pause for approval per repo policy)**

```bash
git add src/utils/mapHelpers.ts src/__tests__/mapHelpers.test.ts
git diff --cached
# wait for user approval, then:
git commit -m "feat(map): heading-aware createLocationIcon with stale fallback"
```

---

## Task 4: Add CSS for cone + dot + stale + pulse

**Files:**
- Modify: `src/app/globals.css:1283-1314` (replace and extend the existing `.location-marker` block)

This task has no automated test — visual changes are verified manually in Task 7.

- [ ] **Step 1: Replace the existing location-marker rules**

Find the block in `src/app/globals.css` starting at line 1283 (`/* Location marker styles */`) and ending at line 1314 (closing brace of `@keyframes locationPulse`). Replace the entire block with:

```css
/* Location marker styles (heading-aware) */
.location-marker-host {
  position: relative;
  width: 80px;
  height: 80px;
  pointer-events: none;
}

.location-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 18px;
  height: 18px;
  margin-top: -9px;
  margin-left: -9px;
  background: #22D3EE;
  border: 3px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  pointer-events: auto;
}

.location-pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  margin-top: -20px;
  margin-left: -20px;
  background: rgba(34, 211, 238, 0.2);
  border-radius: 50%;
  animation: locationPulse 1.5s ease-out infinite;
  pointer-events: none;
}

.location-pulse--paused {
  animation-play-state: paused;
  opacity: 0.4;
}

.heading-cone {
  position: absolute;
  top: 0;
  left: 0;
  width: 80px;
  height: 80px;
  pointer-events: none;
  transition: transform 200ms linear;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25));
}

.heading-cone--stale path {
  fill: rgba(148, 163, 184, 0.45) !important; /* slate-400 @ 0.45 */
}

.heading-cone--stale {
  opacity: 0.6;
}

@keyframes locationPulse {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
}
```

The reduced-motion rule a few lines below (originally `globals.css:1316-1336`) already lists `.location-pulse` — leave it alone; it correctly disables our paused pulse too.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: pass.

- [ ] **Step 3: Stage and commit (pause for approval per repo policy)**

```bash
git add src/app/globals.css
git diff --cached
# wait for user approval, then:
git commit -m "style(map): cone + dot + stale styles for heading-aware pin"
```

---

## Task 5: Wire heading tracking into `Map.tsx`

**Files:**
- Modify: `src/components/Map.tsx:8` (import)
- Modify: `src/components/Map.tsx:37-108` (`LocationTracker` component)
- Modify: `src/components/Map.tsx:189-209` (user-location `<Marker>`)

`LocationTracker` runs its own `watchPosition` on the stations tab. Add a `headingStateRef` that flows through `updateHeading()` on each callback, and emit `heading`+`stale` in the `UserLocation` payload it propagates to the parent.

- [ ] **Step 1: Update the import**

Edit `src/components/Map.tsx` line 8 to also import the heading utilities:

```ts
import { calculateDistance, createLocationIcon, getStationIcon } from '@/utils/mapHelpers';
import { initialHeadingState, updateHeading, type HeadingSample } from '@/utils/headingTracking';
```

- [ ] **Step 2: Add the heading ref and use it in the watcher**

In the same file, replace the body of the `LocationTracker` component (currently lines 37-108) with:

```tsx
function LocationTracker({ onLocationUpdate }: { onLocationUpdate: (location: UserLocation) => void }) {
  const map = useMap();
  const headingStateRef = useRef(initialHeadingState());

  useEffect(() => {
    let watchId: number;
    let isMounted = true;

    const isMapAlive = () => {
      try {
        return isMounted && !!map.getContainer() && !!map.getPane('mapPane');
      } catch {
        return false;
      }
    };

    const ingest = (sample: HeadingSample, base: Omit<UserLocation, 'heading' | 'stale'>): UserLocation => {
      const next = updateHeading(headingStateRef.current, sample);
      headingStateRef.current = next;
      return { ...base, heading: next.heading, stale: next.stale };
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!isMounted) return;
          const sample: HeadingSample = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            heading: null,
            speed: null,
          };
          const location = ingest(sample, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: null,
          });
          onLocationUpdate(location);
          if (isMapAlive()) {
            map.setView([location.latitude, location.longitude], 13);
          }
        },
        (error) => {
          console.warn('Initial geolocation error:', error);
          if (!isMounted) return;
          const defaultLocation: UserLocation = { latitude: 34.0522, longitude: -118.2437 };
          onLocationUpdate(defaultLocation);
          if (isMapAlive()) {
            map.setView([defaultLocation.latitude, defaultLocation.longitude], 10);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!isMounted) return;
          const sample: HeadingSample = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            heading: position.coords.heading ?? null,
            speed: position.coords.speed ?? null,
          };
          const location = ingest(sample, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed ?? null,
          });
          onLocationUpdate(location);
        },
        (error) => {
          console.warn('Watch position error:', error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    }

    return () => {
      isMounted = false;
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [map, onLocationUpdate]);

  return null;
}
```

Note the helper `ingest()`: it routes every sample through `updateHeading` and merges the smoothed heading/stale flag back into the `UserLocation` payload.

- [ ] **Step 3: Use the new icon options in the user marker**

In the same file, replace `icon={createLocationIcon()}` (around line 192) with:

```tsx
icon={createLocationIcon({ heading: userLocation.heading, stale: userLocation.stale })}
```

The surrounding `<Marker>` and `<Popup>` blocks stay unchanged.

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run src/__tests__/components-batch4.test.tsx src/__tests__/mapHelpers.test.ts`
Expected: all tests pass. The existing `vi.mock('@/utils/mapHelpers', ...)` in `components-batch4` returns `{ options: {} }` regardless of arguments, so the new prop chain doesn't break it.

- [ ] **Step 6: Run full test suite**

Run: `npm test -- --run`
Expected: all tests pass.

- [ ] **Step 7: Stage and commit (pause for approval per repo policy)**

```bash
git add src/components/Map.tsx
git diff --cached
# wait for user approval, then:
git commit -m "feat(map): wire heading-aware pin into stations Map.tsx"
```

---

## Task 6: Wire heading tracking into `OptimizedFMStationClient.tsx` (interference flow)

**Files:**
- Modify: `src/components/OptimizedFMStationClient.tsx` (imports near top, watchPosition handler around line 184-206)

`OptimizedFMStationClient` owns the `userLocation` state passed to `<InterferenceAnalysis>` (which forwards it to `<InterferenceMap>`). Add a `headingStateRef`, route every sample through `updateHeading()`, and include `heading`+`stale` in the emitted state.

- [ ] **Step 1: Add imports**

Near the top of `src/components/OptimizedFMStationClient.tsx` (next to existing util imports), add:

```ts
import { initialHeadingState, updateHeading, type HeadingSample } from '@/utils/headingTracking';
```

- [ ] **Step 2: Add the heading ref**

Just below the existing `geolocationWatcherRef = useRef<number | null>(null);` line (around line 92), add:

```ts
const headingStateRef = useRef(initialHeadingState());
```

- [ ] **Step 3: Route the watchPosition sample through updateHeading**

Replace the `watchPosition` success callback (currently lines 184-194) with:

```ts
const watchId = navigator.geolocation.watchPosition(
  (position) => {
    const sample: HeadingSample = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      heading: position.coords.heading ?? null,
      speed: position.coords.speed ?? null,
    };
    const next = updateHeading(headingStateRef.current, sample);
    headingStateRef.current = next;

    const location: UserLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: next.heading,
      speed: position.coords.speed ?? null,
      stale: next.stale,
    };
    setUserLocation(location);
  },
  (error) => {
    if (error.code !== error.TIMEOUT) {
      console.info('📍 Geolocation watch:', error.message);
    }
  },
  {
    enableHighAccuracy: false,
    timeout: 30000,
    maximumAge: 30000,
  }
);
```

The `tryLowAccuracyFirst` block above doesn't capture heading either — leave it alone; the first watchPosition tick will populate the heading state.

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass.

- [ ] **Step 5: Run full test suite**

Run: `npm test -- --run`
Expected: all tests pass.

- [ ] **Step 6: Stage and commit (pause for approval per repo policy)**

```bash
git add src/components/OptimizedFMStationClient.tsx
git diff --cached
# wait for user approval, then:
git commit -m "feat(client): smooth + propagate heading from parent watchPosition"
```

---

## Task 7: Render heading-aware pin in `InterferenceMap.tsx`

**Files:**
- Modify: `src/components/interference/InterferenceMap.tsx:118-135`

- [ ] **Step 1: Use the new icon options**

In `src/components/interference/InterferenceMap.tsx`, replace the user-location `<Marker>` block (currently lines 118-135) with:

```tsx
{/* User location marker */}
{userLocation && (
  <Marker
    position={[userLocation.latitude, userLocation.longitude]}
    icon={createLocationIcon({
      heading: userLocation.heading,
      stale: userLocation.stale,
    })}
  >
    <Popup>
      <div className="interference-popup">
        <div className="interference-popup-title">Your Location</div>
        <div className="interference-popup-details">
          Current position
          {userLocation.accuracy && (
            <div>Accuracy: ±{Math.round(userLocation.accuracy)}m</div>
          )}
        </div>
      </div>
    </Popup>
  </Marker>
)}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass.

- [ ] **Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: all tests pass.

- [ ] **Step 4: Manual verification (dev server)**

Run: `npm run dev`

Open `http://localhost:3000` on a phone (or desktop with a dev-tools "Sensors" panel that can override geolocation + heading):

1. **Stations tab, parked / cold start.** Pin should be a plain cyan dot with the pulsing halo. No cone visible.
2. **Stations tab, driving > 0.5 m/s.** Cone appears, points in direction of travel, rotates smoothly without 0/360 snaps.
3. **Stations tab, stopped at a light.** Cone freezes, fades to gray (`heading-cone--stale`), pulse pauses + dims.
4. **Switch to Interference tab while moving.** Same pin behavior.
5. **Reduced-motion OS setting on.** Pulse halo is disabled (existing rule); cone still rotates.

If anything visually wrong, check `globals.css` cone styles before re-touching JS.

- [ ] **Step 5: Stage and commit (pause for approval per repo policy)**

```bash
git add src/components/interference/InterferenceMap.tsx
git diff --cached
# wait for user approval, then:
git commit -m "feat(interference-map): render heading-aware pin"
```

---

## Verification checklist (run before declaring done)

- [ ] `npm test -- --run` all green
- [ ] `npm run test:coverage` shows `src/utils/headingTracking.ts` ≥ 95% line coverage
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run lint` clean
- [ ] `npm run build` succeeds
- [ ] Manual driving check covered all five scenarios in Task 7 Step 4
- [ ] No console errors / warnings related to Leaflet `divIcon` in either tab

## Out of scope (do not add to this plan)

- Map auto-pan / drive-mode UX
- iOS `DeviceOrientationEvent` compass fallback
- Consolidating the two parallel `watchPosition` calls
- Map heading-up rotation
