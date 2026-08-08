"use client";

import { useState } from "react";
import { generatePassword } from "@/lib/passwordGenerator";
import { CopyablePassword } from "./CopyablePassword";

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;

export function CreateUserModal({ onClose, onCreated }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"admin" | "inspector">("inspector");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const usernameOk = USERNAME_RE.test(username.trim().toLowerCase());
  const passwordOk = password.length >= 8;
  const displayNameOk = displayName.trim().length > 0;
  const formOk = usernameOk && passwordOk && displayNameOk;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: username.trim().toLowerCase(),
        password,
        displayName: displayName.trim(),
        role,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      // Don't close yet: a generated password is only knowable from this
      // screen, so the admin needs a beat to copy it before it's gone.
      setCreated(true);
      return;
    }
    if (res.status === 409) {
      setError("Username already taken");
    } else if (res.status === 400) {
      setError("Invalid input");
    } else {
      setError("Failed to create user");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-[var(--fo-band)] p-6 space-y-4"
        style={{ color: "var(--fo-text)" }}
      >
        <h2 className="text-lg font-semibold">New user</h2>

        {created ? (
          <>
            <p className="text-sm">
              <span className="font-mono">{username.trim().toLowerCase()}</span>{" "}
              created. This is the only time the password is shown — copy it now.
            </p>
            <CopyablePassword value={password} />
            <p className="text-xs opacity-70">
              They must choose their own password the first time they sign in.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onCreated}
                className="rounded-md bg-[var(--fo-accent)] text-black px-3 py-1.5 text-sm"
              >
                Done
              </button>
            </div>
          </>
        ) : (
        <>
        <label className="block text-sm">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--fo-divider)] bg-transparent px-3 py-2"
            autoFocus
          />
          {username && !usernameOk && (
            <span className="text-xs text-red-400">
              3-32 chars, [a-z0-9_.-] only
            </span>
          )}
        </label>

        <label className="block text-sm">
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--fo-divider)] bg-transparent px-3 py-2"
          />
        </label>

        <button
          type="button"
          data-testid="generate-password"
          onClick={() => {
            setPassword(generatePassword());
            setShowPw(true);
          }}
          className="w-full rounded-md border border-[var(--fo-divider)] py-2 text-sm"
        >
          Generate strong password
        </button>

        <label className="block text-sm">
          Password
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--fo-divider)] bg-transparent px-3 py-2 pr-10"
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
          {password && !passwordOk && (
            <span className="text-xs text-red-400">at least 8 chars</span>
          )}
        </label>

        <fieldset className="text-sm">
          <legend className="mb-1">Role</legend>
          <label className="mr-3">
            <input
              type="radio"
              name="role"
              value="inspector"
              checked={role === "inspector"}
              onChange={() => setRole("inspector")}
            />{" "}
            Inspector
          </label>
          <label>
            <input
              type="radio"
              name="role"
              value="admin"
              checked={role === "admin"}
              onChange={() => setRole("admin")}
            />{" "}
            Admin
          </label>
        </fieldset>

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
            disabled={!formOk || submitting}
            className="rounded-md bg-[var(--fo-accent)] text-black px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {submitting ? "..." : "Create"}
          </button>
        </div>
        </>
        )}
      </form>
    </div>
  );
}
