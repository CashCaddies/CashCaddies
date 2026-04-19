import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/faq") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/fair-play") ||
    pathname.startsWith("/closed-beta") ||
    pathname.startsWith("/early-access") ||
    pathname.startsWith("/patch-notes") ||
    pathname.startsWith("/beta-pending") ||
    pathname.startsWith("/feedback");

  if (!isPublicRoute && !user) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("next", pathname + req.nextUrl.search);
    const redirect = NextResponse.redirect(redirectUrl);
    // Keep any Set-Cookie headers from Supabase (e.g. token refresh) on the redirect response
    const setCookieHeaders = res.headers.getSetCookie();
    for (const c of setCookieHeaders) {
      redirect.headers.append("Set-Cookie", c);
    }
    return redirect;
  }

  return res;
}

export const config = {
  matcher: [
    /*
      Protect everything except:
      - static files
      - _next
    */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
