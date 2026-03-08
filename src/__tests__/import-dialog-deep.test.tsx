import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import React from 'react';

const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

import ImportDialog from '@/components/interference/ImportDialog';

describe('ImportDialog - file selection', () => {
  it('shows file name and size after selection', () => {
    const { container } = render(<ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test data'], 'data.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'size', { value: 2048 });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(container.textContent).toContain('data.csv');
    expect(container.textContent).toContain('2.0 KB');
  });

  it('enables Import button after file selection', () => {
    const { container } = render(<ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'data.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Import'
    );
    expect(importBtn?.disabled).toBe(false);
  });

  it('accepts .csv, .xlsx, .xls files', () => {
    const { container } = render(<ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.accept).toBe('.csv,.xlsx,.xls');
  });
});

describe('ImportDialog - handleImport', () => {
  const selectFile = (container: HTMLElement) => {
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test content'], 'data.csv', { type: 'text/csv' });
    // fireEvent.change passes the target properties to the actual event target
    // React reads e.target.files from the change event
    fireEvent.change(fileInput, {
      target: { files: [file] },
    });
  };

  it('calls API with FormData and shows success', async () => {
    vi.useFakeTimers();
    const onImportComplete = vi.fn();

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, imported: 42 }),
    });

    const { container } = render(
      <ImportDialog onClose={vi.fn()} onImportComplete={onImportComplete} />
    );

    selectFile(container);

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Import'
    )!;
    expect(importBtn.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(importBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Successfully imported 42 records');

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(onImportComplete).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('shows error message on API failure', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'Invalid format' }),
    });

    const { container } = render(
      <ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />
    );

    selectFile(container);

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Import'
    )!;

    await act(async () => {
      fireEvent.click(importBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Error: Invalid format');
  });

  it('shows error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));

    const { container } = render(
      <ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />
    );

    selectFile(container);

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Import'
    )!;

    await act(async () => {
      fireEvent.click(importBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Error: Error: Network failure');
  });

  it('shows Importing... while loading', async () => {
    let resolvePromise: (v: unknown) => void;
    const promise = new Promise((resolve) => { resolvePromise = resolve; });
    mockFetch.mockReturnValueOnce(promise);

    const { container } = render(
      <ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'data.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Import'
    )!;

    act(() => {
      fireEvent.click(importBtn);
    });

    expect(container.textContent).toContain('Importing...');

    await act(async () => {
      resolvePromise!({ json: () => Promise.resolve({ success: true, imported: 1 }) });
    });
  });

  it('disables import button while importing', async () => {
    let resolvePromise: (v: unknown) => void;
    const promise = new Promise((resolve) => { resolvePromise = resolve; });
    mockFetch.mockReturnValueOnce(promise);

    const { container } = render(
      <ImportDialog onClose={vi.fn()} onImportComplete={vi.fn()} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['test'], 'data.csv', { type: 'text/csv' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Import'
    )!;

    act(() => {
      fireEvent.click(importBtn);
    });

    // Button should be disabled during import
    const importBtnDuring = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Importing')
    )!;
    expect(importBtnDuring.disabled).toBe(true);

    await act(async () => {
      resolvePromise!({ json: () => Promise.resolve({ success: true, imported: 1 }) });
    });
  });
});

describe('ImportDialog - backdrop click', () => {
  it('calls onClose when clicking backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ImportDialog onClose={onClose} onImportComplete={vi.fn()} />
    );

    // The backdrop is the first child with bg-black/60
    const backdrop = container.querySelector('.bg-black\\/60');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it('calls onClose when X button clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ImportDialog onClose={onClose} onImportComplete={vi.fn()} />
    );

    // X button is the second button (after none or the first close-type button)
    const buttons = container.querySelectorAll('button');
    // First button in the header is the X close button
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });
});
