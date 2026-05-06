import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { MobileFilterBar } from '@/components/field-ops/MobileFilterBar';
import { DEFAULT_FILTERS } from '@/components/field-ops/FieldOpsFilters';

const SS_KEY = 'fo:mobileFiltersOpen';

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('MobileFilterBar', () => {
  it('renders TYPE and STATUS chip rows when expanded', () => {
    const { container } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={vi.fn()} provinces={['นครราชสีมา', 'ชัยภูมิ']} />
    );
    expect(container.textContent).toContain('TYPE');
    expect(container.textContent).toContain('STATUS');
    expect(container.textContent).toContain('FM');
    expect(container.textContent).toContain('INT');
    expect(container.textContent).toContain('PENDING');
    expect(container.textContent).toContain('INSPECTED');
    expect(container.textContent).toContain('OFF AIR');
  });

  it('clicking a TYPE chip calls onChange with the new type', () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={onChange} provinces={['นครราชสีมา', 'ชัยภูมิ']} />
    );
    fireEvent.click(getByText('FM'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'FM' }));
  });

  it('clicking the collapse chevron toggles to a single FILTERS pill', () => {
    const { container, getByLabelText } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={vi.fn()} provinces={['นครราชสีมา', 'ชัยภูมิ']} />
    );
    fireEvent.click(getByLabelText('Collapse filters'));
    expect(container.textContent).toContain('FILTERS · 0');
    expect(container.textContent).not.toContain('TYPE');
  });

  it('shows non-zero count in the collapsed pill when filters are active', () => {
    const { container, getByLabelText } = render(
      <MobileFilterBar
        filters={{ ...DEFAULT_FILTERS, type: 'FM', status: 'PENDING' }}
        onChange={vi.fn()}
        provinces={['นครราชสีมา', 'ชัยภูมิ']}
      />
    );
    fireEvent.click(getByLabelText('Collapse filters'));
    expect(container.textContent).toContain('FILTERS · 2');
  });

  it('persists collapsed state to sessionStorage', () => {
    const { getByLabelText } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={vi.fn()} provinces={['นครราชสีมา', 'ชัยภูมิ']} />
    );
    fireEvent.click(getByLabelText('Collapse filters'));
    expect(window.sessionStorage.getItem(SS_KEY)).toBe('false');
  });

  it('hydrates from sessionStorage on mount', () => {
    window.sessionStorage.setItem(SS_KEY, 'false');
    const { container } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={vi.fn()} provinces={['นครราชสีมา', 'ชัยภูมิ']} />
    );
    expect(container.textContent).toContain('FILTERS');
    expect(container.textContent).not.toContain('TYPE');
  });

  it('clicking the expand pill restores the chip rows', () => {
    window.sessionStorage.setItem(SS_KEY, 'false');
    const { container, getByLabelText } = render(
      <MobileFilterBar filters={DEFAULT_FILTERS} onChange={vi.fn()} provinces={['นครราชสีมา', 'ชัยภูมิ']} />
    );
    fireEvent.click(getByLabelText('Expand filters'));
    expect(container.textContent).toContain('TYPE');
    expect(container.textContent).toContain('STATUS');
  });
});
