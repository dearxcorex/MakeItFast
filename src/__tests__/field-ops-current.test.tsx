import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { FieldOpsCurrentFM } from '@/components/field-ops/FieldOpsCurrent';
import type { FMStation } from '@/types/station';

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

describe('FieldOpsCurrentFM — revoked alert', () => {
  it('renders REVOKED pill and the illegal-if-on-air banner when station.revoked is true', () => {
    const station: FMStation = { ...baseStation, revoked: true, revokedNote: 'NBTC สทช2304/266/2569' };
    const { container, getByRole } = render(
      <FieldOpsCurrentFM
        station={station}
        onToggleInspection={vi.fn()}
        pending={false}
      />
    );
    expect(container.textContent).toContain('REVOKED');
    expect(container.textContent).toContain('ผิดกฎหมาย');
    expect(container.textContent).toContain('NBTC สทช2304/266/2569');
    expect(getByRole('alert')).toBeTruthy();
  });

  it('does NOT render the alert when station.revoked is false or undefined', () => {
    const { container } = render(
      <FieldOpsCurrentFM
        station={baseStation}
        onToggleInspection={vi.fn()}
        pending={false}
      />
    );
    expect(container.textContent).not.toContain('REVOKED');
    expect(container.textContent).not.toContain('ผิดกฎหมาย');
  });

  it('uses warn-style INSPECT button label when revoked', () => {
    const station: FMStation = { ...baseStation, revoked: true };
    const { container } = render(
      <FieldOpsCurrentFM
        station={station}
        onToggleInspection={vi.fn()}
        pending={false}
      />
    );
    expect(container.textContent).toContain('✓ INSPECT');
    expect(container.textContent).toContain('ILLEGAL IF ON AIR');
  });
});
