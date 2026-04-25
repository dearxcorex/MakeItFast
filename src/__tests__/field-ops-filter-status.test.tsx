import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { FieldOpsFilters, type FieldFilters } from '@/components/field-ops/FieldOpsFilters';

afterEach(() => cleanup());

const baseFilters: FieldFilters = {
  type: 'ALL',
  province: 'All',
  status: 'ALL',
  search: '',
};

function renderFilters(overrides: Partial<FieldFilters> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <FieldOpsFilters
      filters={{ ...baseFilters, ...overrides }}
      onChange={onChange}
      provinces={['Bangkok']}
      visibleCount={10}
    />
  );
  return { onChange, ...utils };
}

describe('FieldOpsFilters status chips · type-aware', () => {
  it('type=ALL shows ALL · PENDING · INSPECTED · LAW SENT', () => {
    const { getByText } = renderFilters({ type: 'ALL' });
    expect(getByText('LAW SENT')).toBeTruthy();
    expect(getByText('PENDING')).toBeTruthy();
    expect(getByText('INSPECTED')).toBeTruthy();
  });

  it('type=INT shows LAW SENT', () => {
    const { getByText } = renderFilters({ type: 'INT' });
    expect(getByText('LAW SENT')).toBeTruthy();
  });

  it('type=FM hides LAW SENT chip (FM has no law-paper concept)', () => {
    const { queryByText } = renderFilters({ type: 'FM' });
    expect(queryByText('LAW SENT')).toBeNull();
  });

  it('switching type to FM while status=LAW_SENT cascades status back to ALL', () => {
    const { onChange, getAllByText } = renderFilters({ type: 'ALL', status: 'LAW_SENT' });
    // Click the FM chip in the TYPE row (TYPE chip group is first; "FM" appears once)
    const fmChip = getAllByText('FM')[0];
    fireEvent.click(fmChip);
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0][0];
    expect(next.type).toBe('FM');
    expect(next.status).toBe('ALL');
  });

  it('switching type to FM while status=PENDING leaves status untouched', () => {
    const { onChange, getAllByText } = renderFilters({ type: 'ALL', status: 'PENDING' });
    fireEvent.click(getAllByText('FM')[0]);
    const next = onChange.mock.calls[0][0];
    expect(next.type).toBe('FM');
    expect(next.status).toBe('PENDING');
  });

  it('OFF AIR chip is shown for type=ALL and type=FM, hidden for type=INT', () => {
    const all = renderFilters({ type: 'ALL' });
    expect(all.queryByText('OFF AIR')).toBeTruthy();
    cleanup();
    const fm = renderFilters({ type: 'FM' });
    expect(fm.queryByText('OFF AIR')).toBeTruthy();
    cleanup();
    const int = renderFilters({ type: 'INT' });
    expect(int.queryByText('OFF AIR')).toBeNull();
  });

  it('switching type to INT while status=OFF_AIR cascades back to ALL', () => {
    const { onChange, getAllByText } = renderFilters({ type: 'ALL', status: 'OFF_AIR' });
    fireEvent.click(getAllByText('INT')[0]);
    const next = onChange.mock.calls[0][0];
    expect(next.type).toBe('INT');
    expect(next.status).toBe('ALL');
  });
});
