import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { CopyablePassword } from "@/components/admin/CopyablePassword";
import { ResetPasswordModal } from "@/components/admin/ResetPasswordModal";
import { CreateUserModal } from "@/components/admin/CreateUserModal";
import type { PublicUser } from "@/types/user";

afterEach(cleanup);

const target: PublicUser = {
  id: 2,
  username: "alice",
  displayName: "Alice",
  role: "inspector",
  active: true,
  createdAt: "2026-01-02T00:00:00Z",
  createdBy: 1,
};

function okFetch(status = 200) {
  return vi.fn(async () => ({ ok: status < 400, status }) as Response);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("CopyablePassword", () => {
  it("renders the value in full — it is the only record of it", () => {
    render(<CopyablePassword value="Qw3!rtyUiop" />);
    expect(screen.getByTestId("handover-password").textContent).toBe(
      "Qw3!rtyUiop"
    );
  });

  it("copies to the clipboard and acknowledges", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<CopyablePassword value="Qw3!rtyUiop" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument()
    );
    expect(writeText).toHaveBeenCalledWith("Qw3!rtyUiop");
  });

  it("says so out loud when the clipboard API rejects", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
      configurable: true,
    });
    render(<CopyablePassword value="Qw3!rtyUiop" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    // A silent failure reads as "not clicked yet", so the admin pastes stale
    // clipboard contents and then dismisses the only copy of the password.
    await waitFor(() =>
      expect(screen.getByTestId("copy-failed")).toBeInTheDocument()
    );
    expect(screen.getByRole("alert").textContent).toMatch(/by hand/i);
    expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
    expect(screen.getByTestId("handover-password").textContent).toBe(
      "Qw3!rtyUiop"
    );
  });
});

describe("ResetPasswordModal", () => {
  it("generates a password that satisfies the submit gate", () => {
    render(
      <ResetPasswordModal user={target} onClose={() => {}} onDone={() => {}} />
    );
    fireEvent.click(screen.getByTestId("generate-password"));
    // Generating reveals the field, so it is readable as a text input.
    expect(screen.getByRole("button", { name: "Hide" })).toBeInTheDocument();
    const pw = document.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement | null;
    expect(pw?.value.length).toBeGreaterThanOrEqual(8);
    expect(
      screen.getByRole("button", { name: "Reset" }).hasAttribute("disabled")
    ).toBe(false);
  });

  it("shows the password once after a successful reset", async () => {
    vi.stubGlobal("fetch", okFetch());
    render(
      <ResetPasswordModal user={target} onClose={() => {}} onDone={() => {}} />
    );
    fireEvent.click(screen.getByTestId("generate-password"));
    const generated = (
      document.querySelector('input[type="text"]') as HTMLInputElement
    ).value;
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() =>
      expect(screen.getByTestId("handover-password").textContent).toBe(
        generated
      )
    );
    expect(document.body.textContent).toContain("only time it is shown");
  });

  it("does not close on its own — the admin must dismiss it", async () => {
    const onDone = vi.fn();
    vi.stubGlobal("fetch", okFetch());
    render(
      <ResetPasswordModal user={target} onClose={() => {}} onDone={onDone} />
    );
    fireEvent.click(screen.getByTestId("generate-password"));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() =>
      expect(screen.getByTestId("handover-password")).toBeInTheDocument()
    );
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalled();
  });

  it("surfaces a failed reset instead of a password", async () => {
    vi.stubGlobal("fetch", okFetch(500));
    render(
      <ResetPasswordModal user={target} onClose={() => {}} onDone={() => {}} />
    );
    fireEvent.click(screen.getByTestId("generate-password"));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/Failed/i)
    );
    expect(screen.queryByTestId("handover-password")).toBeNull();
  });
});

describe("CreateUserModal", () => {
  function fillForm() {
    fireEvent.change(screen.getByLabelText(/Username/), {
      target: { value: "carol" },
    });
    fireEvent.change(screen.getByLabelText(/Display name/), {
      target: { value: "Carol" },
    });
    fireEvent.click(screen.getByTestId("generate-password"));
  }

  it("hands the generated password over before closing", async () => {
    const onCreated = vi.fn();
    vi.stubGlobal("fetch", okFetch(201));
    render(<CreateUserModal onClose={() => {}} onCreated={onCreated} />);
    fillForm();
    // Only the password field carries an explicit type, and generating
    // flips it to "text"; the username/display-name inputs have none.
    const generated = (
      document.querySelector('input[type="text"]') as HTMLInputElement
    ).value;
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(screen.getByTestId("handover-password").textContent).toBe(
        generated
      )
    );
    expect(onCreated).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onCreated).toHaveBeenCalled();
  });

  it("keeps the form up when the username is taken", async () => {
    vi.stubGlobal("fetch", okFetch(409));
    render(<CreateUserModal onClose={() => {}} onCreated={() => {}} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(/taken/i)
    );
    expect(screen.queryByTestId("handover-password")).toBeNull();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });
});
