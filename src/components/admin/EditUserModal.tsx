"use client";

import { useState } from "react";
import type { PublicUser } from "@/types/user";

type Props = {
  user: PublicUser;
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function EditUserModal({ user, isSelf, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<"admin" | "inspector">(user.role);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const body: Record<string, unknown> = {};
    if (displayName.trim() !== user.displayName) {
      body.displayName = displayName.trim();
    }
    if (role !== user.role && !isSelf) {
      body.role = role;
    }
    if (Object.keys(body).length === 0) {
      onClose();
      return;
    }
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (res.ok) {
      onSaved();
      return;
    }
    const errBody = await res.json().catch(() => ({}));
    setError(errBody.error ?? "Failed to save");
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-[var(--fo-band)] p-6 space-y-4"
        style={{ color: "var(--fo-text)" }}
      >
        <h2 className="text-lg font-semibold">
          Edit user · <span className="font-mono">{user.username}</span>
        </h2>

        <label className="block text-sm">
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--fo-divider)] bg-transparent px-3 py-2"
          />
        </label>

        <fieldset className="text-sm">
          <legend className="mb-1">Role</legend>
          <label className="mr-3">
            <input
              type="radio"
              name="role"
              value="inspector"
              disabled={isSelf}
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
              disabled={isSelf}
              checked={role === "admin"}
              onChange={() => setRole("admin")}
            />{" "}
            Admin
          </label>
          {isSelf && (
            <p className="text-xs opacity-70 mt-1">
              You cannot change your own role.
            </p>
          )}
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
            disabled={submitting}
            className="rounded-md bg-[var(--fo-accent)] text-black px-3 py-1.5 text-sm"
          >
            {submitting ? "..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
