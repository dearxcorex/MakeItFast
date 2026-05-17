import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { UserList } from "@/components/admin/UserList";
import type { PublicUser } from "@/types/user";

afterEach(cleanup);

const users: PublicUser[] = [
  {
    id: 1,
    username: "boss",
    displayName: "Boss",
    role: "admin",
    active: true,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: null,
  },
  {
    id: 2,
    username: "alice",
    displayName: "Alice",
    role: "inspector",
    active: true,
    createdAt: "2026-01-02T00:00:00Z",
    createdBy: 1,
  },
  {
    id: 3,
    username: "bob",
    displayName: "Bob",
    role: "inspector",
    active: false,
    createdAt: "2026-01-03T00:00:00Z",
    createdBy: 1,
  },
];

describe("UserList", () => {
  it("renders one row per user with username and display name", () => {
    render(
      <UserList
        users={users}
        currentUserId={1}
        onResetPassword={() => {}}
        onEdit={() => {}}
        onToggleActive={() => {}}
      />
    );
    expect(screen.getByText("boss")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("dims inactive users", () => {
    const { container } = render(
      <UserList
        users={users}
        currentUserId={1}
        onResetPassword={() => {}}
        onEdit={() => {}}
        onToggleActive={() => {}}
      />
    );
    const bobRow = container.querySelector('[data-userid="3"]');
    expect(bobRow?.className).toMatch(/opacity-/);
  });

  it("disables destructive actions on the self row", () => {
    render(
      <UserList
        users={users}
        currentUserId={1}
        onResetPassword={() => {}}
        onEdit={() => {}}
        onToggleActive={() => {}}
      />
    );
    const disableSelf = screen
      .getByTestId("toggle-active-1")
      .getAttribute("disabled");
    expect(disableSelf).not.toBeNull();
  });

  it("fires onResetPassword when button clicked", () => {
    const onReset = vi.fn();
    render(
      <UserList
        users={users}
        currentUserId={1}
        onResetPassword={onReset}
        onEdit={() => {}}
        onToggleActive={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId("reset-password-2"));
    expect(onReset).toHaveBeenCalledWith(users[1]);
  });
});
