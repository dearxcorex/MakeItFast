import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: replaceMock, prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams("next=%2F"),
}));

beforeEach(() => {
  replaceMock.mockClear();
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  it("renders username, password, remember-me, submit", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remember me/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("submits and redirects on success", async () => {
    // jsdom marks window.location.assign non-configurable, so vi.spyOn
    // can't reassign it. Swap the whole location object for a stub —
    // the login flow now uses a hard navigation to bust Next.js's App
    // Router client cache after the session cookie lands.
    const assignSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...originalLocation, assign: assignSpy },
    });
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 1 } }), { status: 200 }) as any
    );
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "hunter2!!" },
    });
    fireEvent.click(screen.getByLabelText(/remember me/i));
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith("/"));
    const call = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({
      username: "alice",
      password: "hunter2!!",
      rememberMe: true,
    });
  });

  it("shows error on 401", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_credentials" }), {
        status: 401,
      }) as any
    );
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง/)
      ).toBeInTheDocument()
    );
  });

  it("shows throttle message on 429", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "too_many_attempts" }), {
        status: 429,
      }) as any
    );
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByText(/ลองใหม่อีกครั้งใน 15 นาที/)).toBeInTheDocument()
    );
  });
});
