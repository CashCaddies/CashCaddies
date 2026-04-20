import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import { DebugOutlineStrip } from "@/components/debug-outline-strip";
import { ConditionalBetaBanner } from "@/components/conditional-beta-banner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import SoftLaunchCountdown from "@/components/SoftLaunchCountdown";
import SupabaseProvider from "@/lib/supabase-provider";
import "./globals.css";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // --- SUPABASE SERVER CLIENT ---
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op in layout
        },
      },
    },
  );

  // --- GET USER ---
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- GET CURRENT PATH ---
  const headerList = await headers();
  let pathname =
    headerList.get("x-pathname") ||
    headerList.get("next-url") ||
    "";

  if (pathname.startsWith("http")) {
    try {
      pathname = new URL(pathname).pathname;
    } catch {
      pathname = "";
    }
  } else if (pathname.includes("?")) {
    pathname = pathname.split("?")[0] ?? pathname;
  }

  // --- BETA ACCESS CHECK ---
  if (user && pathname) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("beta_access")
      .eq("id", user.id)
      .maybeSingle();

    const hasAccess = profile?.beta_access === true;

    const allowedPaths =
      pathname === "/" ||
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/api");

    if (!hasAccess && !allowedPaths) {
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
