import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, readSessionFromCookie } from "@/lib/session";
import { safeNextPath } from "@/lib/safeRedirect";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health"];
const ASSET_PREFIXES = ["/_next", "/favicon", "/tiles", "/icons"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (ASSET_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  // Static files (anything with a dot, e.g. /robots.txt)
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;
  return false;
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

// Reachable while a forced password change is pending. Everything else is
// blocked, so a user handed an admin-issued password cannot use the app until
// they replace it — /logout stays open so they can always back out.
const CHANGE_PASSWORD_PATH = "/change-password";
const PASSWORD_CHANGE_ALLOWED = [
  CHANGE_PASSWORD_PATH,
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/auth/me",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Already-logged-in users hitting /login bounce to their `next` param or /.
  // The POST /api/auth/login allow-list stays open so the form can still submit
  // (logout-then-relogin and password-managers depend on it).
  if (pathname === "/login") {
    const cookieValue = req.cookies.get(COOKIE_NAME)?.value;
    const session = await readSessionFromCookie(cookieValue);
    if (session) {
      const target = safeNextPath(req.nextUrl.searchParams.get("next"));
      return NextResponse.redirect(new URL(target, req.url), 307);
    }
    return NextResponse.next();
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const cookieValue = req.cookies.get(COOKIE_NAME)?.value;
  const session = await readSessionFromCookie(cookieValue);

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "not_authenticated" },
        { status: 401 }
      );
    }
    const next = encodeURIComponent(pathname);
    const loginUrl = new URL(`/login?next=${next}`, req.url);
    return NextResponse.redirect(loginUrl, 307);
  }

  if (session.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.includes(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "password_change_required" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, req.url), 307);
  }

  if (isAdminPath(pathname) && session.role !== "admin") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url), 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
