"use client";

import { useEffect, useState, type FormEvent } from "react";

const MIN_LENGTH = 8;

/** Sentinel: the bootstrap fetch has navigated away, so don't render into it. */
const REDIRECTING = Symbol("redirecting");

export default function ChangePasswordPage() {
  const [forced, setForced] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whether the current password field is required depends on the server's
  // view of the account, not on how the user arrived at this page.
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (r) => {
        // A 401 here means the cookie is stale — revoked by a password write
        // elsewhere, or simply expired. Middleware still routes it here on the
        // strength of the flag it was sealed with, so without this bounce the
        // user loops between the gate and a form that cannot succeed.
        if (r.status === 401) {
          window.location.assign("/login?next=%2Fchange-password");
          return REDIRECTING;
        }
        return r.ok ? r.json() : {};
      })
      .then((j) => {
        if (j === REDIRECTING) return;
        setForced(Boolean(j?.user?.mustChangePassword));
      })
      .catch(() => setForced(false));
  }, []);

  const mismatch = confirm.length > 0 && newPassword !== confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mismatch) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        forced ? { newPassword } : { currentPassword, newPassword }
      ),
    });

    if (res.ok) {
      // Hard navigation for the same reason the login page uses one: the
      // App Router cache still holds the middleware redirect issued while
      // the change was pending.
      window.location.assign("/");
      return;
    }

    const body = await res.json().catch(() => ({}));
    setError(
      body?.error === "invalid_credentials"
        ? "Current password is incorrect."
        : body?.error === "password_reused"
          ? "Pick a password you haven't used here before."
          : body?.error === "current_password_required"
            ? "Enter your current password."
            : `Password must be at least ${MIN_LENGTH} characters.`
    );
    setSubmitting(false);
  }

  if (forced === null) return null;

  return (
    <div
      className="field-ops-root min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--fo-canvas)", color: "var(--fo-text)" }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl p-6 shadow-xl space-y-4"
        style={{ background: "var(--fo-band)", color: "var(--fo-text)" }}
      >
        <h1 className="text-2xl font-semibold text-center">
          {forced ? "Set your password" : "Change password"}
        </h1>

        {forced && (
          <p className="text-sm opacity-80 text-center">
            An admin issued your current password. Choose your own to continue —
            only you should know it.
          </p>
        )}

        {!forced && (
          <div>
            <label htmlFor="current" className="block text-sm mb-1">
              Current password
            </label>
            <input
              id="current"
              name="currentPassword"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--fo-divider)] bg-transparent px-3 py-2"
              required
            />
          </div>
        )}

        <div>
          <label htmlFor="new" className="block text-sm mb-1">
            New password
          </label>
          <div className="relative">
            <input
              id="new"
              name="newPassword"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--fo-divider)] bg-transparent px-3 py-2 pr-10"
              required
            />
            <button
              type="button"
              aria-label={showPw ? "Hide" : "Show"}
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-70"
            >
              {showPw ? "🙈" : "👁"}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm mb-1">
            Confirm new password
          </label>
          <input
            id="confirm"
            name="confirm"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-md border border-[var(--fo-divider)] bg-transparent px-3 py-2"
            required
          />
          {mismatch && (
            <p role="alert" className="text-xs mt-1 text-red-400">
              Passwords do not match
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || mismatch}
          className="w-full rounded-md bg-[var(--fo-accent)] text-black font-medium py-2 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting && <span aria-hidden className="fo-spinner" />}
          {submitting ? "Saving…" : "Save password"}
        </button>
      </form>
    </div>
  );
}
