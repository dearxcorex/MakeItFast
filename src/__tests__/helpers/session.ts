import { sealSessionData, COOKIE_NAME, type SessionData } from "@/lib/session";

/**
 * Builds a valid encrypted session cookie value for tests.
 * The header form is `${COOKIE_NAME}=<sealed>` suitable for `Cookie` headers.
 */
export async function mintCookie(
  override: Partial<SessionData> = {}
): Promise<{ name: string; value: string; header: string }> {
  process.env.SESSION_PASSWORD =
    process.env.SESSION_PASSWORD ??
    "test-session-password-32-chars-or-more!!!";

  const data: SessionData = {
    userId: 1,
    username: "tester",
    displayName: "Tester",
    role: "inspector",
    issuedAt: Date.now(),
    ...override,
  };
  const value = await sealSessionData(data);
  return { name: COOKIE_NAME, value, header: `${COOKIE_NAME}=${value}` };
}

export async function mintAdminCookie(override: Partial<SessionData> = {}) {
  return mintCookie({ role: "admin", ...override });
}
