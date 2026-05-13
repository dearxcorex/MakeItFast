"use client";

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
    <div className="field-ops-root min-h-screen bg-[var(--fo-bg)] text-[var(--fo-fg)] p-6">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Manage users</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-[var(--fo-accent)] text-black px-3 py-1.5 text-sm"
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
          onDone={() => setResetting(null)}
        />
      )}
    </div>
  );
}
