# Mobile Header + Login Spinner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two small UX fixes — make the mobile field-ops header visible at all times (currently lost behind the Leaflet map on iOS Safari), and replace the literal `"..."` text on the login button with a real spinner.

**Architecture:** Three surgical edits (one CSS unit change, one position:sticky addition, one button-content rewrite) plus one new test file for the spinner behaviour. No new components, no new dependencies.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 4, Vitest + @testing-library/react.

---

## File Structure

**Task 1 (mobile header fix):**
- Modify: `src/components/field-ops/FieldOpsClient.tsx` — root container `minHeight: "100vh"` → `"100dvh"`.
- Modify: `src/components/field-ops/FieldOpsHeader.tsx` — mobile `<header>` element gains `position: "sticky", top: 0, zIndex: 50`.

**Task 2 (login spinner):**
- Modify: `src/app/login/page.tsx` — submit button content replaced with an inline Tailwind spinner + "Signing in…" label.
- Create: `src/__tests__/login-spinner.test.tsx` — 2 cases pinning the visible/invisible states.

---

## Task 1: Mobile header visibility (100dvh + sticky)

**Files:**
- Modify: `src/components/field-ops/FieldOpsClient.tsx` (around line 462)
- Modify: `src/components/field-ops/FieldOpsHeader.tsx` (the `MobileHeader` function's `<header>` element, around lines 262-273)

- [ ] **Step 1: Switch root container to dynamic viewport units**

Open `src/components/field-ops/FieldOpsClient.tsx`. Find the root `<div className="field-ops-root">`'s style block (around line 461-465):

```tsx
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
```

Replace with:

```tsx
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
```

That's the only change in this file.

- [ ] **Step 2: Make the mobile header sticky**

Open `src/components/field-ops/FieldOpsHeader.tsx`. Find the `MobileHeader` function's `<header>` element (the function is defined around line ~225, the `<header>` return JSX starts around line 261). The existing style block is:

```tsx
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: headerBg,
        color: textColor,
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
      }}
    >
```

Replace with:

```tsx
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: headerBg,
        color: textColor,
        borderBottom: `1px solid ${borderColor}`,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
```

**Do NOT change the desktop branch** (the function-level early-return for `isMobile === false` returns its own `<header>` higher up in the file — keep that one as-is).

- [ ] **Step 3: Verify the dev server compiles**

```bash
tmux capture-pane -t dev -p | tail -10
```

Expected: `✓ Compiled` line, no TypeScript or CSS errors. If the dev server isn't running:

```bash
CMD=npm; tmux new-session -d -s dev "$CMD run dev"
sleep 4
tmux capture-pane -t dev -p | tail -10
```

- [ ] **Step 4: Manual smoke test (mobile viewport)**

Open `http://localhost:3000/field-ops` in DevTools' device-emulation mode (set device to iPhone 14, hard refresh). Confirm:
- The "Field Operations · ALL" header is visible at the top of the screen.
- Scrolling inside the map does NOT push the header off the top.
- Tapping the hamburger (☰) still opens the drawer.

If you can't run a browser, just confirm the dev server has no compile errors.

- [ ] **Step 5: Confirm no test regression**

```bash
npx vitest run src/__tests__/field-ops-current.test.tsx src/__tests__/field-ops-crew-bootstrap.test.tsx
```

Expected: existing pass counts hold (no regression from CSS-only changes).

- [ ] **Step 6: Commit**

```bash
git add src/components/field-ops/FieldOpsClient.tsx src/components/field-ops/FieldOpsHeader.tsx
git commit -m "$(cat <<'EOF'
fix(field-ops): make mobile header always visible

Two coordinated CSS-only changes fix the issue where the
"Field Operations" header was pushed above the visible viewport
on iOS Safari (legacy 100vh overflows when the browser URL bar
and bottom toolbar are showing), and the Leaflet map captured
vertical swipes so the user couldn't scroll up to find it.

- FieldOpsClient.tsx: switch root container from 100vh to
  100dvh so iOS Safari math is correct (dynamic viewport
  excludes the browser chrome).
- FieldOpsHeader.tsx (MobileHeader only): position:sticky;
  top:0; zIndex:50 so the header always renders at the top of
  the visible area regardless of scroll position.

Desktop header is unchanged.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Login button spinner

**Files:**
- Create: `src/__tests__/login-spinner.test.tsx`
- Modify: `src/app/login/page.tsx` (button block, around lines 113-119)

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/login-spinner.test.tsx`:

```tsx
// src/__tests__/login-spinner.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/login/page';

// next/navigation hooks are required by the login page.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
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
```

- [ ] **Step 2: Run the tests — expect 1 PASS, 1 FAIL**

```bash
npx vitest run src/__tests__/login-spinner.test.tsx
```

Expected: "idle button" passes (current code already renders "Sign in" on idle). "after submit" FAILS — the current button shows `"..."` (no `.animate-spin` element).

- [ ] **Step 3: Replace the button in `src/app/login/page.tsx`**

Find the existing submit button (around lines 113-119):

```tsx
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-[var(--fo-accent)] text-black font-medium py-2 disabled:opacity-60"
        >
          {submitting ? "..." : "Sign in"}
        </button>
```

Replace with:

```tsx
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-[var(--fo-accent)] text-black font-medium py-2 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting && (
            <span
              aria-hidden
              className="inline-block w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin"
            />
          )}
          {submitting ? "Signing in…" : "Sign in"}
        </button>
```

- [ ] **Step 4: Run the tests — expect 2 PASS**

```bash
npx vitest run src/__tests__/login-spinner.test.tsx
```

Expected: 2 pass.

- [ ] **Step 5: Confirm dev server compiles**

```bash
tmux capture-pane -t dev -p | tail -10
```

Expected: `✓ Compiled` line.

- [ ] **Step 6: Commit**

```bash
git add src/app/login/page.tsx src/__tests__/login-spinner.test.tsx
git commit -m "$(cat <<'EOF'
feat(login): replace "..." with inline spinner during submit

The login button used to show the literal string "..." while
the auth request was in flight — no visual loading affordance.
Replace with a small dark spinning circle (Tailwind's built-in
animate-spin keyframe) + "Signing in…" label, button stays
disabled. Two tests pin the idle vs submitting states.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Build + lint + final sweep

**Files:** (no code changes — verification)

- [ ] **Step 1: Production build**

```bash
npm run build 2>&1 | tail -8
```

Expected: build completes successfully (look for "✓ Compiled successfully" or the route table at the end). If a TypeScript error appears, fix it before proceeding.

- [ ] **Step 2: Lint sweep**

```bash
npm run lint 2>&1 | head -5
```

Expected: 0 errors. Warning count should be the same as before this work (no new warnings).

- [ ] **Step 3: Full test sweep**

```bash
npm test -- --run 2>&1 | tail -5
```

Expected: pass count goes up by 2 (the new login-spinner tests). Fail count stays at the pre-session baseline (no new regressions). The 25 pre-existing failures (components-batch4, intermod-calculator-deep, field-ops-drawer, analytics.test.tsx) remain.

- [ ] **Step 4: Optional fix commit (only if verification surfaced anything)**

If a bug surfaces during verification, fix inline and commit:

```bash
git add <files>
git commit -m "$(cat <<'EOF'
fix: <one-line description of what verification surfaced>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

If verification was clean, no commit is needed.

---

## Self-Review Notes

- **Spec coverage:** Every spec section maps to a task:
  - Issue 1 (mobile header) Part A (100dvh) → Task 1 Step 1.
  - Issue 1 Part B (sticky header) → Task 1 Step 2.
  - Issue 2 (login spinner) → Task 2 Steps 1-3.
  - Testing → Task 2 Step 1 (spinner tests) + Task 3 (full sweep verification).
- **Placeholder scan:** Every code block is complete. Every command has expected output.
- **Type consistency:**
  - `position: "sticky"`, `top: 0`, `zIndex: 50` match across the spec and the plan.
  - `animate-spin` Tailwind class is built-in (no config change needed).
  - Tests use `.animate-spin` selector for the spinner element to match the className added in the implementation.
- **Branch:** `fix/mobile-header-and-login-spinner` already exists per controller context. No `git checkout -b` needed.
- **No new dependencies, no schema changes, no API changes.**
