"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  // We use a hard browser navigation after login (window.location.assign),
  // not Next.js router methods. Reasons:
  //   1. router.prefetch would follow the middleware's logged-out redirect
  //      to /login and cache the login page under the `/` key, then
  //      router.replace(next) would resolve from that poisoned cache.
  //   2. Even without prefetch, router.replace keeps the App Router client
  //      cache of the pre-login redirect response, so the navigation
  //      appears frozen until the user refreshes.
  // A hard navigation sidesteps both: the server re-renders `next` with the
  // freshly-set session cookie attached.

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password, rememberMe }),
      });
      if (res.ok) {
        window.location.assign(next);
        return;
      }
      if (res.status === 429) {
        setError("ลองใหม่อีกครั้งใน 15 นาที");
      } else {
        setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="field-ops-root min-h-screen flex items-center justify-center p-6"
      style={{
        background: "var(--fo-canvas)",
        color: "var(--fo-text)",
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl p-6 shadow-xl space-y-4"
        style={{
          background: "var(--fo-band)",
          color: "var(--fo-text)",
        }}
      >
        <h1 className="text-2xl font-semibold text-center">Field Ops</h1>

        <div>
          <label htmlFor="username" className="block text-sm mb-1">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-md border border-[var(--fo-divider)] bg-transparent px-3 py-2"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm mb-1">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--fo-divider)] bg-transparent px-3 py-2 pr-10"
              required
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
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          Remember me
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-[var(--fo-accent)] text-black font-medium py-2 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting && <span aria-hidden className="fo-spinner" />}
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
