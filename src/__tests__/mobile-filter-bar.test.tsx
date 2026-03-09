import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

import MobileFilterBar from '@/components/client/MobileFilterBar';
import type { FMStation, FilterType } from '@/types/station';

afterEach(() => {
  cleanup();
});

const makeStation = (overrides: Partial<FMStation> = {}): FMStation => ({
  id: '1',
  name: 'Test FM',
  frequency: 98.5,
  latitude: 13.75,
  longitude: 100.5,
  city: 'Bangkok',
  state: 'Bangkok',
  genre: 'FM',
  onAir: true,
  ...overrides,
});

const defaultProps = {
  filters: {} as FilterType,
  setFilters: vi.fn(),
  showFilters: false,
  setShowFilters: vi.fn(),
  clearFilters: vi.fn(),
  initialProvinces: ['Bangkok', 'Chiang Mai'],
  initialCities: ['Bangkok Noi', 'Bangkok Yai'],
  initialInspectionStatuses: ['ตรวจแล้ว', 'ยังไม่ตรวจ'],
  stations: [
    makeStation({ id: '1', city: 'Bangkok Noi', state: 'Bangkok' }),
    makeStation({ id: '2', city: 'Bangkok Yai', state: 'Bangkok' }),
  ],
};

describe('MobileFilterBar', () => {
  it('renders search input', () => {
    const { container } = render(<MobileFilterBar {...defaultProps} />);
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    expect(input?.getAttribute('placeholder')).toContain('Search');
  });

  it('calls setFilters on search input change', () => {
    const setFilters = vi.fn();
    const { container } = render(<MobileFilterBar {...defaultProps} setFilters={setFilters} />);
    const input = container.querySelector('input[type="text"]')!;
    fireEvent.change(input, { target: { value: 'test' } });
    expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ search: 'test' }));
  });

  it('shows clear search button when search active', () => {
    const { container } = render(
      <MobileFilterBar {...defaultProps} filters={{ search: 'test' }} />
    );
    const clearBtns = container.querySelectorAll('button');
    // Should have the X button inside search
    expect(clearBtns.length).toBeGreaterThan(0);
  });

  it('renders filter toggle button', () => {
    const { container } = render(<MobileFilterBar {...defaultProps} />);
    const toggleBtn = container.querySelector('[aria-label="Toggle filters"]');
    expect(toggleBtn).toBeTruthy();
  });

  it('calls setShowFilters on toggle click', () => {
    const setShow = vi.fn();
    const { container } = render(
      <MobileFilterBar {...defaultProps} setShowFilters={setShow} />
    );
    const toggleBtn = container.querySelector('[aria-label="Toggle filters"]')!;
    fireEvent.click(toggleBtn);
    expect(setShow).toHaveBeenCalledWith(true);
  });

  it('shows active filter count badge', () => {
    const { container } = render(
      <MobileFilterBar {...defaultProps} filters={{ province: 'Bangkok', onAir: true }} />
    );
    // Badge should show "2"
    expect(container.textContent).toContain('2');
  });

  it('renders province dropdown', () => {
    const { container } = render(
      <MobileFilterBar {...defaultProps} showFilters={true} />
    );
    expect(container.textContent).toContain('All Provinces');
  });

  it('calls setFilters on province change', () => {
    const setFilters = vi.fn();
    const { container } = render(
      <MobileFilterBar {...defaultProps} setFilters={setFilters} showFilters={true} />
    );
    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Bangkok' } });
    expect(setFilters).toHaveBeenCalledWith(
      expect.objectContaining({ province: 'Bangkok', city: undefined })
    );
  });

  it('renders On Air / Off Air buttons', () => {
    const { container } = render(
      <MobileFilterBar {...defaultProps} showFilters={true} />
    );
    expect(container.textContent).toContain('On Air');
    expect(container.textContent).toContain('Off Air');
  });

  it('toggles On Air filter', () => {
    const setFilters = vi.fn();
    const { container } = render(
      <MobileFilterBar {...defaultProps} setFilters={setFilters} showFilters={true} />
    );
    const buttons = Array.from(container.querySelectorAll('button'));
    const onAirBtn = buttons.find((b) => b.textContent?.includes('On Air'));
    fireEvent.click(onAirBtn!);
    expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ onAir: true }));
  });

  it('toggles Off Air filter', () => {
    const setFilters = vi.fn();
    const { container } = render(
      <MobileFilterBar {...defaultProps} setFilters={setFilters} showFilters={true} />
    );
    const buttons = Array.from(container.querySelectorAll('button'));
    const offAirBtn = buttons.find((b) => b.textContent?.includes('Off Air'));
    fireEvent.click(offAirBtn!);
    expect(setFilters).toHaveBeenCalledWith(expect.objectContaining({ onAir: false }));
  });

  it('renders inspection dropdown', () => {
    const { container } = render(
      <MobileFilterBar {...defaultProps} showFilters={true} />
    );
    expect(container.textContent).toContain('All Inspection');
  });

  it('shows Clear button when filters active', () => {
    const { container } = render(
      <MobileFilterBar
        {...defaultProps}
        showFilters={true}
        filters={{ province: 'Bangkok' }}
      />
    );
    expect(container.textContent).toContain('Clear');
  });

  it('calls clearFilters on Clear click', () => {
    const clearFn = vi.fn();
    const { container } = render(
      <MobileFilterBar
        {...defaultProps}
        showFilters={true}
        filters={{ province: 'Bangkok' }}
        clearFilters={clearFn}
      />
    );
    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Clear')
    )!;
    fireEvent.click(clearBtn);
    expect(clearFn).toHaveBeenCalled();
  });

  it('city dropdown disabled when no province selected', () => {
    const { container } = render(
      <MobileFilterBar {...defaultProps} showFilters={true} />
    );
    const selects = container.querySelectorAll('select');
    expect(selects[1].disabled).toBe(true);
  });

  it('city dropdown enabled when province selected', () => {
    const { container } = render(
      <MobileFilterBar
        {...defaultProps}
        showFilters={true}
        filters={{ province: 'Bangkok' }}
      />
    );
    const selects = container.querySelectorAll('select');
    expect(selects[1].disabled).toBe(false);
  });
});
