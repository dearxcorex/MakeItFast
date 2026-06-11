import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { FieldOpsDrawer } from '@/components/field-ops/FieldOpsDrawer';
import type { FieldOpsKpis } from '@/utils/fieldOpsKpi';

const baseKpis: FieldOpsKpis = {
  total: 26,
  inspected: 0,
  pending: 26,
  critical: null,
  target: 200,
  pct: 0,
};

afterEach(() => {
  cleanup();
});

describe('FieldOpsDrawer', () => {
  it('does not render when open is false', () => {
    const { container } = render(
      <FieldOpsDrawer
        open={false}
        activeTab="field-ops"
        theme="dark"
        kpis={baseKpis}
        onChangeTab={vi.fn()}
        onToggleTheme={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.textContent).toBe('');
  });

  it('renders NAV / theme / STATS sections when open', () => {
    const { container } = render(
      <FieldOpsDrawer
        open={true}
        activeTab="field-ops"
        theme="dark"
        kpis={baseKpis}
        onChangeTab={vi.fn()}
        onToggleTheme={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.textContent).toContain('NAV');
    expect(container.textContent).toContain('FIELD OPS');
    expect(container.textContent).toContain('INTERMOD');
    expect(container.textContent).toContain('ANALYTICS');
    expect(container.textContent).toContain('DARK');
    expect(container.textContent).toContain('LIVE');
    expect(container.textContent).toContain('STATS');
    expect(container.textContent).toContain('INSPECTED');
    expect(container.textContent).toContain('0/200');
    expect(container.textContent).toContain('PENDING');
    expect(container.textContent).toContain('26');
    expect(container.textContent).toContain('CRITICAL');
  });

  it('clicking a NAV button calls onChangeTab AND onClose', () => {
    const onChangeTab = vi.fn();
    const onClose = vi.fn();
    const { getByText } = render(
      <FieldOpsDrawer
        open={true}
        activeTab="field-ops"
        theme="dark"
        kpis={baseKpis}
        onChangeTab={onChangeTab}
        onToggleTheme={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(getByText('INTERMOD'));
    expect(onChangeTab).toHaveBeenCalledWith('intermod');
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the backdrop calls onClose', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(
      <FieldOpsDrawer
        open={true}
        activeTab="field-ops"
        theme="dark"
        kpis={baseKpis}
        onChangeTab={vi.fn()}
        onToggleTheme={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(getByTestId('fo-drawer-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the DARK toggle calls onToggleTheme', () => {
    const onToggleTheme = vi.fn();
    const { getByText } = render(
      <FieldOpsDrawer
        open={true}
        activeTab="field-ops"
        theme="dark"
        kpis={baseKpis}
        onChangeTab={vi.fn()}
        onToggleTheme={onToggleTheme}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(getByText(/DARK/));
    expect(onToggleTheme).toHaveBeenCalled();
  });

  it('shows critical as "—" when kpis.critical is null', () => {
    const { container } = render(
      <FieldOpsDrawer
        open={true}
        activeTab="field-ops"
        theme="dark"
        kpis={{ ...baseKpis, critical: null }}
        onChangeTab={vi.fn()}
        onToggleTheme={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.textContent).toContain('CRITICAL');
    expect(container.textContent).toContain('—');
  });
});
