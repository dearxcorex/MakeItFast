import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { FieldOpsFilters, type FieldFilters } from '@/components/field-ops/FieldOpsFilters';

afterEach(() => cleanup());

const baseFilters: FieldFilters = {
  type: 'ALL',
  province: 'All',
  status: 'ALL',
  severity: 'ALL',
  offAir: false,
  lawSent: false,
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

describe('FieldOpsFilters · status chips', () => {
  it('always shows the same 3 status chips regardless of type', () => {
    for (const type of ['ALL', 'FM', 'INT'] as const) {
      const { getByText, queryByText } = renderFilters({ type });
      expect(getByText('PENDING')).toBeTruthy();
      expect(getByText('INSPECTED')).toBeTruthy();
      // CRITICAL/LAW SENT/OFF AIR no longer live in the status row
      // (they're separate severity dropdown + toggles now)
      expect(queryByText('LAW SENT')).not.toBe(getByText('PENDING'));
      cleanup();
    }
  });
});

describe('FieldOpsFilters · severity dropdown', () => {
  it('is shown for type=ALL and type=INT; hidden for type=FM', () => {
    const all = renderFilters({ type: 'ALL' });
    expect(all.queryByLabelText('Severity filter')).toBeTruthy();
    cleanup();
    const intView = renderFilters({ type: 'INT' });
    expect(intView.queryByLabelText('Severity filter')).toBeTruthy();
    cleanup();
    const fm = renderFilters({ type: 'FM' });
    expect(fm.queryByLabelText('Severity filter')).toBeNull();
  });

  it('exposes ALL · Critical · Major · Minor as options', () => {
    const { getByLabelText } = renderFilters({ type: 'ALL' });
    const select = getByLabelText('Severity filter') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['ALL', 'Critical', 'Major', 'Minor']);
  });
});

describe('FieldOpsFilters · OFF AIR / LAW SENT toggles', () => {
  it('OFF AIR toggle is shown for type=ALL/FM and hidden for INT', () => {
    const all = renderFilters({ type: 'ALL' });
    expect(all.queryByText('OFF AIR')).toBeTruthy();
    cleanup();
    const fm = renderFilters({ type: 'FM' });
    expect(fm.queryByText('OFF AIR')).toBeTruthy();
    cleanup();
    const int = renderFilters({ type: 'INT' });
    expect(int.queryByText('OFF AIR')).toBeNull();
  });

  it('LAW SENT toggle is shown for type=ALL/INT and hidden for FM', () => {
    const all = renderFilters({ type: 'ALL' });
    expect(all.queryByText('LAW SENT')).toBeTruthy();
    cleanup();
    const intView = renderFilters({ type: 'INT' });
    expect(intView.queryByText('LAW SENT')).toBeTruthy();
    cleanup();
    const fm = renderFilters({ type: 'FM' });
    expect(fm.queryByText('LAW SENT')).toBeNull();
  });

  it('clicking OFF AIR flips the filter flag', () => {
    const { onChange, getByText } = renderFilters({ type: 'ALL', offAir: false });
    fireEvent.click(getByText('OFF AIR'));
    expect(onChange.mock.calls[0][0]).toMatchObject({ offAir: true });
  });
});

describe('FieldOpsFilters · type-change cascade', () => {
  it('switching to FM clears severity and lawSent', () => {
    const { onChange, getAllByText } = renderFilters({
      type: 'ALL',
      severity: 'Critical',
      lawSent: true,
    });
    fireEvent.click(getAllByText('FM')[0]);
    const next = onChange.mock.calls[0][0];
    expect(next.type).toBe('FM');
    expect(next.severity).toBe('ALL');
    expect(next.lawSent).toBe(false);
  });

  it('switching to INT clears offAir', () => {
    const { onChange, getAllByText } = renderFilters({
      type: 'ALL',
      offAir: true,
    });
    fireEvent.click(getAllByText('INT')[0]);
    const next = onChange.mock.calls[0][0];
    expect(next.type).toBe('INT');
    expect(next.offAir).toBe(false);
  });

  it('switching type=FM with status=PENDING preserves status', () => {
    const { onChange, getAllByText } = renderFilters({
      type: 'ALL',
      status: 'PENDING',
    });
    fireEvent.click(getAllByText('FM')[0]);
    const next = onChange.mock.calls[0][0];
    expect(next.status).toBe('PENDING');
  });
});
