import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import InspectionTeamChips from '@/components/field-ops/InspectionTeamChips';

describe('InspectionTeamChips', () => {
  it('renders lead name with lead data-role', () => {
    const { container } = render(
      <InspectionTeamChips
        lead={{ userId: 1, username: 'dao', displayName: 'dao' }}
        helpers={[]}
      />
    );
    expect(container.textContent).toContain('dao');
    expect(container.querySelector('[data-role="lead"]')).toBeTruthy();
  });

  it('renders helpers as chips', () => {
    const { container } = render(
      <InspectionTeamChips
        lead={{ userId: 1, username: 'dao', displayName: 'dao' }}
        helpers={[
          { userId: 2, username: 'ice', displayName: 'ice' },
          { userId: 3, username: 'iff', displayName: 'iff' },
        ]}
      />
    );
    expect(container.textContent).toContain('ice');
    expect(container.textContent).toContain('iff');
  });

  it('renders nothing when lead is null', () => {
    const { container } = render(
      <InspectionTeamChips lead={null} helpers={[]} />
    );
    expect(container.textContent).toBe('');
  });

  it('shows date when provided', () => {
    const { container } = render(
      <InspectionTeamChips
        lead={{ userId: 1, username: 'dao', displayName: 'dao' }}
        helpers={[]}
        inspectedOn="2026-05-20"
      />
    );
    expect(container.textContent).toContain('2026-05-20');
  });
});
