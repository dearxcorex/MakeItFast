import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import NewInspectionForm from '@/components/inspection/NewInspectionForm';

const TODAY = new Date().toISOString().slice(0, 10);

afterEach(() => {
  cleanup();
});

describe('NewInspectionForm', () => {
  it('defaults the date to today and excludes self from helpers', () => {
    render(
      <NewInspectionForm
        currentUserId={3}
        currentUserDisplayName="iff"
        inspectors={[
          { id: 1, username: 'admin', displayName: 'Admin' },
          { id: 3, username: 'iff', displayName: 'iff' },
          { id: 6, username: 'daf', displayName: 'daf' },
        ]}
        onCancel={() => {}}
        onSubmit={vi.fn()}
      />,
    );

    const dateInput = screen.getByLabelText(/วันที่ตรวจ/i) as HTMLInputElement;
    expect(dateInput.value).toBe(TODAY);
    expect(dateInput.max).toBe(TODAY);

    expect(screen.queryByLabelText('iff')).toBeNull();
    expect(screen.getByLabelText('Admin')).toBeTruthy();
    expect(screen.getByLabelText('daf')).toBeTruthy();
  });

  it('submits selected helpers, notes, and date', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <NewInspectionForm
        currentUserId={3}
        currentUserDisplayName="iff"
        inspectors={[
          { id: 6, username: 'daf', displayName: 'daf' },
          { id: 3, username: 'iff', displayName: 'iff' },
        ]}
        onCancel={() => {}}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByLabelText('daf'));
    fireEvent.change(screen.getByLabelText(/วันที่ตรวจ/i), { target: { value: '2026-04-21' } });
    fireEvent.change(screen.getByLabelText(/หมายเหตุ/i), { target: { value: 'OK' } });
    fireEvent.click(screen.getByRole('button', { name: /บันทึก/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      inspectedOn: '2026-04-21',
      helperUserIds: [6],
      notes: 'OK',
    });
  });
});
