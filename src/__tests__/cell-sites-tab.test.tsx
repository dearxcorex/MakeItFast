import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { CellSiteDetail } from '@/components/field-ops/CellSiteDetail';
import { CellSiteFilterBar } from '@/components/field-ops/CellSitesTab';
import { FieldOpsDrawer } from '@/components/field-ops/FieldOpsDrawer';
import { FieldOpsNav } from '@/components/field-ops/FieldOpsNav';
import type { CellSite } from '@/utils/cellSites';
import { DEFAULT_CELL_FILTERS } from '@/utils/cellSiteFilters';

afterEach(() => cleanup());

const site: CellSite = {
  province: 'นครราชสีมา',
  lat: 14.569721,
  lng: 101.232499,
  operators: ['AWN', 'NT*', 'TUC'],
  licences: {
    AWN: [
      { licenseNo: '060365103281', stationCode: '870163' },
      { licenseNo: '060359121970', stationCode: null },
    ],
    NT: [{ licenseNo: '060361186649', stationCode: 'NMA0319-L23' }],
    TUC: [],
  },
};

describe('CellSiteDetail', () => {
  it('lists every licence with its station code, per operator', () => {
    const { container } = render(<CellSiteDetail site={site} filters={DEFAULT_CELL_FILTERS} />);
    const text = container.textContent ?? '';
    expect(text).toContain('060365103281');
    expect(text).toContain('870163');
    expect(text).toContain('— no station code');
    expect(text).toContain('NT*');
    expect(text).toContain('NMA0319-L23');
    expect(text).toContain('No licence listed');
  });

  it('fades operators the filter hides instead of dropping them', () => {
    const { container } = render(
      <CellSiteDetail site={site} filters={{ ...DEFAULT_CELL_FILTERS, operators: ['NT'] }} />
    );
    const faded = [...container.querySelectorAll('section[data-faded="true"]')].map((s) =>
      s.getAttribute('aria-label')
    );
    expect(faded).toEqual(['AWN licences', 'TUC licences']);
  });

  it('links to driving directions for the exact coordinate', () => {
    const { container } = render(<CellSiteDetail site={site} filters={DEFAULT_CELL_FILTERS} />);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toContain('destination=14.569721,101.232499');
  });

  it('shows bearing and distance only once the user location is known', () => {
    const without = render(<CellSiteDetail site={site} filters={DEFAULT_CELL_FILTERS} />);
    expect(without.container.textContent).not.toContain('km');
    cleanup();
    const withLoc = render(
      <CellSiteDetail
        site={site}
        filters={DEFAULT_CELL_FILTERS}
        userLocation={{ latitude: 14.97, longitude: 102.1 }}
      />
    );
    expect(withLoc.container.textContent).toMatch(/→ \d{3}° · \d+\.\d km/);
  });
});

describe('CellSiteFilterBar', () => {
  const renderBar = (onChange = vi.fn(), filters = DEFAULT_CELL_FILTERS) =>
    render(
      <CellSiteFilterBar
        filters={filters}
        onChange={onChange}
        provinces={['ชัยภูมิ', 'นครราชสีมา']}
        operatorCounts={{ AWN: 3, NT: 2, TUC: 1 }}
        visibleCount={5}
        compact={false}
      />
    );

  it('turns an operator off, and back on in AWN/NT/TUC order', () => {
    const onChange = vi.fn();
    const { getByRole } = renderBar(onChange, { ...DEFAULT_CELL_FILTERS, operators: ['TUC'] });
    fireEvent.click(getByRole('button', { name: /AWN/ }));
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_CELL_FILTERS, operators: ['AWN', 'TUC'] });
    fireEvent.click(getByRole('button', { name: /TUC/ }));
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_CELL_FILTERS, operators: [] });
  });

  it('offers the provinces found in the data', () => {
    const { getByLabelText } = renderBar();
    const options = [...(getByLabelText('Province filter') as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toEqual(['All', 'ชัยภูมิ', 'นครราชสีมา']);
  });

  it('passes search text through', () => {
    const onChange = vi.fn();
    const { getByLabelText } = renderBar(onChange);
    fireEvent.change(getByLabelText('Search licence or station code'), { target: { value: 'NMA0319' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_CELL_FILTERS, search: 'NMA0319' });
  });
});

describe('Cell Sites navigation', () => {
  it('sits between Field Ops and Intermod in the rail', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(<FieldOpsNav active="field-ops" onChange={onChange} />);
    const labels = getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['FIELD OPS', 'CELL SITES', 'INTERMOD']);
    fireEvent.click(getAllByRole('button')[1]);
    expect(onChange).toHaveBeenCalledWith('cell-sites');
  });

  it('appears in the mobile drawer', () => {
    const onChangeTab = vi.fn();
    const { container, getByText } = render(
      <FieldOpsDrawer
        open
        activeTab="field-ops"
        theme="dark"
        kpis={{ total: 0, inspected: 0, pending: 0, critical: null, target: 0, pct: 0 }}
        onChangeTab={onChangeTab}
        onToggleTheme={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.textContent).toContain('CELL SITES');
    fireEvent.click(getByText('CELL SITES'));
    expect(onChangeTab).toHaveBeenCalledWith('cell-sites');
  });
});
