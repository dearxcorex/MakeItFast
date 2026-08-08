"use client";

import { useState } from "react";
import type { PublicUser } from "@/types/user";
import { generatePassword } from "@/lib/passwordGenerator";
import { CopyablePassword } from "./CopyablePassword";

type Props = {
  user: PublicUser;
  onClose: () => void;
  onDone: () => void;
};

export function ResetPasswordModal({ user, onClose, onDone }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const mismatch = confirm.length > 0 && newPassword !== confirm;
  const canSubmit =
    newPassword.length >= 8 && newPassword === confirm && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    setSubmitting(false);
    if (res.ok) {
      setSuccess(true);
      return;
    }
    setError("Failed to reset password");
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-[var(--fo-band)] p-6 space-y-4"
        style={{ color: "var(--fo-text)" }}
      >
        <h2 className="text-lg font-semibold">
          Reset password for{" "}
          <span className="font-mono">{user.username}</span>
        </h2>

        {success ? (
          <>
            <p className="text-sm">
              Password reset. This is the only time it is shown — copy it now
              and pass it to the user verbally or via chat.
            </p>
            <CopyablePassword value={newPassword} />
            <p className="text-xs opacity-70">
              {user.displayName} must choose their own password the next time
              they sign in; this one stops working then.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onDone}
                className="rounded-md bg-[var(--fo-accent)] text-black px-3 py-1.5 text-sm"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              data-testid="generate-password"
              onClick={() => {
                const pw = generatePassword();
                setNewPassword(pw);
                setConfirm(pw);
                setShowPw(true);
              }}
              className="w-full rounded-md border border-[var(--fo-divider)] py-2 text-sm"
            >
              Generate strong password
            </button>

            <label className="block text-sm">
              New password
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[var(--fo-divider)] bg-transparent px-3 py-2 pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide" : "Show"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-70"
                >
                  {showPw ? "🙈" : "👁"}
                </button>
              </div>
              {tooShort && (
                <span className="text-xs text-red-400">at least 8 chars</span>
              )}
            </label>

            <label className="block text-sm">
              Confirm
              <input
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--fo-divider)] bg-transparent px-3 py-2"
              />
              {mismatch && (
                <span className="text-xs text-red-400">
                  passwords do not match
                </span>
              )}
            </label>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-md bg-[var(--fo-accent)] text-black px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {submitting ? "..." : "Reset"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
