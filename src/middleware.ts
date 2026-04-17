import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Allow homepage + auth routes
  if (
    url.pathname === "/" ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/auth")
  ) {
    return NextResponse.next();
  }

  // Supabase SSR stores session in `sb-<project-ref>-auth-token` (and legacy names)
  const hasSession = req.cookies.getAll().some(
    (c) =>
      !!c.value &&
      (c.name.includes("-auth-token") ||
        c.name === "sb-access-token" ||
        c.name === "sb:token"),
  );

  // If NOT logged in → redirect to homepage
  if (!hasSession) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/lobby/:path*",
    "/dashboard/:path*",
    "/portal/:path*",
    "/profile/:path*",
    "/faq/:path*",
  ],
};
