# Tag Teammates on Inspect Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small inline "+ tag teammates" picker under the `✓ INSPECT` toggle in the field-ops desktop rail and mobile sheet, so the helpers a user picks at toggle-time are recorded with the new `station_inspection` row.

**Architecture:** New `<TeammatePicker>` component (collapsed-by-default, inline expand). `FieldOpsClient` regains inspectors fetch + `currentUser` pass-through + a `helperUserIds` state that resets on station change. Existing `PATCH /api/stations/:id` accepts an optional `helperUserIds` array and forwards it to the existing `createInspection` sidecar. Picker hidden once a station is INSPECTED.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma, Vitest + @testing-library/react. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-16-tag-teammates-on-toggle-design.md`

---

## File map

**Create:**
- `src/components/field-ops/TeammatePicker.tsx`
- `src/__tests__/teammate-picker.test.tsx`

**Modify:**
- `src/app/api/stations/[id]/route.ts` — pull `helperUserIds` from body, forward to `createInspection`.
- `src/__tests__/api-routes.test.ts` — extend the existing inspection-history-sidecar test to verify helpers are forwarded.
- `src/components/field-ops/FieldOpsFetcher.tsx` — read session, pass `currentUser` to client.
- `src/components/field-ops/FieldOpsClient.tsx` — `currentUser` prop, inspectors fetch, helperUserIds state + reset, send helpers on PATCH, pass-through to both consumers.
- `src/components/field-ops/FieldOpsCurrent.tsx` — `FieldOpsCurrentFM` accepts 4 new props, renders `<TeammatePicker>` on PENDING.
- `src/components/field-ops/FieldOpsBottomSheet.tsx` — accepts 4 new props, renders `<TeammatePicker>` on PENDING.
- `src/__tests__/field-ops-current.test.tsx` — add picker-on-PENDING / picker-absent-on-INSPECTED cases.

**Reuse, no changes:**
- `src/services/inspectionService.ts` — `createInspection` already validates helper IDs (active inspectors, no duplicates, helpers ⊄ {lead}, ≤5 helpers).
- `src/app/api/users/inspectors/route.ts` — already returns `{ users: [{ id, username, displayName }] }`.
- `src/lib/session.ts` — `getSession()` for server-side session read.

**Conventions verified in the codebase:**
- The PATCH handler at `src/app/api/stations/[id]/route.ts:62-80` already runs a `createInspection` sidecar on toggle-ON with `helperUserIds: []`. This plan only adds the wiring to replace `[]` with the body's `helperUserIds`.
- `FieldOpsFetcher` is a server component; `getSession()` is async-safe there (see prior pattern in commit `0e53889`, since reverted, for the exact shape).
- Tests render with `@testing-library/react`, use explicit `afterEach(() => cleanup())`, and stub `fetch` via `vi.stubGlobal('fetch', vi.fn())`.

---

## Task 1: `TeammatePicker` component + tests

**Files:**
- Create: `src/__tests__/teammate-picker.test.tsx`
- Create: `src/components/field-ops/TeammatePicker.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/__tests__/teammate-picker.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TeammatePicker from '@/components/field-ops/TeammatePicker';

afterEach(() => cleanup());

const ROSTER = [
  { id: 1, username: 'admin', displayName: 'Admin' },
  { id: 2, username: 'ice', displayName: 'ice' },
  { id: 3, username: 'iff', displayName: 'iff' },
  { id: 6, username: 'daf', displayName: 'daf' },
];

describe('TeammatePicker', () => {
  it('renders the collapsed link by default and excludes self', () => {
    render(
      <TeammatePicker
        inspectors={ROSTER}
        currentUserId={3}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /\+ tag teammates/i })).toBeTruthy();
    // helper checkboxes should not exist until expanded
    expect(screen.queryByLabelText('daf')).toBeNull();
    expect(screen.queryByLabelText('iff')).toBeNull(); // self always hidden
  });

  it('expands to show helper checkboxes (excluding self) when clicked', () => {
    render(
      <TeammatePicker
        inspectors={ROSTER}
        currentUserId={3}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /\+ tag teammates/i }));
    expect(screen.getByLabelText('Admin')).toBeTruthy();
    expect(screen.getByLabelText('ice')).toBeTruthy();
    expect(screen.getByLabelText('daf')).toBeTruthy();
    expect(screen.queryByLabelText('iff')).toBeNull(); // self never shown
  });

  it('calls onChange with the updated array when a helper is toggled', () => {
    const onChange = vi.fn();
    render(
      <TeammatePicker
        inspectors={ROSTER}
        currentUserId={3}
        value={[]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /\+ tag teammates/i }));
    fireEvent.click(screen.getByLabelText('daf'));
    expect(onChange).toHaveBeenLastCalledWith([6]);

    // toggling off
    onChange.mockClear();
    cleanup();
    render(
      <TeammatePicker
        inspectors={ROSTER}
        currentUserId={3}
        value={[6]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /\+ tag teammates/i }));
    fireEvent.click(screen.getByLabelText('daf'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('shows selected helpers as chips even when collapsed', () => {
    render(
      <TeammatePicker
        inspectors={ROSTER}
        currentUserId={3}
        value={[6, 2]}
        onChange={vi.fn()}
      />,
    );
    // collapsed (no checkbox), but selected names visible as chips
    expect(screen.queryByLabelText('daf')).toBeNull();
    expect(screen.getByText('daf')).toBeTruthy();
    expect(screen.getByText('ice')).toBeTruthy();
  });

  it('returns null when only the current user is in the roster', () => {
    const { container } = render(
      <TeammatePicker
        inspectors={[{ id: 3, username: 'iff', displayName: 'iff' }]}
        currentUserId={3}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(container.textContent).toBe('');
  });
});
```

- [ ] **Step 2: Run — expect failure (component missing)**

Run: `npx vitest run src/__tests__/teammate-picker.test.tsx`
Expected: `Failed to resolve import "@/components/field-ops/TeammatePicker"`.

- [ ] **Step 3: Write the component**

```tsx
// src/components/field-ops/TeammatePicker.tsx
'use client';

import { useState } from 'react';

export interface InspectorOption {
  id: number;
  username: string;
  displayName: string;
}

interface Props {
  inspectors: InspectorOption[];
  currentUserId: number;
  value: number[];
  onChange: (helperUserIds: number[]) => void;
  disabled?: boolean;
}

const linkStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  marginTop: 6,
  fontFamily: 'var(--fo-mono)',
  fontSize: 11,
  letterSpacing: 0.4,
  color: 'var(--fo-accent)',
  cursor: 'pointer',
};

const chipStyleSelected: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'var(--fo-accent)',
  color: 'var(--fo-rail-bg)',
  fontSize: 11,
  fontWeight: 600,
};

const chipStyleUnselected: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid var(--fo-rail-border)',
  color: 'var(--fo-rail-text)',
  fontSize: 11,
  cursor: 'pointer',
};

export default function TeammatePicker({
  inspectors,
  currentUserId,
  value,
  onChange,
  disabled = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const helperOptions = inspectors.filter((u) => u.id !== currentUserId);

  if (helperOptions.length === 0) return null;

  const selectedSet = new Set(value);

  function toggle(id: number) {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  const selectedHelpers = helperOptions.filter((u) => selectedSet.has(u.id));

  if (!expanded) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          disabled={disabled}
          style={linkStyle}
        >
          + tag teammates
        </button>
        {selectedHelpers.map((u) => (
          <span key={u.id} style={chipStyleSelected}>{u.displayName}</span>
        ))}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {helperOptions.map((u) => {
          const selected = selectedSet.has(u.id);
          return (
            <label
              key={u.id}
              style={selected ? chipStyleSelected : chipStyleUnselected}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggle(u.id)}
                aria-label={u.displayName}
                disabled={disabled}
                style={{ margin: 0 }}
              />
              {u.displayName}
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        disabled={disabled}
        style={{ ...linkStyle, color: 'var(--fo-rail-mute)' }}
      >
        – collapse
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `npx vitest run src/__tests__/teammate-picker.test.tsx`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/field-ops/TeammatePicker.tsx \
        src/__tests__/teammate-picker.test.tsx
git commit -m "feat(field-ops): TeammatePicker collapse/expand chip picker"
```

---

## Task 2: PATCH route accepts and forwards `helperUserIds`

**Files:**
- Modify: `src/app/api/stations/[id]/route.ts`
- Modify: `src/__tests__/api-routes.test.ts`

- [ ] **Step 1: Extend the PATCH handler**

Open `src/app/api/stations/[id]/route.ts`. Find the body destructure on line 18 (currently `const { onAir, inspection68, inspection69, details } = body;`). Replace it with:

```ts
    const { onAir, inspection68, inspection69, details, helperUserIds } = body;
```

Then find the sidecar block (currently lines 62-80). Replace the `createInspection` call to forward helpers:

```ts
    if (updates.inspection_69 === true) {
      try {
        const session = await getSession();
        if (session.userId) {
          await createInspection({
            stationId,
            inspectedOn: new Date().toISOString().split('T')[0],
            leadUserId: session.userId,
            helperUserIds: Array.isArray(helperUserIds)
              ? helperUserIds.filter((x: unknown): x is number => typeof x === 'number' && Number.isInteger(x))
              : [],
          });
        }
      } catch (err) {
        console.warn(`Failed to record inspection history for station ${stationId}:`, err);
      }
    }
```

The shape of the rest of the file is unchanged.

- [ ] **Step 2: Extend the API-routes test**

Open `src/__tests__/api-routes.test.ts`. Find the existing test that asserts the `createInspection` sidecar fires on toggle-ON (it was added during the revert in commit `099d3be`). Add a new test case immediately after it:

```ts
  it('PATCH forwards helperUserIds to the inspection-history sidecar', async () => {
    const createSpy = vi
      .spyOn(await import('@/services/inspectionService'), 'createInspection')
      .mockResolvedValue({} as never);

    vi.mocked(prisma.fm_station.update).mockResolvedValue({ id_fm: 1 } as never);

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const headers = new Headers();
    headers.set('Cookie', c.header);
    headers.set('Content-Type', 'application/json');
    const req = new NextRequest('http://t/api/stations/1', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ inspection69: 'ตรวจแล้ว', helperUserIds: [6, 2] }),
    });

    const r = await stationsPatch(req, { params: Promise.resolve({ id: '1' }) });
    expect(r.status).toBe(200);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      stationId: 1,
      leadUserId: 3,
      helperUserIds: [6, 2],
    }));

    createSpy.mockRestore();
  });

  it('PATCH defaults to empty helperUserIds when not provided', async () => {
    const createSpy = vi
      .spyOn(await import('@/services/inspectionService'), 'createInspection')
      .mockResolvedValue({} as never);

    vi.mocked(prisma.fm_station.update).mockResolvedValue({ id_fm: 1 } as never);

    const c = await mintCookie({ userId: 3, username: 'iff', displayName: 'iff', role: 'inspector' });
    const headers = new Headers();
    headers.set('Cookie', c.header);
    headers.set('Content-Type', 'application/json');
    const req = new NextRequest('http://t/api/stations/1', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ inspection69: 'ตรวจแล้ว' }),
    });

    const r = await stationsPatch(req, { params: Promise.resolve({ id: '1' }) });
    expect(r.status).toBe(200);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      helperUserIds: [],
    }));

    createSpy.mockRestore();
  });
```

If the file does not already import `stationsPatch` or `NextRequest`, follow the existing test's import style and use the symbol it uses for the `PATCH` handler import. Search the file with `grep -n "PATCH\|stations\|NextRequest" src/__tests__/api-routes.test.ts` to confirm the symbol name before pasting.

If the file lacks a `mintCookie` import, add: `import { mintCookie } from './helpers/session';` near the top.

- [ ] **Step 3: Run the two new tests + the rest of the file**

Run: `npx vitest run src/__tests__/api-routes.test.ts`
Expected: all passing (previous count + 2 new).

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stations/\[id\]/route.ts src/__tests__/api-routes.test.ts
git commit -m "feat(api): PATCH forwards helperUserIds to inspection sidecar"
```

---

## Task 3: `FieldOpsFetcher` + `FieldOpsClient` plumbing

**Files:**
- Modify: `src/components/field-ops/FieldOpsFetcher.tsx`
- Modify: `src/components/field-ops/FieldOpsClient.tsx`

- [ ] **Step 1: `FieldOpsFetcher` — read session and pass `currentUser`**

Open `src/components/field-ops/FieldOpsFetcher.tsx`. Add at the top of the import block (after the other imports):

```ts
import { getSession } from "@/lib/session";
```

Inside the `try { ... }` block, before the existing `await Promise.all(...)`, add:

```ts
    const session = await getSession();
```

After computing `provinces` (the existing local), add:

```ts
    const currentUser = session.userId
      ? { id: session.userId, displayName: session.displayName }
      : undefined;
```

Then in the `return ( <FieldOpsClient ... /> )` block, add `currentUser={currentUser}` to the prop list. Keep all existing props intact.

- [ ] **Step 2: `FieldOpsClient` — accept `currentUser` + add inspectors fetch + helperUserIds state**

Open `src/components/field-ops/FieldOpsClient.tsx`.

(a) Update the import block. Replace `import { useEffect, useMemo, useState } from "react";` with:

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
```

(b) Find the `Props` interface (near the top of the file). Append a new optional field:

```ts
  currentUser?: { id: number; displayName: string };
```

(c) Find the `export default function FieldOpsClient(props: Props)` signature (around line 65). Destructure the new prop:

```ts
export default function FieldOpsClient({
  initialStations,
  initialInterference,
  initialProvinces,
  currentUser,
}: Props) {
```

(d) Right after the existing `useState` declarations (around lines 70-80), add:

```ts
  const [inspectors, setInspectors] = useState<{ id: number; username: string; displayName: string }[]>([]);
  const [helperUserIds, setHelperUserIds] = useState<number[]>([]);

  useEffect(() => {
    fetch("/api/users/inspectors")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((j) => setInspectors(j.users ?? []))
      .catch(() => setInspectors([]));
  }, []);
```

(e) After the `selection` state declaration, add a reset effect that clears helpers whenever the open FM station changes:

```ts
  const fmStationId = selection?.kind === "fm" && selectedStation ? selectedStation.id : null;
  useEffect(() => { setHelperUserIds([]); }, [fmStationId]);
```

Place this AFTER `selectedStation` is computed (it's a `useMemo` over `stations` + `selection`). If `selectedStation` isn't yet declared at that point in the file, move this `useEffect` below its declaration. If you can't determine the right ordering, look for the line `const selectedStation = ` and put this block right after.

(f) Update `handleToggleInspection`'s FM branch (currently sends `{ inspection69: next }` only). Replace the existing PATCH `fetch(...)` call in the FM branch with:

```ts
        const res = await fetch(`/api/stations/${selectedStation.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inspection69: next,
            ...(next === "ตรวจแล้ว" ? { helperUserIds } : {}),
          }),
        });
        if (!res.ok) throw new Error("FM update failed");
        if (next === "ตรวจแล้ว") setHelperUserIds([]);
```

Leave the INT branch untouched.

(g) Pass the four new props to `<FieldOpsCurrentFM>` (the render site for FM stations on desktop). Find the render around line 514-520. Add these four props alongside the existing ones:

```tsx
                          inspectors={inspectors}
                          currentUser={currentUser}
                          helperUserIds={helperUserIds}
                          onHelperUserIdsChange={setHelperUserIds}
```

(h) Pass the same four new props to `<FieldOpsBottomSheet>` (mobile render site, around line 550-575):

```tsx
                  inspectors={inspectors}
                  currentUser={currentUser}
                  helperUserIds={helperUserIds}
                  onHelperUserIdsChange={setHelperUserIds}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ Compiled successfully`.

(TypeScript will not error yet because `FieldOpsCurrentFM` and `FieldOpsBottomSheet` will accept the extra props as unknown excess. We add their typed props in Task 4.)

- [ ] **Step 4: Commit**

```bash
git add src/components/field-ops/FieldOpsFetcher.tsx \
        src/components/field-ops/FieldOpsClient.tsx
git commit -m "feat(field-ops): plumb inspectors + helperUserIds through FieldOpsClient"
```

---

## Task 4: Wire `<TeammatePicker>` into `FieldOpsCurrentFM` and `FieldOpsBottomSheet`

**Files:**
- Modify: `src/components/field-ops/FieldOpsCurrent.tsx`
- Modify: `src/components/field-ops/FieldOpsBottomSheet.tsx`
- Modify: `src/__tests__/field-ops-current.test.tsx`

- [ ] **Step 1: Extend the failing test FIRST**

Open `src/__tests__/field-ops-current.test.tsx`. Append two new test cases at the bottom of the existing `describe` block (or in a new `describe` block — match the file's style):

```tsx
import TeammatePicker from '@/components/field-ops/TeammatePicker'; // noop import to ensure module exists

describe('FieldOpsCurrentFM — teammate picker', () => {
  it('renders the teammate picker when station is PENDING and all picker props are provided', () => {
    const station: FMStation = { ...baseStation, inspection69: 'ยังไม่ตรวจ' };
    const { getByRole } = render(
      <FieldOpsCurrentFM
        station={station}
        onToggleInspection={vi.fn()}
        pending={false}
        inspectors={[
          { id: 3, username: 'iff', displayName: 'iff' },
          { id: 6, username: 'daf', displayName: 'daf' },
        ]}
        currentUser={{ id: 3, displayName: 'iff' }}
        helperUserIds={[]}
        onHelperUserIdsChange={vi.fn()}
      />,
    );
    expect(getByRole('button', { name: /\+ tag teammates/i })).toBeTruthy();
  });

  it('does NOT render the teammate picker when station is INSPECTED', () => {
    const station: FMStation = { ...baseStation, inspection69: 'ตรวจแล้ว' };
    const { queryByRole } = render(
      <FieldOpsCurrentFM
        station={station}
        onToggleInspection={vi.fn()}
        pending={false}
        inspectors={[
          { id: 3, username: 'iff', displayName: 'iff' },
          { id: 6, username: 'daf', displayName: 'daf' },
        ]}
        currentUser={{ id: 3, displayName: 'iff' }}
        helperUserIds={[]}
        onHelperUserIdsChange={vi.fn()}
      />,
    );
    expect(queryByRole('button', { name: /\+ tag teammates/i })).toBeNull();
  });
});
```

The top-of-file `import TeammatePicker` is intentional — it lets the test fail loudly if someone deletes the picker module later. If lint complains about an unused import, add `// eslint-disable-line @typescript-eslint/no-unused-vars` to that line.

- [ ] **Step 2: Run — expect failure (props not wired)**

Run: `npx vitest run src/__tests__/field-ops-current.test.tsx`
Expected: failure — the test will hit one of: TypeScript prop type mismatch, picker not rendered, or both. That's the red.

- [ ] **Step 3: Update `FieldOpsCurrentFM` props + render**

Open `src/components/field-ops/FieldOpsCurrent.tsx`. Add to the imports:

```ts
import TeammatePicker, { type InspectorOption } from './TeammatePicker';
```

Find the `FieldOpsCurrentFM` props inline type (around lines 25-39). Append four optional fields:

```ts
  inspectors?: InspectorOption[];
  currentUser?: { id: number; displayName: string };
  helperUserIds?: number[];
  onHelperUserIdsChange?: (helperUserIds: number[]) => void;
```

Destructure them in the function signature alongside the existing params (just add the four names).

Find the `ButtonRow` that renders NAVIGATE + INSPECT (around lines 114-127). Immediately after that `ButtonRow` (before the optional ON-AIR `ButtonRow`), add:

```tsx
      {station.inspection69 !== 'ตรวจแล้ว'
        && onHelperUserIdsChange
        && inspectors
        && currentUser && (
        <TeammatePicker
          inspectors={inspectors}
          currentUserId={currentUser.id}
          value={helperUserIds ?? []}
          onChange={onHelperUserIdsChange}
          disabled={pending}
        />
      )}
```

- [ ] **Step 4: Run the FieldOpsCurrent tests**

Run: `npx vitest run src/__tests__/field-ops-current.test.tsx`
Expected: all passing (pre-existing tests + the 2 new ones).

- [ ] **Step 5: Update `FieldOpsBottomSheet` props + render**

Open `src/components/field-ops/FieldOpsBottomSheet.tsx`. Add to imports:

```ts
import TeammatePicker, { type InspectorOption } from './TeammatePicker';
```

Find the inline props type for `FieldOpsBottomSheet` (around lines 26-39). Append four optional fields:

```ts
  inspectors?: InspectorOption[];
  currentUser?: { id: number; displayName: string };
  helperUserIds?: number[];
  onHelperUserIdsChange?: (helperUserIds: number[]) => void;
```

Destructure them in the function signature.

Locate where the FM "INSPECT" button is rendered inside the sheet (search the file for `INSPECT` or `onToggleInspection={onToggleInspection}` to find it — it lives inside the `{isFM ? ... }` block). Immediately after that INSPECT button (before the next sibling, e.g., the LAW PAPER block for INT), add:

```tsx
      {isFM && station!.inspection69 !== 'ตรวจแล้ว'
        && onHelperUserIdsChange
        && inspectors
        && currentUser && (
        <div style={{ padding: '0 16px' }}>
          <TeammatePicker
            inspectors={inspectors}
            currentUserId={currentUser.id}
            value={helperUserIds ?? []}
            onChange={onHelperUserIdsChange}
            disabled={pending}
          />
        </div>
      )}
```

Use whatever wrapping `<div style>` is consistent with the sheet's existing padding pattern (the sheet wraps its rows in `padding: '0 16px'` divs — match that). Don't introduce new layout primitives.

- [ ] **Step 6: Verify build + run the full sweep**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ Compiled successfully`.

Run: `npx vitest run 2>&1 | tail -10`
Expected: no NEW failures beyond the documented pre-existing 30 in `components-batch4`, `intermod-calculator-deep`, `field-ops-drawer`, `analytics`.

- [ ] **Step 7: Commit**

```bash
git add src/components/field-ops/FieldOpsCurrent.tsx \
        src/components/field-ops/FieldOpsBottomSheet.tsx \
        src/__tests__/field-ops-current.test.tsx
git commit -m "feat(field-ops): render TeammatePicker under INSPECT on PENDING stations"
```

---

## Task 5: Lint + smoke notes (no commit unless lint changes)

- [ ] **Step 1: Lint**

Run: `npm run lint 2>&1 | tail -10`
Expected: 0 errors. New files contribute 0 new warnings.

- [ ] **Step 2: Manual smoke (user runs this; CI doesn't)**

Start dev server: `npm run dev`. In the field-ops module:

1. Open a PENDING FM station on desktop. Confirm the `+ tag teammates` link appears below the `✓ INSPECT` button.
2. Click it. Confirm the helper chip row appears (excluding your own username, excluding inactive `aom`).
3. Select `daf`. Confirm `daf` appears as a filled chip even after clicking `– collapse`.
4. Click `✓ INSPECT`. Confirm the toggle succeeds and the picker disappears (station is now INSPECTED).
5. Verify the new `station_inspection` row in DB: `SELECT s.id, s.station_id, s.inspected_on, u.username AS lead, ARRAY_AGG(mu.username) AS helpers FROM station_inspection s JOIN "user" u ON u.id = s.lead_user_id LEFT JOIN station_inspection_member m ON m.inspection_id = s.id LEFT JOIN "user" mu ON mu.id = m.user_id WHERE s.station_id = <id> ORDER BY s.created_at DESC LIMIT 1 GROUP BY s.id, u.username;`. Confirm `helpers` contains `{daf}`.
6. Repeat on mobile (resize to ≤900px or use device emulation). Confirm the picker shows up in the bottom sheet too.

- [ ] **Step 3: No commit unless lint/build introduced changes.**

---

## Self-review notes (run after writing the plan)

- **Spec coverage:**
  - §3.1 collapsed/expanded UX → Task 1 (component + tests).
  - §3.2 hide-on-INSPECTED behavior → Task 4 (consumer guards + test cases).
  - §3.2 reset on station change → Task 3 step 2(e) (`useEffect` keyed on `fmStationId`).
  - §3.2 reset on toggle success → Task 3 step 2(f) (`setHelperUserIds([])` after `res.ok`).
  - §4.1 component shape (`TeammatePicker` props, file-local state) → Task 1.
  - §4.2 `FieldOpsClient` wiring → Task 3.
  - §4.3 `FieldOpsCurrentFM` + `FieldOpsBottomSheet` wiring → Task 4.
  - §5.1 PATCH body extension + forwarding to `createInspection` → Task 2.
  - §5.1 graceful degradation (try/catch + log) → already in the existing handler; Task 2 doesn't remove it.
  - §6 testing → Tasks 1, 2, 4.
  - §7 rollout → task ordering matches; smoke in Task 5.
- **Placeholders:** none.
- **Type consistency:**
  - `InspectorOption` is exported from `TeammatePicker.tsx` in Task 1 and re-imported by `FieldOpsCurrent.tsx` + `FieldOpsBottomSheet.tsx` in Task 4 — consistent name.
  - `currentUser: { id: number; displayName: string }` shape is consistent across `FieldOpsFetcher`, `FieldOpsClient`, `FieldOpsCurrentFM`, `FieldOpsBottomSheet`.
  - `helperUserIds: number[]` and `onHelperUserIdsChange: (helperUserIds: number[]) => void` consistent across the four files.
  - `inspectors` prop shape `{ id, username, displayName }[]` matches the `/api/users/inspectors` response and the `InspectorOption` type.
- **YAGNI:** no date picker, no notes, no history, no admin gate, no UPDATE endpoint, no `StationCard` wiring — all explicitly out-of-scope in spec §2.
