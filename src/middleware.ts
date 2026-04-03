import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasClosedBetaAppAccess } from "@/lib/closed-beta-access";

/**
 * Closed beta: `hasClosedBetaAppAccess` (role + beta fields; staff = `admin`/`senior_admin` role).
 * Unauthenticated users → `/closed-beta`.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/closed-beta") ||
    pathname.startsWith("/early-access") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/update-password")
  ) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(new URL("/closed-beta", request.url));
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileErr) {
    return NextResponse.next();
  }

  const roleRaw = profile?.role;
  if (
    !hasClosedBetaAppAccess(
      { beta_user: profile?.beta_user, beta_status: profile?.beta_status },
      roleRaw,
    )
  ) {
    return NextResponse.redirect(new URL("/closed-beta", request.url));
  }

  return response;
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
