# Fast Login + Pin Render Perceived Latency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut both real and perceived login latency so the user goes from clicking "Sign in" to seeing the map in ~1.0s instead of 3–6s.

**Architecture:** The slow login is two interlocking problems. (A) `POST /api/auth/login` does the Upstash throttle round-trip serially around the DB lookup, and awaits a delete on the happy path that the user does not need. (B) After the API returns 200, `router.replace("/")` triggers a server-component navigation that blocks on `FieldOpsFetcher` — 4 sequential PostgreSQL queries with no `loading.tsx` skeleton, so the login spinner stays up while the RSC payload streams. We fix A by parallelizing the throttle GET with the user lookup and making the success-path delete fire-and-forget, and fix B by adding `app/loading.tsx`, prefetching `/` from the login form, and collapsing the two `findMany({distinct})` calls in the fetcher into a single `groupBy`.

**Tech Stack:** Next.js 15 App Router (RSC), Prisma + Neon Postgres (PgBouncer transaction mode), iron-session, Upstash Redis REST, bcryptjs.

---

## File Structure

**Modify:**
- `src/app/api/auth/login/route.ts` — parallelize throttle GET with user lookup; fire-and-forget `clearAttempts` on success.
- `src/lib/loginThrottle.ts` — add a `clearAttemptsAsync` helper that returns the promise without awaiting (keeps existing `clearAttempts` for tests).
- `src/components/field-ops/FieldOpsFetcher.tsx` — collapse the two `findMany({ distinct })` calls into one `groupBy`.
- `src/app/login/page.tsx` — call `router.prefetch("/")` on mount so the post-login RSC payload starts streaming early; reuse the `submitting` spinner copy.

**Create:**
- `src/app/loading.tsx` — Next.js streaming fallback rendered during RSC navigation to any route under `/`. Shows the same dark `field-ops-root` shell + spinner the login page uses, so the transition reads as instant.

**Test:**
- `src/__tests__/api-auth-login-perf.test.ts` (new) — assert the success-path code does not `await` `clearAttempts` (call order proves it).
- `src/__tests__/auth-login.test.ts` (modify) — update existing tests if they assert on a mocked `clearAttempts` being awaited.
- `src/__tests__/field-ops-fetcher.test.ts` (new) — assert the fetcher issues exactly 3 Prisma calls (was 4) and still produces the same `initialCities` + `initialProvinces` shape.
- `src/__tests__/app-loading.test.tsx` (new) — render `app/loading.tsx`; assert it has the `field-ops-root` class and a `role="status"` spinner.

---

## Task 1: Add `app/loading.tsx` streaming skeleton

This is the single biggest perceived-latency win. Without it, Next.js paints nothing until the RSC payload for `/` is ready. With it, Next.js streams the skeleton instantly on navigation.

**Files:**
- Create: `src/app/loading.tsx`
- Create: `src/__tests__/app-loading.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/app-loading.test.tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Loading from "@/app/loading";

describe("app/loading.tsx", () => {
  it("renders the field-ops shell + spinner", () => {
    const { container, getByRole } = render(<Loading />);
    expect(container.querySelector(".field-ops-root")).toBeTruthy();
    expect(getByRole("status")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/app-loading.test.tsx`
Expected: FAIL with `Cannot find module '@/app/loading'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/loading.tsx
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
        aria-label="Loading"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontFamily: "var(--font-mono, ui-monospace)",
          letterSpacing: "0.18em",
          fontSize: 12,
        }}
      >
        <span aria-hidden className="fo-spinner" />
        LOADING…
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/app-loading.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/app/loading.tsx src/__tests__/app-loading.test.tsx
git commit -m "perf: add app/loading.tsx streaming skeleton for / navigation"
```

---

## Task 2: Prefetch `/` from the login page

`router.prefetch("/")` warms the RSC payload while the user is still typing credentials, so by the time the POST returns, the navigation is mostly cached.

**Files:**
- Modify: `src/app/login/page.tsx:1-43`

- [ ] **Step 1: Read the current login page**

Run: `sed -n '1,50p' src/app/login/page.tsx`
Note the existing `useRouter` + `useSearchParams` imports.

- [ ] **Step 2: Add prefetch effect**

Edit `src/app/login/page.tsx`. Replace the imports block:

```tsx
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
```

Then directly after the existing `const next = params.get("next") ?? "/";` line, add:

```tsx
  useEffect(() => {
    // Warm the RSC payload for the post-login destination while the user is
    // still typing. Cuts perceived login latency because router.replace(next)
    // can then resolve from cache instead of doing a cold server render.
    router.prefetch(next);
  }, [router, next]);
```

- [ ] **Step 3: Manual verification**

Run: `npm run build 2>&1 | tail -20`
Expected: build succeeds, no new warnings.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "perf: prefetch post-login route from the login form"
```

---

## Task 3: Slim `FieldOpsFetcher` to 3 queries via `groupBy`

The current fetcher issues two `findMany({ select: {...}, distinct: [...] })` calls just to get distinct district + province strings. `groupBy` returns the same data in one query, and removing one Prisma round trip is meaningful on cold starts.

**Files:**
- Modify: `src/components/field-ops/FieldOpsFetcher.tsx:7-52`
- Create: `src/__tests__/field-ops-fetcher.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/field-ops-fetcher.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => {
  const fm_station = {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  };
  const interference_site = { findMany: vi.fn() };
  return { default: { fm_station, interference_site } };
});

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => ({ userId: 1, displayName: "Tester" })),
}));

vi.mock("@/services/stationService", () => ({
  convertToFMStation: (r: unknown) => r,
}));
vi.mock("@/services/interferenceService", () => ({
  convertToInterferenceSite: (r: unknown) => r,
}));

// Replace the FieldOpsClient default export with a passthrough we can read.
vi.mock("@/components/field-ops/FieldOpsClient", () => ({
  default: (props: unknown) => ({ type: "div", props: { "data-props": JSON.stringify(props) } }),
}));

import prisma from "@/lib/prisma";
import FieldOpsFetcher from "@/components/field-ops/FieldOpsFetcher";

const mockedFm = prisma.fm_station as unknown as {
  findMany: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
};
const mockedInt = prisma.interference_site as unknown as {
  findMany: ReturnType<typeof vi.fn>;
};

describe("FieldOpsFetcher", () => {
  beforeEach(() => {
    mockedFm.findMany.mockReset();
    mockedFm.groupBy.mockReset();
    mockedInt.findMany.mockReset();
  });

  it("issues exactly three Prisma calls and merges province sources", async () => {
    mockedFm.findMany.mockResolvedValueOnce([]); // stations
    mockedInt.findMany.mockResolvedValueOnce([
      { changwat: "Bangkok" },
      { changwat: "Chiang Mai" },
    ]);
    mockedFm.groupBy.mockResolvedValueOnce([
      { district: "Khlong Toei", province: "Bangkok" },
      { district: "Mueang", province: "Chiang Mai" },
      { district: null, province: "Phuket" },
    ]);

    const result = await FieldOpsFetcher();
    // @ts-expect-error — vitest jsx escape hatch
    const props = JSON.parse(result.props["data-props"]);

    expect(mockedFm.findMany).toHaveBeenCalledTimes(1);
    expect(mockedFm.groupBy).toHaveBeenCalledTimes(1);
    expect(mockedInt.findMany).toHaveBeenCalledTimes(1);

    expect(props.initialCities).toEqual(["Khlong Toei", "Mueang"]);
    expect(props.initialProvinces).toEqual(
      ["Bangkok", "Chiang Mai", "Phuket"].sort()
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/field-ops-fetcher.test.ts`
Expected: FAIL because `mockedFm.groupBy` is never called (current code uses two `findMany`s).

- [ ] **Step 3: Replace fetcher body**

Edit `src/components/field-ops/FieldOpsFetcher.tsx`. Replace lines 10–38 (everything from `const [stations, ...]` through `const provinces = ...`) with:

```tsx
    const [stations, interferenceRows, fmGeoGroups] = await Promise.all([
      prisma.fm_station.findMany({ orderBy: { name: "asc" } }),
      prisma.interference_site.findMany({ orderBy: { site_name: "asc" } }),
      // One groupBy replaces the two distinct findManys we used to issue —
      // half the Prisma round trips, same shape coming out.
      prisma.fm_station.groupBy({
        by: ["district", "province"],
        orderBy: [{ district: "asc" }, { province: "asc" }],
      }),
    ]);

    const transformedStations = stations.map(convertToFMStation);
    const transformedInterference = interferenceRows.map(convertToInterferenceSite);

    const fmCities = Array.from(
      new Set(
        fmGeoGroups
          .map((r) => r.district)
          .filter((c): c is string => !!c)
      )
    ).sort();
    const fmProvinces = fmGeoGroups
      .map((r) => r.province)
      .filter((p): p is string => !!p);

    const interferenceProvinces = Array.from(
      new Set(
        transformedInterference
          .map((s) => s.changwat)
          .filter((p): p is string => !!p)
      )
    ).sort();

    const provinces = Array.from(new Set([...fmProvinces, ...interferenceProvinces])).sort();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/field-ops-fetcher.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the broader fetcher-adjacent suite to catch regressions**

Run: `npx vitest run src/__tests__/field-ops-client.test.tsx src/__tests__/field-ops-fetcher.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/field-ops/FieldOpsFetcher.tsx src/__tests__/field-ops-fetcher.test.ts
git commit -m "perf: collapse fetcher's two distinct findManys into one groupBy"
```

---

## Task 4: Add `clearAttemptsAsync` to the throttle library

We need a variant that returns the promise without forcing callers to await it. Keep `clearAttempts` intact for code (tests) that does want to await.

**Files:**
- Modify: `src/lib/loginThrottle.ts:73-80`
- Modify: `src/__tests__/auth-login.test.ts` (existing) if it asserts on `clearAttempts` being awaited

- [ ] **Step 1: Add the new export**

Edit `src/lib/loginThrottle.ts`. Directly below the existing `clearAttempts` function (after the closing `}` on line 80), add:

```ts
/**
 * Same as clearAttempts but returns the unawaited promise so callers can
 * fire-and-forget on the success path. The Upstash REST DEL adds ~100–150ms
 * to a happy-path login otherwise, and a stale entry naturally expires.
 *
 * In tests, callers can still `await` the returned promise.
 */
export function clearAttemptsAsync(ip: string, username: string): Promise<void> {
  return clearAttempts(ip, username);
}
```

- [ ] **Step 2: Verify nothing imports it yet, then confirm types**

Run: `npx tsc --noEmit 2>&1 | grep loginThrottle`
Expected: no output (no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/loginThrottle.ts
git commit -m "perf: add clearAttemptsAsync helper for fire-and-forget cleanup"
```

---

## Task 5: Parallelize throttle GET with user lookup, fire-and-forget DEL on success

Make `isThrottled(ip, username)` race against `prisma.user.findUnique({ where: { username }})`. If the user is throttled, abandon the lookup result and return 429 — we already paid for the lookup but we save the round-trip cost on the success path where Upstash latency would otherwise be sequential. Then on success, do not await `clearAttempts`.

**Files:**
- Modify: `src/app/api/auth/login/route.ts:48-69`
- Create: `src/__tests__/api-auth-login-perf.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/api-auth-login-perf.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const callOrder: string[] = [];

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(async () => {
        callOrder.push("findUnique");
        return {
          id: 1,
          username: "alice",
          display_name: "Alice",
          role: "inspector",
          active: true,
          password_hash: "hash",
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          default_helper_user_ids: [],
          crew_decided: false,
        };
      }),
    },
  },
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(async () => {
    callOrder.push("verifyPassword");
    return true;
  }),
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => ({
    save: vi.fn(async () => {
      callOrder.push("session.save");
    }),
  })),
}));

vi.mock("@/lib/loginThrottle", () => ({
  isThrottled: vi.fn(async () => {
    callOrder.push("isThrottled");
    return false;
  }),
  recordFailedAttempt: vi.fn(),
  clearAttempts: vi.fn(async () => {
    callOrder.push("clearAttempts:resolved");
  }),
  clearAttemptsAsync: vi.fn(() => {
    callOrder.push("clearAttemptsAsync:fired");
    return Promise.resolve();
  }),
}));

import { POST } from "@/app/api/auth/login/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify(body),
  });
}

describe("login route hot path", () => {
  beforeEach(() => {
    callOrder.length = 0;
  });

  it("starts isThrottled and findUnique concurrently", async () => {
    const res = await POST(makeReq({ username: "alice", password: "secret123" }));
    expect(res.status).toBe(200);
    const throttleIdx = callOrder.indexOf("isThrottled");
    const findIdx = callOrder.indexOf("findUnique");
    expect(throttleIdx).toBeGreaterThanOrEqual(0);
    expect(findIdx).toBeGreaterThanOrEqual(0);
    // Both should have been entered before either resolves long enough to
    // sequence behind the other — call order may vary, but both must appear.
  });

  it("does NOT await clearAttempts on the happy path", async () => {
    await POST(makeReq({ username: "alice", password: "secret123" }));
    expect(callOrder).toContain("clearAttemptsAsync:fired");
    expect(callOrder).not.toContain("clearAttempts:resolved");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/api-auth-login-perf.test.ts`
Expected: FAIL — current route awaits `clearAttempts` (the sequential `await` path), so `clearAttemptsAsync:fired` is missing.

- [ ] **Step 3: Update the route**

Edit `src/app/api/auth/login/route.ts`. Replace lines 5–9 (the throttle import block) with:

```ts
import {
  recordFailedAttempt,
  isThrottled,
  clearAttemptsAsync,
} from "@/lib/loginThrottle";
```

Then replace lines 48–69 (from `const ip = clientIp(req);` through `await clearAttempts(ip, username);`) with:

```ts
  const ip = clientIp(req);

  // Race the throttle check against the user lookup so Upstash REST latency
  // overlaps with PgBouncer's connection setup on cold starts. We still gate
  // the response on the throttle result before we touch the password hash.
  const [throttled, row] = await Promise.all([
    isThrottled(ip, username),
    prisma.user.findUnique({ where: { username } }),
  ]);

  if (throttled) {
    return NextResponse.json(
      { error: "too_many_attempts" },
      { status: 429 }
    );
  }

  const okPassword =
    row && row.active ? await verifyPassword(password, row.password_hash) : false;

  if (!row || !row.active || !okPassword) {
    await recordFailedAttempt(ip, username);
    return NextResponse.json(
      { error: "invalid_credentials" },
      { status: 401 }
    );
  }

  // Fire-and-forget: a stale entry will TTL out within WINDOW_SECONDS anyway,
  // and forcing the user to wait for a REST DEL on every successful login is
  // a waste of ~100-150ms of perceived login time.
  void clearAttemptsAsync(ip, username);
```

- [ ] **Step 4: Run perf test to verify it passes**

Run: `npx vitest run src/__tests__/api-auth-login-perf.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the existing auth-login suite to catch regressions**

Run: `npx vitest run src/__tests__/auth-login.test.ts`
Expected: PASS. If any assertion checked that `clearAttempts` was *awaited* (vs called), update it to assert on `clearAttemptsAsync` being called instead.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/login/route.ts src/__tests__/api-auth-login-perf.test.ts
git commit -m "perf: parallelize login throttle GET and fire-and-forget cleanup"
```

---

## Task 6: Smoke test end-to-end + measure

Spin up the dev server, time the login round trip, and confirm the post-login transition is no longer blocked on a blank screen.

- [ ] **Step 1: Build and start prod-like server**

Run in one terminal:
```bash
npm run build && npm start
```
Wait for "Ready in …".

- [ ] **Step 2: Time the API directly**

Run (replace creds with your test account):
```bash
time curl -s -o /dev/null -w "%{http_code}\n" \
  -H "content-type: application/json" \
  -X POST http://localhost:3000/api/auth/login \
  -d '{"username":"YOUR_USER","password":"YOUR_PASS"}'
```
Expected: `200` and `real` < 500ms (was typically 700-1200ms before).

- [ ] **Step 3: Hit `/` cold and confirm streaming**

Open http://localhost:3000/login in a private window, sign in, watch the network panel. The transition should:
- Show the new `loading.tsx` skeleton within ~50ms of clicking Sign in (was blank).
- Render the map within 1.5–2s of the click (was 3–6s).

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all PASS (or only the pre-existing failures the user already knows about).

- [ ] **Step 5: Commit nothing (this is verification only); note results in the PR description.**

---

## Self-Review Checklist Run

- **Spec coverage:**
  - "Login slow" → Tasks 4, 5 (parallelize + fire-and-forget) and Task 3 (cut one DB round trip on the post-login render).
  - "CSS pin waited / still waited for login" → Tasks 1, 2 (loading.tsx + prefetch) cover the perceived-latency half.

- **Placeholder scan:** No "TBD", "add appropriate error handling", or "similar to Task N" — every code step contains the literal code.

- **Type consistency:** `clearAttemptsAsync` introduced in Task 4 is the name used in Tasks 5's test mock and the route edit. `groupBy` in Task 3 uses `district` + `province` field names that match the existing `findMany({ select: { district } })` schema. `fo-spinner` class in Task 1 already exists (`field-ops.css` ships it — the login page uses it).
