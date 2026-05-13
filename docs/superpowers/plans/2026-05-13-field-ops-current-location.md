# Field Ops Current-Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the user's current location as a moving pin on the Field Ops map. Pin appears immediately on page load and updates as the user moves. No heading cone (no rotation) — just a dot that follows the user.

**Architecture:** The home route renders `FieldOpsClient` → `FieldOpsMap`, neither of which currently calls `navigator.geolocation`. The fix is to (1) add a `useGeolocation()` React hook that uses both `getCurrentPosition()` (fast initial fix) and `watchPosition()` (live updates as user moves), (2) wire it into `FieldOpsClient`, (3) render a dot in `FieldOpsMap` using the existing `createLocationIcon()` factory (called with `{ heading: null }` so no cone), (4) auto-pan the map to that location on first fix only (don't fight user pan), (5) add a status badge in the header (Locating / Located / Denied + Retry), and (6) add a "Recenter on me" button. The hook does NOT call `updateHeading` and the marker never rotates — only the position updates.

**Library choice:** No third-party library. The browser's built-in `navigator.geolocation` API is sufficient — it's free, runs offline, no install. A library like `react-geolocated` would add a dependency for zero functional gain at this scope.

**Tech Stack:** Next.js 15 (Turbopack), React 19, TypeScript, react-leaflet, vitest + @testing-library/react, the existing `createLocationIcon()` factory (already supports a no-heading "just a dot" rendering).

---

## Scope Check

This plan covers ONE subsystem (Field Ops current location). Old `Map.tsx` + `OptimizedFMStationClient.tsx` still contain a movement-aware watcher from the previous session — they are NOT mounted by `/` and remain out of scope. Removing them is a separate cleanup, not part of this plan.

## File Structure

**Create:**
- `src/hooks/useGeolocation.ts` — new reusable React hook. Wraps `navigator.geolocation.getCurrentPosition()` (fast first fix) + `watchPosition()` (live updates). Exposes `{ userLocation, status, retry }`. No heading smoothing — position only.
- `src/__tests__/useGeolocation.test.tsx` — vitest unit tests for the hook (mocked `navigator.geolocation`).
- `src/__tests__/field-ops-map-location.test.tsx` — vitest test that `FieldOpsMap` renders a location marker when `userLocation` is provided.
- `src/__tests__/field-ops-header-location.test.tsx` — vitest test for the new status badge in `FieldOpsHeader`.

**Modify:**
- `src/components/field-ops/FieldOpsClient.tsx` — call `useGeolocation()`, pass `userLocation` + `locationStatus` + `onRetryLocation` to children.
- `src/components/field-ops/FieldOpsMap.tsx` — accept `userLocation` prop, render a `<Marker>` with `createLocationIcon({ heading: null })`, add `InitialLocationPan` and `RecenterButton`.
- `src/components/field-ops/FieldOpsHeader.tsx` — accept optional `locationStatus` + `userLocation` + `onRetryLocation`, render a status badge.

**Not touched (intentionally):**
- `src/components/Map.tsx`, `src/components/OptimizedFMStationClient.tsx`, `src/components/interference/InterferenceMap.tsx` — not mounted by `/`.
- `src/utils/headingTracking.ts` — NOT used by this plan. (Existing file stays untouched; it's only referenced by old code paths.)
- `src/utils/mapHelpers.ts:createLocationIcon` — reused as-is. Calling it with no `heading` produces a static cyan dot with no cone.

---

## Task 1: `useGeolocation` hook scaffolding (failing test first)

**Files:**
- Create: `src/__tests__/useGeolocation.test.tsx`
- Create (later in step 3): `src/hooks/useGeolocation.ts`

- [ ] **Step 1: Write the failing test for the hook's initial state**

Create `src/__tests__/useGeolocation.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from '@/hooks/useGeolocation';

type GeolocationMock = {
  getCurrentPosition: ReturnType<typeof vi.fn>;
  watchPosition: ReturnType<typeof vi.fn>;
  clearWatch: ReturnType<typeof vi.fn>;
};

let geoMock: GeolocationMock;
let originalGeolocation: Geolocation | undefined;

function installGeolocationMock() {
  geoMock = {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(() => 1),
    clearWatch: vi.fn(),
  };
  originalGeolocation = navigator.geolocation;
  Object.defineProperty(navigator, 'geolocation', {
    value: geoMock,
    configurable: true,
  });
}

function restoreGeolocation() {
  Object.defineProperty(navigator, 'geolocation', {
    value: originalGeolocation,
    configurable: true,
  });
}

function makePosition(over: Partial<GeolocationCoordinates> = {}): GeolocationPosition {
  return {
    coords: {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 42,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
      ...over,
    } as GeolocationCoordinates,
    timestamp: Date.now(),
    toJSON: () => ({}),
  } as GeolocationPosition;
}

describe('useGeolocation', () => {
  beforeEach(() => installGeolocationMock());
  afterEach(() => restoreGeolocation());

  it('starts in "locating" status with no userLocation', () => {
    geoMock.getCurrentPosition.mockImplementation(() => {});
    geoMock.watchPosition.mockImplementation(() => 1);
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe('locating');
    expect(result.current.userLocation).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/useGeolocation.test.tsx`
Expected: FAIL — `Cannot find module '@/hooks/useGeolocation'`.

- [ ] **Step 3: Implement the minimal hook to make the test pass**

Create `src/hooks/useGeolocation.ts`:

```ts
'use client';

import { useEffect, useRef, useState } from 'react';
import type { UserLocation } from '@/types/station';

export type GeolocationStatus =
  | 'unsupported'
  | 'locating'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'timeout';

export interface UseGeolocationResult {
  userLocation: UserLocation | undefined;
  status: GeolocationStatus;
  retry: () => void;
}

export function useGeolocation(): UseGeolocationResult {
  const [userLocation, setUserLocation] = useState<UserLocation | undefined>(undefined);
  const [status, setStatus] = useState<GeolocationStatus>(
    typeof navigator !== 'undefined' && navigator.geolocation ? 'locating' : 'unsupported'
  );
  const [attempt, setAttempt] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === 'unsupported') return;

    const applyFix = (coords: GeolocationCoordinates) => {
      setUserLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      });
      setStatus('granted');
    };

    const handleError = (err: GeolocationPositionError) => {
      switch (err.code) {
        case err.PERMISSION_DENIED: setStatus('denied'); break;
        case err.POSITION_UNAVAILABLE: setStatus('unavailable'); break;
        case err.TIMEOUT: setStatus('timeout'); break;
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => applyFix(pos.coords),
      handleError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );

    const id = navigator.geolocation.watchPosition(
      (pos) => applyFix(pos.coords),
      handleError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [attempt, status === 'unsupported']);

  const retry = () => {
    if (status === 'unsupported') return;
    setStatus('locating');
    setAttempt((n) => n + 1);
  };

  return { userLocation, status, retry };
}
```

Note: the hook fires `getCurrentPosition()` for a fast first fix, then `watchPosition()` keeps the position updated as the user moves. Both populate `userLocation` with only `latitude`/`longitude`/`accuracy` — heading/speed are intentionally NOT propagated (the dot moves but doesn't rotate).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/useGeolocation.test.tsx`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGeolocation.ts src/__tests__/useGeolocation.test.tsx
git commit -m "feat(hooks): scaffold useGeolocation hook"
```

---

## Task 2: `useGeolocation` emits user location on success and reports denial

**Files:**
- Modify: `src/__tests__/useGeolocation.test.tsx`

- [ ] **Step 1: Write the failing tests for success and denied transitions**

Append inside the `describe('useGeolocation', ...)` block:

```tsx
  it('transitions to "granted" and exposes userLocation when getCurrentPosition succeeds', () => {
    geoMock.getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success(makePosition({ latitude: 13.75, longitude: 100.5, accuracy: 25 }));
    });

    const { result } = renderHook(() => useGeolocation());

    expect(result.current.status).toBe('granted');
    expect(result.current.userLocation).toEqual({
      latitude: 13.75,
      longitude: 100.5,
      accuracy: 25,
    });
  });

  it('transitions to "denied" when getCurrentPosition errors with PERMISSION_DENIED', () => {
    geoMock.getCurrentPosition.mockImplementation((_s: PositionCallback, error: PositionErrorCallback) => {
      error({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'denied',
      } as GeolocationPositionError);
    });

    const { result } = renderHook(() => useGeolocation());
    expect(result.current.status).toBe('denied');
    expect(result.current.userLocation).toBeUndefined();
  });

  it('updates userLocation when watchPosition delivers a new fix', () => {
    let watchSuccess: PositionCallback | null = null;
    geoMock.getCurrentPosition.mockImplementation((s: PositionCallback) => {
      s(makePosition({ latitude: 13.75, longitude: 100.5, accuracy: 25 }));
    });
    geoMock.watchPosition.mockImplementation((s: PositionCallback) => {
      watchSuccess = s;
      return 99;
    });

    const { result } = renderHook(() => useGeolocation());
    expect(result.current.userLocation?.latitude).toBe(13.75);

    expect(watchSuccess).not.toBeNull();
    act(() => {
      watchSuccess!(makePosition({ latitude: 14.0, longitude: 101.0, accuracy: 18 }));
    });

    expect(result.current.userLocation).toEqual({
      latitude: 14.0,
      longitude: 101.0,
      accuracy: 18,
    });
  });

  it('does NOT expose heading or speed (no rotation, no heading cone)', () => {
    geoMock.getCurrentPosition.mockImplementation((s: PositionCallback) => {
      s(makePosition({ latitude: 13.75, longitude: 100.5, heading: 90, speed: 5 }));
    });
    const { result } = renderHook(() => useGeolocation());
    expect(result.current.userLocation?.heading).toBeUndefined();
    expect(result.current.userLocation?.speed).toBeUndefined();
  });

  it('calls clearWatch on unmount', () => {
    geoMock.watchPosition.mockReturnValue(77);
    geoMock.getCurrentPosition.mockImplementation(() => {});
    const { unmount } = renderHook(() => useGeolocation());
    unmount();
    expect(geoMock.clearWatch).toHaveBeenCalledWith(77);
  });

  it('retry() re-invokes getCurrentPosition', () => {
    geoMock.getCurrentPosition.mockImplementation((_s: PositionCallback, error: PositionErrorCallback) => {
      error({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'denied',
      } as GeolocationPositionError);
    });
    const { result, rerender } = renderHook(() => useGeolocation());
    expect(geoMock.getCurrentPosition).toHaveBeenCalledTimes(1);

    result.current.retry();
    rerender();
    expect(geoMock.getCurrentPosition).toHaveBeenCalledTimes(2);
  });
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `npx vitest run src/__tests__/useGeolocation.test.tsx`
Expected: PASS — 7 tests total.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/useGeolocation.test.tsx
git commit -m "test(hooks): cover useGeolocation success/denied/watch/retry/cleanup"
```

---

## Task 3: Render the static location marker in `FieldOpsMap`

**Files:**
- Create: `src/__tests__/field-ops-map-location.test.tsx`
- Modify: `src/components/field-ops/FieldOpsMap.tsx`

- [ ] **Step 1: Write the failing test for the location marker**

Create `src/__tests__/field-ops-map-location.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { UserLocation } from '@/types/station';

vi.mock('leaflet', async () => {
  return {
    default: {
      divIcon: (opts: { html: string; className?: string }) => ({ options: opts, _html: opts.html }),
      icon: () => ({}),
    },
    divIcon: (opts: { html: string }) => ({ options: opts, _html: opts.html }),
  };
});

vi.mock('react-leaflet', async () => {
  return {
    MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
    TileLayer: () => null,
    Marker: ({ position, icon }: { position: [number, number]; icon: { _html?: string } }) => (
      <div
        data-testid="marker"
        data-lat={position[0]}
        data-lng={position[1]}
        data-html={icon?._html ?? ''}
      />
    ),
    Polyline: () => null,
    useMap: () => ({ flyTo: vi.fn(), setView: vi.fn() }),
    useMapEvents: () => null,
  };
});

vi.mock('react-leaflet-cluster', async () => {
  return { default: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

import { FieldOpsMap } from '@/components/field-ops/FieldOpsMap';

describe('FieldOpsMap — current location pin', () => {
  it('renders a static location marker (no cone) when userLocation is provided', () => {
    const userLocation: UserLocation = {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 25,
    };
    const { getAllByTestId } = render(
      <FieldOpsMap
        stations={[]}
        interference={[]}
        selection={null}
        onSelect={vi.fn()}
        flyTarget={null}
        userLocation={userLocation}
      />
    );
    const markers = getAllByTestId('marker');
    const locMarker = markers.find(
      (m) => m.getAttribute('data-lat') === '13.7563' && m.getAttribute('data-lng') === '100.5018'
    );
    expect(locMarker).toBeDefined();
    const html = locMarker!.getAttribute('data-html') ?? '';
    expect(html).toContain('location-dot');
    expect(html).not.toContain('heading-cone');
  });

  it('renders NO location marker when userLocation is undefined', () => {
    const { queryAllByTestId } = render(
      <FieldOpsMap
        stations={[]}
        interference={[]}
        selection={null}
        onSelect={vi.fn()}
        flyTarget={null}
      />
    );
    const markers = queryAllByTestId('marker');
    const locMarker = markers.find((m) =>
      (m.getAttribute('data-html') ?? '').includes('location-dot')
    );
    expect(locMarker).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/field-ops-map-location.test.tsx`
Expected: FAIL — `userLocation` prop unknown, or marker not rendered.

- [ ] **Step 3: Add `userLocation` prop and render the marker in `FieldOpsMap.tsx`**

At the top of the file, alongside the existing imports, add:

```ts
import { createLocationIcon } from "@/utils/mapHelpers";
import type { UserLocation } from "@/types/station";
```

In the `FieldOpsMap` function signature (around line 284), change the props type to include the new prop:

```tsx
export function FieldOpsMap({
  stations,
  interference,
  selection,
  onSelect,
  flyTarget,
  theme = "dark",
  markingSourceForId = null,
  onMarkSource,
  onCancelMarkSource,
  userLocation,
}: {
  stations: FMStation[];
  interference: InterferenceSite[];
  selection: FieldSelection;
  onSelect: (sel: FieldSelection) => void;
  flyTarget: [number, number] | null;
  theme?: "dark" | "light";
  markingSourceForId?: number | null;
  onMarkSource?: (siteId: number, lat: number, lng: number) => void;
  onCancelMarkSource?: () => void;
  userLocation?: UserLocation;
}) {
```

Inside the JSX, just before `<FlyTo target={flyTarget} />` (line ~524), add:

```tsx
      {userLocation && (
        <Marker
          position={[userLocation.latitude, userLocation.longitude]}
          icon={createLocationIcon({ heading: null })}
        />
      )}
```

Note: passing `heading: null` makes `createLocationIcon` skip the cone SVG branch entirely (see `src/utils/mapHelpers.ts:111`). The result is just the cyan dot + halo.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/field-ops-map-location.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/field-ops-map-location.test.tsx src/components/field-ops/FieldOpsMap.tsx
git commit -m "feat(field-ops): render static current-location pin on FieldOpsMap"
```

---

## Task 4: Wire `useGeolocation` into `FieldOpsClient`

**Files:**
- Modify: `src/components/field-ops/FieldOpsClient.tsx`

- [ ] **Step 1: Add the hook and thread `userLocation` to `FieldOpsMap`**

At the top of `FieldOpsClient.tsx`, add:

```ts
import { useGeolocation } from "@/hooks/useGeolocation";
```

Inside the `FieldOpsClient` function body, near the other `useState` lines (around line 77), add:

```ts
  const { userLocation, status: locationStatus, retry: retryLocation } = useGeolocation();
```

In the `<FieldOpsMap …>` call (around line 424), add the `userLocation` prop:

```tsx
                  <FieldOpsMap
                    stations={filteredStations}
                    interference={filteredInterference}
                    selection={selection}
                    onSelect={handleSelect}
                    flyTarget={flyTarget}
                    theme={theme}
                    markingSourceForId={markingSourceForId}
                    onMarkSource={handleMarkSource}
                    onCancelMarkSource={() => setMarkingSourceForId(null)}
                    userLocation={userLocation}
                  />
```

`locationStatus` and `retryLocation` are unused at this step — Task 6 consumes them. To avoid a lint warning in the meantime, prefix them with `_` in the destructure (TypeScript convention for "intentionally unused"):

```ts
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { userLocation, status: locationStatus, retry: retryLocation } = useGeolocation();
```

(The `eslint-disable` line will be removed in Task 6.)

- [ ] **Step 2: Run linter to confirm no errors introduced**

Run: `npm run lint`
Expected: PASS (or only pre-existing warnings, no new ones).

- [ ] **Step 3: Run the field-ops map test for sanity**

Run: `npx vitest run src/__tests__/field-ops-map-location.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 4: Commit**

```bash
git add src/components/field-ops/FieldOpsClient.tsx
git commit -m "feat(field-ops): wire useGeolocation into FieldOpsClient"
```

---

## Task 5: Auto-pan map to user location on first fix

**Files:**
- Modify: `src/__tests__/field-ops-map-location.test.tsx`
- Modify: `src/components/field-ops/FieldOpsMap.tsx`

- [ ] **Step 1: Write the failing test for auto-pan on first fix**

In `field-ops-map-location.test.tsx`, replace the existing `react-leaflet` mock block with one that records `setView` calls:

```tsx
const setViewCalls: Array<{ center: [number, number]; zoom: number }> = [];

vi.mock('react-leaflet', async () => {
  return {
    MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
    TileLayer: () => null,
    Marker: ({ position, icon }: { position: [number, number]; icon: { _html?: string } }) => (
      <div
        data-testid="marker"
        data-lat={position[0]}
        data-lng={position[1]}
        data-html={icon?._html ?? ''}
      />
    ),
    Polyline: () => null,
    useMap: () => ({
      flyTo: vi.fn(),
      setView: (center: [number, number], zoom: number) => {
        setViewCalls.push({ center, zoom });
      },
    }),
    useMapEvents: () => null,
  };
});
```

Add a new test at the bottom of the `describe`:

```tsx
  it('pans map to user location exactly once on first fix', async () => {
    setViewCalls.length = 0;
    const userLocation: UserLocation = {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 25,
    };
    const { rerender } = render(
      <FieldOpsMap
        stations={[]}
        interference={[]}
        selection={null}
        onSelect={vi.fn()}
        flyTarget={null}
        userLocation={userLocation}
      />
    );

    expect(setViewCalls).toHaveLength(1);
    expect(setViewCalls[0].center).toEqual([13.7563, 100.5018]);

    rerender(
      <FieldOpsMap
        stations={[]}
        interference={[]}
        selection={null}
        onSelect={vi.fn()}
        flyTarget={null}
        userLocation={{ latitude: 14.0, longitude: 101.0, accuracy: 30 }}
      />
    );

    expect(setViewCalls).toHaveLength(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/field-ops-map-location.test.tsx`
Expected: FAIL — no `setView` call recorded.

- [ ] **Step 3: Implement `InitialLocationPan` in `FieldOpsMap.tsx`**

Ensure `useEffect` and `useRef` are imported (locate the existing React import at the top of the file and add them if missing):

```ts
import { useEffect, useMemo, useRef } from "react";
```

Just above the `FieldOpsMap` function definition, add:

```tsx
function InitialLocationPan({ location }: { location: UserLocation | undefined }) {
  const map = useMap();
  const didPanRef = useRef(false);
  useEffect(() => {
    if (didPanRef.current) return;
    if (!location) return;
    map.setView([location.latitude, location.longitude], 13);
    didPanRef.current = true;
  }, [location, map]);
  return null;
}
```

In the JSX, mount the sub-component just before the `userLocation` marker:

```tsx
      <InitialLocationPan location={userLocation} />
      {userLocation && (
        <Marker
          position={[userLocation.latitude, userLocation.longitude]}
          icon={createLocationIcon({ heading: null })}
        />
      )}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/field-ops-map-location.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/field-ops-map-location.test.tsx src/components/field-ops/FieldOpsMap.tsx
git commit -m "feat(field-ops): auto-pan map to user location on first fix"
```

---

## Task 6: Location status badge in `FieldOpsHeader`

**Files:**
- Create: `src/__tests__/field-ops-header-location.test.tsx`
- Modify: `src/components/field-ops/FieldOpsHeader.tsx`
- Modify: `src/components/field-ops/FieldOpsClient.tsx`

- [ ] **Step 1: Write the failing test for the status badge**

Create `src/__tests__/field-ops-header-location.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { FieldOpsHeader } from '@/components/field-ops/FieldOpsHeader';

describe('FieldOpsHeader — location badge', () => {
  const baseProps = {
    stations: [],
    interference: [],
    type: 'ALL' as const,
    theme: 'dark' as const,
    onToggleTheme: vi.fn(),
  };

  it('renders "Locating…" while status is locating', () => {
    const { container } = render(
      <FieldOpsHeader {...baseProps} locationStatus="locating" onRetryLocation={vi.fn()} />
    );
    expect(container.textContent).toContain('LOCATING');
  });

  it('renders accuracy when status is granted and userLocation has accuracy', () => {
    const { container } = render(
      <FieldOpsHeader
        {...baseProps}
        locationStatus="granted"
        userLocation={{ latitude: 13.75, longitude: 100.5, accuracy: 42 }}
        onRetryLocation={vi.fn()}
      />
    );
    expect(container.textContent).toContain('±42m');
  });

  it('renders "Enable location" button when denied; clicking calls onRetryLocation', () => {
    const retry = vi.fn();
    const { container } = render(
      <FieldOpsHeader {...baseProps} locationStatus="denied" onRetryLocation={retry} />
    );
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').toLowerCase().includes('enable')
    );
    expect(btn).toBeDefined();
    fireEvent.click(btn!);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/field-ops-header-location.test.tsx`
Expected: FAIL — `locationStatus` prop unknown.

- [ ] **Step 3: Add props and badge to `FieldOpsHeader.tsx`**

At the top of `FieldOpsHeader.tsx`, add:

```ts
import type { UserLocation } from "@/types/station";
import type { GeolocationStatus } from "@/hooks/useGeolocation";
```

Update the `FieldOpsHeader` function signature:

```tsx
export function FieldOpsHeader({
  stations,
  interference,
  type,
  theme,
  onToggleTheme,
  isMobile = false,
  onOpenDrawer,
  locationStatus,
  userLocation,
  onRetryLocation,
}: {
  stations: FMStation[];
  interference: InterferenceSite[];
  type: TypeFilter;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  isMobile?: boolean;
  onOpenDrawer?: () => void;
  locationStatus?: GeolocationStatus;
  userLocation?: UserLocation;
  onRetryLocation?: () => void;
}) {
```

Add a `LocationBadge` sub-component at the bottom of the file:

```tsx
function LocationBadge({
  status,
  userLocation,
  onRetry,
  accentText,
  labelColor,
}: {
  status: GeolocationStatus | undefined;
  userLocation: UserLocation | undefined;
  onRetry: (() => void) | undefined;
  accentText: string;
  labelColor: string;
}) {
  if (!status || status === 'unsupported') return null;

  const pillStyle: React.CSSProperties = {
    padding: '6px 12px',
    border: `1px solid ${accentText}`,
    color: accentText,
    borderRadius: 999,
    fontSize: 10,
    letterSpacing: '0.16em',
    background: 'transparent',
    cursor:
      status === 'denied' || status === 'timeout' || status === 'unavailable'
        ? 'pointer'
        : 'default',
  };

  if (status === 'locating') {
    return <div className="fo-mono" style={pillStyle}>○ LOCATING…</div>;
  }
  if (status === 'granted') {
    const acc = userLocation?.accuracy;
    const label = acc != null ? `● ±${Math.round(acc)}m` : '● LOCATED';
    return <div className="fo-mono" style={pillStyle}>{label}</div>;
  }
  const buttonLabel = status === 'denied' ? '⚠ ENABLE LOCATION' : '↻ RETRY LOCATION';
  return (
    <button
      type="button"
      className="fo-mono"
      onClick={onRetry}
      style={{ ...pillStyle, color: labelColor, borderColor: labelColor }}
    >
      {buttonLabel}
    </button>
  );
}
```

Mount the badge inside the existing desktop `<header>`, just before the theme-toggle button (line ~93):

```tsx
      <LocationBadge
        status={locationStatus}
        userLocation={userLocation}
        onRetry={onRetryLocation}
        accentText={accentText}
        labelColor={labelColor}
      />
```

For the mobile header, update `MobileHeader`'s props and JSX. Replace its parameter destructure block (line ~180):

```tsx
function MobileHeader({
  scopeLabel,
  headerBg,
  textColor,
  borderColor,
  accentText,
  onOpenDrawer,
  locationStatus,
  userLocation,
  onRetryLocation,
  labelColor,
}: {
  scopeLabel: string;
  headerBg: string;
  textColor: string;
  borderColor: string;
  accentText: string;
  onOpenDrawer?: () => void;
  locationStatus?: GeolocationStatus;
  userLocation?: UserLocation;
  onRetryLocation?: () => void;
  labelColor: string;
}) {
```

Inside the `MobileHeader` JSX, right before the closing `</header>`, append:

```tsx
      <LocationBadge
        status={locationStatus}
        userLocation={userLocation}
        onRetry={onRetryLocation}
        accentText={accentText}
        labelColor={labelColor}
      />
```

Update the `MobileHeader` invocation inside the early-return `if (isMobile)` block (line ~38):

```tsx
    return <MobileHeader
      scopeLabel={scopeLabel}
      headerBg={headerBg}
      textColor={textColor}
      borderColor={borderColor}
      accentText={accentText}
      onOpenDrawer={onOpenDrawer}
      locationStatus={locationStatus}
      userLocation={userLocation}
      onRetryLocation={onRetryLocation}
      labelColor={labelColor}
    />;
```

- [ ] **Step 4: Wire the badge props through in `FieldOpsClient.tsx`**

In `FieldOpsClient.tsx`, remove the `// eslint-disable-next-line` from Task 4 (no longer needed). Update the `<FieldOpsHeader>` call (around line 389) to pass the new props:

```tsx
      <FieldOpsHeader
        stations={filteredStations}
        interference={filteredInterference}
        type={filters.type}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        isMobile={isMobile}
        onOpenDrawer={() => setDrawerOpen(true)}
        locationStatus={locationStatus}
        userLocation={userLocation}
        onRetryLocation={retryLocation}
      />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/field-ops-header-location.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 6: Run all field-ops tests for sanity**

Run: `npx vitest run src/__tests__/field-ops-`
Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add src/__tests__/field-ops-header-location.test.tsx src/components/field-ops/FieldOpsHeader.tsx src/components/field-ops/FieldOpsClient.tsx
git commit -m "feat(field-ops): location status badge in header with retry"
```

---

## Task 7: "Recenter on me" floating button on the map

**Files:**
- Modify: `src/__tests__/field-ops-map-location.test.tsx`
- Modify: `src/components/field-ops/FieldOpsMap.tsx`

- [ ] **Step 1: Write the failing test for the recenter button**

Append inside `describe('FieldOpsMap — current location pin', ...)`:

```tsx
  it('renders a "Recenter" button when userLocation is provided; clicking re-pans', () => {
    setViewCalls.length = 0;
    const userLocation: UserLocation = {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 25,
    };
    const { container } = render(
      <FieldOpsMap
        stations={[]}
        interference={[]}
        selection={null}
        onSelect={vi.fn()}
        flyTarget={null}
        userLocation={userLocation}
      />
    );

    // First call is the auto-pan from Task 5.
    expect(setViewCalls).toHaveLength(1);

    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.getAttribute('aria-label') ?? '').toLowerCase().includes('recenter')
    );
    expect(btn).toBeDefined();
    btn!.click();

    expect(setViewCalls).toHaveLength(2);
    expect(setViewCalls[1].center).toEqual([13.7563, 100.5018]);
  });

  it('does NOT render the Recenter button when userLocation is undefined', () => {
    const { container } = render(
      <FieldOpsMap
        stations={[]}
        interference={[]}
        selection={null}
        onSelect={vi.fn()}
        flyTarget={null}
      />
    );
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.getAttribute('aria-label') ?? '').toLowerCase().includes('recenter')
    );
    expect(btn).toBeUndefined();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/field-ops-map-location.test.tsx`
Expected: FAIL — no recenter button.

- [ ] **Step 3: Add the recenter button to `FieldOpsMap.tsx`**

Add a new sub-component just below `InitialLocationPan`:

```tsx
function RecenterButton({ location }: { location: UserLocation }) {
  const map = useMap();
  return (
    <button
      type="button"
      aria-label="Recenter map on my location"
      onClick={() => {
        map.setView([location.latitude, location.longitude], 14);
      }}
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        zIndex: 500,
        padding: '8px 12px',
        borderRadius: 999,
        border: '1px solid rgba(0, 30, 43, 0.2)',
        background: 'rgba(255, 255, 255, 0.92)',
        color: '#001e2b',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.18)',
        cursor: 'pointer',
        fontSize: 12,
        letterSpacing: '0.12em',
      }}
      className="fo-mono"
    >
      ◎ ME
    </button>
  );
}
```

Mount it inside the `<MapContainer>` after `<FlyTo target={flyTarget} />`:

```tsx
      <FlyTo target={flyTarget} />
      {userLocation && <RecenterButton location={userLocation} />}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/__tests__/field-ops-map-location.test.tsx`
Expected: PASS — 5 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/field-ops-map-location.test.tsx src/components/field-ops/FieldOpsMap.tsx
git commit -m "feat(field-ops): floating recenter-on-me button"
```

---

## Task 8: Final integration check + dev-server smoke

**Files:** none modified

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: all new tests pass (pre-existing failures from the branch's BASE remain unchanged).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no new warnings.

- [ ] **Step 3: Verify dev build compiles**

Run: `tmux new-session -d -s dev 'npm' 'run' 'dev' && sleep 4 && tmux capture-pane -t dev -p | tail -10`
Expected: `✓ Ready in …ms`. (Or, if dev tmux already exists, `tmux capture-pane -t dev -p | tail -10`.)

- [ ] **Step 4: Manual verification checklist (user)**

The agent cannot do this — flag for the user:

1. Open http://localhost:3000 in Chrome.
2. Chrome prompts for Location → **Allow**.
3. Map pans to your location within ~2 seconds, shows a cyan dot (no cone, no rotation).
4. Header badge transitions from `○ LOCATING…` to `● ±NNm`.
5. Pan the map away, click `◎ ME` (bottom-right) → map snaps back to your current location.
6. Walk around with phone (or change emulated location in devtools → Sensors) → dot follows you. Map does NOT auto-pan (you control the view). Click `◎ ME` to re-center.
7. Chrome devtools → Application → Permissions → Location = **Block**, reload → header shows `⚠ ENABLE LOCATION` (clickable retry).

---

## Self-Review

**Spec coverage (against the user's constraints):**
- ✅ Show current location pin when user opens webapp → Tasks 3 + 4 + 5 (render marker, wire hook, auto-pan on first fix).
- ✅ Pin moves as user moves → Task 1 wires `watchPosition()`; Task 2 verifies the watch callback updates `userLocation`.
- ✅ NO heading cone / NO rotation → Task 1 omits `heading`/`speed` from `userLocation`; Task 2 asserts those fields are `undefined`; Task 3 asserts the rendered HTML does NOT contain `heading-cone`. `createLocationIcon({ heading: null })` produces just the cyan dot.
- ✅ No third-party library → hook uses only `navigator.geolocation` (browser-native).

**Placeholder scan:** none — every step shows exact code and command.

**Type consistency:**
- `GeolocationStatus` exported from `useGeolocation.ts` (Task 1), imported by `FieldOpsHeader.tsx` (Task 6). Matches.
- `UserLocation` from `src/types/station.ts` is used everywhere; only the `latitude`/`longitude`/`accuracy` fields are populated by this hook (the legacy `heading`/`speed`/`stale` optional fields stay `undefined`, which is allowed by the type).
- `useGeolocation()` returns `{ userLocation, status, retry }`; destructured as `{ userLocation, status: locationStatus, retry: retryLocation }` in `FieldOpsClient.tsx`. Matches.
- `createLocationIcon({ heading: null })` matches the existing `LocationIconOptions` signature in `mapHelpers.ts`.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-13-field-ops-current-location.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute in this session using `executing-plans` with checkpoints.

Which approach?
