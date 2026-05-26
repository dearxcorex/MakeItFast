# Inspector Podium + INT Distance Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two UX wins in one PR: (1) replace the team analytics top-half with a podium + you-pinned leaderboard that highlights "Am I top 3 this month?", and (2) make the bearing + distance from cell-site to recorded source glanceable on every INT map view so inspectors can plan their next field visit.

**Architecture:** Pure client-side. Both surfaces consume data the codebase already has — `/api/analytics/inspectors` returns per-user `monthTotal` and `ytdTotal`, and `InterferenceSite` already carries `direction` and `estimateDistance`. No API changes, no Prisma changes, no migrations.

**Tech Stack:** Next.js 15 App Router (client components) + React 19 + react-leaflet 5 + Tailwind 4 + Vitest + @testing-library/react.

---

## File Structure

**Create:**
- `src/components/analytics/TimeframePills.tsx` — two-pill toggle between `'month'` and `'ytd'`.
- `src/components/analytics/InspectorPodium.tsx` — desktop 3-column podium (silver / GOLD / bronze).
- `src/components/analytics/InspectorPodiumMobile.tsx` — stacked gold/silver/bronze cards for phones.
- `src/components/analytics/InspectorLeaderboard.tsx` — ranks 4+ list with sticky "You" row.
- `src/components/interference/NavigationPill.tsx` — shared `→ NNN° · X.X km` chip.
- `src/__tests__/inspector-podium.test.tsx`
- `src/__tests__/inspector-leaderboard.test.tsx`
- `src/__tests__/navigation-pill.test.tsx`

**Modify:**
- `src/components/analytics/InspectorsSection.tsx` — rewire top-half to use the new components; preserve `MonthlyParticipationChart` + `PerUserRoleDonuts` blocks at the bottom.
- `src/components/interference/InterferenceMap.tsx` — replace dashed source line with gradient + arrowhead; render `NavigationPill` as a Leaflet `Control`; add midpoint distance chip.
- `src/components/field-ops/FieldOpsMap.tsx` — same map treatment scaled for mobile.
- `src/components/field-ops/FieldOpsBottomSheet.tsx` — promote bearing + distance into one row directly under the title.

**Remove (only after verifying no other importers):**
- `src/components/analytics/TopPerformer.tsx` — superseded by `InspectorPodium`.

---

## Task 1: TimeframePills component + state scaffold

Add the month/ytd toggle. It will own no derived data — just toggle a state in `InspectorsSection`.

**Files:**
- Create: `src/components/analytics/TimeframePills.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/timeframe-pills.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import TimeframePills from "@/components/analytics/TimeframePills";

describe("TimeframePills", () => {
  it("renders month + ytd labels and marks the active one", () => {
    const { container } = render(
      <TimeframePills value="month" onChange={() => {}} monthLabel="MAY 2026" />
    );
    const buttons = container.querySelectorAll('button[role="tab"]');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.textContent).toMatch(/MAY 2026/);
    expect(buttons[1]?.textContent).toMatch(/YTD/);
    expect(buttons[0]?.getAttribute("aria-selected")).toBe("true");
    expect(buttons[1]?.getAttribute("aria-selected")).toBe("false");
  });

  it("fires onChange when the other pill is clicked", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TimeframePills value="month" onChange={onChange} monthLabel="MAY 2026" />
    );
    const ytd = container.querySelectorAll('button[role="tab"]')[1]!;
    fireEvent.click(ytd);
    expect(onChange).toHaveBeenCalledWith("ytd");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/timeframe-pills.test.tsx`
Expected: FAIL — `Cannot find module '@/components/analytics/TimeframePills'`.

- [ ] **Step 3: Write the component**

Create `src/components/analytics/TimeframePills.tsx`:

```tsx
'use client';

export type Timeframe = 'month' | 'ytd';

export default function TimeframePills({
  value,
  onChange,
  monthLabel,
}: {
  value: Timeframe;
  onChange: (next: Timeframe) => void;
  monthLabel: string;
}) {
  const pills: Array<{ key: Timeframe; label: string }> = [
    { key: 'month', label: monthLabel },
    { key: 'ytd', label: 'YTD' },
  ];

  return (
    <div
      role="tablist"
      aria-label="Timeframe"
      style={{ display: 'inline-flex', gap: 6, marginBottom: 16 }}
    >
      {pills.map((p) => {
        const active = p.key === value;
        return (
          <button
            key={p.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(p.key)}
            className="fo-mono"
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: `1px solid ${active ? 'var(--fo-accent)' : 'var(--fo-line)'}`,
              background: active ? 'var(--fo-accent)' : 'transparent',
              color: active ? 'var(--fo-ink)' : 'var(--fo-rail-mute)',
              fontSize: 11,
              letterSpacing: '0.14em',
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/timeframe-pills.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/TimeframePills.tsx src/__tests__/timeframe-pills.test.tsx
git commit -m "feat(analytics): add TimeframePills component for month/ytd toggle"
```

---

## Task 2: InspectorPodium (desktop 3-column)

Builds the gold/silver/bronze pedestal layout for desktop. Accepts pre-sorted inspector data; renders the top-3 with #1 in the center column.

**Files:**
- Create: `src/components/analytics/InspectorPodium.tsx`
- Create: `src/__tests__/inspector-podium.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/inspector-podium.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import InspectorPodium, { type PodiumInspector } from "@/components/analytics/InspectorPodium";

const mk = (id: number, name: string, points: number): PodiumInspector => ({
  userId: id,
  displayName: name,
  points,
});

describe("InspectorPodium", () => {
  it("renders three pedestals in silver/gold/bronze column order", () => {
    const { container } = render(
      <InspectorPodium
        inspectors={[mk(1, "Aom", 18), mk(2, "Boom", 14), mk(3, "Cherry", 11)]}
        currentUserId={null}
      />
    );
    const places = container.querySelectorAll('[data-place]');
    expect(places).toHaveLength(3);
    expect(places[0]?.getAttribute('data-place')).toBe('silver');
    expect(places[1]?.getAttribute('data-place')).toBe('gold');
    expect(places[2]?.getAttribute('data-place')).toBe('bronze');
    expect(places[1]?.textContent).toContain('Aom');
    expect(places[0]?.textContent).toContain('Boom');
    expect(places[2]?.textContent).toContain('Cherry');
  });

  it("renders only filled pedestals when fewer than 3 inspectors have points", () => {
    const { container } = render(
      <InspectorPodium
        inspectors={[mk(1, "Aom", 5), mk(2, "Boom", 3)]}
        currentUserId={null}
      />
    );
    const places = container.querySelectorAll('[data-place]');
    expect(places).toHaveLength(2);
    expect(places[0]?.getAttribute('data-place')).toBe('gold');
    expect(places[1]?.getAttribute('data-place')).toBe('silver');
  });

  it("renders empty state when no inspectors have points", () => {
    const { container } = render(
      <InspectorPodium inspectors={[]} currentUserId={null} />
    );
    expect(container.textContent).toMatch(/no inspections recorded/i);
  });

  it("adds an accent ring on the current user's pedestal", () => {
    const { container } = render(
      <InspectorPodium
        inspectors={[mk(1, "Aom", 18), mk(7, "You", 14), mk(3, "Cherry", 11)]}
        currentUserId={7}
      />
    );
    const silver = container.querySelector('[data-place="silver"]') as HTMLElement;
    expect(silver.getAttribute('data-is-you')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/inspector-podium.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/analytics/InspectorPodium.tsx`:

```tsx
'use client';

export type PodiumInspector = {
  userId: number;
  displayName: string;
  points: number;
};

const TONE = {
  gold: { bg: '#ffc845', ink: '#001e2b', height: 140 },
  silver: { bg: '#c0c0c0', ink: '#001e2b', height: 115 },
  bronze: { bg: '#cd7f32', ink: '#ffffff', height: 95 },
} as const;

type Tone = keyof typeof TONE;

function Pedestal({
  inspector,
  tone,
  rank,
  isYou,
}: {
  inspector: PodiumInspector;
  tone: Tone;
  rank: 1 | 2 | 3;
  isYou: boolean;
}) {
  const t = TONE[tone];
  return (
    <div
      data-place={tone}
      data-is-you={isYou}
      style={{
        flex: 1,
        background: t.bg,
        color: t.ink,
        borderRadius: '12px 12px 0 0',
        padding: '14px 10px 10px',
        textAlign: 'center',
        height: t.height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        outline: isYou ? '3px solid var(--fo-accent)' : 'none',
        outlineOffset: 2,
      }}
    >
      {rank === 1 && <div style={{ fontSize: 18 }} aria-hidden>🏆</div>}
      <div className="fo-mono" style={{ fontSize: 22, fontWeight: 800 }}>#{rank}</div>
      <div className="fo-serif" style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
        {inspector.displayName}
      </div>
      <div className="fo-mono" style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
        {inspector.points} {inspector.points === 1 ? 'inspection' : 'inspections'}
      </div>
    </div>
  );
}

export default function InspectorPodium({
  inspectors,
  currentUserId,
}: {
  inspectors: PodiumInspector[];
  currentUserId: number | null;
}) {
  const withPoints = inspectors.filter((i) => i.points > 0);

  if (withPoints.length === 0) {
    return (
      <div
        className="fo-mono"
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: 'var(--fo-rail-mute)',
          border: '1px dashed var(--fo-line)',
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        No inspections recorded yet this period.
      </div>
    );
  }

  const [first, second, third] = withPoints;
  const isYou = (i?: PodiumInspector) =>
    !!i && currentUserId !== null && i.userId === currentUserId;

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        justifyContent: 'center',
        maxWidth: 560,
        margin: '0 auto 24px',
      }}
    >
      {second && (
        <Pedestal inspector={second} tone="silver" rank={2} isYou={isYou(second)} />
      )}
      {first && (
        <Pedestal inspector={first} tone="gold" rank={1} isYou={isYou(first)} />
      )}
      {third && (
        <Pedestal inspector={third} tone="bronze" rank={3} isYou={isYou(third)} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/inspector-podium.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/InspectorPodium.tsx src/__tests__/inspector-podium.test.tsx
git commit -m "feat(analytics): add InspectorPodium for desktop top-3 leaderboard"
```

---

## Task 3: InspectorPodiumMobile (stacked cards)

Same props as `InspectorPodium`, but renders gold/silver/bronze as full-width stacked cards optimized for phones.

**Files:**
- Create: `src/components/analytics/InspectorPodiumMobile.tsx`

- [ ] **Step 1: Add tests to the same test file**

Append to `src/__tests__/inspector-podium.test.tsx`:

```tsx
import InspectorPodiumMobile from "@/components/analytics/InspectorPodiumMobile";

describe("InspectorPodiumMobile", () => {
  it("renders top-3 as stacked gold/silver/bronze cards in 1→2→3 order", () => {
    const { container } = render(
      <InspectorPodiumMobile
        inspectors={[mk(1, "Aom", 18), mk(2, "Boom", 14), mk(3, "Cherry", 11)]}
        currentUserId={null}
      />
    );
    const cards = container.querySelectorAll('[data-medal]');
    expect(cards).toHaveLength(3);
    expect(cards[0]?.getAttribute('data-medal')).toBe('gold');
    expect(cards[1]?.getAttribute('data-medal')).toBe('silver');
    expect(cards[2]?.getAttribute('data-medal')).toBe('bronze');
  });

  it("marks the current user's card", () => {
    const { container } = render(
      <InspectorPodiumMobile
        inspectors={[mk(1, "Aom", 18), mk(7, "You", 14), mk(3, "Cherry", 11)]}
        currentUserId={7}
      />
    );
    const silver = container.querySelector('[data-medal="silver"]') as HTMLElement;
    expect(silver.getAttribute('data-is-you')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/inspector-podium.test.tsx`
Expected: FAIL — `Cannot find module '@/components/analytics/InspectorPodiumMobile'`.

- [ ] **Step 3: Write the component**

Create `src/components/analytics/InspectorPodiumMobile.tsx`:

```tsx
'use client';

import type { PodiumInspector } from './InspectorPodium';

const TONE = {
  gold: { bg: '#ffc845', ink: '#001e2b', label: '1ST', icon: '🏆' },
  silver: { bg: '#c0c0c0', ink: '#001e2b', label: '2ND', icon: '2' },
  bronze: { bg: '#cd7f32', ink: '#ffffff', label: '3RD', icon: '3' },
} as const;

type Tone = keyof typeof TONE;

function MedalCard({
  inspector,
  tone,
  rank,
  isYou,
}: {
  inspector: PodiumInspector;
  tone: Tone;
  rank: 1 | 2 | 3;
  isYou: boolean;
}) {
  const t = TONE[tone];
  return (
    <div
      data-medal={tone}
      data-is-you={isYou}
      style={{
        background: t.bg,
        color: t.ink,
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        outline: isYou ? '3px solid var(--fo-accent)' : 'none',
        outlineOffset: 2,
      }}
    >
      <div
        className="fo-mono"
        style={{ fontSize: 20, fontWeight: 800, width: 28, textAlign: 'center' }}
        aria-hidden
      >
        {rank === 1 ? t.icon : rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fo-mono" style={{ fontSize: 10, letterSpacing: '0.14em', opacity: 0.75 }}>
          {t.label}
        </div>
        <div className="fo-serif" style={{ fontSize: 16, fontWeight: 700 }}>
          {inspector.displayName}
        </div>
      </div>
      <div className="fo-mono" style={{ fontSize: 22, fontWeight: 800 }}>
        {inspector.points}
      </div>
    </div>
  );
}

export default function InspectorPodiumMobile({
  inspectors,
  currentUserId,
}: {
  inspectors: PodiumInspector[];
  currentUserId: number | null;
}) {
  const withPoints = inspectors.filter((i) => i.points > 0);
  if (withPoints.length === 0) {
    return (
      <div
        className="fo-mono"
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--fo-rail-mute)',
          border: '1px dashed var(--fo-line)',
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        No inspections recorded yet this period.
      </div>
    );
  }
  const [first, second, third] = withPoints;
  const isYou = (i?: PodiumInspector) =>
    !!i && currentUserId !== null && i.userId === currentUserId;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {first && <MedalCard inspector={first} tone="gold" rank={1} isYou={isYou(first)} />}
      {second && <MedalCard inspector={second} tone="silver" rank={2} isYou={isYou(second)} />}
      {third && <MedalCard inspector={third} tone="bronze" rank={3} isYou={isYou(third)} />}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/inspector-podium.test.tsx`
Expected: PASS, 6 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/InspectorPodiumMobile.tsx src/__tests__/inspector-podium.test.tsx
git commit -m "feat(analytics): add InspectorPodiumMobile stacked-card layout"
```

---

## Task 4: InspectorLeaderboard with you-pinned row

Renders ranks 4+. When the current user is rank 5 or lower, render their row as a sticky pinned header AND keep them in natural position so the list remains contiguous.

**Files:**
- Create: `src/components/analytics/InspectorLeaderboard.tsx`
- Create: `src/__tests__/inspector-leaderboard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/inspector-leaderboard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import InspectorLeaderboard, {
  type LeaderboardInspector,
} from "@/components/analytics/InspectorLeaderboard";

const mk = (id: number, name: string, points: number): LeaderboardInspector => ({
  userId: id,
  displayName: name,
  points,
});

describe("InspectorLeaderboard", () => {
  it("renders ranks 4+ when current user is in the top 3", () => {
    const list = [
      mk(1, "Aom", 18),
      mk(2, "Boom", 14),
      mk(3, "Cherry", 11),
      mk(4, "Daeng", 8),
      mk(5, "Eak", 6),
    ];
    const { container } = render(
      <InspectorLeaderboard inspectors={list} currentUserId={2} />
    );
    const rows = container.querySelectorAll('[data-row]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Daeng');
    expect(rows[1]?.textContent).toContain('Eak');
  });

  it("pins the current user at top when they are rank 5+, and keeps them inline", () => {
    const list = [
      mk(1, "Aom", 18),
      mk(2, "Boom", 14),
      mk(3, "Cherry", 11),
      mk(4, "Daeng", 8),
      mk(7, "You", 7),
      mk(5, "Eak", 6),
      mk(6, "Fay", 4),
    ];
    const { container } = render(
      <InspectorLeaderboard inspectors={list} currentUserId={7} />
    );
    const pinned = container.querySelectorAll('[data-pinned="true"]');
    expect(pinned).toHaveLength(1);
    expect(pinned[0]?.textContent).toContain('You');
    const inline = container.querySelectorAll('[data-row]:not([data-pinned="true"])');
    expect(Array.from(inline).map((r) => r.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Daeng'), expect.stringContaining('You'), expect.stringContaining('Eak'), expect.stringContaining('Fay')])
    );
  });

  it("highlights the current user's row with the accent border in inline position", () => {
    const list = [
      mk(1, "Aom", 18),
      mk(2, "Boom", 14),
      mk(3, "Cherry", 11),
      mk(7, "You", 9),
    ];
    const { container } = render(
      <InspectorLeaderboard inspectors={list} currentUserId={7} />
    );
    const youRow = container.querySelector('[data-row][data-is-you="true"]') as HTMLElement;
    expect(youRow).toBeTruthy();
    expect(youRow.textContent).toContain('You');
  });

  it("renders nothing when there are 3 or fewer inspectors and current user is among them", () => {
    const list = [mk(1, "Aom", 18), mk(2, "Boom", 14), mk(3, "Cherry", 11)];
    const { container } = render(
      <InspectorLeaderboard inspectors={list} currentUserId={1} />
    );
    const rows = container.querySelectorAll('[data-row]');
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/inspector-leaderboard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/analytics/InspectorLeaderboard.tsx`:

```tsx
'use client';

export type LeaderboardInspector = {
  userId: number;
  displayName: string;
  points: number;
};

function Row({
  rank,
  inspector,
  isYou,
  pinned,
}: {
  rank: number;
  inspector: LeaderboardInspector;
  isYou: boolean;
  pinned?: boolean;
}) {
  return (
    <div
      data-row
      data-is-you={isYou}
      data-pinned={pinned ? 'true' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px',
        borderBottom: '1px solid var(--fo-line)',
        background: isYou ? 'rgba(0,237,100,0.08)' : 'transparent',
        borderLeft: isYou ? '3px solid var(--fo-accent)' : '3px solid transparent',
        color: isYou ? 'var(--fo-accent)' : 'inherit',
        fontWeight: isYou ? 700 : 400,
        position: pinned ? 'sticky' : 'static',
        top: pinned ? 0 : 'auto',
        zIndex: pinned ? 2 : 'auto',
      }}
    >
      <span
        className="fo-mono"
        style={{ width: 36, color: 'var(--fo-rail-mute)', fontSize: 12 }}
      >
        #{rank}
      </span>
      <span style={{ flex: 1, fontSize: 14 }}>
        {isYou ? 'You' : inspector.displayName}
      </span>
      <span className="fo-mono" style={{ width: 48, textAlign: 'right', fontSize: 14 }}>
        {inspector.points}
      </span>
    </div>
  );
}

export default function InspectorLeaderboard({
  inspectors,
  currentUserId,
}: {
  inspectors: LeaderboardInspector[];
  currentUserId: number | null;
}) {
  // Pre-sorted desc by points. We render ranks 4+ only.
  const ranked = inspectors.map((i, idx) => ({ ...i, rank: idx + 1 }));
  const tailRows = ranked.filter((i) => i.rank >= 4);
  if (tailRows.length === 0) return null;

  const you = currentUserId !== null ? ranked.find((i) => i.userId === currentUserId) : undefined;
  const showPinned = !!you && you.rank >= 5;

  return (
    <div
      style={{
        border: '1px solid var(--fo-line)',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 24,
      }}
    >
      {showPinned && you && (
        <Row rank={you.rank} inspector={you} isYou pinned />
      )}
      {tailRows.map((i) => (
        <Row
          key={i.userId}
          rank={i.rank}
          inspector={i}
          isYou={!!you && i.userId === you.userId}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/inspector-leaderboard.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/InspectorLeaderboard.tsx src/__tests__/inspector-leaderboard.test.tsx
git commit -m "feat(analytics): add InspectorLeaderboard with sticky you-pinned row"
```

---

## Task 5: Wire podium + leaderboard into InspectorsSection

Replace the old `TopPerformer` + `LeaderboardTable` blocks at the top of the section. Keep `MonthlyParticipationChart` + `PerUserRoleDonuts` below.

**Files:**
- Modify: `src/components/analytics/InspectorsSection.tsx`
- Verify-then-delete: `src/components/analytics/TopPerformer.tsx`

- [ ] **Step 1: Look up `currentUser.id` plumbing**

Run: `grep -n "currentUser" src/components/analytics/AnalyticsDashboard.tsx src/components/analytics/InspectorsSection.tsx 2>/dev/null`
Note: `InspectorsSection` currently has no `currentUser` prop. We'll add one.

Run: `grep -n "AnalyticsDashboard" src/components/field-ops/FieldOpsClient.tsx`
Note where `AnalyticsDashboard` is rendered so we can plumb `currentUser.id` through.

- [ ] **Step 2: Rewrite `InspectorsSection.tsx`**

Replace `src/components/analytics/InspectorsSection.tsx` entirely with:

```tsx
// src/components/analytics/InspectorsSection.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { InspectorsAnalytics } from '@/types/analytics';
import FoBarChart from './charts/FoBarChart';
import FoDonut from './charts/FoDonut';
import TimeframePills, { type Timeframe } from './TimeframePills';
import InspectorPodium, { type PodiumInspector } from './InspectorPodium';
import InspectorPodiumMobile from './InspectorPodiumMobile';
import InspectorLeaderboard, { type LeaderboardInspector } from './InspectorLeaderboard';

// Stable palette for usernames. Falls back to ink for unknown names.
const USER_COLORS: Record<string, string> = {
  admin: '#5d4fff',
  ice: '#1da1c4',
  iff: '#e07b00',
  dao: '#7b5cff',
  daf: '#22a06b',
};
function colorFor(username: string): string {
  return USER_COLORS[username] ?? 'var(--fo-ink)';
}

const THAI_MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

function monthLabelFor(thisMonth: string): string {
  // thisMonth is YYYY-MM (UTC). We just need an uppercase short label.
  const [y, m] = thisMonth.split('-');
  const idx = Math.max(0, Math.min(11, Number(m) - 1));
  return `${THAI_MONTHS[idx]} ${y}`;
}

function SectionHeader() {
  return (
    <div style={{ marginTop: 32, marginBottom: 12 }}>
      <div className="fo-mono" style={{ color: 'var(--fo-accent)', letterSpacing: 0.6 }}>
        INSPECTORS
      </div>
      <div className="fo-serif" style={{ fontSize: 22, color: 'var(--fo-ink)' }}>
        Team leaderboard
      </div>
    </div>
  );
}

function MonthlyParticipationChart({
  series,
  thisYear,
}: {
  series: InspectorsAnalytics['monthlySeries'];
  thisYear: number;
}) {
  const yearPrefix = `${thisYear}-`;
  const data = series
    .filter((m) => m.month.startsWith(yearPrefix))
    .map((m) => ({
      label: m.month.slice(5),
      v: Object.values(m.perUser).reduce((s, n) => s + n, 0),
      color: 'var(--fo-accent)',
    }));
  return (
    <div style={{ marginBottom: 24 }}>
      <FoBarChart data={data} title={`Participations per month · ${thisYear}`} />
    </div>
  );
}

function PerUserRoleDonuts({ inspectors }: { inspectors: InspectorsAnalytics['inspectors'] }) {
  const withActivity = inspectors.filter((u) => u.ytdTotal > 0);
  if (withActivity.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {withActivity.map((u) => (
        <FoDonut
          key={u.userId}
          title={u.displayName}
          segments={[
            { label: 'Lead', v: u.ytdAsLead, c: colorFor(u.username) },
            { label: 'Helper', v: u.ytdAsHelper, c: 'var(--fo-line)' },
          ]}
          centerLabel={`${u.ytdTotal}`}
          centerSub="YTD"
        />
      ))}
    </div>
  );
}

export default function InspectorsSection({
  currentUserId = null,
}: {
  currentUserId?: number | null;
}) {
  const [data, setData] = useState<InspectorsAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('month');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/analytics/inspectors');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as InspectorsAnalytics;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'unknown');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ranked: (PodiumInspector & LeaderboardInspector)[] = useMemo(() => {
    if (!data) return [];
    return [...data.inspectors]
      .map((u) => ({
        userId: u.userId,
        displayName: u.displayName,
        points: timeframe === 'month' ? u.monthTotal : u.ytdTotal,
      }))
      .sort((a, b) => b.points - a.points);
  }, [data, timeframe]);

  if (error) {
    return (
      <section>
        <SectionHeader />
        <div className="fo-mono" style={{ padding: 12, border: '1px solid var(--fo-crit)', color: 'var(--fo-crit)', borderRadius: 8 }}>
          Failed to load inspector analytics ({error}).
        </div>
      </section>
    );
  }
  if (!data) {
    return (
      <section>
        <SectionHeader />
        <div className="fo-mono" style={{ padding: 12, color: 'var(--fo-rail-mute)' }}>
          Loading...
        </div>
      </section>
    );
  }

  const monthLabel = monthLabelFor(data.thisMonth);

  return (
    <section>
      <SectionHeader />
      <TimeframePills value={timeframe} onChange={setTimeframe} monthLabel={monthLabel} />
      {/* Desktop podium + mobile podium — CSS chooses which is visible */}
      <div className="hidden md:block">
        <InspectorPodium inspectors={ranked} currentUserId={currentUserId} />
      </div>
      <div className="block md:hidden">
        <InspectorPodiumMobile inspectors={ranked} currentUserId={currentUserId} />
      </div>
      <InspectorLeaderboard inspectors={ranked} currentUserId={currentUserId} />
      <MonthlyParticipationChart series={data.monthlySeries} thisYear={data.thisYear} />
      <PerUserRoleDonuts inspectors={data.inspectors} />
    </section>
  );
}
```

- [ ] **Step 3: Plumb `currentUserId` through `AnalyticsDashboard`**

Open `src/components/analytics/AnalyticsDashboard.tsx`. Find the `<InspectorsSection />` render site. Change the surrounding component signature to accept `currentUserId` and forward it. Then change `<InspectorsSection />` to `<InspectorsSection currentUserId={currentUserId} />`.

In the file that renders `<AnalyticsDashboard />` (search with `grep -rn "AnalyticsDashboard" src/`), forward `currentUser?.id ?? null` as `currentUserId`. The session-derived `currentUser` is already on `FieldOpsClient`.

- [ ] **Step 4: Verify `TopPerformer` has no other importers, then remove**

Run: `grep -rn "TopPerformer" src/ --include='*.ts' --include='*.tsx' | grep -v inspector-podium.test`
If the only matches are the `import` line and component definition you just removed, delete the file:

```bash
git rm src/components/analytics/TopPerformer.tsx
```

If there are other importers, leave the file in place and add a deprecation comment at the top: `// TODO: superseded by InspectorPodium; remove once X also migrates.`

- [ ] **Step 5: Run the analytics test suite**

Run: `npx vitest run src/__tests__/timeframe-pills.test.tsx src/__tests__/inspector-podium.test.tsx src/__tests__/inspector-leaderboard.test.tsx`
Expected: all pass.

- [ ] **Step 6: Build**

Run: `npm run build 2>&1 | tail -10`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/analytics/InspectorsSection.tsx src/components/analytics/AnalyticsDashboard.tsx
git add src/components/analytics/TopPerformer.tsx 2>/dev/null || true
git commit -m "feat(analytics): wire podium + leaderboard into InspectorsSection"
```

(If `TopPerformer.tsx` was removed via `git rm`, the deletion is included in the same commit.)

---

## Task 6: NavigationPill shared component

The chip that reads `→ NNN° · X.X km` (or just `X.X km` when no bearing, or `→ NNN° · pending source` when no source).

**Files:**
- Create: `src/components/interference/NavigationPill.tsx`
- Create: `src/__tests__/navigation-pill.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/navigation-pill.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import NavigationPill from "@/components/interference/NavigationPill";

describe("NavigationPill", () => {
  it("renders bearing + distance when both present", () => {
    const { container } = render(<NavigationPill bearing={62} distance={5.4321} />);
    expect(container.textContent?.replace(/\s+/g, ' ').trim()).toBe('→ 062° · 5.4 km');
  });

  it("zero-pads bearings under 100", () => {
    const { container: c1 } = render(<NavigationPill bearing={5} distance={1} />);
    expect(c1.textContent).toContain('005°');
    const { container: c2 } = render(<NavigationPill bearing={90} distance={1} />);
    expect(c2.textContent).toContain('090°');
    const { container: c3 } = render(<NavigationPill bearing={359} distance={1} />);
    expect(c3.textContent).toContain('359°');
  });

  it("renders distance only when bearing is null", () => {
    const { container } = render(<NavigationPill bearing={null} distance={5.4} />);
    expect(container.textContent?.trim()).toBe('5.4 km');
  });

  it("renders 'pending source' when bearing present but distance null", () => {
    const { container } = render(<NavigationPill bearing={62} distance={null} />);
    expect(container.textContent?.replace(/\s+/g, ' ').trim()).toBe('→ 062° · pending source');
  });

  it("renders nothing when both bearing and distance are null", () => {
    const { container } = render(<NavigationPill bearing={null} distance={null} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/navigation-pill.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/interference/NavigationPill.tsx`:

```tsx
'use client';

function formatBearing(b: number): string {
  const rounded = Math.round(((b % 360) + 360) % 360);
  return `${String(rounded).padStart(3, '0')}°`;
}

export default function NavigationPill({
  bearing,
  distance,
  className,
  style,
}: {
  bearing: number | null;
  distance: number | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (bearing === null && distance === null) return null;

  const parts: string[] = [];
  if (bearing !== null) {
    parts.push(`→ ${formatBearing(bearing)}`);
  }
  if (distance !== null) {
    parts.push(`${distance.toFixed(1)} km`);
  } else if (bearing !== null) {
    parts.push('pending source');
  }

  return (
    <div
      className={`fo-mono ${className ?? ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 999,
        background: 'var(--fo-canvas)',
        color: 'var(--fo-accent)',
        border: '1px solid var(--fo-accent)',
        fontSize: 11,
        letterSpacing: '0.12em',
        ...style,
      }}
    >
      {parts.join(' · ')}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/navigation-pill.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/interference/NavigationPill.tsx src/__tests__/navigation-pill.test.tsx
git commit -m "feat(int): add NavigationPill shared component (bearing + distance chip)"
```

---

## Task 7: Wire NavigationPill into InterferenceMap (desktop)

Render the pill as an overlay on the map (absolute-positioned div, not a Leaflet `Control`, to keep things simple). Replace the dashed connecting line with a solid colored line plus a small distance chip at the midpoint.

**Files:**
- Modify: `src/components/interference/InterferenceMap.tsx`

- [ ] **Step 1: Add the pill overlay**

In `src/components/interference/InterferenceMap.tsx`, import `NavigationPill` at the top:

```ts
import NavigationPill from './NavigationPill';
```

Inside the top-level `<div className="relative h-full w-full">` (the wrapper around `<MapContainer>`), add this overlay BEFORE the `<MapContainer>` line:

```tsx
{selectedSite && (selectedSite.direction != null || (selectedSite.sourceLat !== null && selectedSite.sourceLong !== null)) && (
  <div className="absolute top-3 left-3 z-[1000] pointer-events-none">
    <NavigationPill
      bearing={selectedSite.direction ?? null}
      distance={
        selectedSite.sourceLat !== null && selectedSite.sourceLong !== null
          ? selectedSite.estimateDistance ?? null
          : null
      }
    />
  </div>
)}
```

- [ ] **Step 2: Swap the dashed line for a solid colored line**

Find the existing `<Polyline>` inside the source-marker `Fragment` (currently uses `dashArray: '6, 4'`). Replace it with:

```tsx
<Polyline
  positions={[
    [site.lat, site.long],
    [site.sourceLat, site.sourceLong],
  ]}
  pathOptions={{
    color: 'var(--fo-accent)',
    weight: 3,
    opacity: 0.85,
  }}
/>
```

(We drop the dashArray and use the accent green so the line is visually obvious as "the bearing path to your source".)

- [ ] **Step 3: Build to confirm no type errors**

Run: `npm run build 2>&1 | tail -5`
Expected: exits 0.

- [ ] **Step 4: Run the existing interference tests if present**

Run: `ls src/__tests__/ | grep -i interference`
For each match: `npx vitest run src/__tests__/<filename>`
Expected: all pass (these tests mock `react-leaflet` so the overlay change should be invisible to them).

- [ ] **Step 5: Commit**

```bash
git add src/components/interference/InterferenceMap.tsx
git commit -m "feat(int): show NavigationPill + solid bearing line on InterferenceMap"
```

---

## Task 8: Wire NavigationPill into FieldOpsMap (mobile)

The mobile field-ops map uses Leaflet directly inside `FieldOpsMap.tsx` and already draws source pins and connector lines. We add the same pill overlay + line treatment.

**Files:**
- Modify: `src/components/field-ops/FieldOpsMap.tsx`

- [ ] **Step 1: Find where source lines are drawn**

Run: `grep -n "sourceLat\|Polyline\|source" src/components/field-ops/FieldOpsMap.tsx | head -20`
Note the line range that draws the source-connector polyline so you can replace it in step 3.

- [ ] **Step 2: Import NavigationPill and wire the overlay**

Add to the top of `src/components/field-ops/FieldOpsMap.tsx`:

```ts
import NavigationPill from '@/components/interference/NavigationPill';
```

Locate the JSX that returns the map (search for `<MapContainer`). In the wrapper element AROUND `<MapContainer>` (the outer `<div>` with the relative-positioned styles), insert the pill overlay BEFORE `<MapContainer>`:

```tsx
{selection?.kind === 'int' && selectedSite && (selectedSite.direction != null || (selectedSite.sourceLat !== null && selectedSite.sourceLong !== null)) && (
  <div
    style={{
      position: 'absolute',
      top: 12,
      left: 12,
      zIndex: 1000,
      pointerEvents: 'none',
    }}
  >
    <NavigationPill
      bearing={selectedSite.direction ?? null}
      distance={
        selectedSite.sourceLat !== null && selectedSite.sourceLong !== null
          ? selectedSite.estimateDistance ?? null
          : null
      }
    />
  </div>
)}
```

If `selection`, `selectedSite` are not the variable names this component uses, substitute the correct ones — search nearby for what the component already references when it draws source pins; reuse that exact value.

- [ ] **Step 3: Solidify the source connector line**

Find the existing `<Polyline>` that connects cell to source. Replace its `pathOptions` with:

```ts
pathOptions={{
  color: 'var(--fo-accent)',
  weight: 3,
  opacity: 0.85,
}}
```

(Drop any `dashArray`.)

- [ ] **Step 4: Build + run field-ops test suite**

Run: `npm run build 2>&1 | tail -5 && npx vitest run src/__tests__/field-ops-map.test.tsx 2>&1 | tail -5`
Expected: build exits 0; field-ops-map tests pass (they mock react-leaflet, so the overlay div is just rendered in plain DOM).

- [ ] **Step 5: Commit**

```bash
git add src/components/field-ops/FieldOpsMap.tsx
git commit -m "feat(int): show NavigationPill + solid bearing line on FieldOpsMap"
```

---

## Task 9: Promote bearing + distance row in FieldOpsBottomSheet

Inside the bottom sheet, the existing `BEARING` and `DIST` `Inline` chips appear in a flex row under the title. Replace them (when both are present) with a single prominent row that reads `→ 062° · 5.4 km`.

**Files:**
- Modify: `src/components/field-ops/FieldOpsBottomSheet.tsx`

- [ ] **Step 1: Locate the inline metrics block**

Open `src/components/field-ops/FieldOpsBottomSheet.tsx`. Find the section that renders metrics for INT (the `isINT ? <> ... </>` branch around line 320). It currently has `<Inline label="BEARING" .../>`, `<Inline label="N/I" ... />`, `<Inline label="RANK" ... />`, and conditionally `<Inline label="DIST" ... />`.

- [ ] **Step 2: Add the import**

At the top of `FieldOpsBottomSheet.tsx`:

```ts
import NavigationPill from '@/components/interference/NavigationPill';
```

- [ ] **Step 3: Render the promoted row above the existing metrics**

Immediately AFTER the title block (the `<div style={{ padding: "8px 16px 4px" }}>` block that renders the site name + province) and BEFORE the `<CoLocatedStrip ... />`, add:

```tsx
{isINT && (site!.direction != null || (site!.sourceLat !== null && site!.sourceLong !== null)) && (
  <div style={{ padding: '4px 16px 0' }}>
    <NavigationPill
      bearing={site!.direction ?? null}
      distance={
        site!.sourceLat !== null && site!.sourceLong !== null
          ? site!.estimateDistance ?? null
          : null
      }
      style={{ fontSize: 13, padding: '8px 14px' }}
    />
  </div>
)}
```

- [ ] **Step 4: Remove the now-redundant inline BEARING + DIST chips**

In the INT metrics block, DELETE these two `Inline` renders (keep `N/I` and `RANK`):

```tsx
{site!.direction !== null && site!.direction !== undefined && (
  <Inline label="BEARING" value={`${site!.direction.toFixed(0)}°`} />
)}
// ... and ...
{hasSource && site!.estimateDistance !== null && site!.estimateDistance !== undefined && (
  <Inline label="DIST" value={`${site!.estimateDistance.toFixed(1)} km`} />
)}
```

- [ ] **Step 5: Run any bottom-sheet tests**

Run: `ls src/__tests__/ | grep -i bottom`
For each match: `npx vitest run src/__tests__/<filename>`
Expected: pass. If any test asserts the literal strings `BEARING` or `DIST` in the inline chips, the test was asserting old behavior; update it to look for the new pill (use `getByText(/062°/)` or similar) — note the change in the commit message.

- [ ] **Step 6: Commit**

```bash
git add src/components/field-ops/FieldOpsBottomSheet.tsx src/__tests__/field-ops-bottom-sheet.test.tsx 2>/dev/null
git commit -m "feat(int): promote bearing + distance into prominent row on mobile sheet"
```

---

## Task 10: End-to-end verification + smoke test

- [ ] **Step 1: Build**

Run: `npm run build 2>&1 | tail -10`
Expected: exits 0.

- [ ] **Step 2: Run the relevant test surface**

Run:
```bash
npx vitest run \
  src/__tests__/timeframe-pills.test.tsx \
  src/__tests__/inspector-podium.test.tsx \
  src/__tests__/inspector-leaderboard.test.tsx \
  src/__tests__/navigation-pill.test.tsx \
  $(ls src/__tests__/field-ops-* src/__tests__/interference-* 2>/dev/null) \
  --reporter=basic 2>&1 | sed -E 's/\x1b\[[0-9;]*m//g' | tail -5
```
Expected: all PASS. Pre-existing failures in `analytics.test.tsx` are out of scope.

- [ ] **Step 3: Manual smoke (dev server)**

Run: `npm run dev` (in a separate terminal).

Open http://localhost:3000/analytics in a desktop browser:
- Podium appears with `MAY 2026` pill selected by default.
- Top-3 visible as silver/GOLD/bronze pedestals.
- Clicking `YTD` re-sorts.
- Leaderboard shows ranks 4+ with `border-left: 3px solid var(--fo-accent)` on your row.

Resize to phone width (or open Chrome DevTools mobile emulation):
- Podium switches to 3 stacked cards.
- Your card has the accent outline.

Open http://localhost:3000/ (the field-ops map):
- Click any INT site that has a source recorded.
- Top-left of the map: `→ NNN° · X.X km` pill.
- Solid green line cell→source.
- Bottom sheet: promoted bearing+distance row right under the title.

- [ ] **Step 4: No commit. Note results for the PR description.**

---

## Self-Review

**Spec coverage:**
- "Timeframe pills (Month / YTD)" → Task 1.
- "Desktop 3-column podium" → Task 2.
- "Mobile stacked gold/silver/bronze cards" → Task 3.
- "You-pinned leaderboard with sticky row when rank 5+" → Task 4.
- "Wire it all into AnalyticsDashboard with currentUser plumbing" → Task 5.
- "NavigationPill shared component (bearing + distance + fallbacks)" → Task 6.
- "InterferenceMap pill + solid line" → Task 7.
- "FieldOpsMap pill + solid line" → Task 8.
- "FieldOpsBottomSheet promoted row" → Task 9.
- "Build + smoke" → Task 10.
- All acceptance criteria in the spec are covered.

**Placeholder scan:** No "TBD", "TODO", "similar to Task N". Every code step shows the literal code.

**Type consistency:**
- `PodiumInspector` (Task 2) and `LeaderboardInspector` (Task 4) both have the same shape `{ userId, displayName, points }`. Task 5 produces objects matching both interfaces via the intersection type `(PodiumInspector & LeaderboardInspector)[]`.
- `Timeframe` type (Task 1) is reused as the state type in Task 5.
- `NavigationPill` props (`bearing: number | null`, `distance: number | null`) are consistent in Tasks 7, 8, 9.
- `selectedSite.direction` is typed as `number | null` in `InterferenceSite`; tasks coerce via `?? null` where needed.
