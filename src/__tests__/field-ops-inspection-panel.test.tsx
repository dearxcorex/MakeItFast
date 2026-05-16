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
