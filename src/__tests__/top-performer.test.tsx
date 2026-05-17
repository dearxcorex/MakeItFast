// src/__tests__/top-performer.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import TopPerformer from '@/components/analytics/TopPerformer';
import type { InspectorsAnalytics } from '@/types/analytics';

afterEach(() => cleanup());

type Inspector = InspectorsAnalytics['inspectors'][number];

function mkInspector(overrides: Partial<Inspector> = {}): Inspector {
  return {
    userId: 1,
    username: 'iff',
    displayName: 'iff',
    ytdTotal: 14,
    monthTotal: 3,
    ytdAsLead: 11,
    ytdAsHelper: 3,
    lastActive: '2026-05-12',
    ...overrides,
  };
}

describe('TopPerformer', () => {
  it('renders the muted empty card when inspectors array is empty', () => {
    const { container } = render(<TopPerformer inspectors={[]} thisYear={2026} />);
    expect(container.textContent).toContain('No activity yet for 2026');
  });

  it('renders the muted empty card when every inspector has ytdTotal=0', () => {
    const { container } = render(
      <TopPerformer
        inspectors={[mkInspector({ ytdTotal: 0, ytdAsLead: 0, ytdAsHelper: 0 })]}
        thisYear={2026}
      />,
    );
    expect(container.textContent).toContain('No activity yet for 2026');
  });

  it('renders name, YTD total, lead/helper pills, and last-active footer for a single active inspector', () => {
    const { container } = render(
      <TopPerformer inspectors={[mkInspector()]} thisYear={2026} />,
    );
    expect(container.textContent).toContain('iff');
    expect(container.textContent).toContain('14 inspections this year');
    expect(container.textContent).toContain('11 led');
    expect(container.textContent).toContain('3 helped');
    expect(container.textContent).toContain('Last active');
    expect(container.textContent).toContain('3 this month');
  });

  it('picks inspectors[0] (trusts caller-provided DESC sort by ytdTotal)', () => {
    const { container } = render(
      <TopPerformer
        inspectors={[
          mkInspector({ userId: 1, username: 'iff', displayName: 'iff', ytdTotal: 14 }),
          mkInspector({ userId: 6, username: 'daf', displayName: 'daf', ytdTotal: 9 }),
        ]}
        thisYear={2026}
      />,
    );
    expect(container.textContent).toContain('iff');
    expect(container.textContent).not.toContain('daf');
  });

  it('header reads "TOP PERFORMER · YTD 2026" when thisYear=2026', () => {
    const { container } = render(
      <TopPerformer inspectors={[mkInspector()]} thisYear={2026} />,
    );
    expect(container.textContent).toContain('TOP PERFORMER · YTD 2026');
  });

  it('renders "Last active —" when lastActive is null', () => {
    const { container } = render(
      <TopPerformer
        inspectors={[mkInspector({ lastActive: null })]}
        thisYear={2026}
      />,
    );
    expect(container.textContent).toContain('Last active —');
  });
});
