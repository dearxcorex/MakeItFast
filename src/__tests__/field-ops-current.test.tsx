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
