// src/__tests__/login-spinner.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/login/page';

// next/navigation hooks are required by the login page.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => cleanup());

beforeEach(() => {
  // Pending fetch — never resolves so the submitting state stays true.
  global.fetch = vi.fn(() => new Promise(() => {})) as never;
});

describe('LoginPage — submit spinner', () => {
  it('idle button shows "Sign in" with no spinner', () => {
    const { getByRole, container } = render(<LoginPage />);
    const btn = getByRole('button', { name: /sign in/i });
    expect(btn.hasAttribute('disabled')).toBe(false);
    // The spinner span carries the animate-spin class only while submitting.
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('after submit, button is disabled, shows spinner + "Signing in…"', async () => {
    const { getByRole, getByLabelText, container } = render(<LoginPage />);
    fireEvent.change(getByLabelText(/username/i), { target: { value: 'iff' } });
    fireEvent.change(getByLabelText(/password/i), { target: { value: 'pw12345678' } });
    const btn = getByRole('button', { name: /sign in/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
    expect(btn.textContent).toContain('Signing in');
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });
});
