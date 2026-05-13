import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import InspectionPanel from '@/components/inspection/InspectionPanel';
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

afterEach(() => {
  cleanup();
});

describe('InspectionPanel', () => {
  it('shows latest + collapsed history toggle and opens form on click', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <InspectionPanel
        stationId={1}
        history={HISTORY}
        currentUser={{ id: 3, displayName: 'iff' }}
        inspectors={[
          { id: 3, username: 'iff', displayName: 'iff' },
          { id: 6, username: 'daf', displayName: 'daf' },
        ]}
        onCreate={onCreate}
      />,
    );

    expect(screen.getByText(/ตรวจแล้ว/)).toBeTruthy();
    // Latest helpers visible
    expect(screen.getAllByText('iff').length).toBeGreaterThan(0);
    expect(screen.getAllByText('daf').length).toBeGreaterThan(0);

    // History toggle present
    const toggle = screen.getByRole('button', { name: /History/i });
    fireEvent.click(toggle);
    expect(screen.getByText(/2026-02-12|2026|ก\.พ\./).textContent).toBeTruthy();

    // Open record form
    fireEvent.click(screen.getByRole('button', { name: /Record/i }));
    expect(screen.getByLabelText(/วันที่ตรวจ/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /บันทึก/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
  });
});
