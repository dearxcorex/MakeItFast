import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import React from 'react';

const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ==========================================
// InterferenceFilterPanel
// ==========================================
import InterferenceFilterPanel from '@/components/interference/InterferenceFilterPanel';

describe('InterferenceFilterPanel', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ byProvince: { Bangkok: 5, 'Chiang Mai': 3 } }),
    });
  });

  it('renders dropdowns', async () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={vi.fn()} />
    );
    expect(container.textContent).toContain('All Provinces');
  });

  it('renders ranking filter badges', () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={vi.fn()} />
    );
    expect(container.textContent).toContain('Critical');
    expect(container.textContent).toContain('Major');
    expect(container.textContent).toContain('Minor');
    expect(container.textContent).toContain('Has Source');
  });

  it('toggles ranking filter on badge click', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );
    const criticalBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Critical'
    )!;
    fireEvent.click(criticalBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ranking: 'Critical' }));
  });

  it('untoggles ranking filter when clicking active badge', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{ ranking: 'Critical' }} onFiltersChange={onChange} />
    );
    const criticalBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Critical'
    )!;
    fireEvent.click(criticalBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ranking: undefined }));
  });

  it('toggles hasSource filter', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );
    const sourceBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Has Source'
    )!;
    fireEvent.click(sourceBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hasSource: true }));
  });

  it('changes province filter via select', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );

    // Wait for provinces to load from API
    await waitFor(() => {
      const selects = container.querySelectorAll('select');
      const options = selects[0].querySelectorAll('option');
      expect(options.length).toBeGreaterThan(1);
    });

    const selects = container.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: 'Bangkok' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ changwat: 'Bangkok' }));
  });

  it('changes ranking filter via badge click', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );
    const majorBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Major'
    )!;
    fireEvent.click(majorBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ranking: 'Major' }));
  });

  it('shows clear button when filters active and clears', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{ ranking: 'Critical' }} onFiltersChange={onChange} />
    );
    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Clear all')
    )!;
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('does not show clear button when no filters active', () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={vi.fn()} />
    );
    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Clear all')
    );
    expect(clearBtn).toBeUndefined();
  });

  it('renders status filter buttons', () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={vi.fn()} />
    );
    expect(container.textContent).toContain('ตรวจแล้ว');
    expect(container.textContent).toContain('ยังไม่ตรวจ');
  });

  it('toggles ตรวจแล้ว status filter on click', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );
    const statusBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('ตรวจแล้ว') && !b.textContent?.includes('ยังไม่ตรวจ')
    )!;
    fireEvent.click(statusBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'ตรวจแล้ว' }));
  });

  it('untoggles ตรวจแล้ว status filter when already active', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{ status: 'ตรวจแล้ว' }} onFiltersChange={onChange} />
    );
    const statusBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('ตรวจแล้ว') && !b.textContent?.includes('ยังไม่ตรวจ')
    )!;
    fireEvent.click(statusBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it('toggles ยังไม่ตรวจ status filter on click', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{}} onFiltersChange={onChange} />
    );
    const statusBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('ยังไม่ตรวจ')
    )!;
    fireEvent.click(statusBtn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'ยังไม่ตรวจ' }));
  });

  it('shows active class when ตรวจแล้ว status is active', () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{ status: 'ตรวจแล้ว' }} onFiltersChange={vi.fn()} />
    );
    const statusBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('ตรวจแล้ว') && !b.textContent?.includes('ยังไม่ตรวจ')
    )!;
    expect(statusBtn.className).toContain('active');
  });

  it('shows active class when ยังไม่ตรวจ status is active', () => {
    const { container } = render(
      <InterferenceFilterPanel filters={{ status: 'ยังไม่ตรวจ' }} onFiltersChange={vi.fn()} />
    );
    const statusBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('ยังไม่ตรวจ')
    )!;
    expect(statusBtn.className).toContain('active');
  });

  it('includes status in clear all filters', () => {
    const onChange = vi.fn();
    const { container } = render(
      <InterferenceFilterPanel filters={{ status: 'ตรวจแล้ว' }} onFiltersChange={onChange} />
    );
    const clearBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Clear all')
    )!;
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith({});
  });
});

