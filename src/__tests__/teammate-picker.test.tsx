import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import TeammatePicker from '@/components/field-ops/TeammatePicker';

afterEach(() => cleanup());

const ROSTER = [
  { id: 1, username: 'admin', displayName: 'Admin' },
  { id: 2, username: 'ice', displayName: 'ice' },
  { id: 3, username: 'iff', displayName: 'iff' },
  { id: 6, username: 'daf', displayName: 'daf' },
];

describe('TeammatePicker', () => {
  it('renders the collapsed link by default and excludes self', () => {
    render(
      <TeammatePicker
        inspectors={ROSTER}
        currentUserId={3}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /\+ tag teammates/i })).toBeTruthy();
    // helper checkboxes should not exist until expanded
    expect(screen.queryByLabelText('daf')).toBeNull();
    expect(screen.queryByLabelText('iff')).toBeNull(); // self always hidden
  });

  it('expands to show helper checkboxes (excluding self) when clicked', () => {
    render(
      <TeammatePicker
        inspectors={ROSTER}
        currentUserId={3}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /\+ tag teammates/i }));
    expect(screen.getByLabelText('Admin')).toBeTruthy();
    expect(screen.getByLabelText('ice')).toBeTruthy();
    expect(screen.getByLabelText('daf')).toBeTruthy();
    expect(screen.queryByLabelText('iff')).toBeNull(); // self never shown
  });

  it('calls onChange with the updated array when a helper is toggled', () => {
    const onChange = vi.fn();
    render(
      <TeammatePicker
        inspectors={ROSTER}
        currentUserId={3}
        value={[]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /\+ tag teammates/i }));
    fireEvent.click(screen.getByLabelText('daf'));
    expect(onChange).toHaveBeenLastCalledWith([6]);

    // toggling off
    onChange.mockClear();
    cleanup();
    render(
      <TeammatePicker
        inspectors={ROSTER}
        currentUserId={3}
        value={[6]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /\+ tag teammates/i }));
    fireEvent.click(screen.getByLabelText('daf'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('shows selected helpers as chips even when collapsed', () => {
    render(
      <TeammatePicker
        inspectors={ROSTER}
        currentUserId={3}
        value={[6, 2]}
        onChange={vi.fn()}
      />,
    );
    // collapsed (no checkbox), but selected names visible as chips
    expect(screen.queryByLabelText('daf')).toBeNull();
    expect(screen.getByText('daf')).toBeTruthy();
    expect(screen.getByText('ice')).toBeTruthy();
  });

  it('returns null when only the current user is in the roster', () => {
    const { container } = render(
      <TeammatePicker
        inspectors={[{ id: 3, username: 'iff', displayName: 'iff' }]}
        currentUserId={3}
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(container.textContent).toBe('');
  });
});
