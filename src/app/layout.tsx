import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppProviders } from "@/components/app-providers";
import { DebugOutlineStrip } from "@/components/debug-outline-strip";
import { ConditionalBetaBanner } from "@/components/conditional-beta-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import SoftLaunchCountdown from "@/components/SoftLaunchCountdown";
import { isAdmin } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import SupabaseProvider from "@/lib/supabase-provider";
import "./globals.css";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ogImageUrl = "/logo.png?v=1";

export const metadata: Metadata = {
  metadataBase: new URL("https://cashcaddies.com"),

  title: "CashCaddies",

  description: "Daily Fantasy Golf",

  openGraph: {
    title: "CashCaddies",
    description: "Daily Fantasy Golf",
    images: [
      {
        url: ogImageUrl,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "CashCaddies",
    description: "Daily Fantasy Golf",
    images: [ogImageUrl],
  },
};

async function pathnameFromHeaders(): Promise<string> {
  const headerList = await headers();
  let pathname = headerList.get("next-url") || "";

  if (pathname.startsWith("http")) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      pathname = "";
    }
  } else if (pathname.includes("?")) {
    pathname = pathname.split("?")[0] ?? pathname;
  }

  if (!pathname) {
    const referer = headerList.get("referer");
    const host = headerList.get("host");
    if (referer && host && referer.includes(host)) {
      try {
        pathname = new URL(referer).pathname;
      } catch {
        pathname = "";
      }
    }
  }

  if (pathname.includes("#")) {
    pathname = pathname.split("#")[0] ?? pathname;
  }

  return pathname || "";
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/login" || pathname === "/signup") return true;
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) return true;
  return false;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = await pathnameFromHeaders();
  const isPublicRoute = isPublicPath(pathname);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicRoute) {
    redirect("/");
  }

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    let isApproved = false;
    if (!profileError && profile) {
      const p = profile as {
        beta_status?: string | null;
        beta_access?: boolean | null;
        role?: string | null;
        founding_tester?: boolean | null;
      };
      isApproved =
        p.beta_status === "approved" ||
        p.beta_access === true ||
        isAdmin(p.role) ||
        p.founding_tester === true;
    }

    if (!isApproved && !isPublicRoute) {
      redirect("/");
    }
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-slate-950 text-slate-100">
        <DebugOutlineStrip />
        <div className="app-shell">
          <div className="app-container">
            <SupabaseProvider>
              <AppProviders>
                {/* No overflow-y on this wrapper — it clipped header tooltips (portal golf ball). Body scrolls. */}
                <div className="flex min-h-[100dvh] flex-1 flex-col overflow-visible">
                  <SiteHeader />
                  <SoftLaunchCountdown />
                  <ConditionalBetaBanner />
                  <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</main>
                  <SiteFooter />
                </div>
              </AppProviders>
            </SupabaseProvider>
            <script
              dangerouslySetInnerHTML={{
                __html: `
      setInterval(() => {
        document.querySelectorAll('select').forEach(el => {
          el.style.display = 'none';
        });
      }, 500);
    `,
              }}
            />
          </div>
        </div>
      </body>
    </html>
  );
}
