# Filter Pins Disappear Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the field-ops map from intermittently losing all pins when the user changes filters in rapid succession.

**Architecture:** The field-ops home page (`/`) renders `FieldOpsMap.tsx`, which mounts a single `<MarkerClusterGroup>` from `react-leaflet-cluster@4.1.3` with `chunkedLoading` enabled. `chunkedLoading` delegates marker insertion to Leaflet's async `addLayers` chunker. When React rerenders children faster than a chunk completes (the user is on mobile, toggling filters), the cluster's internal layer state diverges from React's children list and the cluster's `removeLayer`/`addLayer` calls for the next render fire against an inconsistent base — markers can be silently dropped or the entire cluster can clear. Removing `chunkedLoading` makes marker reconciliation synchronous and deterministic. The dataset is moderate (low thousands of FM + interference rows), so synchronous add is fast enough to render in one frame and avoid the race entirely.

**Tech Stack:** React 19, Next.js 15, react-leaflet 5.0.0, react-leaflet-cluster 4.1.3, leaflet.markercluster 1.5.3, Vitest + @testing-library/react

---

## Investigation Summary

- **Symptom (user-reported):** "filter sometime pin map it all gone" — intermittently, after toggling filters (TYPE / PROVINCE / STATUS / search), every marker on the map disappears.
- **Affected surface:** `/` (the home page) → `FieldOpsFetcher` → `FieldOpsClient` → `FieldOpsMap`. The legacy `OptimizedFMStationClient`/`Map.tsx` is no longer wired to any route, so its plain `<Marker>` rendering is not in scope.
- **Filter logic is correct.** `fmStationMatchesFilter` (`src/components/field-ops/FieldOpsClient.tsx:48-63`) and `filteredInterference` (lines 155-170) are pure functions of `(stations, filters)` / `(interference, filters)` — they don't mutate state, and existing unit tests in `src/__tests__/field-ops-filters.test.ts` and `field-ops-filter-status.test.tsx` cover the predicate behaviour. The bug is in marker rendering, not filtering.
- **Root cause:** `src/components/field-ops/FieldOpsMap.tsx:472` — `<MarkerClusterGroup chunkedLoading …>`. With `chunkedLoading`, `leaflet.markercluster`'s `addLayers` splits work across animation frames. `react-leaflet-cluster` (v4) treats marker children as a flat array and uses React's reconciliation to call `addLayer`/`removeLayer` on the underlying cluster group; it does not wait for the chunker to finish before applying the next React update. Rapid filter toggles interleave chunked inserts and synchronous removes, leaving the cluster's internal `_featureGroup` empty.
- **Fix scope:** One file (`FieldOpsMap.tsx`), one prop removed. Add a regression test that asserts the props we pass to `MarkerClusterGroup` do **not** include `chunkedLoading`, so we don't silently regress.

---

### Task 1: Baseline — confirm current tests are green before changing anything

**Files:** (none modified)

- [ ] **Step 1: Run the full test suite to lock in baseline**

Run: `npm test`

Expected: full suite passes. If anything is red on `main`, capture which tests so the post-fix run can be compared apples-to-apples.

- [ ] **Step 2: Sanity-check the file you're about to edit**

Run: `grep -n "chunkedLoading" src/components/field-ops/FieldOpsMap.tsx`

Expected: exactly one match on the `<MarkerClusterGroup>` opening tag (today line 472). If you see zero matches, someone else already removed it — stop and re-check `git log`.

---

### Task 2: Remove `chunkedLoading` from the field-ops MarkerClusterGroup

**Files:**
- Modify: `src/components/field-ops/FieldOpsMap.tsx:471-479`

- [ ] **Step 1: Read the current MarkerClusterGroup opening tag**

Open `src/components/field-ops/FieldOpsMap.tsx` and locate the `<MarkerClusterGroup>` element (search for `MarkerClusterGroup`). It currently looks like:

```tsx
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={45}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        iconCreateFunction={(c: { getChildCount: () => number }) =>
          makeClusterIcon(c.getChildCount())
        }
      >
```

- [ ] **Step 2: Remove the `chunkedLoading` line and add a one-line comment explaining the choice**

Replace the block above with:

```tsx
      {/*
        NOTE: do NOT re-enable `chunkedLoading`. It races with React updates
        when the user toggles filters quickly — pins can disappear entirely.
        Synchronous addLayers handles the current dataset comfortably.
      */}
      <MarkerClusterGroup
        maxClusterRadius={45}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        iconCreateFunction={(c: { getChildCount: () => number }) =>
          makeClusterIcon(c.getChildCount())
        }
      >
```

This is the WHY-comment exception in CLAUDE.md: a footgun that a future reader would otherwise re-enable for "perf wins".

- [ ] **Step 3: Lint + typecheck the file**

Run: `npx eslint src/components/field-ops/FieldOpsMap.tsx && npx tsc --noEmit`

Expected: zero errors, zero new warnings.

---

### Task 3: Add a regression test that pins `chunkedLoading` off

The actual race only manifests in a real browser (jsdom doesn't run Leaflet's chunker), so we can't reproduce the symptom in vitest. What we **can** pin is the contract: the field-ops map must not pass `chunkedLoading` to `MarkerClusterGroup`. A future "perf cleanup" PR that re-enables it will fail this test instead of silently regressing the bug.

**Files:**
- Create: `src/__tests__/field-ops-map-no-chunked-loading.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/field-ops-map-no-chunked-loading.test.tsx` with:

```tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the "all pins disappear on filter change" bug.
 *
 * react-leaflet-cluster@4.1.3 + chunkedLoading races with React updates:
 * when the user rapidly toggles filters, Leaflet's chunked addLayers can
 * still be running when React fires the next remove/add round, leaving the
 * cluster's internal feature group empty. Removing the prop is the fix; this
 * test pins that decision so it survives future "perf" cleanups.
 *
 * We assert against the source string rather than mounting the component
 * because jsdom doesn't exercise the cluster's chunker — there's no
 * runtime symptom to assert on.
 */
describe("FieldOpsMap — chunkedLoading guard", () => {
  it("must NOT pass chunkedLoading to MarkerClusterGroup", () => {
    const src = readFileSync(
      resolve(__dirname, "../components/field-ops/FieldOpsMap.tsx"),
      "utf8"
    );
    const clusterBlock = src.match(/<MarkerClusterGroup[\s\S]*?>/);
    expect(clusterBlock, "MarkerClusterGroup tag not found").not.toBeNull();
    expect(clusterBlock![0]).not.toMatch(/\bchunkedLoading\b/);
  });
});
```

- [ ] **Step 2: Run the new test to confirm it PASSES (after Task 2's edit) and would FAIL if chunkedLoading were re-added**

Run: `npx vitest run src/__tests__/field-ops-map-no-chunked-loading.test.tsx`

Expected: PASS.

Then, as a sanity check, temporarily re-add `chunkedLoading` in `FieldOpsMap.tsx`, rerun the test, confirm it FAILS, and then remove `chunkedLoading` again. (Do this *before* committing.)

---

### Task 4: Full test suite + lint after the fix

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: All tests pass, including the new `field-ops-map-no-chunked-loading.test.tsx`. Total test count should be exactly +1 vs Task 1 baseline.

- [ ] **Step 2: Run lint across the project**

Run: `npm run lint`

Expected: no new warnings or errors.

---

### Task 5: Manual verification in a real browser

This is the only step that actually exercises the race. Do not skip it — the unit test pins the code but only a real Leaflet runtime can prove the symptom is gone.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

Expected: dev server boots at `http://localhost:3000`.

- [ ] **Step 2: Open in a real mobile device or Chrome DevTools with CPU throttling**

Open Chrome → DevTools → Performance tab → CPU throttling = 4x slowdown. Navigate to `http://localhost:3000`. Log in if prompted.

- [ ] **Step 3: Reproduce the original symptom on `main` (optional, for confidence)**

If you want concrete before/after, `git stash` the fix, restart dev server, and try Step 4 below. Pins will sometimes vanish entirely. Unstash to restore the fix.

- [ ] **Step 4: Verify the fix**

With the fix applied, on the throttled browser:

1. Rapidly tap TYPE chips: ALL → FM → INT → ALL → FM → INT (≈1 tap/300 ms, 6+ cycles).
2. Rapidly change PROVINCE: All → some province → All → another province (5+ cycles).
3. Rapidly toggle STATUS: ALL → PENDING → INSPECTED → OFF AIR → REVOKED → ALL.
4. Type in the search box: `a`, `ab`, `abc`, then backspace down to empty.

After each interaction, pins must redraw consistently. There should be **no** state where pins are entirely missing despite filters that match data. The visible count in the FieldOpsHeader (`X FM · Y INT`) should always agree with the number of pins on the map (modulo clustering).

- [ ] **Step 5: Stage and commit (DO NOT push — wait for explicit user instruction per CLAUDE.md)**

Files changed:
- `src/components/field-ops/FieldOpsMap.tsx` (drop `chunkedLoading`, add WHY comment)
- `src/__tests__/field-ops-map-no-chunked-loading.test.tsx` (new regression test)

Run:

```bash
git add src/components/field-ops/FieldOpsMap.tsx src/__tests__/field-ops-map-no-chunked-loading.test.tsx
git commit -m "$(cat <<'EOF'
fix: stop field-ops pins from disappearing on filter changes

react-leaflet-cluster@4.1.3 with chunkedLoading races against React
updates: when the user toggles filters faster than Leaflet's chunked
addLayers completes, the cluster's internal feature group diverges
from the React children list and all markers vanish.

Drop chunkedLoading — the dataset is small enough that synchronous
addLayers renders in one frame. Add a regression test that pins the
prop off so a future "perf" cleanup can't silently bring the bug back.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: hooks pass, commit succeeds. `git status` afterwards should be clean except for any unrelated tracked files.

---

## Notes for the executor

- **Do NOT push or open a PR.** The user's CLAUDE.md is explicit: "Do not commit and push to GitHub. Wait for explicit command." Stop after the local commit.
- If `npm test` fails for a reason unrelated to this fix (pre-existing red on `main`), surface that to the user before commiting — do not paper over a broken baseline.
- If Step 4 still shows pins disappearing after the fix, this plan's hypothesis is incomplete. Next steps to try (do not implement without consulting the user):
  - Memoize the children arrays and pass them as a stable prop.
  - Add a `key={\`fm:${filteredStations.length}|int:${filteredInterference.length}\`}` on `<MarkerClusterGroup>` to force remount when dataset size changes drastically.
  - Drop `react-leaflet-cluster` in favour of imperative `L.markerClusterGroup` + manual `addLayers`/`removeLayers` with batching that respects React updates.
