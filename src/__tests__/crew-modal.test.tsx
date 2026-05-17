// src/__tests__/crew-modal.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import CrewModal from '@/components/field-ops/CrewModal';

afterEach(() => cleanup());

const inspectors = [
  { id: 3, username: 'iff', displayName: 'iff' },
  { id: 6, username: 'daf', displayName: 'daf' },
  { id: 7, username: 'ice', displayName: 'ice' },
];

describe('CrewModal', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <CrewModal
        open={false}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('renders a chip for each active inspector except self', () => {
    const { getByRole, queryByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(getByRole('button', { name: /^daf$/i })).toBeTruthy();
    expect(getByRole('button', { name: /^ice$/i })).toBeTruthy();
    expect(queryByRole('button', { name: /^iff$/i })).toBeNull();
  });

  it('disables SAVE when no chip is selected', () => {
    const { getByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const save = getByRole('button', { name: /save crew/i });
    expect(save.hasAttribute('disabled')).toBe(true);
  });

  it('enables SAVE and shows live count once a chip is selected', () => {
    const { getByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[6]}
        onSave={vi.fn()}
        onSolo={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const save = getByRole('button', { name: /save crew \(1\)/i });
    expect(save.hasAttribute('disabled')).toBe(false);
  });

  it('toggles selection when a chip is clicked', () => {
    const { getByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(getByRole('button', { name: /^daf$/i }));
    expect(getByRole('button', { name: /save crew \(1\)/i })).toBeTruthy();
    fireEvent.click(getByRole('button', { name: /^daf$/i }));
    expect(getByRole('button', { name: /save crew/i }).hasAttribute('disabled')).toBe(true);
  });

  it('calls onSave with the selected ids', () => {
    const onSave = vi.fn();
    const { getByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[6, 7]}
        onSave={onSave}
        onSolo={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(getByRole('button', { name: /save crew \(2\)/i }));
    expect(onSave).toHaveBeenCalledWith([6, 7]);
  });

  it('calls onSolo when I WORK SOLO is clicked', () => {
    const onSolo = vi.fn();
    const { getByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={onSolo}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(getByRole('button', { name: /work solo/i }));
    expect(onSolo).toHaveBeenCalled();
  });

  it('× button also calls onSolo (same intent)', () => {
    const onSolo = vi.fn();
    const { getByRole } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={onSolo}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(getByRole('button', { name: /close/i }));
    expect(onSolo).toHaveBeenCalled();
  });

  it('ESC equals onSolo', () => {
    const onSolo = vi.fn();
    render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={onSolo}
        onClose={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSolo).toHaveBeenCalled();
  });

  it('backdrop click does NOT dismiss', () => {
    const onSolo = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={onSolo}
        onClose={onClose}
      />,
    );
    const backdrop = container.querySelector('[data-testid="crew-modal-backdrop"]')!;
    fireEvent.click(backdrop);
    expect(onSolo).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the inline error when provided', () => {
    const { container } = render(
      <CrewModal
        open={true}
        inspectors={inspectors}
        currentUserId={3}
        initialSelected={[]}
        onSave={vi.fn()}
        onSolo={vi.fn()}
        onClose={vi.fn()}
        error="Couldn't save — try again."
      />,
    );
    expect(container.textContent).toContain("Couldn't save — try again.");
  });
});
