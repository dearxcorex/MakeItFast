import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import ChangePasswordPage from "@/app/change-password/page";

afterEach(cleanup);

const assign = vi.fn();

/** Queues responses: first call is /api/auth/me, second is the POST. */
function mockFetch(responses: Array<Partial<Response> | Error>) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(i++, responses.length - 1)];
    if (r instanceof Error) throw r;
    return r as Response;
  });
}

const meOk = (mustChangePassword: boolean) => ({
  ok: true,
  status: 200,
  json: async () => ({ user: { mustChangePassword } }),
});

const err = (status: number, error?: string) => ({
  ok: false,
  status,
  json: async () => (error ? { error } : {}),
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    value: { assign, href: "http://localhost/change-password" },
    writable: true,
    configurable: true,
  });
});

async function renderForced(extra: Array<Partial<Response> | Error> = []) {
  vi.stubGlobal("fetch", mockFetch([meOk(true), ...extra]));
  render(<ChangePasswordPage />);
  await screen.findByText("ตั้งรหัสผ่านของคุณ");
}

async function renderVoluntary(extra: Array<Partial<Response> | Error> = []) {
  vi.stubGlobal("fetch", mockFetch([meOk(false), ...extra]));
  render(<ChangePasswordPage />);
  await screen.findByText("เปลี่ยนรหัสผ่าน");
}

function fill(newPw = "BrandNewPass1", current?: string) {
  if (current !== undefined) {
    fireEvent.change(screen.getByLabelText("รหัสผ่านปัจจุบัน"), {
      target: { value: current },
    });
  }
  fireEvent.change(screen.getByLabelText("รหัสผ่านใหม่"), {
    target: { value: newPw },
  });
  fireEvent.change(screen.getByLabelText("ยืนยันรหัสผ่านใหม่"), {
    target: { value: newPw },
  });
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "บันทึกรหัสผ่าน" }));

describe("ChangePasswordPage bootstrap", () => {
  it("hides the current-password field when the server says forced", async () => {
    await renderForced();
    expect(screen.queryByLabelText("รหัสผ่านปัจจุบัน")).toBeNull();
  });

  it("bounces a dead session to login instead of rendering a dead form", async () => {
    vi.stubGlobal("fetch", mockFetch([err(401)]));
    render(<ChangePasswordPage />);
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("/login?next=%2Fchange-password")
    );
  });
});

describe("ChangePasswordPage error reporting", () => {
  it("does not blame password length for an expired session", async () => {
    await renderForced([err(401, "not_authenticated")]);
    fill();
    submit();
    // The old mapping showed "at least 8 characters" here, so the user retyped
    // ever-longer passwords instead of signing in again.
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("/login?next=%2Fchange-password")
    );
  });

  it("reports a server fault as a fault, not a validation problem", async () => {
    await renderForced([err(500)]);
    fill();
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/เกิดข้อผิดพลาด/);
    expect(alert.textContent).not.toMatch(/8 ตัวอักษร/);
  });

  it("still reports a genuinely short password as short", async () => {
    await renderForced([err(400, "validation_error")]);
    fill();
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/อย่างน้อย 8 ตัวอักษร/);
  });

  it("distinguishes a wrong current password from a dead session", async () => {
    await renderVoluntary([err(401, "invalid_credentials")]);
    fill("BrandNewPass1", "wrong-one");
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/รหัสผ่านปัจจุบันไม่ถูกต้อง/);
    expect(assign).not.toHaveBeenCalled();
  });

  it("reveals the current-password field when the server starts demanding it", async () => {
    // The account left the forced state between page load and submit, so the
    // message named an input that was not on screen.
    await renderForced([err(400, "current_password_required")]);
    expect(screen.queryByLabelText("รหัสผ่านปัจจุบัน")).toBeNull();
    fill();
    submit();
    await waitFor(() =>
      expect(screen.getByLabelText("รหัสผ่านปัจจุบัน")).toBeInTheDocument()
    );
    expect(screen.getByRole("alert").textContent).toMatch(
      /กรอกรหัสผ่านปัจจุบัน/
    );
  });
});

describe("ChangePasswordPage network failure", () => {
  it("releases the submit button when the request never lands", async () => {
    await renderForced([new Error("offline")]);
    fill();
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
    // Middleware blocks every other route while a change is pending, so a
    // permanently disabled button leaves the user with no way forward.
    expect(
      screen.getByRole("button", { name: "บันทึกรหัสผ่าน" })
    ).not.toBeDisabled();
  });
});

describe("ChangePasswordPage success", () => {
  it("hard-navigates home so the cached middleware redirect is dropped", async () => {
    await renderForced([{ ok: true, status: 200, json: async () => ({}) }]);
    fill();
    submit();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
  });
});
