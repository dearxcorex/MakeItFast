import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { FieldOpsCurrentFM } from '@/components/field-ops/FieldOpsCurrent';
import TeammatePicker from '@/components/field-ops/TeammatePicker'; // eslint-disable-line @typescript-eslint/no-unused-vars
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
      <FieldOpsCurrentFM
        station={station}
        onToggleInspection={vi.fn()}
        pending={false}
      />
    );
    expect(container.textContent).toContain('REVOKED');
  });

  it('does NOT render the REVOKED chip when station.revoked is false or undefined', () => {
    const { container } = render(
      <FieldOpsCurrentFM
        station={baseStation}
        onToggleInspection={vi.fn()}
        pending={false}
      />
    );
    expect(container.textContent).not.toContain('REVOKED');
  });

  it('still renders the INSPECT button when revoked', () => {
    const station: FMStation = { ...baseStation, revoked: true };
    const { container } = render(
      <FieldOpsCurrentFM
        station={station}
        onToggleInspection={vi.fn()}
        pending={false}
      />
    );
    expect(container.textContent).toContain('✓ INSPECT');
  });

  it('renders INSPECT with the danger palette for a revoked station', () => {
    const station: FMStation = {
      ...baseStation,
      revoked: true,
      onAir: false,
      inspection69: 'ยังไม่ตรวจ',
    };
    const { container } = render(
      <FieldOpsCurrentFM
        station={station}
        onToggleInspection={vi.fn()}
        onToggleOnAir={vi.fn()}
        pending={false}
      />
    );
    const buttons = container.querySelectorAll('button');
    const inspectBtn = Array.from(buttons).find(btn => btn.textContent === '✓ INSPECT')!;
    expect(inspectBtn.getAttribute('style')).toContain('var(--fo-crit)');
  });

  it('renders INSPECT with the primary palette for a non-revoked pending station', () => {
    const station: FMStation = {
      ...baseStation,
      revoked: false,
      onAir: false,
      inspection69: 'ยังไม่ตรวจ',
    };
    const { container } = render(
      <FieldOpsCurrentFM
        station={station}
        onToggleInspection={vi.fn()}
        pending={false}
      />
    );
    const buttons = container.querySelectorAll('button');
    const inspectBtn = Array.from(buttons).find(btn => btn.textContent === '✓ INSPECT')!;
    expect(inspectBtn.getAttribute('style')).toContain('var(--fo-accent)');
    expect(inspectBtn.getAttribute('style')).not.toContain('var(--fo-crit)');
  });
});

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
