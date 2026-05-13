import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FieldOpsBottomSheet } from '@/components/field-ops/FieldOpsBottomSheet';

vi.mock('leaflet', () => ({ default: { Icon: vi.fn(), divIcon: vi.fn() } }));
vi.mock('react-leaflet', () => ({}));

afterEach(() => cleanup());

describe('FieldOpsBottomSheet — inspection panel', () => {
  it('renders the InspectionPanel for the open station', () => {
    render(
      <FieldOpsBottomSheet
        selection={{ kind: 'fm', id: 1 } as never}
        station={{
          id: 1, name: 'X', frequency: 95.5, latitude: 0, longitude: 0,
          city: 'A', state: 'B', genre: '', inspection69: 'ตรวจแล้ว',
          dateInspected: '2026-04-21', onAir: true,
        } as never}
        site={null}
        inspectionHistory={[]}
        inspectors={[]}
        currentUser={{ id: 3, displayName: 'iff' }}
        onCreateInspection={vi.fn()}
        onLoadInspections={vi.fn()}
        onClose={vi.fn()}
        onToggleInspection={vi.fn()}
        onToggleLawPaper={vi.fn()}
        pending={false}
      />,
    );
    expect(screen.getByRole('button', { name: /Record inspection/i })).toBeTruthy();
  });
});
