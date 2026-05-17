// src/__tests__/crew-indicator.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import CrewIndicator from '@/components/field-ops/CrewIndicator';

afterEach(() => cleanup());

const inspectors = [
  { id: 3, username: 'iff', displayName: 'iff' },
  { id: 6, username: 'daf', displayName: 'daf' },
  { id: 7, username: 'ice', displayName: 'ice' },
  { id: 8, username: 'dao', displayName: 'dao' },
];

describe('CrewIndicator', () => {
  it('returns null when defaultCrew is null', () => {
    const { container } = render(
      <CrewIndicator
        defaultCrew={null}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={false}
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('renders "My crew · solo" when defaultCrew is []', () => {
    const { container } = render(
      <CrewIndicator
        defaultCrew={[]}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={false}
      />,
    );
    expect(container.textContent?.toLowerCase()).toContain('my crew');
    expect(container.textContent?.toLowerCase()).toContain('solo');
  });

  it('renders up to 2 names then +N for larger crews', () => {
    const { container } = render(
      <CrewIndicator
        defaultCrew={[6, 7, 8]}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={false}
      />,
    );
    expect(container.textContent).toContain('daf');
    expect(container.textContent).toContain('ice');
    expect(container.textContent).toContain('+1');
  });

  it('falls back to id when an inspector is missing from the list', () => {
    const { container } = render(
      <CrewIndicator
        defaultCrew={[99]}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={false}
      />,
    );
    expect(container.textContent).toContain('#99');
  });

  it('compact mode shows the count badge when crew is non-empty', () => {
    const { container } = render(
      <CrewIndicator
        defaultCrew={[6, 7]}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={true}
      />,
    );
    expect(container.textContent).toContain('2');
    expect(container.textContent).not.toContain('daf');
  });

  it('compact mode renders icon only (no zero) when crew is solo', () => {
    const { container, getByRole } = render(
      <CrewIndicator
        defaultCrew={[]}
        inspectors={inspectors}
        onOpen={vi.fn()}
        compact={true}
      />,
    );
    // Button is rendered (re-openable) but does NOT show "0" — that would be
    // confusing. The 🧑 icon alone signals "you've chosen to work solo".
    expect(getByRole('button')).toBeTruthy();
    expect(container.textContent).not.toContain('0');
    // No names either (compact mode never shows names).
    expect(container.textContent).not.toContain('daf');
  });

  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    const { getByRole } = render(
      <CrewIndicator
        defaultCrew={[]}
        inspectors={inspectors}
        onOpen={onOpen}
        compact={false}
      />,
    );
    fireEvent.click(getByRole('button'));
    expect(onOpen).toHaveBeenCalled();
  });
});
