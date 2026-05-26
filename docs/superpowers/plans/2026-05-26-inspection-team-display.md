# Inspection Team Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a station (FM or INT) is already inspected, show who inspected it (lead + helpers) as read-only name chips — so teammates can see who did the work.

**Architecture:** Fetch the latest inspection record from the existing `/api/stations/[id]/inspections` (FM) and a new `/api/interference/[id]/inspections` (INT) route when a selected item is inspected. Display the team via a new `InspectionTeamChips` read-only component in both the mobile bottom sheet and desktop current-item panel. When NOT inspected, the existing `TeammatePicker` continues to show as before.

**Tech Stack:** Next.js API route, Prisma service (already exists), React component, TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/field-ops/InspectionTeamChips.tsx` | Read-only chip display: lead (highlighted) + helpers |
| Create | `src/app/api/interference/[id]/inspections/route.ts` | GET endpoint for INT inspection history (mirrors FM) |
| Modify | `src/components/field-ops/FieldOpsClient.tsx` | Fetch latest inspection when selection is inspected; pass data down |
| Modify | `src/components/field-ops/FieldOpsBottomSheet.tsx` | Show `InspectionTeamChips` when inspected |
| Modify | `src/components/field-ops/FieldOpsCurrent.tsx` | Show `InspectionTeamChips` when inspected (desktop FM + INT) |
| Create | `src/__tests__/inspection-team-chips.test.tsx` | Unit tests for InspectionTeamChips |
| Create | `src/__tests__/api-interference-inspections.test.ts` | API route tests |

---

### Task 1: Create the INT inspections GET route

The FM route at `src/app/api/stations/[id]/inspections/route.ts` already exists. We need the same for interference sites.

**Files:**
- Create: `src/app/api/interference/[id]/inspections/route.ts`
- Reference: `src/app/api/stations/[id]/inspections/route.ts` (mirror structure)
- Reference: `src/services/interferenceInspectionService.ts` (`listInspectionsForInterferenceSite`)

- [ ] **Step 1: Write the API route test**

Create `src/__tests__/api-interference-inspections.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockListInspections = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/services/interferenceInspectionService', () => ({
  listInspectionsForInterferenceSite: (...args: unknown[]) => mockListInspections(...args),
}));
vi.mock('@/lib/session', () => ({
  getSession: () => mockGetSession(),
}));

const { GET } = await import('@/app/api/interference/[id]/inspections/route');

describe('GET /api/interference/[id]/inspections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: 1 });
  });

  it('returns inspections for a valid site ID', async () => {
    const fakeInspections = [
      { id: 1, interferenceId: 42, inspectedOn: '2026-05-20', lead: { userId: 1, username: 'dao', displayName: 'dao' }, helpers: [] },
    ];
    mockListInspections.mockResolvedValue(fakeInspections);

    const req = new NextRequest('http://localhost/api/interference/42/inspections');
    const res = await GET(req, { params: Promise.resolve({ id: '42' }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.inspections).toEqual(fakeInspections);
    expect(mockListInspections).toHaveBeenCalledWith(42);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValue({ userId: null });

    const req = new NextRequest('http://localhost/api/interference/42/inspections');
    const res = await GET(req, { params: Promise.resolve({ id: '42' }) });

    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid ID', async () => {
    const req = new NextRequest('http://localhost/api/interference/abc/inspections');
    const res = await GET(req, { params: Promise.resolve({ id: 'abc' }) });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/api-interference-inspections.test.ts
```

Expected: FAIL — cannot import the route (file doesn't exist yet).

- [ ] **Step 3: Create the route**

Create `src/app/api/interference/[id]/inspections/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { listInspectionsForInterferenceSite } from '@/services/interferenceInspectionService';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const siteId = parseInt(id, 10);
  if (Number.isNaN(siteId)) {
    return NextResponse.json({ error: 'Invalid site ID' }, { status: 400 });
  }

  const inspections = await listInspectionsForInterferenceSite(siteId);
  return NextResponse.json({ inspections });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/api-interference-inspections.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/interference/\[id\]/inspections/route.ts src/__tests__/api-interference-inspections.test.ts
git commit -m "feat: add GET /api/interference/[id]/inspections route"
```

---

### Task 2: Create InspectionTeamChips component

A read-only display showing who inspected: lead name (bold) + helper names as chips.

**Files:**
- Create: `src/components/field-ops/InspectionTeamChips.tsx`
- Create: `src/__tests__/inspection-team-chips.test.tsx`

- [ ] **Step 1: Write the component test**

Create `src/__tests__/inspection-team-chips.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import InspectionTeamChips from '@/components/field-ops/InspectionTeamChips';

describe('InspectionTeamChips', () => {
  it('renders lead name with crown icon', () => {
    const { container } = render(
      <InspectionTeamChips
        lead={{ userId: 1, username: 'dao', displayName: 'dao' }}
        helpers={[]}
      />
    );
    expect(container.textContent).toContain('dao');
    expect(container.querySelector('[data-role="lead"]')).toBeTruthy();
  });

  it('renders helpers as chips', () => {
    const { container } = render(
      <InspectionTeamChips
        lead={{ userId: 1, username: 'dao', displayName: 'dao' }}
        helpers={[
          { userId: 2, username: 'ice', displayName: 'ice' },
          { userId: 3, username: 'iff', displayName: 'iff' },
        ]}
      />
    );
    expect(container.textContent).toContain('ice');
    expect(container.textContent).toContain('iff');
  });

  it('renders nothing when lead is null', () => {
    const { container } = render(
      <InspectionTeamChips lead={null} helpers={[]} />
    );
    expect(container.textContent).toBe('');
  });

  it('shows date when provided', () => {
    const { container } = render(
      <InspectionTeamChips
        lead={{ userId: 1, username: 'dao', displayName: 'dao' }}
        helpers={[]}
        inspectedOn="2026-05-20"
      />
    );
    expect(container.textContent).toContain('2026-05-20');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/__tests__/inspection-team-chips.test.tsx
```

Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Create the component**

Create `src/components/field-ops/InspectionTeamChips.tsx`:

```tsx
'use client';

interface InspectionMember {
  userId: number;
  username: string;
  displayName: string;
}

export default function InspectionTeamChips({
  lead,
  helpers,
  inspectedOn,
}: {
  lead: InspectionMember | null;
  helpers: InspectionMember[];
  inspectedOn?: string;
}) {
  if (!lead) return null;

  return (
    <div style={{ padding: '8px 0' }}>
      <div
        className="fo-mono"
        style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--fo-rail-mute)', marginBottom: 6 }}
      >
        INSPECTED BY{inspectedOn ? ` · ${inspectedOn}` : ''}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span
          data-role="lead"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'var(--fo-accent)',
            color: 'var(--fo-ink, #001e2b)',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {lead.displayName}
        </span>
        {helpers.map((h) => (
          <span
            key={h.userId}
            data-role="helper"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid var(--fo-rail-border, var(--fo-line))',
              color: 'var(--fo-rail-text, var(--fo-ink))',
              fontSize: 12,
            }}
          >
            {h.displayName}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/__tests__/inspection-team-chips.test.tsx
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/field-ops/InspectionTeamChips.tsx src/__tests__/inspection-team-chips.test.tsx
git commit -m "feat: add InspectionTeamChips read-only component"
```

---

### Task 3: Fetch latest inspection in FieldOpsClient

When a station/site is selected AND is inspected, fetch the most recent inspection record so we can display the team.

**Files:**
- Modify: `src/components/field-ops/FieldOpsClient.tsx`

- [ ] **Step 1: Add state and fetch effect**

In `src/components/field-ops/FieldOpsClient.tsx`, add imports and state near the existing state declarations (around line 83, after `helperUserIds`):

```typescript
import type { InspectionMember } from '@/types/inspection';
```

Add state:

```typescript
const [lastInspection, setLastInspection] = useState<{
  lead: InspectionMember;
  helpers: InspectionMember[];
  inspectedOn: string;
} | null>(null);
```

- [ ] **Step 2: Add useEffect to fetch inspection when selected item is inspected**

Add this effect after the existing `selectedTargetKey` effect (around line 182):

```typescript
useEffect(() => {
  setLastInspection(null);
  if (!selection) return;

  const isInspected =
    (selection.kind === 'fm' && selectedStation?.inspection69 === 'ตรวจแล้ว') ||
    (selection.kind === 'int' && selectedSite?.status === 'ตรวจแล้ว');
  if (!isInspected) return;

  let cancelled = false;
  const url =
    selection.kind === 'fm'
      ? `/api/stations/${selection.id}/inspections`
      : `/api/interference/${selection.id}/inspections`;

  fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (cancelled || !data?.inspections?.length) return;
      const latest = data.inspections[0];
      setLastInspection({
        lead: latest.lead,
        helpers: latest.helpers ?? [],
        inspectedOn: latest.inspectedOn,
      });
    })
    .catch(() => {});
  return () => { cancelled = true; };
}, [selectedTargetKey, selectedStation?.inspection69, selectedSite?.status]);
```

Note: `selectedTargetKey` (already defined at line 179) changes when the selection changes. Adding `inspection69`/`status` as deps ensures a re-fetch when the user toggles inspection.

- [ ] **Step 3: Also re-fetch after toggling inspection ON**

In `handleToggleInspection`, after the successful toggle-ON paths, the `lastInspection` will automatically update because the effect deps include the inspection status. However, for immediate feedback, add a manual fetch inside the toggle handler.

After line 295 (`if (next === "ตรวจแล้ว") setHelperUserIds([]);`), add:

```typescript
if (next === "ตรวจแล้ว") {
  setHelperUserIds([]);
  // Fetch the just-created inspection to show who inspected
  fetch(`/api/stations/${selectedStation.id}/inspections`)
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
      if (data?.inspections?.length) {
        const latest = data.inspections[0];
        setLastInspection({ lead: latest.lead, helpers: latest.helpers ?? [], inspectedOn: latest.inspectedOn });
      }
    })
    .catch(() => {});
}
```

Replace the existing `if (next === "ตรวจแล้ว") setHelperUserIds([]);` line (295) with the block above.

Similarly, after line 310 (`if (next === "ตรวจแล้ว") setHelperUserIds(defaultCrew ?? []);`), replace with:

```typescript
if (next === "ตรวจแล้ว") {
  setHelperUserIds(defaultCrew ?? []);
  fetch(`/api/interference/${selectedSite.id}/inspections`)
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
      if (data?.inspections?.length) {
        const latest = data.inspections[0];
        setLastInspection({ lead: latest.lead, helpers: latest.helpers ?? [], inspectedOn: latest.inspectedOn });
      }
    })
    .catch(() => {});
}
```

- [ ] **Step 4: Pass `lastInspection` to child components**

Find where `FieldOpsCurrentFM` is rendered (around line 549-561) and add the prop:

```typescript
<FieldOpsCurrentFM
  station={selectedStation}
  ...existing props...
  lastInspection={lastInspection}
/>
```

Find where `FieldOpsCurrentINT` is rendered (around line 563-580) and add:

```typescript
<FieldOpsCurrentINT
  site={selectedSite}
  ...existing props...
  lastInspection={lastInspection}
/>
```

Find where `FieldOpsBottomSheet` is rendered (look for the mobile bottom sheet render) and add:

```typescript
<FieldOpsBottomSheet
  ...existing props...
  lastInspection={lastInspection}
/>
```

- [ ] **Step 5: Run type check**

```bash
npx tsc --noEmit
```

Expected: Type errors for the new `lastInspection` prop on child components (they don't accept it yet). That's expected — we'll fix in Tasks 4 and 5.

- [ ] **Step 6: Commit**

```bash
git add src/components/field-ops/FieldOpsClient.tsx
git commit -m "feat: fetch latest inspection team when item is inspected"
```

---

### Task 4: Show InspectionTeamChips in FieldOpsBottomSheet (mobile)

**Files:**
- Modify: `src/components/field-ops/FieldOpsBottomSheet.tsx`

- [ ] **Step 1: Add the prop and import**

At the top of `FieldOpsBottomSheet.tsx`, add the import:

```typescript
import InspectionTeamChips from './InspectionTeamChips';
import type { InspectionMember } from '@/types/inspection';
```

Add to the component's props type (in the destructured params object):

```typescript
lastInspection?: {
  lead: InspectionMember;
  helpers: InspectionMember[];
  inspectedOn: string;
} | null;
```

- [ ] **Step 2: Show InspectionTeamChips when inspected, TeammatePicker when not**

The existing TeammatePicker block (around lines 436-450 in current file) shows only when NOT inspected:

```tsx
{((isFM && station!.inspection69 !== 'ตรวจแล้ว')
  || (isINT && site!.status !== 'ตรวจแล้ว'))
  && onHelperUserIdsChange
  && inspectors
  && currentUser && (
  <div style={{ padding: '0 16px' }}>
    <TeammatePicker ... />
  </div>
)}
```

**After** this block, add the inspected-team display:

```tsx
{inspected && lastInspection && (
  <div style={{ padding: '0 16px' }}>
    <InspectionTeamChips
      lead={lastInspection.lead}
      helpers={lastInspection.helpers}
      inspectedOn={lastInspection.inspectedOn}
    />
  </div>
)}
```

The variable `inspected` is already declared at line 182 of the current file.

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: Should compile (or only remaining errors from Task 5 props).

- [ ] **Step 4: Commit**

```bash
git add src/components/field-ops/FieldOpsBottomSheet.tsx
git commit -m "feat: show inspection team chips in mobile bottom sheet"
```

---

### Task 5: Show InspectionTeamChips in FieldOpsCurrent (desktop)

**Files:**
- Modify: `src/components/field-ops/FieldOpsCurrent.tsx`

- [ ] **Step 1: Add import and prop**

At the top of `FieldOpsCurrent.tsx`, add:

```typescript
import InspectionTeamChips from './InspectionTeamChips';
import type { InspectionMember } from '@/types/inspection';
```

Add `lastInspection` prop to **both** `FieldOpsCurrentFM` and `FieldOpsCurrentINT` prop types:

```typescript
lastInspection?: {
  lead: InspectionMember;
  helpers: InspectionMember[];
  inspectedOn: string;
} | null;
```

- [ ] **Step 2: Show chips after TeammatePicker in FieldOpsCurrentFM**

The FM section currently has (around line 138-149):

```tsx
{station.inspection69 !== 'ตรวจแล้ว'
  && onHelperUserIdsChange
  && inspectors
  && currentUser && (
  <TeammatePicker ... />
)}
```

**After** this block, add:

```tsx
{inspected && lastInspection && (
  <InspectionTeamChips
    lead={lastInspection.lead}
    helpers={lastInspection.helpers}
    inspectedOn={lastInspection.inspectedOn}
  />
)}
```

The variable `inspected` is already declared at line 49 of the file.

- [ ] **Step 3: Show chips after TeammatePicker in FieldOpsCurrentINT**

The INT section currently has (around line 371-382):

```tsx
{site.status !== 'ตรวจแล้ว'
  && onHelperUserIdsChange
  && inspectors
  && currentUser && (
  <TeammatePicker ... />
)}
```

**After** this block, add:

```tsx
{inspected && lastInspection && (
  <InspectionTeamChips
    lead={lastInspection.lead}
    helpers={lastInspection.helpers}
    inspectedOn={lastInspection.inspectedOn}
  />
)}
```

The variable `inspected` is already declared at line 261 of the file.

- [ ] **Step 4: Run type check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: Clean — all components now accept `lastInspection` prop.

- [ ] **Step 5: Commit**

```bash
git add src/components/field-ops/FieldOpsCurrent.tsx
git commit -m "feat: show inspection team chips in desktop panel"
```

---

### Task 6: Manual verification

- [ ] **Step 1: Start dev server and test**

```bash
npm run dev
```

Open `http://localhost:3000`. Test these flows:

1. **FM station already inspected** — tap/click it → see "INSPECTED BY · date" with lead chip (green) + helper chips below the INSPECT button
2. **FM station not inspected** — tap → see TeammatePicker ("+ tag teammates"), tag some, click INSPECT → chips should switch from TeammatePicker to InspectionTeamChips showing who just inspected
3. **INT site already inspected** — same as FM flow
4. **INT site not inspected** — same toggle flow
5. **Mobile** — verify bottom sheet shows the chips; swipe to expand to see them if needed
6. **Desktop** — verify the right-panel sidebar card shows the chips

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: All new tests pass. No regressions in existing tests.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: polish inspection team display"
```
