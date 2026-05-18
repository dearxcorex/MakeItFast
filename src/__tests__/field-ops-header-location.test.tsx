import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { FieldOpsHeader } from '@/components/field-ops/FieldOpsHeader';

describe('FieldOpsHeader — location badge', () => {
  const baseProps = {
    stations: [],
    interference: [],
    type: 'ALL' as const,
    theme: 'dark' as const,
    onToggleTheme: vi.fn(),
  };

  // The header used to show "LOCATING…" / "±Xm" pills, but those were noisy
  // for the operator (the accuracy number is meaningless to non-engineers
  // and the "locating" state flickers every few seconds). The header now
  // suppresses the badge in healthy states and only surfaces a retry chip
  // when the user has to act (denied / timeout / unavailable).
  it('renders nothing while status is locating', () => {
    const { container } = render(
      <FieldOpsHeader {...baseProps} locationStatus="locating" onRetryLocation={vi.fn()} />
    );
    expect(container.textContent ?? '').not.toContain('LOCATING');
    expect(container.textContent ?? '').not.toMatch(/±\d+m/);
  });

  it('renders nothing when status is granted', () => {
    const { container } = render(
      <FieldOpsHeader {...baseProps} locationStatus="granted" onRetryLocation={vi.fn()} />
    );
    expect(container.textContent ?? '').not.toMatch(/±\d+m/);
    expect(container.textContent ?? '').not.toContain('LOCATED');
  });

  it('renders "Enable location" button when denied; clicking calls onRetryLocation', () => {
    const retry = vi.fn();
    const { container } = render(
      <FieldOpsHeader {...baseProps} locationStatus="denied" onRetryLocation={retry} />
    );
    const btn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').toLowerCase().includes('enable')
    );
    expect(btn).toBeDefined();
    fireEvent.click(btn!);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
