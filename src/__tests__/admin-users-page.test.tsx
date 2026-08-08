import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import AdminUsersPage from "@/app/admin/users/page";

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
    user: { id: 1, username: "boss", displayName: "Boss", role: "admin" },
    loading: false,
  }),
}));

afterEach(cleanup);

const alice = {
  id: 2,
  username: "alice",
  displayName: "Alice",
  role: "inspector" as const,
  active: true,
  createdAt: "2026-01-02T00:00:00Z",
  createdBy: 1,
  mustChangePassword: false,
};

/** Serves the user list, flipping the temp-pw flag once a reset has happened. */
function serveList() {
  let resetHappened = false;
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/admin/users") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          users: [
            { ...alice, mustChangePassword: resetHappened },
          ],
        }),
      } as unknown as Response;
    }
    if (url.endsWith("/reset-password") && init?.method === "POST") {
      resetHappened = true;
      return { ok: true, status: 200 } as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminUsersPage reset flow", () => {
  it("refetches on Done so the temp-pw badge appears", async () => {
    // Without the refetch the list still shows no badge, so an admin can't
    // tell the reset landed and may reset again — invalidating the password
    // they already handed over.
    vi.stubGlobal("fetch", serveList());
    render(<AdminUsersPage />);

    await screen.findByText("alice");
    expect(screen.queryByTestId("must-change-2")).toBeNull();

    fireEvent.click(screen.getByTestId("reset-password-2"));
    fireEvent.click(screen.getByTestId("generate-password"));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    await screen.findByTestId("handover-password");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() =>
      expect(screen.getByTestId("must-change-2")).toBeInTheDocument()
    );
  });

  it("closes the modal on Done", async () => {
    vi.stubGlobal("fetch", serveList());
    render(<AdminUsersPage />);
    await screen.findByText("alice");

    fireEvent.click(screen.getByTestId("reset-password-2"));
    fireEvent.click(screen.getByTestId("generate-password"));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await screen.findByTestId("handover-password");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() =>
      expect(screen.queryByTestId("handover-password")).toBeNull()
    );
  });
});
