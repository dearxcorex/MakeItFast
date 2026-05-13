import { getIronSession, sealData, unsealData, type IronSession } from "iron-session";
import { cookies } from "next/headers";

export const COOKIE_NAME = "fm_session";

export type SessionData = {
  userId: number;
  username: string;
  displayName: string;
  role: "admin" | "inspector";
  issuedAt: number;
};

function getPassword(): string {
  const p = process.env.SESSION_PASSWORD;
  if (!p || p.length < 32) {
    throw new Error(
      "SESSION_PASSWORD env var is missing or shorter than 32 chars."
    );
  }
  return p;
}

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionCookieMode = "persistent" | "session";

export function buildSessionOptions(mode: SessionCookieMode) {
  return {
    cookieName: COOKIE_NAME,
    password: getPassword(),
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      ...(mode === "persistent" ? { maxAge: SESSION_TTL_SECONDS } : {}),
    },
  };
}

/** For Route Handlers: returns the iron-session for the current request. */
export async function getSession(
  mode: SessionCookieMode = "persistent"
): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), buildSessionOptions(mode));
}

/** Encrypts a session payload into a cookie string. Used by the test helper. */
export async function sealSessionData(data: SessionData): Promise<string> {
  return sealData(data, { password: getPassword() });
}

function isSessionData(value: unknown): value is SessionData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.userId === "number" &&
    typeof v.username === "string" &&
    typeof v.displayName === "string" &&
    (v.role === "admin" || v.role === "inspector") &&
    typeof v.issuedAt === "number"
  );
}

/** Decrypts a cookie string back to a session payload. Returns null on tamper/expiry. */
export async function readSessionFromCookie(
  cookieValue: string | undefined
): Promise<SessionData | null> {
  if (!cookieValue) return null;
  try {
    const data = await unsealData<SessionData>(cookieValue, { password: getPassword() });
    // iron-session's unsealData may return an empty object on MAC failure
    // instead of throwing, so verify the payload shape.
    return isSessionData(data) ? data : null;
  } catch {
    return null;
  }
}
