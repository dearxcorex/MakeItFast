# YTD Team Performance Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the existing team performance section to the top of the Analytics page, replace the 3-card KPI strip with a single TopPerformer hero card, add an explicit `· 2026` year label, strip the sidebar's dead-nav items, and demote the FM/interference widgets to a secondary "Operations overview" block below.

**Architecture:** UI-only redesign. One new presentational component (`TopPerformer`) reads from the existing `/api/analytics/inspectors` payload (passed in as props, no extra fetch). `InspectorsSection` swaps its KPI strip for the new component and gains a year label. `AnalyticsDashboard` reorders its main column and trims the sidebar. No API changes, no schema, no migrations.

**Tech Stack:** Next.js 15, TypeScript, React, Vitest + @testing-library/react.

---

## File Structure

**Component (new)**
- Create: `src/components/analytics/TopPerformer.tsx` — hero card; reads `inspectors[0]`, renders name + count + role pills + last-active footer, OR a muted "No activity yet for {year}" card.

**Component (modify)**
- Modify: `src/components/analytics/InspectorsSection.tsx` — remove `KpiStrip` definition and its render, add `· {data.thisYear}` to the section header, render `<TopPerformer inspectors={data.inspectors} thisYear={data.thisYear} />` in its place.
- Modify: `src/components/analytics/AnalyticsDashboard.tsx` — strip the 4-item `SIDEBAR_ANALYZE` array down to a single inert "Overview" pill; reorder main column so `<InspectorsSection />` comes BEFORE the KPI row; insert a divider + `OPERATIONS OVERVIEW` mono label above the demoted FM/interference content.

**Tests (new)**
- Create: `src/__tests__/top-performer.test.tsx` — 6 cases (see Task 1).

**No changes to:**
- `/api/analytics/inspectors` route or any other API.
- `src/types/analytics.ts` (still emits `kpis.*` even though UI no longer reads it — intentional, see spec "Out of scope").
- Any other dashboard sub-components (`FoKPI`, `FoBarChart`, `FoDonut`, `FoLineChart`).

---

## Task 1: Build `TopPerformer` component with TDD

**Files:**
- Create: `src/components/analytics/TopPerformer.tsx`
- Create: `src/__tests__/top-performer.test.tsx`

- [ ] **Step 1: Write the 6 failing tests**

Create `src/__tests__/top-performer.test.tsx`:

```tsx
// src/__tests__/top-performer.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import TopPerformer from '@/components/analytics/TopPerformer';
import type { InspectorsAnalytics } from '@/types/analytics';

afterEach(() => cleanup());

type Inspector = InspectorsAnalytics['inspectors'][number];

function mkInspector(overrides: Partial<Inspector> = {}): Inspector {
  return {
    userId: 1,
    username: 'iff',
    displayName: 'iff',
    ytdTotal: 14,
    monthTotal: 3,
    ytdAsLead: 11,
    ytdAsHelper: 3,
    lastActive: '2026-05-12',
    ...overrides,
  };
}

describe('TopPerformer', () => {
  it('renders the muted empty card when inspectors array is empty', () => {
    const { container } = render(<TopPerformer inspectors={[]} thisYear={2026} />);
    expect(container.textContent).toContain('No activity yet for 2026');
  });

  it('renders the muted empty card when every inspector has ytdTotal=0', () => {
    const { container } = render(
      <TopPerformer
        inspectors={[mkInspector({ ytdTotal: 0, ytdAsLead: 0, ytdAsHelper: 0 })]}
        thisYear={2026}
      />,
    );
    expect(container.textContent).toContain('No activity yet for 2026');
  });

  it('renders name, YTD total, lead/helper pills, and last-active footer for a single active inspector', () => {
    const { container } = render(
      <TopPerformer inspectors={[mkInspector()]} thisYear={2026} />,
    );
    expect(container.textContent).toContain('iff');
    expect(container.textContent).toContain('14 inspections this year');
    expect(container.textContent).toContain('11 led');
    expect(container.textContent).toContain('3 helped');
    // daysAgo("2026-05-12") on 2026-05-17 → "5 days ago"
    expect(container.textContent).toContain('Last active');
    expect(container.textContent).toContain('3 this month');
  });

  it('picks inspectors[0] (trusts caller-provided DESC sort by ytdTotal)', () => {
    const { container } = render(
      <TopPerformer
        inspectors={[
          mkInspector({ userId: 1, username: 'iff', displayName: 'iff', ytdTotal: 14 }),
          mkInspector({ userId: 6, username: 'daf', displayName: 'daf', ytdTotal: 9 }),
        ]}
        thisYear={2026}
      />,
    );
    expect(container.textContent).toContain('iff');
    expect(container.textContent).not.toContain('daf');
  });

  it('header reads "TOP PERFORMER · YTD 2026" when thisYear=2026', () => {
    const { container } = render(
      <TopPerformer inspectors={[mkInspector()]} thisYear={2026} />,
    );
    expect(container.textContent).toContain('TOP PERFORMER · YTD 2026');
  });

  it('renders "Last active —" when lastActive is null', () => {
    const { container } = render(
      <TopPerformer
        inspectors={[mkInspector({ lastActive: null })]}
        thisYear={2026}
      />,
    );
    expect(container.textContent).toContain('Last active —');
  });
});
```

- [ ] **Step 2: Run the tests — expect 6 failures**

```bash
npx vitest run src/__tests__/top-performer.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/analytics/TopPerformer'`.

- [ ] **Step 3: Implement `TopPerformer`**

Create `src/components/analytics/TopPerformer.tsx`:

```tsx
// src/components/analytics/TopPerformer.tsx
'use client';

import type { InspectorsAnalytics } from '@/types/analytics';

interface Props {
  inspectors: InspectorsAnalytics['inspectors']; // already sorted DESC by ytdTotal
  thisYear: number;
}

// Local copy of the helper used by InspectorsSection. Kept duplicated by
// design (see spec "Out of scope") — a shared util would expand this PR
// beyond the redesign's intent.
function daysAgo(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(`${iso}T00:00:00Z`);
  const now = new Date();
  const ms = now.getTime() - then.getTime();
  const days = Math.max(0, Math.floor(ms / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

const cardBase: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
  border: '1px solid #86efac',
  borderRadius: 12,
  padding: 18,
  marginBottom: 16,
};

const cardEmpty: React.CSSProperties = {
  background: 'var(--fo-surface)',
  border: '1px solid var(--fo-line)',
  borderRadius: 12,
  padding: 18,
  marginBottom: 16,
  color: 'var(--fo-mute)',
};

const pillLed: React.CSSProperties = {
  display: 'inline-block',
  padding: '3px 10px',
  borderRadius: 999,
  background: '#f0fdf4',
  border: '1px solid #86efac',
  color: '#166534',
  fontFamily: 'var(--fo-mono)',
  fontSize: 11,
  fontWeight: 600,
  marginRight: 6,
};

const pillHelped: React.CSSProperties = {
  ...pillLed,
  background: '#ffffff',
  borderColor: '#cbd5e1',
  color: 'var(--fo-mute)',
};

export default function TopPerformer({ inspectors, thisYear }: Props) {
  const top = inspectors[0];
  const isEmpty = !top || top.ytdTotal === 0;

  if (isEmpty) {
    return (
      <div style={cardEmpty}>
        <div className="fo-mono" style={{ color: 'var(--fo-mute)' }}>
          🏆 TOP PERFORMER · YTD {thisYear}
        </div>
        <div className="fo-serif" style={{ fontSize: 22, marginTop: 8 }}>
          No activity yet for {thisYear}
        </div>
      </div>
    );
  }

  return (
    <div style={cardBase}>
      <div className="fo-mono" style={{ color: '#166534' }}>
        🏆 TOP PERFORMER · YTD {thisYear}
      </div>
      <div
        className="fo-serif"
        style={{ fontSize: 42, marginTop: 8, lineHeight: 1, color: 'var(--fo-ink)' }}
      >
        {top.displayName}
      </div>
      <div
        style={{
          color: '#166534',
          fontSize: 14,
          marginTop: 6,
          fontWeight: 600,
        }}
      >
        {top.ytdTotal} inspections this year
      </div>
      <div style={{ marginTop: 14 }}>
        <span style={pillLed}>{top.ytdAsLead} led</span>
        <span style={pillHelped}>{top.ytdAsHelper} helped</span>
      </div>
      <div style={{ color: 'var(--fo-mute)', fontSize: 11, marginTop: 10 }}>
        Last active {daysAgo(top.lastActive)} · {top.monthTotal} this month
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests — expect 6 to pass**

```bash
npx vitest run src/__tests__/top-performer.test.tsx
```

Expected: 6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/TopPerformer.tsx src/__tests__/top-performer.test.tsx
git commit -m "$(cat <<'EOF'
feat(analytics): add TopPerformer hero card component

Single-card hero that reads inspectors[0] from the existing
/api/analytics/inspectors payload and renders the year's top
inspector with name, YTD count, lead/helper pills, and a
last-active footer. Falls back to a muted "No activity yet for
{year}" card when nobody has activity. Trusts the caller-provided
DESC sort by ytdTotal. daysAgo helper duplicated locally per
spec — no shared-util refactor in this plan.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire `TopPerformer` into `InspectorsSection`

**Files:**
- Modify: `src/components/analytics/InspectorsSection.tsx`

- [ ] **Step 1: Add the year to the section header**

In `src/components/analytics/InspectorsSection.tsx`, find the `SectionHeader` function (around lines 33-44):

```tsx
function SectionHeader() {
  return (
    <div style={{ marginTop: 32, marginBottom: 12 }}>
      <div className="fo-mono" style={{ color: 'var(--fo-accent)', letterSpacing: 0.6 }}>
        INSPECTORS
      </div>
      <div className="fo-serif" style={{ fontSize: 22, color: 'var(--fo-ink)' }}>
        Year-to-date team performance
      </div>
    </div>
  );
}
```

Replace with a version that takes `thisYear` as a prop and includes it in the title:

```tsx
function SectionHeader({ thisYear }: { thisYear: number }) {
  return (
    <div style={{ marginTop: 32, marginBottom: 12 }}>
      <div className="fo-mono" style={{ color: 'var(--fo-accent)', letterSpacing: 0.6 }}>
        INSPECTORS
      </div>
      <div className="fo-serif" style={{ fontSize: 22, color: 'var(--fo-ink)' }}>
        Year-to-date team performance · {thisYear}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the TopPerformer import**

At the top of `src/components/analytics/InspectorsSection.tsx`, after the existing analytics imports (around line 7), add:

```tsx
import TopPerformer from './TopPerformer';
```

- [ ] **Step 3: Delete the `KpiStrip` function**

Still in `src/components/analytics/InspectorsSection.tsx`, find the `KpiStrip` function (around lines 46-62):

```tsx
function KpiStrip({ kpis }: { kpis: InspectorsAnalytics['kpis'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
      <FoKPI label="Active inspectors this month" value={kpis.activeThisMonth} />
      <FoKPI
        label="Largest team"
        value={kpis.largestTeam ? `${kpis.largestTeam.memberCount}` : '—'}
        sub={kpis.largestTeam ? `${kpis.largestTeam.stationName} · ${kpis.largestTeam.inspectedOn}` : 'no data'}
      />
      <FoKPI
        label="Most-tagged helper"
        value={kpis.mostTaggedHelperThisYear ? kpis.mostTaggedHelperThisYear.displayName : '—'}
        sub={kpis.mostTaggedHelperThisYear ? `${kpis.mostTaggedHelperThisYear.count} helper assists this year` : 'no data'}
      />
    </div>
  );
}
```

Delete the entire function. Also remove the now-unused `FoKPI` import at the top:

Find:
```tsx
import FoKPI from './FoKPI';
```

Delete that line.

- [ ] **Step 4: Update every `SectionHeader` call site to pass `thisYear`**

`SectionHeader` is called in four places in `InspectorsSection.tsx` — the error state, loading state, empty state, and the main render. Each must pass `thisYear`. The error state and loading state don't have `data`, so they pass a sensible default (use current year as fallback so the empty UI still says "2026").

Find each `<SectionHeader />` and replace as follows:

Error state (around line 156):
```tsx
<SectionHeader />
```
Replace with:
```tsx
<SectionHeader thisYear={new Date().getUTCFullYear()} />
```

Loading state (around line 168):
```tsx
<SectionHeader />
```
Replace with:
```tsx
<SectionHeader thisYear={new Date().getUTCFullYear()} />
```

Empty state (around line 182) — `data` is non-null here (`hasAnyActivity` already evaluated `data`), so use `data.thisYear` directly:
```tsx
<SectionHeader />
```
Replace with:
```tsx
<SectionHeader thisYear={data.thisYear} />
```

Main render (around line 192):
```tsx
<SectionHeader />
```
Replace with:
```tsx
<SectionHeader thisYear={data.thisYear} />
```

- [ ] **Step 5: Replace `<KpiStrip />` call with `<TopPerformer />`**

In the main render section (around line 193), find:

```tsx
<KpiStrip kpis={data.kpis} />
```

Replace with:

```tsx
<TopPerformer inspectors={data.inspectors} thisYear={data.thisYear} />
```

- [ ] **Step 6: Verify the file compiles by running its consumer's tests**

There's no dedicated test file for `InspectorsSection`. Run the closest existing analytics test files to confirm no regression:

```bash
npx vitest run src/__tests__/api-analytics-inspectors.test.ts src/__tests__/top-performer.test.tsx
```

Expected: 13 pass (6 + 7 from the prior `api-analytics-inspectors` tests post-audit).

Also run a TypeScript compile check via the dev server's tmux capture (the file is part of the live build):

```bash
tmux capture-pane -t dev -p | tail -10
```

Look for `✓ Compiled` lines. If there's a `TypeError` or `Cannot find name`, fix it before committing.

- [ ] **Step 7: Commit**

```bash
git add src/components/analytics/InspectorsSection.tsx
git commit -m "$(cat <<'EOF'
refactor(analytics): replace KpiStrip with TopPerformer hero + year label

Drops the 3-card KPI strip (ACTIVE INSPECTORS / LARGEST TEAM /
MOST-TAGGED HELPER) and renders the single TopPerformer hero card
in its place. Section header now reads "Year-to-date team
performance · {year}" so the YTD context is explicit. The FoKPI
import is no longer needed in this file. The kpis fields in the
API response are intentionally left in place — see spec "Out of
scope" — only the UI consumption changes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Reorder `AnalyticsDashboard` + strip sidebar dead nav

**Files:**
- Modify: `src/components/analytics/AnalyticsDashboard.tsx`

- [ ] **Step 1: Strip the `SIDEBAR_ANALYZE` constant**

In `src/components/analytics/AnalyticsDashboard.tsx`, find lines 21-26:

```tsx
const SIDEBAR_ANALYZE = [
  { key: "Overview", active: true },
  { key: "FM Stations", active: false },
  { key: "Interference", active: false },
  { key: "Provinces", active: false },
] as const;
```

Delete the entire constant.

- [ ] **Step 2: Replace the sidebar's `.map(...)` with a single inert "Overview" pill**

Find the sidebar's render block (around lines 266-281):

```tsx
        <div className="fo-mono" style={{ marginBottom: 4 }}>
          ANALYZE
        </div>
        {SIDEBAR_ANALYZE.map(({ key, active }) => (
          <div
            key={key}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              background: active ? "rgba(0,104,74,0.08)" : "transparent",
              border: active ? "1px solid var(--fo-accent-2)" : "1px solid transparent",
              color: active ? "var(--fo-accent-2)" : "var(--fo-mute)",
            }}
          >
            {key}
          </div>
        ))}
```

Replace with:

```tsx
        <div className="fo-mono" style={{ marginBottom: 4 }}>
          ANALYZE
        </div>
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            background: "rgba(0,104,74,0.08)",
            border: "1px solid var(--fo-accent-2)",
            color: "var(--fo-accent-2)",
          }}
        >
          Overview
        </div>
```

- [ ] **Step 3: Move `<InspectorsSection />` to the top of the main column**

Find the existing `<InspectorsSection />` render at the END of the main column (around line 456):

```tsx
        <InspectorsSection />
      </div>
    </div>
  );
}
```

Delete that `<InspectorsSection />` line (leave the closing `</div></div>);}` structure intact).

Then find the start of the main column's content (after the `Header` block around line 352-353):

```tsx
        </div>

        {/* KPI row */}
        <div
          style={{
            display: "grid",
```

Insert `<InspectorsSection />` BEFORE the KPI row, and prepare to wrap the demoted content:

```tsx
        </div>

        <InspectorsSection />

        {/* Operations overview (secondary) */}
        <hr
          style={{
            border: "none",
            borderTop: "2px dashed var(--fo-line)",
            margin: "24px 0 16px",
          }}
        />
        <div
          className="fo-mono"
          style={{ color: "var(--fo-mute)", marginBottom: 12 }}
        >
          OPERATIONS OVERVIEW
        </div>

        {/* KPI row */}
        <div
          style={{
            display: "grid",
```

- [ ] **Step 4: Run the dev server smoke check**

```bash
tmux capture-pane -t dev -p | tail -10
```

Expected: `✓ Compiled` line with no errors. If the file fails to compile, fix the issue (most likely a missing closing brace or duplicate import) before committing.

- [ ] **Step 5: Manual smoke check (open the page)**

Open `http://localhost:3000/field-ops` and click the Analytics tab in the field-ops nav.

Confirm:
- Sidebar shows ANALYZE label + a single "Overview" pill + the UPDATED timestamp at the bottom. NO FM Stations / Interference / Provinces rows.
- Main column shows (in order): page header → TopPerformer hero card → leaderboard table → monthly chart → per-user donuts → dashed divider → "OPERATIONS OVERVIEW" mono label → existing FM/interference KPI row + 2 chart rows.
- Section header reads "Year-to-date team performance · 2026".
- No console errors in DevTools.

- [ ] **Step 6: Run the full test suite for regression**

```bash
npm test -- --run 2>&1 | tail -8
```

Expected: same baseline as before this plan started (the 25 pre-existing failures in components-batch4 / intermod-calculator-deep / field-ops-drawer / analytics.test.tsx). The 6 new TopPerformer tests should pass, no new failures introduced.

- [ ] **Step 7: Commit**

```bash
git add src/components/analytics/AnalyticsDashboard.tsx
git commit -m "$(cat <<'EOF'
refactor(analytics): promote team section to top + strip sidebar dead nav

Three coordinated changes to make the Analytics tab focus on team
performance:
- Sidebar: drop the 4-item ANALYZE list (Overview/FM Stations/
  Interference/Provinces were dead nav). Replace with a single
  inert "Overview" pill so the sidebar still has visual anchor +
  the UPDATED timestamp footer.
- Main column: move InspectorsSection from the BOTTOM to right
  after the page header — the TopPerformer hero is now the first
  thing the user sees.
- Operations overview: wrap the existing FM/interference content
  (KPI row + 2 chart rows) under a dashed divider + small mono
  label so it reads as the secondary lens it now is.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** Every spec section maps to a task:
  - Page structure → Task 3 (sidebar + reorder).
  - TopPerformer component (props, behavior, styling, no new fetch) → Task 1.
  - InspectorsSection changes (header year, drop KpiStrip, render TopPerformer) → Task 2.
  - AnalyticsDashboard changes (sidebar trim, reorder, divider+label) → Task 3.
  - Data flow (no API change) → confirmed in Tasks 1/2 (no new fetches).
  - Empty/loading/error states → Task 2 (every SectionHeader call site updated) + Task 1 (TopPerformer empty branch).
  - Testing → Task 1 (6 cases). No new test for InspectorsSection or AnalyticsDashboard per spec.
  - Out-of-scope items (kpis fields unused, daysAgo duplicated, Overview pill inert) → explicitly preserved.

- **Placeholder scan:** No "TBD", "add error handling", or unspecified code blocks. All commands have expected output.

- **Type consistency:**
  - `TopPerformer` prop type `InspectorsAnalytics['inspectors']` matches the field in `src/types/analytics.ts`.
  - `thisYear: number` matches the API response.
  - `SectionHeader` signature change in Task 2 is consistently updated in all 4 call sites.
  - The deleted `FoKPI` import in Task 2 doesn't break anything because `KpiStrip` was the only consumer in that file.

- **Sort trust:** Per spec, `TopPerformer` relies on the caller-provided DESC sort. The API route guarantees this (`inspectors.sort((a, b) => b.ytdTotal - a.ytdTotal)` at `src/app/api/analytics/inspectors/route.ts:182`). Test 4 pins this contract.
