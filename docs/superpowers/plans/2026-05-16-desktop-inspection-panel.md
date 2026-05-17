# Desktop Field-Ops Inspection Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy `✓ INSPECT` toggle in the desktop field-ops right rail with a field-ops-themed `FieldOpsInspectionPanel` that shows the inspection date, lead inspector, helpers, history, and a `+ บันทึก` recording form.

**Architecture:** Build a new dark-themed sibling of `InspectionPanel` (`FieldOpsInspectionPanel`) that consumes the same props and calls the same `onCreate` callback. Wire it into `FieldOpsCurrentFM`, drop the legacy toggle path entirely for FM stations, and trim the now FM-dead `handleToggleInspection` in `FieldOpsClient` down to its interference branch.

**Tech Stack:** Next.js 15, React 19, TypeScript, vitest + @testing-library/react. No new dependencies. Uses existing `--fo-*` CSS variables (defined in `src/app/field-ops.css`) for styling.

**Spec:** `docs/superpowers/specs/2026-05-16-desktop-inspection-panel-design.md`

---

## File map

**Create:**
- `src/components/field-ops/FieldOpsInspectionPanel.tsx` — themed panel + inline `FieldOpsNewInspectionForm` subcomponent.
- `src/__tests__/field-ops-inspection-panel.test.tsx` — unit tests for the new panel.

**Modify:**
- `src/components/field-ops/FieldOpsCurrent.tsx` — `FieldOpsCurrentFM` drops `onToggleInspection`, gains 5 inspection props, renders the panel.
- `src/components/field-ops/FieldOpsClient.tsx` — passes the 5 new props to `<FieldOpsCurrentFM>`; renames `handleToggleInspection` → `handleToggleInterferenceInspection` and trims the FM branch.
- `src/__tests__/field-ops-current.test.tsx` — drops the four legacy `INSPECT`-button assertions, replaces with a panel-renders assertion.

**Conventions verified in the codebase:**
- Mobile bottom sheet `FieldOpsBottomSheet` keeps its `onToggleInspection` prop (still used for interference sites). Only `FieldOpsCurrentFM` loses the prop.
- Tests use `vitest` + `@testing-library/react`; the project pattern is `render` → `container.querySelectorAll` / `getByRole` / `getByLabelText` → cleanup via explicit `afterEach(cleanup)` (see `src/__tests__/inspection-panel.test.tsx`).
- Mock prisma is unnecessary here — these are pure React unit tests.

---

## Task 1: Failing test for `FieldOpsInspectionPanel`

**Files:**
- Create: `src/__tests__/field-ops-inspection-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/field-ops-inspection-panel.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import FieldOpsInspectionPanel from '@/components/field-ops/FieldOpsInspectionPanel';
import type { StationInspection } from '@/types/inspection';

const HISTORY: StationInspection[] = [
  {
    id: 10, stationId: 1, inspectedOn: '2026-04-21', source: 'app',
    lead: { userId: 3, username: 'iff', displayName: 'iff' },
    helpers: [{ userId: 6, username: 'daf', displayName: 'daf' }],
    createdAt: '2026-04-21T00:00:00Z',
  },
  {
    id: 9, stationId: 1, inspectedOn: '2026-02-12', source: 'app',
    lead: { userId: 2, username: 'ice', displayName: 'ice' },
    helpers: [],
    createdAt: '2026-02-12T00:00:00Z',
  },
];

const INSPECTORS = [
  { id: 1, username: 'admin', displayName: 'Admin' },
  { id: 2, username: 'ice', displayName: 'ice' },
  { id: 3, username: 'iff', displayName: 'iff' },
  { id: 6, username: 'daf', displayName: 'daf' },
];

afterEach(() => cleanup());

describe('FieldOpsInspectionPanel', () => {
  it('renders PENDING token + no date when history is empty', () => {
    const { container } = render(
      <FieldOpsInspectionPanel
        stationId={1}
        history={[]}
        currentUser={{ id: 3, displayName: 'iff' }}
        inspectors={INSPECTORS}
        onCreate={vi.fn()}
      />,
    );
    expect(container.textContent).toContain('PENDING');
    expect(container.textContent).not.toMatch(/\d{4}/); // no year visible
  });

  it('renders INSPECTED + Thai-locale date + lead chip + helper chips for populated history', () => {
    const { container } = render(
      <FieldOpsInspectionPanel
        stationId={1}
        history={HISTORY}
        currentUser={{ id: 3, displayName: 'iff' }}
        inspectors={INSPECTORS}
        onCreate={vi.fn()}
      />,
    );
    expect(container.textContent).toContain('INSPECTED');
    // formatInspectionDate produces th-TH long form, Buddhist year.
    expect(container.textContent).toMatch(/เมษายน.*2569/);
    expect(container.textContent).toContain('ผู้ตรวจ');
    // Lead is iff; helper is daf. Both appear at least once.
    expect(container.textContent).toContain('iff');
    expect(container.textContent).toContain('daf');
  });

  it('history toggle expands prior inspections', () => {
    render(
      <FieldOpsInspectionPanel
        stationId={1}
        history={HISTORY}
        currentUser={{ id: 3, displayName: 'iff' }}
        inspectors={INSPECTORS}
        onCreate={vi.fn()}
      />,
    );
    const toggle = screen.getByRole('button', { name: /HISTORY/i });
    fireEvent.click(toggle);
    expect(screen.getByText(/กุมภาพันธ์.*2569/).textContent).toBeTruthy();
    expect(screen.getAllByText('ice').length).toBeGreaterThan(0);
  });

  it('+ บันทึก opens the form; helpers exclude self; date defaults to today; submitting calls onCreate', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const today = new Date().toISOString().slice(0, 10);
    render(
      <FieldOpsInspectionPanel
        stationId={1}
        history={HISTORY}
        currentUser={{ id: 3, displayName: 'iff' }}
        inspectors={INSPECTORS}
        onCreate={onCreate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /บันทึก/i }));
    const dateInput = screen.getByLabelText(/วันที่ตรวจ/i) as HTMLInputElement;
    expect(dateInput.value).toBe(today);
    expect(dateInput.max).toBe(today);

    // Self (iff) is excluded from helper list.
    expect(screen.queryByLabelText('iff')).toBeNull();
    fireEvent.click(screen.getByLabelText('daf'));
    fireEvent.click(screen.getByRole('button', { name: /^บันทึก$/i }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      stationId: 1,
      inspectedOn: today,
      helperUserIds: [6],
      notes: undefined,
    }));
  });
});
```

- [ ] **Step 2: Run — expect failure (component missing)**

Run: `npx vitest run src/__tests__/field-ops-inspection-panel.test.tsx`
Expected: `Failed to resolve import "@/components/field-ops/FieldOpsInspectionPanel"`.

---

## Task 2: Implement `FieldOpsInspectionPanel`

**Files:**
- Create: `src/components/field-ops/FieldOpsInspectionPanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/field-ops/FieldOpsInspectionPanel.tsx
'use client';
import { useMemo, useState } from 'react';
import type { StationInspection } from '@/types/inspection';
import { formatInspectionDate } from '@/utils/mapHelpers';

export interface InspectorOption {
  id: number;
  username: string;
  displayName: string;
}

interface Props {
  stationId: number;
  history: StationInspection[];
  currentUser: { id: number; displayName: string };
  inspectors: InspectorOption[];
  onCreate: (input: {
    stationId: number;
    inspectedOn: string;
    helperUserIds: number[];
    notes?: string;
  }) => Promise<void>;
}

const wrapperStyle: React.CSSProperties = {
  border: '1px solid var(--fo-rail-border)',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.02)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--fo-mono)',
  fontSize: 10,
  letterSpacing: 0.6,
  color: 'var(--fo-accent)',
};

const muteStyle: React.CSSProperties = {
  fontFamily: 'var(--fo-mono)',
  fontSize: 10,
  letterSpacing: 0.5,
  color: 'var(--fo-rail-mute)',
};

const leadChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 10px',
  borderRadius: 999,
  background: 'var(--fo-accent)',
  color: 'var(--fo-rail-bg)',
  fontSize: 12,
  fontWeight: 700,
};

const helperChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid var(--fo-rail-border)',
  color: 'var(--fo-rail-mute)',
  fontSize: 11,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--fo-accent)',
  color: 'var(--fo-rail-bg)',
  fontFamily: 'var(--fo-mono)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.4,
  cursor: 'pointer',
};

const ghostBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid var(--fo-rail-border)',
  background: 'transparent',
  color: 'var(--fo-rail-text)',
  fontFamily: 'var(--fo-mono)',
  fontSize: 11,
  letterSpacing: 0.4,
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid var(--fo-rail-border)',
  background: 'var(--fo-rail-bg)',
  color: 'var(--fo-rail-text)',
  fontFamily: 'var(--fo-body)',
  fontSize: 13,
};

function Chips({
  lead,
  helpers,
}: {
  lead: StationInspection['lead'];
  helpers: StationInspection['helpers'];
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <span style={{ ...muteStyle, marginRight: 2 }}>ผู้ตรวจ:</span>
      <span style={leadChipStyle} title={`Lead: ${lead.displayName}`}>
        <span aria-hidden>★</span>
        {lead.displayName}
      </span>
      {helpers.map((h) => (
        <span key={h.userId} style={helperChipStyle} title={`Helper: ${h.displayName}`}>
          {h.displayName}
        </span>
      ))}
    </div>
  );
}

function FieldOpsNewInspectionForm({
  currentUser,
  inspectors,
  onCancel,
  onSubmit,
}: {
  currentUser: { id: number; displayName: string };
  inspectors: InspectorOption[];
  onCancel: () => void;
  onSubmit: (input: {
    inspectedOn: string;
    helperUserIds: number[];
    notes?: string;
  }) => Promise<void>;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [inspectedOn, setInspectedOn] = useState(today);
  const [helperIds, setHelperIds] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const helperOptions = inspectors.filter((u) => u.id !== currentUser.id);

  function toggleHelper(id: number) {
    setHelperIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        inspectedOn,
        helperUserIds: [...helperIds],
        notes: notes.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: 4,
        padding: 10,
        borderRadius: 10,
        border: '1px solid var(--fo-rail-border)',
        background: 'rgba(255,255,255,0.015)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelStyle}>วันที่ตรวจ</span>
        <input
          type="date"
          value={inspectedOn}
          max={today}
          onChange={(e) => setInspectedOn(e.target.value)}
          required
          aria-label="วันที่ตรวจ"
          style={inputStyle}
        />
      </label>

      <div>
        <div style={labelStyle}>หัวหน้าทีม</div>
        <div style={{ ...muteStyle, marginTop: 2 }}>{currentUser.displayName} (คุณ)</div>
      </div>

      {helperOptions.length > 0 && (
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={labelStyle}>ผู้ร่วมตรวจ</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {helperOptions.map((u) => (
              <label
                key={u.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  color: 'var(--fo-rail-text)',
                }}
              >
                <input
                  type="checkbox"
                  checked={helperIds.has(u.id)}
                  onChange={() => toggleHelper(u.id)}
                  aria-label={u.displayName}
                />
                {u.displayName}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={labelStyle}>หมายเหตุ</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          aria-label="หมายเหตุ"
          style={inputStyle}
        />
      </label>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={onCancel} disabled={submitting} style={ghostBtnStyle}>
          ยกเลิก
        </button>
        <button type="submit" disabled={submitting} style={primaryBtnStyle}>
          {submitting ? '...' : 'บันทึก'}
        </button>
      </div>
    </form>
  );
}

export default function FieldOpsInspectionPanel({
  stationId,
  history,
  currentUser,
  inspectors,
  onCreate,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const latest = history[0] ?? null;
  const rest = history.slice(1);

  return (
    <div style={wrapperStyle} data-testid="field-ops-inspection-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={labelStyle}>INSPECTION</span>
        {!recording && (
          <button type="button" onClick={() => setRecording(true)} style={primaryBtnStyle}>
            + บันทึก
          </button>
        )}
      </div>

      {latest ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontFamily: 'var(--fo-mono)',
                fontSize: 10,
                letterSpacing: 0.5,
                color: 'var(--fo-accent)',
              }}
            >
              ✓ INSPECTED
            </span>
            <span
              style={{
                fontFamily: 'var(--fo-serif)',
                fontSize: 14,
                color: 'var(--fo-rail-text)',
              }}
            >
              · {formatInspectionDate(latest.inspectedOn)}
            </span>
          </div>
          <Chips lead={latest.lead} helpers={latest.helpers} />
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--fo-mono)',
              fontSize: 10,
              letterSpacing: 0.5,
              color: 'var(--fo-warn)',
            }}
          >
            ⏳ PENDING
          </span>
          <span style={{ ...muteStyle }}>ยังไม่ตรวจ</span>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            style={{
              ...muteStyle,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            {historyOpen ? '▾' : '▸'} HISTORY ({rest.length})
          </button>
          {historyOpen && (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '8px 0 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {rest.map((row) => (
                <li
                  key={row.id}
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: '1px solid var(--fo-rail-border)',
                    background: 'rgba(255,255,255,0.015)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span style={{ fontFamily: 'var(--fo-serif)', fontSize: 13, color: 'var(--fo-rail-text)' }}>
                    {formatInspectionDate(row.inspectedOn)}
                  </span>
                  <Chips lead={row.lead} helpers={row.helpers} />
                  {row.notes && (
                    <span style={{ ...muteStyle, fontStyle: 'italic' }}>{row.notes}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {recording && (
        <FieldOpsNewInspectionForm
          currentUser={currentUser}
          inspectors={inspectors}
          onCancel={() => setRecording(false)}
          onSubmit={async (input) => {
            await onCreate({ stationId, ...input });
            setRecording(false);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run tests — must pass**

Run: `npx vitest run src/__tests__/field-ops-inspection-panel.test.tsx`
Expected: 4 passing.

- [ ] **Step 3: Commit**

```bash
git add src/components/field-ops/FieldOpsInspectionPanel.tsx \
        src/__tests__/field-ops-inspection-panel.test.tsx
git commit -m "feat(field-ops): FieldOpsInspectionPanel themed for desktop rail"
```

---

## Task 3: Wire panel into `FieldOpsCurrentFM`, drop legacy INSPECT button

**Files:**
- Modify: `src/components/field-ops/FieldOpsCurrent.tsx`
- Modify: `src/components/field-ops/FieldOpsClient.tsx`
- Modify: `src/__tests__/field-ops-current.test.tsx`

- [ ] **Step 1: Update `FieldOpsCurrentFM` props and body**

Open `src/components/field-ops/FieldOpsCurrent.tsx`. Add imports near the top (after the existing imports on lines 1-6):

```ts
import FieldOpsInspectionPanel, { type InspectorOption } from './FieldOpsInspectionPanel';
import type { StationInspection } from '@/types/inspection';
```

Replace the existing `FieldOpsCurrentFM` props signature (currently lines 25-39) with the version below — `onToggleInspection` is removed, the five inspection props are added:

```ts
export function FieldOpsCurrentFM({
  station,
  coLocated,
  onSelectStation,
  onToggleOnAir,
  pending,
  inspectionHistory,
  inspectors,
  currentUser,
  onLoadInspections,
  onCreateInspection,
}: {
  station: FMStation;
  coLocated?: FMStation[];
  onSelectStation?: (id: string | number) => void;
  onToggleOnAir?: () => void;
  pending: boolean;
  inspectionHistory?: StationInspection[];
  inspectors?: InspectorOption[];
  currentUser?: { id: number; displayName: string };
  onLoadInspections?: () => void;
  onCreateInspection?: (input: {
    stationId: number;
    inspectedOn: string;
    helperUserIds: number[];
    notes?: string;
  }) => Promise<void>;
}) {
```

Add a `useEffect` immediately after the destructure to auto-load history when the station changes — first add the `useEffect` import at the top of the file (the file currently imports `useEffect, useState` from React; if `useEffect` is already imported, skip). After the `inspected`/`main`/`others` `const` block (currently lines 40-42), add:

```ts
  useEffect(() => {
    onLoadInspections?.();
  }, [station.id, onLoadInspections]);
```

Then **replace** the entire `ButtonRow` block that renders both NAVIGATE + INSPECT (currently lines 114-127) with a single-button row plus the new panel:

```tsx
      <ButtonRow
        actions={[
          {
            label: '▶ NAVIGATE',
            pending: '...',
            onClick: () => window.open(googleMapsUrl(station.latitude, station.longitude), '_blank'),
            variant: 'primary',
          },
        ]}
        loading={pending}
      />

      {onCreateInspection && currentUser && inspectors && (
        <FieldOpsInspectionPanel
          stationId={Number(station.id)}
          history={inspectionHistory ?? []}
          currentUser={currentUser}
          inspectors={inspectors}
          onCreate={onCreateInspection}
        />
      )}
```

The `useState` import at line 3 is still needed by other code paths — leave it. If `useEffect` was not in the existing import, change `import { useState } from "react";` to `import { useEffect, useState } from "react";`.

- [ ] **Step 2: Update the render site in `FieldOpsClient`**

Open `src/components/field-ops/FieldOpsClient.tsx`. Find the `<FieldOpsCurrentFM>` render around lines 514-522:

```tsx
<FieldOpsCurrentFM
  station={selectedStation}
  coLocated={coLocatedStations}
  onSelectStation={(id) => handleSelect({ kind: "fm", id })}
  onToggleInspection={handleToggleInspection}
  onToggleOnAir={handleToggleOnAir}
  pending={pending}
/>
```

Replace with:

```tsx
<FieldOpsCurrentFM
  station={selectedStation}
  coLocated={coLocatedStations}
  onSelectStation={(id) => handleSelect({ kind: "fm", id })}
  onToggleOnAir={handleToggleOnAir}
  pending={pending}
  inspectors={inspectors}
  inspectionHistory={inspectionHistory[Number(selectedStation.id)] ?? []}
  currentUser={currentUser}
  onLoadInspections={() => loadInspectionsFor(Number(selectedStation.id))}
  onCreateInspection={handleCreateInspection}
/>
```

- [ ] **Step 3: Update `field-ops-current.test.tsx`**

Open `src/__tests__/field-ops-current.test.tsx`. The current file has 5 tests — four of them (`still renders the INSPECT button when revoked`, `renders INSPECT with the danger palette for a revoked station`, `renders INSPECT with the primary palette for a non-revoked pending station`, plus the `onToggleInspection` prop being passed in the REVOKED chip tests) assert on the legacy `✓ INSPECT` button which no longer exists. Replace the entire file with:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { FieldOpsCurrentFM } from '@/components/field-ops/FieldOpsCurrent';
import type { FMStation } from '@/types/station';

afterEach(() => cleanup());

const baseStation: FMStation = {
  id: 5520117,
  name: 'เสียงชนเสรี',
  frequency: 106,
  latitude: 14.96,
  longitude: 102.07,
  city: 'คง',
  state: 'นครราชสีมา',
  genre: 'ธุรกิจ',
  type: 'ธุรกิจ',
  inspection69: 'ยังไม่ตรวจ',
  onAir: true,
};

describe('FieldOpsCurrentFM — revoked station', () => {
  it('renders the REVOKED chip when station.revoked is true', () => {
    const station: FMStation = { ...baseStation, revoked: true, revokedNote: 'NBTC สทช2304/266/2569' };
    const { container } = render(
      <FieldOpsCurrentFM station={station} pending={false} />,
    );
    expect(container.textContent).toContain('REVOKED');
  });

  it('does NOT render the REVOKED chip when station.revoked is false or undefined', () => {
    const { container } = render(
      <FieldOpsCurrentFM station={baseStation} pending={false} />,
    );
    expect(container.textContent).not.toContain('REVOKED');
  });
});

describe('FieldOpsCurrentFM — inspection panel', () => {
  it('renders the FieldOpsInspectionPanel when inspection props are provided', () => {
    const { getByTestId } = render(
      <FieldOpsCurrentFM
        station={baseStation}
        pending={false}
        inspectors={[]}
        inspectionHistory={[]}
        currentUser={{ id: 3, displayName: 'iff' }}
        onCreateInspection={vi.fn()}
        onLoadInspections={vi.fn()}
      />,
    );
    expect(getByTestId('field-ops-inspection-panel')).toBeTruthy();
  });

  it('does NOT render the panel when inspection props are missing', () => {
    const { queryByTestId } = render(
      <FieldOpsCurrentFM station={baseStation} pending={false} />,
    );
    expect(queryByTestId('field-ops-inspection-panel')).toBeNull();
  });

  it('calls onLoadInspections on mount', () => {
    const onLoadInspections = vi.fn();
    render(
      <FieldOpsCurrentFM
        station={baseStation}
        pending={false}
        inspectors={[]}
        inspectionHistory={[]}
        currentUser={{ id: 3, displayName: 'iff' }}
        onCreateInspection={vi.fn()}
        onLoadInspections={onLoadInspections}
      />,
    );
    expect(onLoadInspections).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the affected tests**

Run: `npx vitest run src/__tests__/field-ops-current.test.tsx src/__tests__/field-ops-inspection-panel.test.tsx`
Expected: all green (4 in panel test + 5 in current test = 9 passing).

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run build 2>&1 | tail -20`
Expected: `✓ Compiled successfully`. If TS complains about `FieldOpsClient.tsx` still passing `onToggleInspection` to `FieldOpsCurrentFM`, double-check Step 2 — the prop must be removed from that render site.

- [ ] **Step 6: Commit**

```bash
git add src/components/field-ops/FieldOpsCurrent.tsx \
        src/components/field-ops/FieldOpsClient.tsx \
        src/__tests__/field-ops-current.test.tsx
git commit -m "feat(field-ops): replace desktop INSPECT toggle with InspectionPanel"
```

---

## Task 4: Trim `handleToggleInspection` to interference-only

**Files:**
- Modify: `src/components/field-ops/FieldOpsClient.tsx`

After Task 3, the FM branch of `handleToggleInspection` (currently lines 205-223) is dead code — nothing calls it for FM stations anymore. The interference branch (lines 224-244) is still used by `FieldOpsCurrentINT` and `FieldOpsBottomSheet`'s interference path.

- [ ] **Step 1: Rename and trim**

Open `src/components/field-ops/FieldOpsClient.tsx`. Replace the full `handleToggleInspection` (currently lines 205-244) with:

```ts
  const handleToggleInterferenceInspection = async () => {
    if (!selection || selection.kind !== "int" || !selectedSite) return;
    setPending(true);
    try {
      const next = selectedSite.status === "ตรวจแล้ว" ? "ยังไม่ตรวจ" : "ตรวจแล้ว";
      setInterference((all) =>
        all.map((s) => (s.id === selectedSite.id ? { ...s, status: next } : s))
      );
      const res = await fetch(`/api/interference/${selectedSite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Interference update failed");
    } catch (err) {
      console.error(err);
      window.location.reload();
    } finally {
      setPending(false);
    }
  };
```

- [ ] **Step 2: Update the two render sites that consumed the old name**

Find every `onToggleInspection={handleToggleInspection}` (will be one for `<FieldOpsCurrentINT>` near line 528, and one for `<FieldOpsBottomSheet>` near line 558). Change both to:

```tsx
onToggleInspection={handleToggleInterferenceInspection}
```

Verify with: `grep -n "handleToggleInspection\|handleToggleInterferenceInspection" src/components/field-ops/FieldOpsClient.tsx`
Expected: 3 matches — 1 declaration, 2 usages — all with the new name.

- [ ] **Step 3: Run the full test sweep**

Run: `npx vitest run 2>&1 | tail -10`
Expected: same passing count as before this PR plus the new tests. The pre-existing failures in `components-batch4`, `intermod-calculator-deep`, `field-ops-drawer`, `analytics` remain unchanged.

- [ ] **Step 4: Verify TypeScript still compiles**

Run: `npm run build 2>&1 | tail -10`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add src/components/field-ops/FieldOpsClient.tsx
git commit -m "refactor(field-ops): handleToggleInspection -> handleToggleInterferenceInspection"
```

---

## Task 5: Lint + build + smoke verify

This task only validates; no code commits expected unless the prior tasks left lint warnings on new files.

- [ ] **Step 1: Lint**

Run: `npm run lint 2>&1 | tail -10`
Expected: 0 errors. The pre-existing 34 `no-unused-vars` warnings in unrelated test files are acceptable. The two new files (`FieldOpsInspectionPanel.tsx`, `field-ops-inspection-panel.test.tsx`) should contribute 0 warnings.

- [ ] **Step 2: Coverage spot-check**

Run: `npx vitest run src/__tests__/field-ops-inspection-panel.test.tsx src/__tests__/field-ops-current.test.tsx --coverage 2>&1 | tail -20`
Expected: `FieldOpsInspectionPanel.tsx` shows ≥80% coverage on statements/branches. If a branch is missing, add a targeted test or accept the gap if the branch is trivially safe.

- [ ] **Step 3: Manual smoke test**

Start dev server: `npm run dev`

Then in a browser:

1. Visit `http://localhost:3000/field-ops` and log in as `iff`.
2. Click an inspected FM marker (e.g. `5520014 กว้างไกล ฟ้าใส`). In the right rail, confirm:
   - The `INSPECTED ●` badge in the header row is still present.
   - Below the meters and `▶ NAVIGATE` button, the new `INSPECTION` panel shows `✓ INSPECTED · 3 เมษายน 2569` followed by `ผู้ตรวจ: ★ iff` (chips).
   - History toggle is absent because this station has only 1 inspection.
3. Click a never-inspected FM marker. The panel shows `⏳ PENDING · ยังไม่ตรวจ` and no chips.
4. Click `+ บันทึก`. The form opens with today's date and a checkbox row that excludes `iff`. Tag `daf`, click `บันทึก`. Confirm:
   - The form closes.
   - The latest line updates to today's date with `★ iff` + `daf` chips.
   - The `INSPECTED ●` header badge stays (or appears if it was PENDING).
5. Confirm the legacy `✓ INSPECT` button is gone from the rail.

- [ ] **Step 4: No commit if everything's clean**

If the smoke test passes, end the plan here. If a defect surfaces, file a follow-up task — don't shoehorn fixes into this PR.

---

## Self-review notes (run after writing the plan)

- **Spec coverage:**
  - §3.1 `FieldOpsInspectionPanel` → Tasks 1-2.
  - §3.1 Themed `FieldOpsNewInspectionForm` inline subcomponent → included in Task 2.
  - §4.1 `FieldOpsCurrentFM` modifications (props, panel render, useEffect, button row trim) → Task 3 step 1.
  - §4.2 Render site update in `FieldOpsClient` → Task 3 step 2.
  - §4.3 `handleToggleInspection` cleanup → Task 4.
  - §5 Testing → Task 1 (new tests), Task 3 step 3 (updated tests), Task 4 step 3 (sweep), Task 5 (coverage).
  - §6 Rollout → maps to the task order; smoke test in Task 5 step 3.
- **Placeholders:** none.
- **Type consistency:** `InspectorOption` is exported from `FieldOpsInspectionPanel.tsx` and re-imported by `FieldOpsCurrent.tsx` for prop typing — consistent in name and shape. `StationInspection` comes from `@/types/inspection` (already exists). `onCreate` signature matches the one used by `OptimizedFMStationClient.handleCreateInspection` (already shipped). `currentUser: { id: number; displayName: string }` matches the prop already accepted by `FieldOpsClient`, `FieldOpsBottomSheet`, and `OptimizedFMStationClient`.
- **YAGNI:** no shared abstractions across the two themes; no extra subcomponents beyond what the spec calls for; no admin/management UI; no list-row changes.
