"use client";

import type { PublicUser } from "@/types/user";

type Props = {
  users: PublicUser[];
  currentUserId: number;
  onResetPassword: (user: PublicUser) => void;
  onEdit: (user: PublicUser) => void;
  onToggleActive: (user: PublicUser, nextActive: boolean) => void;
};

export function UserList({
  users,
  currentUserId,
  onResetPassword,
  onEdit,
  onToggleActive,
}: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left opacity-70">
          <th className="py-2 w-12">ID</th>
          <th>Username</th>
          <th>Display name</th>
          <th>Role</th>
          <th>Active</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          return (
            <tr
              key={u.id}
              data-userid={u.id}
              className={`border-t border-[var(--fo-divider)] ${
                u.active ? "" : "opacity-50"
              }`}
            >
              <td className="py-2 font-mono opacity-60">{u.id}</td>
              <td className="font-mono">
                {u.username}
                {u.mustChangePassword && (
                  <span
                    data-testid={`must-change-${u.id}`}
                    title="Admin-issued password — the user must replace it at next sign-in"
                    className="ml-2 text-[10px] uppercase tracking-wider opacity-70 border border-[var(--fo-divider)] rounded px-1 py-0.5"
                  >
                    temp pw
                  </span>
                )}
              </td>
              <td>{u.displayName}</td>
              <td>
                <span className="text-xs uppercase tracking-wider">
                  {u.role}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  data-testid={`toggle-active-${u.id}`}
                  disabled={isSelf}
                  onClick={() => onToggleActive(u, !u.active)}
                  className="text-xs underline disabled:opacity-40 disabled:no-underline"
                  aria-label={u.active ? "Disable" : "Enable"}
                >
                  {u.active ? "✓" : "—"}
                </button>
              </td>
              <td className="text-right">
                <button
                  type="button"
                  data-testid={`edit-${u.id}`}
                  onClick={() => onEdit(u)}
                  className="text-xs underline mr-2"
                >
                  Edit
                </button>
                <button
                  type="button"
                  data-testid={`reset-password-${u.id}`}
                  onClick={() => onResetPassword(u)}
                  className="text-xs underline"
                >
                  Reset password
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
