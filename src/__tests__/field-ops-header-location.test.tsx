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

  it('renders "Locating…" while status is locating', () => {
    const { container } = render(
      <FieldOpsHeader {...baseProps} locationStatus="locating" onRetryLocation={vi.fn()} />
    );
    expect(container.textContent).toContain('LOCATING');
  });

  it('renders accuracy when status is granted and userLocation has accuracy', () => {
    const { container } = render(
      <FieldOpsHeader
        {...baseProps}
        locationStatus="granted"
        userLocation={{ latitude: 13.75, longitude: 100.5, accuracy: 42 }}
        onRetryLocation={vi.fn()}
      />
    );
    expect(container.textContent).toContain('±42m');
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
