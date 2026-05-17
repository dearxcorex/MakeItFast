# Mobile Crew Indicator Visibility Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MY CREW indicator visible at a glance on mobile (currently only reachable via ☰ → drawer).

**Architecture:** Surface a compact `CrewIndicator` (icon + count badge, or just icon for "solo") in `MobileHeader`'s right cluster, immediately before `<UserChip>`. Keep the full pill in the drawer as a secondary entry point so the spec's design isn't regressed.

**Tech Stack:** Next.js 15 client component, inline-styled React, no new deps. Re-uses `CrewIndicator`'s existing `compact={true}` branch.

---

## Background — what's there now

- **Desktop header** (`FieldOpsHeader.tsx` non-mobile branch, line 121): renders `<CrewIndicator compact={false}>` between `<LocationBadge>` and theme toggle.
- **Mobile drawer** (`FieldOpsDrawer.tsx` line 168): renders a row with `<CrewIndicator compact={false}>` — only visible after tapping ☰.
- **Mobile header** (`MobileHeader` sub-component inside `FieldOpsHeader.tsx`, lines 213-284): currently shows ☰ button, scope label, `<LocationBadge>`, `<UserChip>`. **No `CrewIndicator`.**

## Behavior after the fix

| State | Mobile header shows |
|---|---|
| `defaultCrew === null` (undecided) | Nothing (modal handles first prompt) |
| `defaultCrew === []` (solo) | `🧑` icon button (no number — "0" would be confusing) |
| `defaultCrew.length >= 1` (crew) | `🧑 N` (icon + count badge) |

Tapping it opens the modal directly (no drawer detour). The drawer row stays as-is for users who land there first.

## File Structure

- Modify: `src/components/field-ops/CrewIndicator.tsx` — fix compact-mode rendering when crew is empty (show icon only, not "🧑 0").
- Modify: `src/components/field-ops/FieldOpsHeader.tsx` — thread the three crew props into `MobileHeader`, render `<CrewIndicator compact={true}>` in its right cluster.
- Modify: `src/__tests__/crew-indicator.test.tsx` — update the "compact mode shows only the count badge" test to also cover the solo case.

No new test file needed; no schema change; no API change.

---

## Task 1: Fix compact-mode rendering for empty crew + surface indicator in mobile header

**Files:**
- Modify: `src/components/field-ops/CrewIndicator.tsx` (compact branch around lines 41-56)
- Modify: `src/components/field-ops/FieldOpsHeader.tsx` (`MobileHeader` sub-component, lines 213-284)
- Modify: `src/__tests__/crew-indicator.test.tsx` (compact mode test case)

- [ ] **Step 1: Write the failing test for the empty-compact behavior**

Open `src/__tests__/crew-indicator.test.tsx`. Find the existing `it('compact mode shows only the count badge', …)` test (around line 60). Replace it with:

```tsx
  it('compact mode shows the count badge when crew is non-empty', () => {
    const { container } = render(
      <CrewIndicator
        defaultCrew={[6, 7]}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={true}
      />,
    );
    expect(container.textContent).toContain('2');
    expect(container.textContent).not.toContain('daf');
  });

  it('compact mode renders icon only (no zero) when crew is solo', () => {
    const { container, getByRole } = render(
      <CrewIndicator
        defaultCrew={[]}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={true}
      />,
    );
    // Button is rendered (re-openable) but does NOT show "0" — that would be
    // confusing. The 🧑 icon alone signals "you've chosen solo".
    expect(getByRole('button')).toBeTruthy();
    expect(container.textContent).not.toContain('0');
    // No names either (compact mode never shows names).
    expect(container.textContent).not.toContain('daf');
  });
```

- [ ] **Step 2: Run the new tests — expect 1 PASS, 1 FAIL**

```bash
npx vitest run src/__tests__/crew-indicator.test.tsx -t "compact mode"
```

Expected: the first new test passes (existing behavior covers it); the second new test FAILS because the current compact branch always renders `{defaultCrew.length}` which is `0` for solo.

- [ ] **Step 3: Fix `CrewIndicator` compact-mode rendering**

In `src/components/field-ops/CrewIndicator.tsx`, find the compact branch (lines 41-56):

```tsx
  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="My crew"
        style={{ ...baseBtn, padding: '6px 10px' }}
      >
        <span aria-hidden>🧑</span>
        <span>{defaultCrew.length}</span>
      </button>
    );
  }
```

Replace with:

```tsx
  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={defaultCrew.length === 0 ? 'My crew (solo)' : 'My crew'}
        style={{ ...baseBtn, padding: '6px 10px' }}
      >
        <span aria-hidden>🧑</span>
        {defaultCrew.length > 0 && <span>{defaultCrew.length}</span>}
      </button>
    );
  }
```

- [ ] **Step 4: Run all CrewIndicator tests — expect 7 PASS (6 existing + 1 new)**

```bash
npx vitest run src/__tests__/crew-indicator.test.tsx
```

The original "compact mode shows only the count badge" test was renamed in Step 1 to "shows the count badge when crew is non-empty" and a sibling solo case was added. Total goes from 6 → 7.

- [ ] **Step 5: Thread the crew props into `MobileHeader`**

Open `src/components/field-ops/FieldOpsHeader.tsx`. Find the desktop branch's destructure (around line 22-32) — it already receives `defaultCrew`, `inspectors`, `onOpenCrew`. Now route them into `MobileHeader`.

Find the early-return for mobile (around line 46-58):

```tsx
  if (isMobile) {
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
  }
```

Replace with:

```tsx
  if (isMobile) {
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
      defaultCrew={defaultCrew}
      inspectors={inspectors}
      onOpenCrew={onOpenCrew}
    />;
  }
```

- [ ] **Step 6: Update `MobileHeader` signature and render the compact indicator**

Still in `FieldOpsHeader.tsx`, find the `MobileHeader` function signature (around line 213-235):

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

Add three optional props to both the destructure and the type:

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
  defaultCrew,
  inspectors,
  onOpenCrew,
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
  defaultCrew?: number[] | null;
  inspectors?: { id: number; username: string; displayName: string }[];
  onOpenCrew?: () => void;
}) {
```

Then in the `MobileHeader` return JSX (around line 274-282), insert the compact indicator **between `<LocationBadge … />` and `<UserChip … />`**:

```tsx
      <LocationBadge
        status={locationStatus}
        userLocation={userLocation}
        onRetry={onRetryLocation}
        accentText={accentText}
        labelColor={labelColor}
      />
      {onOpenCrew && (
        <CrewIndicator
          defaultCrew={defaultCrew ?? null}
          inspectors={inspectors ?? []}
          onOpen={onOpenCrew}
          compact={true}
        />
      )}
      <UserChip accentText={accentText} textColor={textColor} borderColor={borderColor} compact />
```

(`CrewIndicator` is already imported at the top of the file from when Task 9 of the prior plan wired the desktop branch.)

- [ ] **Step 7: Run the full field-ops regression suite to confirm no break**

```bash
npx vitest run src/__tests__/field-ops-current.test.tsx src/__tests__/field-ops-crew-bootstrap.test.tsx src/__tests__/field-ops-drawer.test.tsx src/__tests__/crew-indicator.test.tsx
```

Expected: existing pass counts hold (field-ops-current 7/7, field-ops-crew-bootstrap 4/4, field-ops-drawer same baseline including the 1 pre-existing fail), plus CrewIndicator 7/7.

- [ ] **Step 8: Manual smoke test (mobile viewport)**

Confirm the dev server is up:

```bash
tmux capture-pane -t dev -p | tail -5
```

Open `http://localhost:3000/field-ops` in DevTools mobile emulation (width < 900px).
- If `defaultCrew` is `null` (undecided): modal pops, indicator is NOT yet in the header. After saving/skipping, header should show the compact pill.
- If `defaultCrew` is `[]` (solo): header right cluster shows `🧑` (icon only, no `0`).
- If `defaultCrew` is `[6, 7]` (chosen crew): header shows `🧑 2`. Tap → modal opens directly.
- Drawer still has the full "MY CREW · …" row as a secondary entry point.

- [ ] **Step 9: Commit**

```bash
git add src/components/field-ops/CrewIndicator.tsx src/components/field-ops/FieldOpsHeader.tsx src/__tests__/crew-indicator.test.tsx
git commit -m "$(cat <<'EOF'
fix(field-ops): surface CrewIndicator in mobile header

Previously the MY CREW pill only lived in FieldOpsDrawer on
mobile (2 taps deep: ☰ → MY CREW row). Add a compact
CrewIndicator (icon + count badge, or icon alone when "solo")
to MobileHeader's right cluster so the current crew is
visible at a glance and one-tap re-openable. Drawer row stays
as a secondary entry point.

Side fix: CrewIndicator compact mode no longer renders "🧑 0"
for the solo state — that count was misleading. The icon
alone signals "you've chosen to work solo"; the aria-label
distinguishes the two cases for screen readers.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** The original spec said the mobile indicator "collapses to the icon + count badge (e.g., `🧑 2`) and lives in the existing drawer button row, not inline in the header." User feedback contradicts that placement — they couldn't find it. This plan amends the choice to inline-in-header AND drawer (drawer kept as backup).
- **Placeholder scan:** All code blocks complete; all paths exact.
- **Type consistency:** `defaultCrew?: number[] | null`, `inspectors?: { id, username, displayName }[]`, `onOpenCrew?: () => void` match the desktop header's existing prop shape exactly.
- **No new files; no schema; no API changes.**
- **One commit, one task** — small enough to land atomically.
