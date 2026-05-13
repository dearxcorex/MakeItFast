import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, readSessionFromCookie } from "@/lib/session";

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
