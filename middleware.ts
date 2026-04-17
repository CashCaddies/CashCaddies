import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow ONLY homepage + auth routes (+ public FAQ)
  if (
    pathname === "/" ||
    pathname.startsWith("/faq") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".") // static files
  ) {
    return NextResponse.next();
  }

  // API routes must not be redirected (webhooks, server handlers use their own auth)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // FORCE check for ANY possible auth cookie
  const cookies = req.cookies;

  const hasSession =
    cookies.get("sb-access-token") ||
    cookies.get("sb-refresh-token") ||
    cookies.get("supabase-auth-token") ||
    cookies.get("sb:token") ||
    cookies.get("sb-access-token.0") ||
    cookies.get("sb-access-token.1") ||
    cookies.getAll().some((c) => !!c.value && c.name.includes("-auth-token"));

  // NOT logged in → HARD REDIRECT
  if (!hasSession) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

// MATCH EVERYTHING EXCEPT STATIC
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
