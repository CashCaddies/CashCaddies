import { NextResponse, type NextRequest } from "next/server";

/**
 * Passthrough (no Supabase, no redirects): the previous middleware awaited
 * `getSession` + `profiles` on every matched route and redirected unapproved users —
 * that blocked navigations for seconds. Restore closed-beta gating when you have a
 * faster strategy (cached JWT claims, edge config, or client-only gates).
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/lobby/:path*",
    "/dashboard/:path*",
    "/lineups/:path*",
    "/leaderboard/:path*",
    "/contests/:path*",
    "/contest/:path*",
    "/lineup/:path*",
    "/profile/:path*",
    "/wallet/:path*",
    "/admin/:path*",
    "/lineup-builder/:path*",
  ],
};
