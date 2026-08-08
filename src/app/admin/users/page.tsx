"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { PublicUser } from "@/types/user";
import { UserList } from "@/components/admin/UserList";
import { CreateUserModal } from "@/components/admin/CreateUserModal";
import { EditUserModal } from "@/components/admin/EditUserModal";
import { ResetPasswordModal } from "@/components/admin/ResetPasswordModal";

export default function AdminUsersPage() {
  const { user: me, loading } = useCurrentUser();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [resetting, setResetting] = useState<PublicUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoadingList(true);
    const res = await fetch("/api/admin/users", { credentials: "include" });
    if (res.ok) {
      const body = await res.json();
      setUsers(body.users as PublicUser[]);
    }
    setLoadingList(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (loading || !me) return null;

  async function toggleActive(target: PublicUser, nextActive: boolean) {
    const prev = users;
    setUsers((cur) =>
      cur.map((u) => (u.id === target.id ? { ...u, active: nextActive } : u))
    );
    const res = await fetch(`/api/admin/users/${target.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    });
    if (!res.ok) {
      setUsers(prev);
      alert("Failed to update user");
    }
  }

  return (
    <div
      className="field-ops-root min-h-screen p-6"
      style={{
        background: "var(--fo-canvas)",
        color: "var(--fo-text)",
      }}
    >
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm opacity-80 hover:opacity-100"
            style={{ color: "var(--fo-text)" }}
          >
            ← Back
          </Link>
          <h1 className="text-xl font-semibold" style={{ color: "var(--fo-text)" }}>
            Manage users
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-[var(--fo-accent)] px-3 py-1.5 text-sm font-medium"
          style={{ color: "#001e2b" }}
        >
          + New user
        </button>
      </header>

      {loadingList ? (
        <p>Loading…</p>
      ) : (
        <UserList
          users={users}
          currentUserId={me.id}
          onResetPassword={setResetting}
          onEdit={setEditing}
          onToggleActive={toggleActive}
        />
      )}

      {creating && (
        <CreateUserModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            fetchUsers();
          }}
        />
      )}
      {editing && (
        <EditUserModal
          user={editing}
          isSelf={editing.id === me.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchUsers();
          }}
        />
      )}
      {resetting && (
        <ResetPasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onDone={() => {
            setResetting(null);
            // Refetch like the create and edit flows: the reset sets
            // must_change_password, and without this the "temp pw" badge never
            // appears, so the list looks like the reset never happened.
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}
