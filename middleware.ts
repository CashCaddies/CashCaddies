import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === "/" ||
    pathname.startsWith("/faq") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const cookies = req.cookies;

  const hasSession =
    cookies.get("sb-access-token") ||
    cookies.get("sb-refresh-token") ||
    cookies.get("supabase-auth-token") ||
    cookies.get("sb:token") ||
    cookies.get("sb-access-token.0") ||
    cookies.get("sb-access-token.1") ||
    cookies.getAll().some((c) => !!c.value && c.name.includes("-auth-token"));

  if (!hasSession && pathname.startsWith("/dashboard")) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
